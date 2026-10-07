import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { getTargetTier } from '../../../../lib/coachSettings';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchLeagueByPuuid,
} from '../../../../lib/riot';
import {
  RawMatchRecord,
  calculateRealSessionAnalytics,
} from '../../../../lib/sessionAnalyticsCalculator';
import { getChampionKitTactics } from '../../../../lib/championKitTactics';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { fetchRankBenchmark } from '../../../../lib/rankBenchmarks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error || '管理者認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const {
      gameName,
      tagLine,
      queueType = 'solo', // 'solo' | 'all'
    } = body;

    // 目標ランクは ktm_settings に保存された値を使う（未設定なら既定値）。
    // 2026-09-30: 以前は 'Emerald IV' がこのルートの既定値とクライアント側の両方に
    // 直書きされており、昇格しても目標が動かないままAIへの指示文に入り続けていた。
    const targetTier = String(body?.targetTier || '').trim() || (await getTargetTier());

    // Riot IDが指定されていなければ環境変数のオーナーIDにフォールバックする。
    // 2026-09-30: 呼び出し側(SoloQDeepIntelSyncCard と coach/page.tsx)に
    // "Kazurin#4036" が3箇所ハードコードされていた。他のソロQ系ルートは
    // すべて RIOT_GAME_NAME / RIOT_TAG_LINE を使っているため、ここも同じ
    // 単一の出所に揃える（Riot IDを変えたときの二重管理をなくす）。
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

      // ランク情報の取得
      const leagues = await fetchLeagueByPuuid(puuid, apiKey);
      if (Array.isArray(leagues) && leagues.length > 0) {
        const soloLeague = leagues.find((l: any) => l.queueType === 'RANKED_SOLO_5x5') || leagues[0];
        if (soloLeague && soloLeague.tier) {
          tier = `${soloLeague.tier} ${soloLeague.rank} (${soloLeague.leaguePoints} LP)`;
        }
      }

      // ソロキュー（Ranked Solo 5v5 / queue=420）のマッチIDを最新35件取得
      let matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 35);
      if (matchIds.length === 0) {
        // ソロキュー未プレイ時は直近ノーマル・全キューを取得
        matchIds = await fetchRecentMatchIds(puuid, apiKey, 30);
      }

      if (matchIds.length === 0) {
        return NextResponse.json({
          error: `「${cleanName}#${cleanTag || 'JP1'}」の直近試合履歴が見つかりませんでした。直近で試合をプレイしているか確認してください。`,
        }, { status: 404 });
      }

      // 各マッチの詳細を確実に取得 (5件ずつバッチ制御で429レート制限を完全回避)
      const targetIds = matchIds.slice(0, 35);
      const rawMatchResults: RawMatchRecord[] = [];
      const chunkSize = 5;

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
              const epicOf = (t: any) => (t?.objectives?.dragon?.kills || 0) + (t?.objectives?.baron?.kills || 0) + (t?.objectives?.riftHerald?.kills || 0);
              const teamEpicKills = epicOf(myTeam);
              const enemyEpicKills = epicOf(enemyTeam);

              const record: RawMatchRecord = {
                matchId: mId,
                gameStartTimestamp: startTs,
                gameDuration: durSec,
                gameEndTimestamp: endTs,
                win: p.win,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                championName: p.championName,
                lane: (p as any).individualPosition || p.lane || 'JUNGLE',
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
                teamEpicKills,
                enemyEpicKills,
                firstBloodInvolved: !!(p.firstBloodKill || p.firstBloodAssist),
                turretTakedowns: p.turretTakedowns ?? null,
                laningAhead: p.laningPhaseGoldExpAdvantage == null ? null : p.laningPhaseGoldExpAdvantage > 0,
              };
              return record;
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

    // ロール判定
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
      avgCsPerMin = totalDurationMin > 0 ? Number((totalCs / totalDurationMin).toFixed(1)) : (role === 'UTILITY' || role === 'SUPPORT' ? 1.2 : 6.5);
      avgVisionPerMin = totalDurationMin > 0 ? Number((totalVision / totalDurationMin).toFixed(2)) : 1.35;

      const totalKp = rawMatches.reduce((sum, m) => {
        const kp = m.teamKills > 0 ? ((m.kills + m.assists) / m.teamKills) * 100 : 40;
        return sum + kp;
      }, 0);
      avgKpPercent = Math.round(totalKp / rawMatches.length);
    }

    const survivalScore = Math.max(20, Math.min(100, Math.round(100 - avgDeaths * 14)));
    const farmScore = (role === 'UTILITY' || role === 'SUPPORT')
      ? Math.max(40, Math.min(100, Math.round(avgCsPerMin <= 1.8 ? 95 : 100 - (avgCsPerMin - 1.8) * 20)))
      : Math.max(30, Math.min(100, Math.round(avgCsPerMin * 11.5)));
    const combatScore = Math.max(20, Math.min(100, Math.round(avgKpPercent * 1.3)));
    // ★ 2026-10-07: 以前は総合勝率から「オブジェクト管理点」を作っていた（60+(勝率-50)×0.8）。
    // 実測に置き換え: 自チームが獲ったドラゴン・バロン・ヘラルドの割合（両チーム合計に対する%。50=五分）。1体も出ていなければ点数は出さない
    const epicTotals = rawMatches.reduce((acc, m) => ({ mine: acc.mine + (m.teamEpicKills || 0), all: acc.all + (m.teamEpicKills || 0) + (m.enemyEpicKills || 0) }), { mine: 0, all: 0 });
    const objScore: number | null = epicTotals.all > 0 ? Math.round((epicTotals.mine / epicTotals.all) * 100) : null;
    const teamfightScore = Math.min(98, Math.max(40, Math.round(avgKda * 12)));

    // 3. チャンピオン別実測集計（勝利時 vs 敗北時の詳細スタッツも完全分離集計）
    const champStatsMap: {
      [name: string]: {
        name: string;
        gamesCount: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
        cs: number;
        durationMin: number;
        vision: number;
        winCount: number;
        winDeaths: number;
        winCs: number;
        winDurationMin: number;
        winVision: number;
        lossCount: number;
        lossDeaths: number;
        lossCs: number;
        lossDurationMin: number;
        lossVision: number;
      };
    } = {};

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
          winCount: 0,
          winDeaths: 0,
          winCs: 0,
          winDurationMin: 0,
          winVision: 0,
          lossCount: 0,
          lossDeaths: 0,
          lossCs: 0,
          lossDurationMin: 0,
          lossVision: 0,
        };
      }
      const dur = m.gameDuration / 60;
      const cs = m.totalMinionsKilled + m.neutralMinionsKilled;
      champStatsMap[c].gamesCount += 1;
      champStatsMap[c].kills += m.kills;
      champStatsMap[c].deaths += m.deaths;
      champStatsMap[c].assists += m.assists;
      champStatsMap[c].cs += cs;
      champStatsMap[c].durationMin += dur;
      champStatsMap[c].vision += m.visionScore;

      if (m.win) {
        champStatsMap[c].wins += 1;
        champStatsMap[c].winCount += 1;
        champStatsMap[c].winDeaths += m.deaths;
        champStatsMap[c].winCs += cs;
        champStatsMap[c].winDurationMin += dur;
        champStatsMap[c].winVision += m.visionScore;
      } else {
        champStatsMap[c].lossCount += 1;
        champStatsMap[c].lossDeaths += m.deaths;
        champStatsMap[c].lossCs += cs;
        champStatsMap[c].lossDurationMin += dur;
        champStatsMap[c].lossVision += m.visionScore;
      }
    });

    // 実際にプレイしたチャンピオンを試合数順に最大5体抽出
    const topChampions = Object.values(champStatsMap)
      .sort((a, b) => b.gamesCount - a.gamesCount)
      .slice(0, 5);

    if (topChampions.length === 0) {
      return NextResponse.json({
        error: `「${cleanName}#${cleanTag || 'JP1'}」のプレイ済みチャンピオン統計が取得できませんでした。`,
      }, { status: 404 });
    }

    const isSupportRole = role === 'UTILITY' || role === 'SUPPORT';

    const calculatedChamps = topChampions.map((c) => {
      const winRate = Math.round((c.wins / c.gamesCount) * 100);
      const kda = c.deaths > 0 ? Number(((c.kills + c.assists) / c.deaths).toFixed(2)) : c.kills + c.assists;
      const csPerMin = c.durationMin > 0 ? Number((c.cs / c.durationMin).toFixed(1)) : 6.8;
      const avgK = Number((c.kills / c.gamesCount).toFixed(1));
      const avgD = Number((c.deaths / c.gamesCount).toFixed(1));
      const avgA = Number((c.assists / c.gamesCount).toFixed(1));

      // 勝利時 vs 敗北時（試合データの実測）。★ 2026-10-08: 片方が0試合の時に「全体×0.85」「全体×0.6」「1.6 / 1.1」で
      // 埋めていたのをやめ、データなしと表示する。第1コア完成時間は全員に同じ固定文字（推定 10分45秒 / 13分30秒）だったため削除
      // （実測にはタイムラインが試合数分必要で、Riot API の回数制限に当たる）
      const winCsPerMin = c.winCount > 0 && c.winDurationMin > 0 ? Number((c.winCs / c.winDurationMin).toFixed(1)) : null;
      const lossCsPerMin = c.lossCount > 0 && c.lossDurationMin > 0 ? Number((c.lossCs / c.lossDurationMin).toFixed(1)) : null;
      const winAvgD = c.winCount > 0 ? Number((c.winDeaths / c.winCount).toFixed(1)) : null;
      const lossAvgD = c.lossCount > 0 ? Number((c.lossDeaths / c.lossCount).toFixed(1)) : null;
      const winVisionPerMin = c.winCount > 0 && c.winDurationMin > 0 ? Number((c.winVision / c.winDurationMin).toFixed(2)) : null;
      const lossVisionPerMin = c.lossCount > 0 && c.lossDurationMin > 0 ? Number((c.lossVision / c.lossDurationMin).toFixed(2)) : null;
      const fmt = (v: number | null, unit = '') => (v === null ? 'データなし' : `${v}${unit}`);
      const diffNote = (a: number | null, b: number | null, digits: number) =>
        a !== null && b !== null ? ` (差 ${a - b >= 0 ? '+' : ''}${Number((a - b).toFixed(digits))})` : '';

      const winVsLossDiffs = {
        cs15Diff: `勝利時: ${fmt(winCsPerMin, '/分')} | 敗北時: ${fmt(lossCsPerMin, '/分')}${diffNote(winCsPerMin, lossCsPerMin, 1)}`,
        deathsDiff: `勝利時: 平均 ${fmt(winAvgD, 'デス')} | 敗北時: 平均 ${fmt(lossAvgD, 'デス')}${diffNote(winAvgD, lossAvgD, 1)}`,
        visionDiff: `勝利時: ${fmt(winVisionPerMin, '/分')} | 敗北時: ${fmt(lossVisionPerMin, '/分')}${diffNote(winVisionPerMin, lossVisionPerMin, 2)}`,
      };

      let powerRating = 'A (主力)';
      if (winRate >= 60) powerRating = 'S (メインキャリー)';
      else if (winRate < 45) powerRating = 'B (要立ち回り改善)';

      return {
        id: c.name,
        name: c.name,
        role,
        powerRating,
        winRate,
        kda,
        avgKills: avgK,
        avgDeaths: avgD,
        avgAssists: avgA,
        csPerMin,
        gamesCount: c.gamesCount,
        winVsLossDiffs,
      };
    });

    // 4. 実測タイムスタンプからのコンディション・心理DNA・目標ランクギャップ自動計算
    // 目標ランク・同ロールの実測平均（毎日収集）。無ければ目標ランク比較は出さない（2026-10-07、以前は手入力の値）
    const rankBenchmark = await fetchRankBenchmark(targetTier, role);
    const calculatedSessionAnalytics = calculateRealSessionAnalytics(rawMatches, targetTier, role, rankBenchmark);
    const gap = calculatedSessionAnalytics.targetRankGap;
    const benchmarkPromptBlock = gap
      ? `【プレイヤー実測スタッツ vs 目標ランク（${targetTier}）・同ロールの実測平均】
※平均は ${targetTier} のプレイヤー本人の直近ランクソロ ${gap.benchmark.sampleCount}試合（直近30日）の実測値です${gap.lowSample ? '（試合数が少ないため参考値）' : ''}。
・平均デス: 実測 ${avgDeaths}（${targetTier}平均 ${gap.benchmark.avgDeaths}）
・分間CS: 実測 ${avgCsPerMin}（${targetTier}平均 ${gap.benchmark.csPerMin}）${isSupportRole ? ' ※サポートは低CSが通常' : ''}
・キル関与率（試合全体）: 実測 ${avgKpPercent}%（${targetTier}平均 ${gap.benchmark.killParticipation}%）
・分間視界スコア: 実測 ${avgVisionPerMin}（${targetTier}平均 ${gap.benchmark.visionScorePerMin}）
・平均以上の項目: ${gap.passedCount}/${gap.totalCount}`
      : `【プレイヤー実測スタッツ】（${targetTier} の実測平均はまだ収集中のため比較値はありません。目標ランクの水準に達している・いないとは断定しないこと）
・平均デス: ${avgDeaths} / 分間CS: ${avgCsPerMin} / キル関与率（試合全体）: ${avgKpPercent}% / 分間視界スコア: ${avgVisionPerMin}`;

    // 5. Gemini AIによる動的総合診断 ＆ 目標ランク到達処方箋の生成
    // ★ 2026-10-07: 対面の例として「LeeSin, Nocturne…」等の名前を並べていたため、AIがどのJGにも LeeSin を天敵に挙げていた。例示の名前は外した
    const aiPrompt = `あなたはLoL（League of Legends）の最高峰データアナリスト兼パーソナルコーチです。
プレイヤー「${cleanName}#${cleanTag}」（メインロール: ${calculatedSessionAnalytics.roleConfig.roleName}、現在ランク: ${tier}）は、目標ランク【${targetTier}】への昇格を目指しています。
以下の実測スタッツ（と、あれば目標ランクの実測平均との差）をもとに、【目標ランク到達処方箋レポート】を作成してください。
数値は下に示したものだけを使い、示していない数値（ワードの位置・ソロキル数・時間帯別の値など）を作らないこと。
${isSupportRole ? '※重要: このプレイヤーは【サポート (Support)】です。CSは取らないのが正解（1.5以下が適正）ですので、CSを求めるアドバイスは絶対にせず、分間視界スコア・ピンクワード購入・戦闘関与率（KP）・味方キャリーのピール/エンゲージを評価・指南してください。' : ''}

【マッチアップ ＆ パワースパイク生成の厳格ルール】
1. 各チャンピオンの「favoredMatchups（得意な相手）」と「hardMatchups（苦手な相手）」には、**必ずそのチャンピオンと同じロール（レーン）の対面チャンピオン**を指定してください。
・サポートの対面はサポート、ジャングルの対面はジャングル。他ロールのチャンピオンを混ぜないこと。
・対面は、そのチャンピオンにとって実際に相性の悪い・良い相手を個別に選ぶこと。どのチャンピオンにも同じ相手を並べないこと。
2. 「powerSpikes」は、各チャンピオン固有のスキル名（例: RellのWフェロマンシー/R磁気誘導、ShyvanaのLv6ドラゴンフォーム/Eブレス、LeonaのEゼニス/Rソーラーフレアなど）を含め、具体的かつ実戦的な時間軸立ち回りを記述してください。抽象的・定型的な文言は禁止です。

${benchmarkPromptBlock}

以下のJSONフォーマットのみを返してください（コードブロックなしの純粋なJSON）:
{
  "styleTypeName": "（プレイヤー固有のプレイスタイル名、例: 鉄壁の視界制圧＆味方防衛ピールマスター）",
  "styleBadge": "（強みバッジ、例: 視界制圧 Sランク）",
  "coreDiagnosis": "（現状と目標ランク【${targetTier}】に向けた客観総括 2〜3文）",
  "strengths": ["実測データに基づく強み1", "実測データに基づく強み2", "実測データに基づく強み3"],
  "coreBottleNeck": "（目標ランク到達を阻んでいる最大のボトルネック・負け筋 1〜2文）",
  "visionAnalysis": "（分間視界スコアの評価。ワードの設置位置のデータは無いので、位置の良し悪しは断定しない）",
  "actionPlan": "（【${targetTier}】昇格のために次戦から変えるべき具体的急所アクション）",
  "goldenDeepWard": {
    "spot": "（推奨ワード場所）",
    "timing": "（推奨タイミング）",
    "reason": "（理由）"
  },
  "championDetails": [
    ${calculatedChamps
      .map(
        (c) => `{
      "id": "${c.id}",
      "powerSpikes": {
        "earlyLvl1to5": "（Lv1〜5序盤スパイク: ${c.name}の固有スキルを交えた解説）",
        "mid1to2Core": "（1〜2コア中盤スパイク: ${c.name}の1〜2コア完成時コンボ解説）",
        "late3CorePlus": "（3コア終盤スパイク: ${c.name}の集団戦ポジショニング解説）"
      },
      "favoredMatchups": [
        { "enemy": "（同レーンの有利な相手1）", "reason": "（有利な理由）" },
        { "enemy": "（同レーンの有利な相手2）", "reason": "（有利な理由）" }
      ],
      "hardMatchups": [
        { "enemy": "（同レーンの苦手な相手1）", "counterPlay": "（具体的な対抗立ち回り）" },
        { "enemy": "（同レーンの苦手な相手2）", "counterPlay": "（具体的な対抗立ち回り）" }
      ],
      "aiTacticsGuide": "（このプレイヤーが${c.name}で【${targetTier}】に通用するための専属指南）"
    }`
      )
      .join(',\n    ')}
  ]
}
`;

    let aiResult: any;
    try {
      const responseText = await callGeminiWithRetry(aiPrompt, {
        model: 'gemini-3.1-flash-lite',
        temperature: 0.4,
        maxOutputTokens: 4096,
      });
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      aiResult = JSON.parse(cleanJson);
    } catch (e) {
      console.warn('Gemini AI synthesis fallback:', e);
      aiResult = {
        styleTypeName: isSupportRole ? '視界制圧＆味方ピール守護神' : 'ファームスケーリング＆セーフティ型',
        styleBadge: isSupportRole ? '視界スコア Sランク' : '安定度 Sランク',
        // ★ 2026-10-07: 以前はAI失敗時に実測値と無関係に「既に【目標】水準に到達」と断定していた。実測値だけを示す
        coreDiagnosis: gap
          ? `AIによる総合診断を生成できませんでした。実測値では、${targetTier}の同ロール平均に対して ${gap.totalCount}項目中 ${gap.passedCount}項目が平均以上です。`
          : `AIによる総合診断を生成できませんでした（${targetTier}の実測平均は収集中です）。`,
        strengths: [
          `平均デス ${avgDeaths}`,
          `分間CS ${avgCsPerMin}`,
          `キル関与率 ${avgKpPercent}% / 分間視界 ${avgVisionPerMin}`,
        ],
        coreBottleNeck: gap && gap.keyActionToPromote.length > 0 && gap.passedCount < gap.totalCount
          ? `${targetTier}平均を下回っている項目: ${gap.keyActionToPromote.join(' / ')}`
          : 'AIによる分析を生成できませんでした。',
        visionAnalysis: `分間視界スコア ${avgVisionPerMin}${gap ? `（${targetTier}平均 ${gap.benchmark.visionScorePerMin}）` : ''}。`,
        actionPlan: calculatedSessionAnalytics.roleConfig.defaultActionGuideline,
        goldenDeepWard: {
          spot: isSupportRole ? '敵トライブッシュ＆ドラゴン裏' : '敵ラプター裏ブッシュ',
          timing: isSupportRole ? 'オブジェクト湧き60秒前' : '3:30〜4:00 (1周目フルクリア直後)',
          reason: '敵の進行ルートを30秒前に完全察知し、味方崩壊を防ぐため',
        },
        championDetails: calculatedChamps.map((c) => {
          const kit = getChampionKitTactics(c.name, role);
          return {
            id: c.id,
            powerSpikes: kit.powerSpikes,
            favoredMatchups: kit.favoredMatchups,
            hardMatchups: kit.hardMatchups,
            aiTacticsGuide: kit.tacticsGuide,
          };
        }),
      };
    }

    // 万が一AIの返答で特定キーが欠落していた場合のフォールバック合成（実測アナリティクスと完全一致）
    if (!aiResult.styleTypeName) {
      aiResult.styleTypeName = calculatedSessionAnalytics.playstyleMbti.typeName;
    }
    if (!aiResult.styleBadge) {
      aiResult.styleBadge = `${calculatedSessionAnalytics.playstyleMbti.typeCode} 型`;
    }
    if (!aiResult.strengths || !Array.isArray(aiResult.strengths)) {
      aiResult.strengths = [
        `平均被デス ${avgDeaths} (安全性 ${calculatedSessionAnalytics.playstyleMbti.axes.safetyVsRisk.safetyPercent}%) による安定した立ち回り`,
        isSupportRole
          ? `分間視界スコア ${avgVisionPerMin} によるマップ防衛網の維持`
          : `分間CS ${avgCsPerMin} のリソース回収力`,
        `キル関与率 ${avgKpPercent}% によるチーム貢献`,
      ];
    }

    // チャンピオン名正規化ヘルパー (MonkeyKing -> Wukong 等)
    const normalizeChampKey = (name: string) => {
      const lower = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower === 'monkeyking') return 'wukong';
      return lower;
    };

    const mergedChampionProfiles = calculatedChamps.map((c) => {
      const cNorm = normalizeChampKey(c.name);
      // AIの返答から対応するチャンピオンを柔軟に探索 (ID, name, normalized name)
      const detail = aiResult.championDetails?.find((d: any) => {
        if (!d) return false;
        const dIdNorm = normalizeChampKey(d.id || '');
        const dNameNorm = normalizeChampKey(d.name || '');
        return dIdNorm === cNorm || dNameNorm === cNorm || d.id === c.id || d.name === c.name;
      });

      const kit = getChampionKitTactics(c.name, role);

      // AIの返答が有効でプレースホルダーでない場合のみ採用し、それ以外はチャンピオン固有キットを採用
      const hasValidEarly = detail?.powerSpikes?.earlyLvl1to5 && !detail.powerSpikes.earlyLvl1to5.includes('Lv1〜5序盤スパイク');
      const hasValidMid = detail?.powerSpikes?.mid1to2Core && !detail.powerSpikes.mid1to2Core.includes('1〜2コア中盤スパイク');
      const hasValidLate = detail?.powerSpikes?.late3CorePlus && !detail.powerSpikes.late3CorePlus.includes('3コア終盤スパイク');

      const powerSpikes = (hasValidEarly && hasValidMid && hasValidLate)
        ? detail.powerSpikes
        : kit.powerSpikes;

      const hasValidFav = detail?.favoredMatchups?.length > 0 && !detail.favoredMatchups[0].enemy.includes('有利な相手');
      const favoredMatchups = hasValidFav
        ? detail.favoredMatchups
        : kit.favoredMatchups;

      const hasValidHard = detail?.hardMatchups?.length > 0 && !detail.hardMatchups[0].enemy.includes('苦手な相手');
      const hardMatchups = hasValidHard
        ? detail.hardMatchups
        : kit.hardMatchups;

      const hasValidAiGuide = detail?.aiTacticsGuide && !detail.aiTacticsGuide.includes('専属指南');
      const aiTacticsGuide = hasValidAiGuide
        ? detail.aiTacticsGuide
        : kit.tacticsGuide;

      return {
        ...c,
        powerSpikes,
        favoredMatchups,
        hardMatchups,
        winVsLossDiffs: c.winVsLossDiffs, // 100%実測計算値を直接使用
        aiTacticsGuide,
      };
    });

    const report = {
      summoner: {
        name: cleanName,
        tag: cleanTag,
        tier,
        role,
        isRealMatchData: rawMatches.length > 0,
        sampleMatchesCount: rawMatches.length,
        queueType,
        targetTier,
      },
      metrics: {
        survival: { score: survivalScore, avgDeaths, percentile: Math.max(2, Math.round(avgDeaths * 2.5)) },
        farm: { score: farmScore, csPerMin: avgCsPerMin, percentile: 15 },
        combat: { score: combatScore, kpPercent: avgKpPercent, percentile: Math.max(5, 100 - avgKpPercent) },
        objectives: { score: objScore },
        teamfight: { score: teamfightScore, avgKda },
        vision: {
          visionScorePerMin: avgVisionPerMin,
          // ★ 2026-10-07: 「ピンク推計（視界×1.6/0.9）」と「自陣/敵陣ワード比率（視界×12）」は計測していない値だったため削除
          percentile: 20,
        },
      },
      championProfiles: mergedChampionProfiles,
      sessionAnalytics: calculatedSessionAnalytics,
      analysis: aiResult,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error('Universal Deep intel error:', err);
    const msg = String(err?.message || '');
    let friendlyError = '深層解析エラーが発生しました。';
    if (msg.includes('404') || msg.includes('not found')) {
      friendlyError = '指定されたプレイヤーが見つかりませんでした。Riot ID（サモナー名#タグ）が正しいかご確認ください。';
    } else if (msg.includes('403') || msg.includes('Forbidden')) {
      friendlyError = 'Riot APIキーが無効または期限切れです。管理画面からAPIキーをご確認ください。';
    } else if (msg.includes('429') || msg.includes('Rate limit')) {
      friendlyError = 'Riot APIの呼び出し制限に達しました。少し時間を置いてから再度お試しください。';
    } else if (msg) {
      friendlyError = `解析エラー: ${msg}`;
    }
    return NextResponse.json({ error: friendlyError }, { status: 500 });
  }
}
