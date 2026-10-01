import { NextRequest, NextResponse } from 'next/server';
import { getTargetTier } from '@/lib/coachSettings';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchLeagueByPuuid,
} from '@/lib/riot';
import {
  RawMatchRecord,
  calculateRealSessionAnalytics,
} from '@/lib/sessionAnalyticsCalculator';
import { getChampionKitTactics } from '@/lib/championKitTactics';
import { callGeminiWithRetry } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      gameName,
      tagLine,
      queueType = 'solo', // 'solo' | 'all'
    } = body;

    const targetTier = String(body?.targetTier || '').trim() || (await getTargetTier());

    const cleanName = String(gameName || process.env.RIOT_GAME_NAME || '').trim();
    const cleanTag = String(tagLine || process.env.RIOT_TAG_LINE || '').trim().replace(/^#/, '');

    if (!cleanName) {
      return NextResponse.json({ error: 'プレイヤー名を入力してください。' }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'RIOT_API_KEY が設定されていません。' }, { status: 500 });
    }

    let tier = 'UNRANKED';
    let role = 'JUNGLE';
    let rawMatches: RawMatchRecord[] = [];
    let puuid = '';

    // 1. Riot APIからPUUID・ランク・マッチ履歴を取得 (最大35試合)
    try {
      puuid = await fetchPuuidByRiotId(cleanName, cleanTag || 'JP1', apiKey);
      if (!puuid) {
        return NextResponse.json({
          error: `プレイヤー「${cleanName}#${cleanTag || 'JP1'}」が見つかりませんでした。Riot ID（名前#タグ）をご確認ください。`,
        }, { status: 404 });
      }

      const leagues = await fetchLeagueByPuuid(puuid, apiKey);
      if (Array.isArray(leagues) && leagues.length > 0) {
        const soloLeague = leagues.find((l: any) => l.queueType === 'RANKED_SOLO_5x5') || leagues[0];
        if (soloLeague && soloLeague.tier) {
          tier = `${soloLeague.tier} ${soloLeague.rank} (${soloLeague.leaguePoints} LP)`;
        }
      }

      let matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 35);
      if (matchIds.length === 0) {
        matchIds = await fetchRecentMatchIds(puuid, apiKey, 30);
      }

      if (matchIds.length === 0) {
        return NextResponse.json({
          error: `「${cleanName}#${cleanTag || 'JP1'}」の直近試合履歴が見つかりませんでした。直近で試合をプレイしているか確認してください。`,
        }, { status: 404 });
      }

      const targetIds = matchIds.slice(0, 35);
      const rawMatchResults: RawMatchRecord[] = [];
      const chunkSize = 5;

      for (let i = 0; i < targetIds.length; i += chunkSize) {
        const chunk = targetIds.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(async (mId) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const detail: any = await fetchMatchDetails(mId, apiKey);
              if (!detail || !detail.participants) return null;

              const p = detail.participants.find((part: any) => part.puuid === puuid);
              if (!p) return null;

              const teamMembers = detail.participants.filter((part: any) => part.teamId === p.teamId);
              const teamKills = teamMembers.reduce((sum: number, m: any) => sum + m.kills, 0);
              const teamDamage = teamMembers.reduce((sum: number, m: any) => sum + m.damageDealtToChampions, 0);

              const startTs = detail.gameStartTimestamp || Date.now();
              const durSec = detail.gameDuration || 1800;
              const endTs = startTs + durSec * 1000;

              const myTeam = detail.teams?.find((t: any) => t.teamId === p.teamId);
              const enemyTeam = detail.teams?.find((t: any) => t.teamId !== p.teamId);
              const teamHordeKills = myTeam?.objectives?.horde?.kills || 0;
              const teamDragonKills = myTeam?.objectives?.dragon?.kills || 0;
              const enemyHordeKills = enemyTeam?.objectives?.horde?.kills || 0;
              const enemyDragonKills = enemyTeam?.objectives?.dragon?.kills || 0;
              const firstDragon = myTeam?.objectives?.dragon?.first || false;

              return {
                matchId: mId,
                gameStartTimestamp: startTs,
                gameDuration: durSec,
                gameEndTimestamp: endTs,
                win: p.win,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                championName: p.championName,
                lane: p.lane || 'JUNGLE',
                visionScore: p.visionScore || 0,
                totalMinionsKilled: p.totalMinionsKilled || 0,
                neutralMinionsKilled: p.neutralMinionsKilled || 0,
                teamDamage: teamDamage || 1,
                playerDamage: p.damageDealtToChampions || 0,
                teamKills: teamKills || 1,
                goldEarned: p.goldEarned || 0,
                teamHordeKills,
                teamDragonKills,
                enemyHordeKills,
                enemyDragonKills,
                firstDragon,
              } as RawMatchRecord;
            } catch (e: any) {
              if (e?.name === 'RiotRateLimitError') {
                const waitMs = e?.retryAfterSec ? (e.retryAfterSec + 1) * 1000 : 1000 * (attempt + 1);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                continue;
              }
              console.error(`マッチ取得エラー (${mId}):`, e?.message || e);
              return null;
            }
          }
          return null;
        });

        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.forEach((r) => {
          if (r) rawMatchResults.push(r);
        });

        if (i + chunkSize < targetIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }

      rawMatches = rawMatchResults;
    } catch (e: any) {
      console.error('Riot API stats fetch failed:', e);
      return NextResponse.json({
        error: `Riot API 通信エラー: ${e.message || 'プレイヤーデータの取得に失敗しました'}`,
      }, { status: 502 });
    }

    if (rawMatches.length === 0) {
      return NextResponse.json({
        error: `「${cleanName}#${cleanTag || 'JP1'}」のマッチ詳細データを取得できませんでした。時間をおいて再試行してください。`,
      }, { status: 404 });
    }

    // 2. 実測マッチデータからの集計
    const totalWins = rawMatches.filter((m) => m.win).length;
    const overallWinRate = rawMatches.length > 0 ? Math.round((totalWins / rawMatches.length) * 100) : 53;

    if (rawMatches.length > 0) {
      const laneCounts: { [key: string]: number } = {};
      rawMatches.forEach((m) => {
        const l = m.lane.toUpperCase();
        laneCounts[l] = (laneCounts[l] || 0) + 1;
      });
      const topLane = Object.entries(laneCounts).sort((a, b) => b[1] - a[1])[0];
      if (topLane) role = topLane[0];
    }

    let avgDeaths = 3.5;
    let avgKills = 5.8;
    let avgAssists = 8.4;
    let avgKda = 6.0;
    let avgCsPerMin = 7.2;
    let avgKpPercent = 42;
    let avgVisionPerMin = 1.45;

    if (rawMatches.length > 0) {
      const totalDeaths = rawMatches.reduce((sum, m) => sum + m.deaths, 0);
      const totalKills = rawMatches.reduce((sum, m) => sum + m.kills, 0);
      const totalAssists = rawMatches.reduce((sum, m) => sum + m.assists, 0);
      const totalDurationMin = rawMatches.reduce((sum, m) => sum + m.gameDuration, 0) / 60;
      const totalCs = rawMatches.reduce((sum, m) => sum + m.totalMinionsKilled + m.neutralMinionsKilled, 0);
      const totalVision = rawMatches.reduce((sum, m) => sum + m.visionScore, 0);

      avgDeaths = Number((totalDeaths / rawMatches.length).toFixed(2));
      avgKills = Number((totalKills / rawMatches.length).toFixed(1));
      avgAssists = Number((totalAssists / rawMatches.length).toFixed(1));
      avgKda = totalDeaths > 0 ? Number(((totalKills + totalAssists) / totalDeaths).toFixed(2)) : totalKills + totalAssists;
      avgCsPerMin = totalDurationMin > 0 ? Number((totalCs / totalDurationMin).toFixed(1)) : 6.5;
      avgVisionPerMin = totalDurationMin > 0 ? Number((totalVision / totalDurationMin).toFixed(2)) : 1.35;

      const totalKp = rawMatches.reduce((sum, m) => {
        const kp = m.teamKills > 0 ? ((m.kills + m.assists) / m.teamKills) * 100 : 40;
        return sum + kp;
      }, 0);
      avgKpPercent = Math.round(totalKp / rawMatches.length);
    }

    const survivalScore = Math.max(20, Math.min(100, Math.round(100 - avgDeaths * 14)));
    const farmScore = Math.max(30, Math.min(100, Math.round(avgCsPerMin * 11.5)));
    const combatScore = Math.max(20, Math.min(100, Math.round(avgKpPercent * 1.3)));
    const objScore = Math.min(95, Math.max(50, Math.round(60 + (overallWinRate - 50) * 0.8)));
    const teamfightScore = Math.min(98, Math.max(40, Math.round(avgKda * 12)));

    // 3. チャンピオン別実測集計
    const champStatsMap: { [name: string]: any } = {};
    rawMatches.forEach((m) => {
      const c = m.championName;
      if (!champStatsMap[c]) {
        champStatsMap[c] = {
          name: c,
          gamesCount: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0,
          durationMin: 0,
          vision: 0,
        };
      }
      const st = champStatsMap[c];
      st.gamesCount++;
      if (m.win) st.wins++;
      st.kills += m.kills;
      st.deaths += m.deaths;
      st.assists += m.assists;
      st.cs += (m.totalMinionsKilled + m.neutralMinionsKilled);
      st.durationMin += (m.gameDuration / 60);
      st.vision += m.visionScore;
    });

    const detailedChampions = Object.values(champStatsMap)
      .map((st: any) => {
        const wr = Math.round((st.wins / st.gamesCount) * 100);
        const kda = st.deaths > 0 ? Number(((st.kills + st.assists) / st.deaths).toFixed(2)) : st.kills + st.assists;
        const csPerMin = st.durationMin > 0 ? Number((st.cs / st.durationMin).toFixed(1)) : 0;
        const kitTactics = getChampionKitTactics(st.name, role);

        return {
          name: st.name,
          gamesCount: st.gamesCount,
          winRate: wr,
          kda,
          csPerMin,
          tactics: kitTactics,
        };
      })
      .sort((a, b) => b.gamesCount - a.gamesCount);

    // 4. セッション＆心理分析計算
    const sessionData = calculateRealSessionAnalytics(rawMatches, targetTier);

    // 5. レポート組み立て
    const reportData = {
      summoner: {
        gameName: cleanName,
        tagLine: cleanTag || 'JP1',
        tier,
        role,
        analyzedMatchesCount: rawMatches.length,
      },
      targetTier,
      radarScores: {
        survival: survivalScore,
        farming: farmScore,
        combat: combatScore,
        objectives: objScore,
        teamfighting: teamfightScore,
      },
      averages: {
        winRate: overallWinRate,
        kda: avgKda,
        kills: avgKills,
        deaths: avgDeaths,
        assists: avgAssists,
        csPerMin: avgCsPerMin,
        visionPerMin: avgVisionPerMin,
        killParticipation: avgKpPercent,
      },
      champions: detailedChampions,
      sessionAnalytics: sessionData,
    };

    return NextResponse.json({ success: true, report: reportData });
  } catch (err: any) {
    console.error('[deep-intel] error:', err);
    return NextResponse.json({ error: err.message || '内部サーバーエラー' }, { status: 500 });
  }
}
