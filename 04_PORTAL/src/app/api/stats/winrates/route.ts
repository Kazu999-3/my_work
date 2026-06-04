import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 全てのプレイヤー一覧を取得
    const { data: players, error: pError } = await supabase
      .from('ktm_players')
      .select('name, is_active, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, mmr');

    if (pError || !players) {
      throw new Error("Failed to fetch players");
    }

    // 2. 過去の全試合の参加者と勝敗情報を取得
    const { data: historyData, error: hError } = await supabase
      .from('ktm_match_participants')
      .select(`
        player_name, role, team, ktm_matches!inner(winning_team)
      `);

    if (hError) {
      throw new Error("Failed to fetch match history");
    }

    // 3. データ集計用の初期化
    const statsMap: Record<string, any> = {};
    players.forEach(p => {
      statsMap[p.name] = {
        name: p.name,
        totalGames: 0,
        totalWins: 0,
        overallMmr: p.mmr || 1200,
        lanes: {
          TOP: { games: 0, wins: 0, mmr: p.mmr_top || 1200 },
          JG: { games: 0, wins: 0, mmr: p.mmr_jg || 1200 },
          MID: { games: 0, wins: 0, mmr: p.mmr_mid || 1200 },
          ADC: { games: 0, wins: 0, mmr: p.mmr_adc || 1200 },
          SUP: { games: 0, wins: 0, mmr: p.mmr_sup || 1200 },
        }
      };
    });

    // 4. 勝敗の集計
    if (historyData) {
      historyData.forEach((row: any) => {
        const pName = row.player_name;
        // 退会済みや非アクティブなユーザーの履歴はスキップ
        if (!statsMap[pName]) return;

        const role = row.role?.toUpperCase() || 'UNKNOWN';
        const isWin = row.team === row.ktm_matches?.winning_team;

        statsMap[pName].totalGames += 1;
        if (isWin) statsMap[pName].totalWins += 1;

        if (statsMap[pName].lanes[role]) {
          statsMap[pName].lanes[role].games += 1;
          if (isWin) statsMap[pName].lanes[role].wins += 1;
        }
      });
    }

    // 5. 配列に変換し、総試合数が多い順（同数の場合は勝率順）にソート
    const results = Object.values(statsMap).sort((a, b) => {
      if (b.totalGames !== a.totalGames) {
        return b.totalGames - a.totalGames;
      }
      const aWr = a.totalGames > 0 ? a.totalWins / a.totalGames : 0;
      const bWr = b.totalGames > 0 ? b.totalWins / b.totalGames : 0;
      return bWr - aWr;
    });

    return NextResponse.json({ status: "SUCCESS", data: results });

  } catch (error: any) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ status: "ERROR", message: error.message }, { status: 500 });
  }
}
