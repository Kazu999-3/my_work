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
        });
      } else {
        activeSync.push(dbPlayer);
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
      totalDiscordMembers: humanMembers.length,
    });
  } catch (error: any) {
    console.error('Discord Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { add, deactivate } = await request.json();
    
    // 追加処理
    if (add && add.length > 0) {
      const newPlayers = add.map((p: any) => ({
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
        is_active: true
      }));

      const { error: addError } = await supabase.from('ktm_players').insert(newPlayers);
      if (addError) throw addError;
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

    return NextResponse.json({ success: true, message: `Added ${add?.length || 0}, Deactivated ${deactivate?.length || 0}` });
  } catch (error: any) {
    console.error('Discord Sync POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
