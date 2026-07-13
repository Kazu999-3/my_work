import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

  if (!DISCORD_BOT_TOKEN) {
    return NextResponse.json({ error: 'Discord BOT Token is not configured' }, { status: 500 });
  }

  try {
    // 1. ktm_players から discord_id が設定されている全プレイヤーを取得
    const { data: players, error: fetchError } = await supabase
      .from('ktm_players')
      .select('id, discord_id, name')
      .not('discord_id', 'is', null)
      .not('discord_id', 'eq', '');

    if (fetchError) throw fetchError;
    if (!players || players.length === 0) {
      return NextResponse.json({ message: 'No players with discord_id found.' });
    }

    // 2. Discord APIを叩いて最新のユーザー名を取得
    const updatedPlayers = [];
    for (const player of players) {
      try {
        const userRes = await fetch(`https://discord.com/api/v10/users/${player.discord_id}`, {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        });
        
        if (userRes.ok) {
          const userData = await userRes.json();
          const latestName = userData.global_name || userData.username || player.name;
          if (latestName !== player.name) {
            updatedPlayers.push({ id: player.id, name: latestName, oldName: player.name });
            // 3. Supabaseに更新を反映
            await supabase
              .from('ktm_players')
              .update({ name: latestName })
              .eq('id', player.id);

            // ★ 連動更新: 過去の試合ログのプレイヤー名も新しい名前に更新
            const { error: matchesUpdateError } = await supabase
              .from('ktm_match_participants')
              .update({ player_name: latestName })
              .eq('player_name', player.name);
            if (matchesUpdateError) {
              console.error(`Failed to update matches for ${player.name} -> ${latestName}:`, matchesUpdateError);
            }
          }
        }
      } catch (e) {
        console.error(`Failed to sync discord_id: ${player.discord_id}`, e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      syncedCount: updatedPlayers.length,
      updatedPlayers 
    });

  } catch (error: any) {
    console.error('Discord Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
