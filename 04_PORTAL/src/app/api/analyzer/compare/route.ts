import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchLeagueByPuuid,
} from '../../../../lib/riot';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface MatchData {
  matchId: string;
  gameDuration: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  championName: string;
  lane: string;
  visionScore: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  damageDealtToChampions: number;
  teamDamage: number;
  teamKills: number;
  goldEarned: number;
}

interface AggregatedPlayerStats {
  riotId: string;
  tier: string;
  lp: number;
  mainRole: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number;
  avgCsPerMin: number;
  avgGoldPerMin: number;
  avgVisionPerMin: number;
  avgKpPercent: number;
  avgDamageShare: number;
  scores: {
    survival: number;
    farm: number;
    combat: number;
    teamfight: number;
    objective: number;
  };
  topChampions: {
    name: string;
    games: number;
    wins: number;
    winRate: number;
    kda: number;
    avgCsPerMin: number;
  }[];
}

// プレイヤー1人のマッチデータ取得と集計を行う共通ヘルパー
async function fetchAndAggregatePlayer(
  gameName: string,
  tagLine: string,
  apiKey: string,
  maxMatches = 20
): Promise<AggregatedPlayerStats> {
  const puuid = await fetchPuuidByRiotId(gameName, tagLine || 'JP1', apiKey);
  if (!puuid) {
    throw new Error(`プレイヤー「${gameName}#${tagLine}」が見つかりませんでした。`);
  }

  // ランク情報の取得
  let tier = 'UNRANKED';
  let lp = 0;
  try {
    const leagues = await fetchLeagueByPuuid(puuid, apiKey);
    if (Array.isArray(leagues) && leagues.length > 0) {
      const soloLeague = leagues.find((l: any) => l.queueType === 'RANKED_SOLO_5x5') || leagues[0];
      if (soloLeague && soloLeague.tier) {
        tier = `${soloLeague.tier} ${soloLeague.rank || ''}`.trim();
        lp = soloLeague.leaguePoints || 0;
      }
    }
  } catch {
    // ignore
  }

  // マッチID取得
  let matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, maxMatches);
  if (matchIds.length === 0) {
    matchIds = await fetchRecentMatchIds(puuid, apiKey, maxMatches);
  }

  if (matchIds.length === 0) {
    throw new Error(`「${gameName}#${tagLine}」の直近試合データが取得できませんでした。`);
  }

  // マッチ詳細をバッチ取得 (4件ずつ並列処理で429防止)
  const targetIds = matchIds.slice(0, maxMatches);
  const rawMatches: MatchData[] = [];
  const chunkSize = 4;

  for (let i = 0; i < targetIds.length; i += chunkSize) {
    const chunk = targetIds.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (mId) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const detail = await fetchMatchDetails(mId, apiKey);
          const p = detail.participants.find((part) => part.puuid === puuid);
          if (!p) return null;

          const teamMembers = detail.participants.filter((part) => part.teamId === p.teamId);
          const teamKills = teamMembers.reduce((sum, m) => sum + m.kills, 0);
          const teamDamage = teamMembers.reduce((sum, m) => sum + m.damageDealtToChampions, 0);
          const durSec = detail.gameDuration || 1800;

          return {
            matchId: mId,
            gameDuration: durSec,
            win: p.win,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            championName: p.championName,
            lane: (p as any).individualPosition || p.lane || 'JUNGLE',
            visionScore: p.visionScore || 0,
            totalMinionsKilled: p.totalMinionsKilled || 0,
            neutralMinionsKilled: p.neutralMinionsKilled || 0,
            damageDealtToChampions: p.damageDealtToChampions || 0,
            teamDamage: teamDamage || 1,
            teamKills: teamKills || 1,
            goldEarned: p.goldEarned || 0,
          } as MatchData;
        } catch (e: any) {
          if (attempt < 2 && (e?.name === 'RiotRateLimitError' || String(e).includes('429'))) {
            const waitMs = e?.retryAfterSec ? (e.retryAfterSec + 1) * 1000 : 1000 * (attempt + 1);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
          return null;
        }
      }
      return null;
    });

    const results = await Promise.all(chunkPromises);
    results.forEach((r) => {
      if (r) rawMatches.push(r);
    });

    if (i + chunkSize < targetIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  if (rawMatches.length === 0) {
    throw new Error(`「${gameName}#${tagLine}」のマッチ詳細データを取得できませんでした。`);
  }

  // 集計処理
  const totalGames = rawMatches.length;
  const wins = rawMatches.filter((m) => m.win).length;
  const losses = totalGames - wins;
  const winRate = Math.round((wins / totalGames) * 100);

  // 主力レーン判定
  const laneCounts: { [l: string]: number } = {};
  rawMatches.forEach((m) => {
    const l = (m.lane || 'UNKNOWN').toUpperCase();
    laneCounts[l] = (laneCounts[l] || 0) + 1;
  });
  const mainRole = Object.entries(laneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'JUNGLE';

  const totalDeaths = rawMatches.reduce((sum, m) => sum + m.deaths, 0);
  const totalKills = rawMatches.reduce((sum, m) => sum + m.kills, 0);
  const totalAssists = rawMatches.reduce((sum, m) => sum + m.assists, 0);
  const totalDurationMin = rawMatches.reduce((sum, m) => sum + m.gameDuration, 0) / 60;
  const totalCs = rawMatches.reduce((sum, m) => sum + m.totalMinionsKilled + m.neutralMinionsKilled, 0);
  const totalGold = rawMatches.reduce((sum, m) => sum + m.goldEarned, 0);
  const totalVision = rawMatches.reduce((sum, m) => sum + m.visionScore, 0);

  const avgKills = Number((totalKills / totalGames).toFixed(1));
  const avgDeaths = Number((totalDeaths / totalGames).toFixed(2));
  const avgAssists = Number((totalAssists / totalGames).toFixed(1));
  const kda = totalDeaths > 0 ? Number(((totalKills + totalAssists) / totalDeaths).toFixed(2)) : totalKills + totalAssists;
  const avgCsPerMin = totalDurationMin > 0 ? Number((totalCs / totalDurationMin).toFixed(1)) : 0;
  const avgGoldPerMin = totalDurationMin > 0 ? Math.round(totalGold / totalDurationMin) : 0;
  const avgVisionPerMin = totalDurationMin > 0 ? Number((totalVision / totalDurationMin).toFixed(2)) : 0;

  // キル関与率 (KP%)
  const totalKp = rawMatches.reduce((sum, m) => {
    const kp = m.teamKills > 0 ? ((m.kills + m.assists) / m.teamKills) * 100 : 0;
    return sum + kp;
  }, 0);
  const avgKpPercent = Math.round(totalKp / totalGames);

  // ダメージシェア (%)
  const totalDmgShare = rawMatches.reduce((sum, m) => {
    const share = m.teamDamage > 0 ? (m.damageDealtToChampions / m.teamDamage) * 100 : 0;
    return sum + share;
  }, 0);
  const avgDamageShare = Math.round(totalDmgShare / totalGames);

  // 5大メトリクススコア (0〜100)
  const survivalScore = Math.max(20, Math.min(100, Math.round(100 - avgDeaths * 13)));
  const farmScore = (mainRole === 'UTILITY' || mainRole === 'SUPPORT')
    ? Math.max(40, Math.min(100, Math.round(avgCsPerMin <= 2.0 ? 95 : 100 - (avgCsPerMin - 2.0) * 20)))
    : Math.max(25, Math.min(100, Math.round(avgCsPerMin * 11.5)));
  const combatScore = Math.max(20, Math.min(100, Math.round(avgKpPercent * 1.35)));
  const teamfightScore = Math.max(25, Math.min(100, Math.round(kda * 12 + avgDamageShare * 1.2)));
  const objectiveScore = Math.max(30, Math.min(100, Math.round(50 + (winRate - 50) * 0.9 + avgVisionPerMin * 15)));

  // チャンピオン別集計
  const champMap: {
    [name: string]: {
      name: string;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      cs: number;
      durationMin: number;
    };
  } = {};

  rawMatches.forEach((m) => {
    if (!champMap[m.championName]) {
      champMap[m.championName] = {
        name: m.championName,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        durationMin: 0,
      };
    }
    const c = champMap[m.championName];
    c.games += 1;
    if (m.win) c.wins += 1;
    c.kills += m.kills;
    c.deaths += m.deaths;
    c.assists += m.assists;
    c.cs += m.totalMinionsKilled + m.neutralMinionsKilled;
    c.durationMin += m.gameDuration / 60;
  });

  const topChampions = Object.values(champMap)
    .sort((a, b) => b.games - a.games)
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      games: c.games,
      wins: c.wins,
      winRate: Math.round((c.wins / c.games) * 100),
      kda: c.deaths > 0 ? Number(((c.kills + c.assists) / c.deaths).toFixed(2)) : c.kills + c.assists,
      avgCsPerMin: c.durationMin > 0 ? Number((c.cs / c.durationMin).toFixed(1)) : 0,
    }));

  return {
    riotId: `${gameName}#${tagLine}`,
    tier,
    lp,
    mainRole,
    totalGames,
    wins,
    losses,
    winRate,
    avgKills,
    avgDeaths,
    avgAssists,
    kda,
    avgCsPerMin,
    avgGoldPerMin,
    avgVisionPerMin,
    avgKpPercent,
    avgDamageShare,
    scores: {
      survival: survivalScore,
      farm: farmScore,
      combat: combatScore,
      teamfight: teamfightScore,
      objective: objectiveScore,
    },
    topChampions,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error || '管理者認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { player1, player2, matchCount = 18 } = body;

    if (!player1?.gameName || !player2?.gameName) {
      return NextResponse.json(
        { error: '比較する2人のプレイヤー名（Riot ID）を入力してください。' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RIOT_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が設定されていません。' }, { status: 500 });
    }

    const p1Name = String(player1.gameName).trim();
    const p1Tag = String(player1.tagLine || 'JP1').trim().replace(/^#/, '');
    const p2Name = String(player2.gameName).trim();
    const p2Tag = String(player2.tagLine || 'JP1').trim().replace(/^#/, '');

    // 2人分のデータを並列取得・集計
    let stats1: AggregatedPlayerStats;
    let stats2: AggregatedPlayerStats;

    try {
      [stats1, stats2] = await Promise.all([
        fetchAndAggregatePlayer(p1Name, p1Tag, apiKey, Math.min(25, Number(matchCount) || 18)),
        fetchAndAggregatePlayer(p2Name, p2Tag, apiKey, Math.min(25, Number(matchCount) || 18)),
      ]);
    } catch (fetchErr: any) {
      console.error('Failed to fetch player stats for comparison:', fetchErr);
      return NextResponse.json(
        { error: fetchErr.message || 'プレイヤーデータの取得に失敗しました。' },
        { status: 502 }
      );
    }

    // 共通チャンピオンの抽出
    const p1ChampNames = new Set(stats1.topChampions.map((c) => c.name));
    const commonChampions = stats2.topChampions
      .filter((c2) => p1ChampNames.has(c2.name))
      .map((c2) => {
        const c1 = stats1.topChampions.find((c) => c.name === c2.name)!;
        return {
          championName: c2.name,
          player1: c1,
          player2: c2,
        };
      });

    // Gemini による比較考察プロンプト生成
    const aiPrompt = `あなたはプロLoLコーチ兼アナリストです。以下の実測統計データに基づき、2人のプレイヤー（Player 1 vs Player 2）の比較診断レポートを作成してください。

【Player 1: ${stats1.riotId}】
- ランク: ${stats1.tier} (${stats1.lp} LP)
- メインロール: ${stats1.mainRole} / 直近勝率: ${stats1.winRate}% (${stats1.totalGames}戦)
- KDA: ${stats1.kda} (K: ${stats1.avgKills} / D: ${stats1.avgDeaths} / A: ${stats1.avgAssists})
- CS/分: ${stats1.avgCsPerMin} / 分間ゴールド: ${stats1.avgGoldPerMin}
- KP%: ${stats1.avgKpPercent}% / ダメージシェア: ${stats1.avgDamageShare}% / 分間視界: ${stats1.avgVisionPerMin}
- 主力プール: ${stats1.topChampions.map((c) => `${c.name}(${c.games}戦 ${c.winRate}% KDA:${c.kda})`).join(', ')}

【Player 2: ${stats2.riotId}】
- ランク: ${stats2.tier} (${stats2.lp} LP)
- メインロール: ${stats2.mainRole} / 直近勝率: ${stats2.winRate}% (${stats2.totalGames}戦)
- KDA: ${stats2.kda} (K: ${stats2.avgKills} / D: ${stats2.avgDeaths} / A: ${stats2.avgAssists})
- CS/分: ${stats2.avgCsPerMin} / 分間ゴールド: ${stats2.avgGoldPerMin}
- KP%: ${stats2.avgKpPercent}% / ダメージシェア: ${stats2.avgDamageShare}% / 分間視界: ${stats2.avgVisionPerMin}
- 主力プール: ${stats2.topChampions.map((c) => `${c.name}(${c.games}戦 ${c.winRate}% KDA:${c.kda})`).join(', ')}

【出力要件】
以下の3つの項目について、客観的な数値の根拠とともに具体的・実践的な日本語で分析してください。
架空の数字やでっち上げは厳禁とし、上記実測値のみを根拠にしてください。

1. プレイスタイルの対比（Style Analysis）: 各自がどのような勝ち筋（キャリー型、マクロ・視界型、アグレッシブ交戦型等）を持っているか
2. 差を生んでいる決定的な要因（Key Factors）: デス数、ファーム精度、集団戦関与などの面で、どちらが何において優位に立っているか
3. コーチング＆直接対決アドバイス（Actionable Advice）:
   - もし生徒と目標・コーチの関係なら、Player 1 が Player 2 から即座に吸収すべき重要ポイント
   - もしライバル関係や対面対決なら、相手の癖を突くための戦術的アドバイス

出力は以下のJSON形式のみで返してください：
{
  "styleComparison": "2人のスタイルの違いの解説（3〜4行）",
  "keyFactors": "勝敗やランク差を生む決定的な指標差の分析（3〜4行）",
  "coachingAdvice": "具体的なネクストアクションやコーチングアドバイス（3〜4行）"
}`;

    let aiDiagnosis = {
      styleComparison: `${stats1.riotId} は ${stats1.mainRole} を主戦場としKDA ${stats1.kda}、${stats2.riotId} は ${stats2.mainRole} でKDA ${stats2.kda}を記録。`,
      keyFactors: `CS/分（${stats1.avgCsPerMin} vs ${stats2.avgCsPerMin}）およびキル関与率（${stats1.avgKpPercent}% vs ${stats2.avgKpPercent}%）にプレイスタイルの明確な差異が現れています。`,
      coachingAdvice: `両者の強みを比較し、より安定した勝率に繋がるリソース配分やデス抑制を意識することが有効です。`,
    };

    try {
      const aiResponse = await callGeminiWithRetry(aiPrompt, {
        temperature: 0.3,
        responseMimeType: 'application/json',
      });
      if (aiResponse) {
        const parsed = JSON.parse(aiResponse);
        if (parsed.styleComparison && parsed.keyFactors && parsed.coachingAdvice) {
          aiDiagnosis = parsed;
        }
      }
    } catch (aiErr) {
      console.warn('Gemini comparison diagnosis failed, using fallback metrics:', aiErr);
    }

    return NextResponse.json({
      success: true,
      player1: stats1,
      player2: stats2,
      commonChampions,
      aiDiagnosis,
    });
  } catch (error: any) {
    console.error('Analyzer comparison error:', error);
    return NextResponse.json(
      { error: error?.message || '2人比較解析処理中に予期せぬエラーが発生しました。' },
      { status: 500 }
    );
  }
}
