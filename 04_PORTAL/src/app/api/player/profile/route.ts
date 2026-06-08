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
    const { data: playerMatches, error } = await supabase
      .from('ktm_match_participants')
      .select(`
        match_id,
        role,
        champion_name,
        team,
        kills,
        deaths,
        assists,
        mmr_delta,
        ktm_matches!inner(created_at, winning_team, ktm_match_participants(role, team, champion_name))
      `)
      .eq('player_name', playerName);

    if (error) {
      throw error;
    }

    if (!playerMatches || playerMatches.length === 0) {
      return NextResponse.json({ stats: {}, matchupStats: {} }); // まだ試合データがない場合
    }

    // 集計用オブジェクトの準備
    const laneStats: Record<string, { totalGames: number, totalWins: number, champions: Record<string, { games: number, wins: number }> }> = {};
    const matchupStats: Record<string, { games: number, wins: number }> = {}; // 対面チャンピオンごとの勝率
    const validRoles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

    validRoles.forEach(role => {
      laneStats[role] = { totalGames: 0, totalWins: 0, champions: {} };
    });

    // 試合データの集計
    playerMatches.forEach((row: any) => {
      const role = row.role?.toUpperCase();
      if (!validRoles.includes(role)) return;

      const isWin = row.team === row.ktm_matches.winning_team;
      const champ = row.champion_name || 'Unknown';

      // 1. レーン別・チャンピオン別の集計
      laneStats[role].totalGames += 1;
      if (isWin) laneStats[role].totalWins += 1;

      if (!laneStats[role].champions[champ]) {
        laneStats[role].champions[champ] = { games: 0, wins: 0 };
      }
      laneStats[role].champions[champ].games += 1;
      if (isWin) laneStats[role].champions[champ].wins += 1;

      // 2. 対面（マッチアップ）の集計
      // 同じ試合の全参加者から、同じロールで別チームのプレイヤーを探す
      const allParticipants = row.ktm_matches.ktm_match_participants || [];
      const opponent = allParticipants.find((p: any) => p.role?.toUpperCase() === role && p.team !== row.team);
      
      if (opponent && opponent.champion_name) {
        const oppChamp = opponent.champion_name;
        const matchupKey = `${champ} vs ${oppChamp}`; // "MyChamp vs OppChamp"
        
        if (!matchupStats[oppChamp]) {
            matchupStats[oppChamp] = { games: 0, wins: 0 };
        }
        matchupStats[oppChamp].games += 1;
        if (isWin) matchupStats[oppChamp].wins += 1;
      }
    });

    // フォーマットして一番プレイ回数が多いチャンピオンを上位3体ピックアップ
    const formattedStats: any = {};
    validRoles.forEach(role => {
      const stats = laneStats[role];
      if (stats.totalGames > 0) {
        const topChamps = Object.entries(stats.champions)
          .sort((a, b) => b[1].games - a[1].games)
          .slice(0, 5) // TOP5まで返す
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

    // 対面チャンピオンの集計をフォーマット（試合数が多い順）
    const formattedMatchups = Object.entries(matchupStats)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 10)
      .map(([oppChamp, data]) => ({
         opponentChampion: oppChamp,
         games: data.games,
         wins: data.wins,
         winRate: Math.round((data.wins / data.games) * 100)
      }));

    // 直近の試合履歴を抽出（最大10件）
    const formattedHistory = playerMatches
      .sort((a: any, b: any) => {
         const dateA = new Date(a.ktm_matches.created_at || 0).getTime();
         const dateB = new Date(b.ktm_matches.created_at || 0).getTime();
         return dateB - dateA;
      })
      .slice(0, 10)
      .map((row: any) => {
        return {
          matchId: row.match_id,
          date: row.ktm_matches.created_at,
          role: row.role,
          champion: row.champion_name || 'Unknown',
          kills: row.kills || 0,
          deaths: row.deaths || 0,
          assists: row.assists || 0,
          mmrDelta: row.mmr_delta || 0,
          isWin: row.team === row.ktm_matches.winning_team
        };
      });

    return NextResponse.json({ 
        stats: formattedStats,
        matchups: formattedMatchups,
        history: formattedHistory
    });

  } catch (error: any) {
    console.error('Profile Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'データ取得に失敗しました。' }, { status: 500 });
  }
}
