import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
    
    // 追加処理
    if (add && add.length > 0) {
      // データベースから最新の discord_id 一覧を取得して競合を防ぐ
      const { data: existingPlayers, error: fetchError } = await supabase
        .from('ktm_players')
        .select('discord_id')
        .not('discord_id', 'is', null);

      if (fetchError) throw fetchError;

      const existingIds = new Set(existingPlayers.map(p => p.discord_id));

      // すでにDBに存在する discord_id は除外する
      const filteredAdd = add.filter((p: any) => p.discord_id && !existingIds.has(p.discord_id));

      // リクエスト(add配列)内での重複も排除する
      const uniqueAdd: any[] = [];
      const seenIds = new Set();
      for (const p of filteredAdd) {
        if (!seenIds.has(p.discord_id)) {
          seenIds.add(p.discord_id);
          uniqueAdd.push(p);
        }
      }

      if (uniqueAdd.length > 0) {
        const newPlayers = uniqueAdd.map((p: any) => ({
          discord_id: p.discord_id,
          name: p.name,
          ign: p.ign || 'Unknown#0000',
          highest_rank: 'UNRANKED',
          role_preferences: { primary: 'ALL', secondary: 'FILL' },
          mmr: 1200,
          mmr_top: 1000,
          mmr_jg: 1000,
          mmr_mid: 1000,
          mmr_adc: 1000,
          mmr_sup: 1000,
          is_active: true,
          metadata: p.metadata || {}
        }));

        const { error: addError } = await supabase.from('ktm_players').insert(newPlayers);
        if (addError) throw addError;
      }
    }

    // 削除処理
    if (deactivate && deactivate.length > 0) {
      const idsToDeactivate = deactivate.map((p: any) => p.id);
      const { error: deactError } = await supabase
        .from('ktm_players')
        .delete()
        .in('id', idsToDeactivate);
      
      if (deactError) throw deactError;
    }

    // 既存プレイヤーのメタデータ(joined_at等)や名前の更新処理
    if (update_metadata && update_metadata.length > 0) {
      for (const p of update_metadata) {
        if (p.id) {
          const { error: updateError } = await supabase
            .from('ktm_players')
            .update({ 
              metadata: p.metadata,
              name: p.name // Discordの最新の表示名で上書き保存する
            })
            .eq('id', p.id);
          if (updateError) console.error(`Player update failed for ID ${p.id}:`, updateError);
        }
      }
    }

    return NextResponse.json({ success: true, message: `Added ${add?.length || 0}, Deactivated ${deactivate?.length || 0}, Updated ${update_metadata?.length || 0}` });
  } catch (error: any) {
    console.error('Discord Sync POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
