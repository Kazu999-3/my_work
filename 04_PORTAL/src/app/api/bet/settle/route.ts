import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { winner, players, mvp, awards } = body;
    // winner: 'BLUE' | 'RED'
    // players: [{ name: '...', team: 'BLUE' | 'RED', role: 'TOP' }, ...]
    // mvp: 'PlayerName'
    // awards: { mostKills: '...', mostDamageTaken: '...', mostAssists: '...' }

    if (!winner || !players || !Array.isArray(players)) {
      return NextResponse.json({ error: '勝敗情報またはプレイヤーリストが不足しています。' }, { status: 400 });
    }

    const playerNames = players.map(p => p.name).filter(Boolean);
    const { data: dbPlayers } = await supabase
      .from('ktm_players')
      .select('name, coins')
      .in('name', playerNames);

    const coinMap = new Map<string, number>();
    (dbPlayers || []).forEach((p: any) => {
      coinMap.set(p.name, p.coins ?? 1000);
    });

    const rewardDetails: { name: string; added: number; total: number; reasons: string[] }[] = [];

    for (const p of players) {
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

      const current = coinMap.get(p.name) ?? 1000;
      const total = current + added;
      coinMap.set(p.name, total);

      rewardDetails.push({
        name: p.name,
        added,
        total,
        reasons,
      });

      // DB更新
      await supabase
        .from('ktm_players')
        .update({ coins: total })
        .eq('name', p.name);
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
