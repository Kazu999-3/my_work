import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { calculatePlaystyle } from '../../../../lib/playstyle';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds TTL

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerName = searchParams.get('name');

    if (!playerName) {
      return NextResponse.json({ error: 'プレイヤー名が指定されていません。' }, { status: 400 });
    }

    const cached = cache.get(playerName);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data);
    }

    // プレイヤーの現在MMR等の情報を取得
    const { data: dbPlayer, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .eq('name', playerName)
      .single();

    if (pError || !dbPlayer) {
      // プレイヤーがいない場合は空データを返す
      return NextResponse.json({ stats: {}, matchupStats: {}, history: [] });
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

    // 直近の試合履歴を抽出
    // 逆算を行うために、すべてのマッチを新しい順にソート
    const sortedMatches = [...playerMatches]
      .sort((a: any, b: any) => {
         const dateA = new Date(a.ktm_matches.created_at || 0).getTime();
         const dateB = new Date(b.ktm_matches.created_at || 0).getTime();
         return dateB - dateA; // 降順（新しい順）
      });

    // 現在のMMR値から逆算を開始
    let currentTop = dbPlayer.mmr_top || 1200;
    let currentJg = dbPlayer.mmr_jg || 1200;
    let currentMid = dbPlayer.mmr_mid || 1200;
    let currentAdc = dbPlayer.mmr_adc || 1200;
    let currentSup = dbPlayer.mmr_sup || 1200;

    const formattedHistory = sortedMatches.map((row: any) => {
      // この試合終了時点のMMRを格納
      const matchMmr = {
        TOP: currentTop,
        JG: currentJg,
        MID: currentMid,
        ADC: currentAdc,
        SUP: currentSup,
        TOTAL: Math.round((currentTop + currentJg + currentMid + currentAdc + currentSup) / 5)
      };

      // 次の過去試合（時間を戻す）のために、この試合での変動量を引く
      const role = row.role?.toUpperCase();
      const delta = row.mmr_delta || 0;
      if (role === 'TOP') currentTop -= delta;
      else if (role === 'JG') currentJg -= delta;
      else if (role === 'MID') currentMid -= delta;
      else if (role === 'ADC') currentAdc -= delta;
      else if (role === 'SUP') currentSup -= delta;

      return {
        matchId: row.match_id,
        date: row.ktm_matches.created_at,
        role: row.role,
        champion: row.champion_name || 'Unknown',
        kills: row.kills || 0,
        deaths: row.deaths || 0,
        assists: row.assists || 0,
        mmrDelta: delta,
        isWin: row.team === row.ktm_matches.winning_team,
        mmrHistory: matchMmr // 各レーンのMMR推移をマージ
      };
    }).slice(0, 20); // 履歴表示用に直近20件を返す

    const customPlaystyle = calculatePlaystyle(playerMatches);
    const savedPlaystyle = (dbPlayer.metadata as any)?.playstyle_cache || {};

    const playstyle = {
      custom: customPlaystyle,
      soloq: savedPlaystyle.soloq || {
        sliders: { aggressive: 50, farming: 50, supportive: 50 },
        tags: [{ id: 'no-data', name: 'データなし', description: 'ソロキューデータが同期されていません。', reason: 'プロフィール画面から同期を実行してください。' }],
        lastUpdated: null
      }
    };

    const result = { 
        stats: formattedStats,
        matchups: formattedMatchups,
        history: formattedHistory,
        playstyle
    };

    cache.set(playerName, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Profile Fetch Error:', error);
    return NextResponse.json({ error: error.message || 'データ取得に失敗しました。' }, { status: 500 });
  }
}
