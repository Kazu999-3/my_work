import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { winner, players, mvp, awards } = body;
    // winner: 'BLUE' | 'RED'
    // players: [{ name: '...', team: 'BLUE' | 'RED', role: 'TOP', discordId?: '...' }, ...]
    // mvp: 'PlayerName'
    // awards: { mostKills: '...', mostDamageTaken: '...', mostAssists: '...' }

    if (!winner || !players || !Array.isArray(players)) {
      return NextResponse.json({ error: '勝敗情報またはプレイヤーリストが不足しています。' }, { status: 400 });
    }

    const rewardDetails: { name: string; added: number; total: number; reasons: string[] }[] = [];

    for (const p of players) {
      if (!p.name) continue;

      let added = 100; // 参加賞 +100
      const reasons = ['参加賞 (+100)'];

      if (p.team === winner) {
        added += 150; // 勝利ボーナス +150
        reasons.push('勝利ボーナス (+150)');
      }

      if (mvp && p.name === mvp) {
        added += 200; // MVP +200
        reasons.push('👑 MVP賞 (+200)');
      }

      if (awards) {
        if (awards.mostKills === p.name) {
          added += 200;
          reasons.push('⚔️ 最多キル賞 (+200)');
        }
        if (awards.mostDamageTaken === p.name) {
          added += 200;
          reasons.push('🛡️ 不沈艦タンク賞 (+200)');
        }
        if (awards.mostAssists === p.name) {
          added += 200;
          reasons.push('🪄 ベストサポート賞 (+200)');
        }
      }

      // プレイヤーを安全に取得
      const dbPlayer = await findOrCreatePlayer({
        discordId: p.discordId || p.discord_id,
        name: p.name,
        autoCreate: true,
      });

      if (dbPlayer) {
        const current = getPlayerCoins(dbPlayer);
        const total = current + added;

        // role_preferences.coins を安全に更新
        await updatePlayerCoinsAndInventory({
          player: dbPlayer,
          newCoins: total,
        });

        rewardDetails.push({
          name: p.name,
          added,
          total,
          reasons,
        });
      }
    }

    return NextResponse.json({
      success: true,
      winner,
      rewardDetails,
      message: `🎉 試合結果（${winner} 勝利）に基づき、全出場者にコインボーナスが付与されました！`,
    });
  } catch (error: any) {
    console.error('Bet Settle API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
