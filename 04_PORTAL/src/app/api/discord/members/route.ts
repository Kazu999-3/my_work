import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { resolveDisplayName } from '../../../../lib/discordName';
import { verifyAdminSession } from '../../../../lib/adminAuth';




export async function GET(request: Request) {
  // ===== 管理者セッション確認 =====
  // ktm-adminのDiscord同期モーダル専用のエンドポイント（Discordサーバーの全メンバー情報を返す）のため保護する。
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
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
    
    const dbPlayersMap = new Map();
    dbPlayers.forEach((p: any) => {
      dbPlayersMap.set(p.discord_id || p.name.toLowerCase(), p);
    });

    const discordIdsFound = new Set();
    const toUpdateName: any[] = [];

    humanMembers.forEach(m => {
      const discordId = m.user.id;
      const displayName = resolveDisplayName(m);
      discordIdsFound.add(discordId);

      let dbPlayer = dbPlayersMap.get(discordId);
      if (!dbPlayer) {
         const byName = dbPlayers.find((p: any) => p.name.toLowerCase() === displayName.toLowerCase());
         if (byName) dbPlayer = byName;
      }

      if (!dbPlayer) {
        toAdd.push({
          discord_id: discordId,
          name: displayName,
          ign: `${m.user.username}#...`, // ダミー
          role_preferences: { primary: "ALL", secondary: "-", ignore_role: "-" },
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

        activeSync.push({
          ...dbPlayer,
          name: displayName,
          metadata: { ...(dbPlayer.metadata || {}), joined_at: m.joined_at }
        });
      }
    });

    // DBにはいるが、Discordにいない人（Active/Inactive問わず）
    dbPlayers.forEach((p: any) => {
      if (p.discord_id) {
        // IDで判定
        if (!discordIdsFound.has(p.discord_id)) {
          toDeactivate.push(p);
        }
      } else {
        // IDが未登録の場合は名前で判定
        const found = humanMembers.some(m => {
          const displayName = resolveDisplayName(m);
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
  // ===== 管理者セッション確認 =====
  // プレイヤー名簿への追加・非アクティブ化・メタデータ上書きを行う書き込みAPIのため保護する。
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
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
          const addData = add.map((p: any) => {
            // role_preferences.ignore_role を ng_lane_1 カラムに展開する
            // （parseIntroduction() の検出結果を DB のトップレベルカラムへ正しく反映）
            const ignoreRole = p.role_preferences?.ignore_role;
            const ng_lane_1 = (ignoreRole && ignoreRole !== '-') ? ignoreRole : (p.ng_lane_1 || null);
            const ng_lane_2 = p.ng_lane_2 || null;

            return {
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
              is_active: p.is_active ?? false,
              ng_lane_1, // ★ バグ修正: Discord自己紹介から解析したNGレーンをDBへ書き込む
              ng_lane_2, // ★ バグ修正: ng_lane_2 も同様に引き継ぎ
            };
          });

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

    // 既存プレイヤーのメタデータ(joined_at等)や名前の更新処理（差分がある場合のみ並列で高速更新）
    if (update_metadata && update_metadata.length > 0) {
      const { data: dbPlayers } = await supabase
        .from('ktm_players')
        .select('id, name, metadata');

      const dbPlayerMap = new Map();
      (dbPlayers || []).forEach((p: any) => dbPlayerMap.set(p.id, p));

      const updatePromises = [];

      for (const p of update_metadata) {
        if (!p.id) continue;
        const dbPlayer = dbPlayerMap.get(p.id);
        if (!dbPlayer) continue;

        const isNameChanged = dbPlayer.name !== p.name;
        const isMetaChanged = JSON.stringify(dbPlayer.metadata || {}) !== JSON.stringify(p.metadata || {});

        if (isNameChanged || isMetaChanged) {
          const oldName = dbPlayer.name;
          const newName = p.name;

          const updatePromise = (async () => {
            const { error: updateError } = await supabase
              .from('ktm_players')
              .update({ 
                metadata: p.metadata,
                name: newName
              })
              .eq('id', p.id);
            
            if (updateError) {
              console.error(`Player update failed for ID ${p.id}:`, updateError);
            } else if (isNameChanged) {
              console.log(`[Discord Sync Name Change] Updating matches for ${oldName} -> ${newName}`);
              const { error: matchesUpdateError } = await supabase
                .from('ktm_match_participants')
                .update({ player_name: newName })
                .eq('player_name', oldName);
              if (matchesUpdateError) {
                console.error(`Failed to update matches for ${oldName} -> ${newName}:`, matchesUpdateError);
              }
            }
          })();

          updatePromises.push(updatePromise);
        }
      }

      if (updatePromises.length > 0) {
        console.log(`[Discord Sync POST] Executing parallel update for ${updatePromises.length} players with differences.`);
        await Promise.all(updatePromises);
      }
    }

    return NextResponse.json({ success: true, message: `Added ${add?.length || 0}, Deactivated ${deactivate?.length || 0}, Updated ${update_metadata?.length || 0}` });
  } catch (error: any) {
    console.error('Discord Sync POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
