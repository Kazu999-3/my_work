import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('name');

    if (!playerName) {
      return NextResponse.json({ error: 'プレイヤー名が指定されていません。' }, { status: 400 });
    }

    // KTMの試合履歴を取得 (勝敗判定のために ktm_matches の winning_team も取得)
    const { data: matchHistory, error } = await supabase
      .from('ktm_match_participants')
      .select(`
        role,
        champion_name,
        team,
        ktm_matches!inner(winning_team)
      `)
      .eq('player_name', playerName);

    if (error) {
      throw error;
    }

    if (!matchHistory || matchHistory.length === 0) {
      return NextResponse.json({ stats: {} }); // まだ試合データがない場合
    }

    // 集計用オブジェクトの準備
    // role: { totalGames: 0, totalWins: 0, champions: { [championName]: { games: 0, wins: 0 } } }
    const laneStats: Record<string, { totalGames: number, totalWins: number, champions: Record<string, { games: number, wins: number }> }> = {};
    const validRoles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

    validRoles.forEach(role => {
      laneStats[role] = { totalGames: 0, totalWins: 0, champions: {} };
    });

    // 試合データの集計
    matchHistory.forEach((row: any) => {
      const role = row.role?.toUpperCase();
      if (!validRoles.includes(role)) return;

      const isWin = row.team === row.ktm_matches.winning_team;
      const champ = row.champion_name || 'Unknown';

      laneStats[role].totalGames += 1;
      if (isWin) laneStats[role].totalWins += 1;

      if (!laneStats[role].champions[champ]) {
        laneStats[role].champions[champ] = { games: 0, wins: 0 };
      }
      laneStats[role].champions[champ].games += 1;
      if (isWin) laneStats[role].champions[champ].wins += 1;
    });

    // フォーマットして一番プレイ回数が多いチャンピオンを上位1体ピックアップ
    const formattedStats: any = {};
    validRoles.forEach(role => {
      const stats = laneStats[role];
      if (stats.totalGames > 0) {
        // チャンピオンをプレイ回数順にソート
        const topChamps = Object.entries(stats.champions)
          .sort((a, b) => b[1].games - a[1].games)
          .slice(0, 3) // TOP3まで返す
          .map(([name, data]) => ({
            name,
            games: data.games,
            wins: data.wins,
            winRate: Math.round((data.wins / data.games) * 100)
          }));

        formattedStats[role] = {
          totalGames: stats.totalGames,
          totalWins: stats.totalWins,
          winRate: Math.round((stats.totalWins / stats.totalGames) * 100),
          topChampions: topChamps
        };
      } else {
        formattedStats[role] = null;
      }
    });

    return NextResponse.json({ stats: formattedStats });

  } catch (error: any) {
    console.error('Profile Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'データ取得に失敗しました。' }, { status: 500 });
  }
}
