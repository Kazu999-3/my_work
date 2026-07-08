import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    return NextResponse.json({ error: 'Discord credentials not configured' }, { status: 500 });
  }

  try {
    // 1. Discordからメンバー一覧を取得
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=1000`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Failed to fetch Discord members: ${errorText}` }, { status: res.status });
    }

    const discordMembers: any[] = await res.json();
    
    // Botを除外
    const humanMembers = discordMembers.filter(m => !m.user.bot);

    // 2. DBから現在のプレイヤー一覧を取得
    const { data: dbPlayers, error: dbError } = await supabase
      .from('ktm_players')
      .select('*');

    if (dbError) throw dbError;

    // 3. 差分を計算
    const toAdd: any[] = [];
    const toDeactivate: any[] = [];
    const activeSync: any[] = [];

    // Discord名とDB名をマッピングする
    // DBには 'name' (表示名/呼び名) と 'discord_id' があるはず。
    // 無ければ name でマッチング（Discordの global_name や username と比較）
    
    const dbPlayersMap = new Map();
    dbPlayers.forEach(p => {
      // discord_id が登録されていればそれをキーに、なければ name をキーにするなどの工夫が必要だが、
      // 基本は discord_id ベース、無い場合は手動追加されたものとして名前でマッチ。
      dbPlayersMap.set(p.discord_id || p.name.toLowerCase(), p);
    });

    const discordIdsFound = new Set();
    const toUpdateName: any[] = [];

    humanMembers.forEach(m => {
      const discordId = m.user.id;
      const displayName = m.nick || m.user.global_name || m.user.username;
      discordIdsFound.add(discordId);

      // discord_idで検索、なければ名前で検索
      let dbPlayer = dbPlayersMap.get(discordId);
      if (!dbPlayer) {
         const byName = dbPlayers.find(p => p.name.toLowerCase() === displayName.toLowerCase());
         if (byName) dbPlayer = byName;
      }

      if (!dbPlayer) {
        toAdd.push({
          discord_id: discordId,
          name: displayName,
          ign: `${m.user.username}#...`, // ダミー
          metadata: { joined_at: m.joined_at }
        });
      } else {
        const nameChanged = dbPlayer.name !== displayName;
        if (nameChanged) {
          toUpdateName.push({
            id: dbPlayer.id,
            oldName: dbPlayer.name,
            newName: displayName,
            discord_id: discordId
          });
        }

        // joined_atが未保存、または更新が必要な場合のために保持
        activeSync.push({
          ...dbPlayer,
          name: displayName, // 最新のDiscord名に同期させる
          metadata: { ...(dbPlayer.metadata || {}), joined_at: m.joined_at }
        });
      }
    });

    // DBにはいるが、Discordにいない人（Active/Inactive問わず）
    dbPlayers.forEach(p => {
      if (p.discord_id) {
        // IDで判定
        if (!discordIdsFound.has(p.discord_id)) {
          toDeactivate.push(p);
        }
      } else {
        // IDが未登録の場合は名前で判定
        const found = humanMembers.some(m => {
          const displayName = m.nick || m.user.global_name || m.user.username;
          return displayName.toLowerCase() === p.name.toLowerCase();
        });
        if (!found) {
          toDeactivate.push(p);
        }
      }
    });

    return NextResponse.json({
      toAdd,
      toDeactivate,
      activeSync,
      toUpdateName,
      totalDiscordMembers: humanMembers.length,
    });
  } catch (error: any) {
    console.error('Discord Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { add, deactivate, update_metadata } = await request.json();
    
    // 追加・削除処理を FastAPI (Sovereign Core API) へ委譲 (Proxy)
    if ((add && add.length > 0) || (deactivate && deactivate.length > 0)) {
      // 本番環境など、FastAPI がローカル同居していない場合は直接 Supabase を叩くようにフォールバック
      const isLocalhostFastApi = process.env.NODE_ENV === 'development' && !process.env.SKIP_FASTAPI_PROXY;
      const fastapiUrl = process.env.FASTAPI_API_URL || 'http://localhost:8000/api/v1/players/sync';
      
      let proxySuccess = false;
      
      if (isLocalhostFastApi) {
        try {
          const apiKey = process.env.ANTIGRAVITY_API_KEY || 'default_dev_key_2026';
          const response = await fetch(fastapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Antigravity-Key': apiKey
            },
            body: JSON.stringify({ add: add || [], deactivate: deactivate || [] })
          });

          if (response.ok) {
            proxySuccess = true;
          } else {
            const errText = await response.text();
            console.warn(`[Discord Sync POST] FastAPI proxy failed, fallback to direct Supabase. Error: ${errText}`);
          }
        } catch (e: any) {
          console.warn(`[Discord Sync POST] FastAPI is offline, fallback to direct Supabase. Error: ${e.message}`);
        }
      }

      if (!proxySuccess) {
        console.log(`[Discord Sync POST] Executing direct Supabase sync (Add: ${add?.length || 0}, Deactivate: ${deactivate?.length || 0})`);
        
        // (A) 新規プレイヤーの一括インサート/アップサート
        if (add && add.length > 0) {
          const addData = add.map((p: any) => ({
            discord_id: p.discord_id,
            name: p.name,
            ign: p.ign,
            highest_rank: p.highest_rank,
            role_preferences: p.role_preferences,
            mmr: p.mmr,
            mmr_top: p.mmr_top,
            mmr_jg: p.mmr_jg,
            mmr_mid: p.mmr_mid,
            mmr_adc: p.mmr_adc,
            mmr_sup: p.mmr_sup,
            is_active: p.is_active ?? true
          }));

          const { error: upsertError } = await supabase
            .from('ktm_players')
            .upsert(addData, { onConflict: 'discord_id' });

          if (upsertError) {
            throw new Error(`Direct Database upsert error: ${upsertError.message}`);
          }
        }

        // (B) プレイヤーの物理削除
        if (deactivate && deactivate.length > 0) {
          const idsToDelete = deactivate.map((p: any) => p.id).filter(Boolean);
          if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
              .from('ktm_players')
              .delete()
              .in('id', idsToDelete);

            if (deleteError) {
              throw new Error(`Direct Database delete error: ${deleteError.message}`);
            }
          }
        }
      }
    }

    // 既存プレイヤーのメタデータ(joined_at等)や名前の更新処理
    if (update_metadata && update_metadata.length > 0) {
      for (const p of update_metadata) {
        if (p.id) {
          const { data: oldPlayer } = await supabase
            .from('ktm_players')
            .select('name')
            .eq('id', p.id)
            .single();

          const oldName = oldPlayer?.name;
          const newName = p.name;

          const { error: updateError } = await supabase
            .from('ktm_players')
            .update({ 
              metadata: p.metadata,
              name: newName
            })
            .eq('id', p.id);
          
          if (updateError) {
            console.error(`Player update failed for ID ${p.id}:`, updateError);
          } else if (oldName && oldName !== newName) {
            console.log(`[Discord Sync Name Change] Updating matches for ${oldName} -> ${newName}`);
            const { error: matchesUpdateError } = await supabase
              .from('ktm_match_participants')
              .update({ player_name: newName })
              .eq('player_name', oldName);
            if (matchesUpdateError) {
              console.error(`Failed to update matches for ${oldName} -> ${newName}:`, matchesUpdateError);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: `Added ${add?.length || 0}, Deactivated ${deactivate?.length || 0}, Updated ${update_metadata?.length || 0}` });
  } catch (error: any) {
    console.error('Discord Sync POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
