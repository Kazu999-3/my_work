/**
 * 試合後振り返り(コーチ)の中核ロジック。
 *
 * 元々は api/coach/analyze/route.ts の mode==='post' 内にのみ実装されており、
 * ポータル画面で「🔍 試合後」ボタンを手動で押した時にしか実行されなかった。
 * そのため「傾向」タブが集計する coach_analyses テーブルは、ユーザーが
 * 毎回ボタンを押さない限り一切データが増えなかった。
 * 日次Cron(api/cron/soloq-coach)からも同じロジックを呼べるよう、この関数として
 * 切り出す（HTTP経由の内部呼び出しにすると認証・ベースURL解決が余計に複雑になるため、
 * 同一ランタイム内の直接importで共有する）。
 */
import { supabaseAdmin as supabase } from './supabaseAdmin';
import { fetchPuuidByRiotId, fetchRankedSoloMatchIds, fetchMatchDetails, fetchMatchTimeline } from './riot';
import { getChampionSearchVariations } from './championNames';
import { getChampionKnowledge } from './championKnowledge';
import { callGeminiWithRetry } from './geminiClient';
import { analyzeSpatialContext, SpatialEvent } from './mapCoordinates';

async function callGemini(prompt: string, cacheKey?: string): Promise<string> {
  return callGeminiWithRetry(prompt, {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.7,
    maxOutputTokens: 2048,
    maxRetries: 3,
    cacheKey,
  });
}

async function searchKnowledge(keywords: string[]): Promise<string> {
  if (keywords.length === 0) return '';
  const expandedKeywords = keywords.flatMap((k) => getChampionSearchVariations(k));

  const champOr = expandedKeywords.map((k) => `champion.ilike.%${k}%`).join(',');
  const { data: champData } = await supabase
    .from('personal_knowledge')
    .select('title, content, champion, tags')
    .or(champOr)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  const championMatches = champData || [];

  const textOr = expandedKeywords
    .flatMap((kw) => [`title.ilike.%${kw}%`, `content.ilike.%${kw}%`])
    .join(',');
  const { data: textMatches } = await supabase
    .from('personal_knowledge')
    .select('title, content, champion, tags')
    .or(textOr)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const seen = new Set<string>();
  const merged = [...championMatches, ...(textMatches || [])].filter((d) => {
    if (seen.has(d.title)) return false;
    seen.add(d.title);
    return (d.content || '').length > 30;
  }).slice(0, 6);

  if (merged.length === 0) return '';
  return merged
    .map((d) => {
      const isArchived = d.tags?.includes('__DELETED__') ? ' (マージ済アーカイブ)' : '';
      return `【${d.title}】${d.champion && d.champion !== 'Unknown' ? ` (対象: ${d.champion})` : ''}${isArchived}\n${(d.content || '').slice(0, 600)}`;
    })
    .join('\n\n---\n\n');
}

async function searchMatchupSentinel(champion: string): Promise<string> {
  try {
    const knowledge = await getChampionKnowledge(supabase, champion);
    if (knowledge.hasData) return knowledge.text;
  } catch (e) {
    console.warn('[coachPostGame] getChampionKnowledge失敗、matchup_sentinelにフォールバック:', e);
  }

  const variations = getChampionSearchVariations(champion);
  const champQueries = variations.map((v) => `champion.ilike.%${v}%`).join(',');

  const { data: globalData } = await supabase
    .from('matchup_sentinel')
    .select('title, strategy, champion, enemy')
    .or(champQueries)
    .or('enemy.eq.GLOBAL,matchup_id.ilike.%GLOBAL%')
    .not('strategy', 'eq', '')
    .not('strategy', 'is', null)
    .limit(2);

  const { data: matchupData } = await supabase
    .from('matchup_sentinel')
    .select('title, strategy, champion, enemy')
    .or(champQueries)
    .not('enemy', 'eq', 'GLOBAL')
    .not('strategy', 'eq', '')
    .not('strategy', 'is', null)
    .not('champion', 'eq', 'SYSTEM')
    .order('matchup_id', { ascending: false })
    .limit(3);

  const combined = [...(globalData || []), ...(matchupData || [])];
  if (combined.length === 0) return '';

  let strategyText = combined
    .map((d) => {
      const vsInfo = d.enemy && d.enemy !== 'GLOBAL' ? ` vs ${d.enemy}` : ' (基本戦略)';
      return `【${d.champion || champion}${vsInfo}】\n${d.strategy || ''}`;
    })
    .join('\n\n---\n\n');

  if (strategyText.length > 800) {
    strategyText = strategyText.slice(0, 800) + '\n...（省略）';
  }
  return strategyText;
}

async function fetchPowerSpikeContext(champion: string): Promise<string> {
  if (!champion) return '';
  const variations = getChampionSearchVariations(champion);
  const orQuery = variations.map((v) => `champion.ilike.%${v}%`).join(',');

  const { data } = await supabase
    .from('champion_power_spikes')
    .select('champion, early_game_score, mid_game_score, late_game_score, peak_window, summary')
    .or(orQuery)
    .limit(1);

  if (!data || data.length === 0) return '';
  const s = data[0];
  const stars = (n: number) => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));
  return [
    `${s.champion} の時間帯別の強さ（5段階）:`,
    `- 序盤(1-9分): ${stars(s.early_game_score)}`,
    `- 中盤(10-20分): ${stars(s.mid_game_score)}`,
    `- 終盤(20分以降): ${stars(s.late_game_score)}`,
    s.peak_window ? `- ピーク: ${s.peak_window}` : '',
    s.summary ? `- 要約: ${s.summary}` : '',
  ].filter(Boolean).join('\n');
}

export interface PostGameReviewResult {
  result: {
    win: boolean;
    champion: string;
    enemyChampion: string | null;
    role: string;
    kda: string;
    kdaRatio: string;
    csPerMin: string;
    visionPerMin: string;
    damage: number;
    gameDuration: string;
  };
  weaknesses: string[];
  deathTimeline: string[];
  advice: string;
  focus: string | null;
  focusAchieved: boolean | null;
  matchId: string;
  champion: string;
  turningPoints?: string[];
  rootCauses?: string[];
  actionItems?: { action: string; why: string }[];
  mapEvents?: SpatialEvent[];
}

/**
 * 直近(または指定)のランクソロ1試合を分析し、coach_analysesへ構造化保存する。
 * matchIdを省略すると「一番最新のランクソロ試合」を対象にする(手動ボタンと同じ挙動)。
 * 指定すると、その特定の試合を対象にする(Cronが未分析分を1件ずつ処理するのに使う)。
 */
export async function runPostGameReview(opts: { matchId?: string; focus?: string } = {}): Promise<PostGameReviewResult> {
  const apiKey = process.env.RIOT_API_KEY!;
  const gameName = process.env.RIOT_GAME_NAME!;
  const tagLine = process.env.RIOT_TAG_LINE!;
  if (!apiKey || !gameName || !tagLine) {
    throw new Error('Riot API環境変数が未設定です。');
  }

  const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

  let targetMatchId = opts.matchId;
  if (!targetMatchId) {
    const matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 1);
    if (!matchIds.length) throw new Error('ランクソロの試合データが見つかりません。');
    targetMatchId = matchIds[0];
  }

  const match = await fetchMatchDetails(targetMatchId, apiKey);
  const me = match.participants.find((p: any) => p.puuid === puuid);
  if (!me) throw new Error('自分のデータが見つかりません。');

  const gameMins = match.gameDuration / 60;
  const csPerMin = ((me.totalMinionsKilled + me.neutralMinionsKilled) / gameMins).toFixed(1);
  const visionPerMin = (me.visionScore / gameMins).toFixed(2);
  const kda = me.deaths === 0 ? 'Perfect' : ((me.kills + me.assists) / me.deaths).toFixed(2);

  const lane = (me.lane || 'JUNGLE').toUpperCase();
  let targetCs = 6.0;
  let targetVision = 0.7;
  let isSupport = false;

  if (lane === 'JUNGLE') {
    targetCs = 5.0;
    targetVision = 0.8;
  } else if (lane === 'UTILITY' || lane === 'SUPPORT') {
    targetCs = 1.2;
    targetVision = 1.4;
    isSupport = true;
  } else if (lane === 'MIDDLE' || lane === 'MID' || lane === 'TOP') {
    targetCs = 6.5;
    targetVision = 0.5;
  } else if (lane === 'BOTTOM' || lane === 'ADC') {
    targetCs = 7.2;
    targetVision = 0.4;
  }

  const weaknesses: string[] = [];
  const csVal = parseFloat(csPerMin);
  const visVal = parseFloat(visionPerMin);

  if (isSupport) {
    if (csVal > targetCs) weaknesses.push(`CS/min ${csPerMin} (サポートにしてはCSを取りすぎています: 目標 ${targetCs}以下)`);
  } else {
    if (csVal < targetCs) weaknesses.push(`CS/min ${csPerMin} (目標: ${targetCs}以上)`);
  }
  if (visVal < targetVision) weaknesses.push(`Vision/min ${visionPerMin} (目標: ${targetVision}以上)`);
  if (me.deaths >= 7) weaknesses.push(`デス数 ${me.deaths} (要改善)`);
  if (kda !== 'Perfect' && parseFloat(kda) < 2.0) weaknesses.push(`KDA ${kda} (目標: 2.0以上)`);

  const enemyLaner = match.participants.find((p: any) => p.teamId !== me.teamId && (p.lane === me.lane || (lane === 'JUNGLE' && (p.lane === 'JUNGLE' || p.role === 'JUNGLE' || p.individualPosition === 'JUNGLE'))));

  const deathTimeline: string[] = [];
  const deathEvents: { min: number; phase: string; killer: string; teamGoldDiffAtDeath: number | null; nearbyFightKills: number }[] = [];
  const turningPoints: { min: number; deltaGold: number; summary: string }[] = [];
  const recallTrips: { min: number; items: string[]; goldSpent: number }[] = [];
  const mapEvents: SpatialEvent[] = [];
  let earlyLv1to6Events: string[] = [];

  try {
    const timeline = await fetchMatchTimeline(targetMatchId, apiKey);
    const participants: any[] = timeline?.info?.participants || [];
    const myParticipantId = participants.find((p) => p.puuid === puuid)?.participantId;
    const participantIdToChampion = new Map<number, string>();
    const participantIdToTeam = new Map<number, number>();
    participants.forEach((p) => {
      const matchParticipant = match.participants.find((mp: any) => mp.puuid === p.puuid);
      if (matchParticipant?.championName) participantIdToChampion.set(p.participantId, matchParticipant.championName);
      if (matchParticipant?.teamId) participantIdToTeam.set(p.participantId, matchParticipant.teamId);
    });

    if (myParticipantId) {
      const frames: any[] = timeline?.info?.frames || [];
      const allKillTimestamps: number[] = [];
      const rawDeaths: {
        timestamp: number;
        min: number;
        sec: number;
        phase: string;
        killer: string;
        teamGoldDiffAtDeath: number | null;
        pos?: { x: number; y: number };
        spatialInfo?: ReturnType<typeof analyzeSpatialContext>;
      }[] = [];
      let previousTeamGoldDiff: number | null = null;

      for (let fIdx = 0; fIdx < frames.length; fIdx++) {
        const frame = frames[fIdx];
        const min = Math.floor(frame.timestamp / 60000);
        let currentTeamGoldDiff: number | null = null;

        const pFrames = frame.participantFrames || {};
        const goldEntries = Object.keys(pFrames);

        // 同フレームにおける全参加者の位置情報リスト
        const allParticipantsPositions: { participantId: number; teamId: number; pos: { x: number; y: number } }[] = [];
        if (goldEntries.length > 0) {
          let myTeamGold = 0;
          let enemyTeamGold = 0;
          for (const pidStr of goldEntries) {
            const pid = Number(pidStr);
            const gold = pFrames[pidStr]?.totalGold || 0;
            const pPos = pFrames[pidStr]?.position;
            const team = participantIdToTeam.get(pid);
            if (team === me.teamId) myTeamGold += gold;
            else if (team !== undefined) enemyTeamGold += gold;

            if (pPos && team !== undefined) {
              allParticipantsPositions.push({ participantId: pid, teamId: team, pos: pPos });
            }
          }
          currentTeamGoldDiff = myTeamGold - enemyTeamGold;

          // ターニングポイント検知: 1分間でゴールド差が1200以上急激に悪化/好転した瞬間
          if (previousTeamGoldDiff !== null && currentTeamGoldDiff !== null) {
            const diffChange = currentTeamGoldDiff - previousTeamGoldDiff;
            if (diffChange <= -1200) {
              turningPoints.push({
                min,
                deltaGold: diffChange,
                summary: `${min}分: チームゴールド差が ${diffChange}G 急落（集団戦敗北または複数キル献上・オブジェクト喪失の可能性）`,
              });
            } else if (diffChange >= 1200) {
              turningPoints.push({
                min,
                deltaGold: diffChange,
                summary: `${min}分: チームゴールド差が +${diffChange}G 急伸（大きな有利獲得）`,
              });
            }
          }
          previousTeamGoldDiff = currentTeamGoldDiff;
        }

        for (const ev of frame.events || []) {
          const evMin = Math.floor(ev.timestamp / 60000);
          const evSec = Math.floor((ev.timestamp % 60000) / 1000);

          if (ev.type === 'CHAMPION_KILL') {
            allKillTimestamps.push(ev.timestamp);
            const killerChamp = participantIdToChampion.get(ev.killerId) || '敵';
            const victimChamp = participantIdToChampion.get(ev.victimId) || '味方';
            const evPos = ev.position || pFrames[String(ev.victimId)]?.position;

            let spatialInfo: ReturnType<typeof analyzeSpatialContext> | undefined = undefined;
            if (evPos && allParticipantsPositions.length > 0) {
              spatialInfo = analyzeSpatialContext({
                eventPos: evPos,
                myParticipantId,
                myTeamId: me.teamId,
                allParticipantsPositions,
              });
            }

            if (ev.victimId === myParticipantId) {
              const phase = evMin <= 10 ? '序盤' : evMin <= 20 ? '中盤' : '終盤';
              rawDeaths.push({
                timestamp: ev.timestamp,
                min: evMin,
                sec: evSec,
                phase,
                killer: killerChamp,
                teamGoldDiffAtDeath: currentTeamGoldDiff,
                pos: evPos,
                spatialInfo,
              });

              if (evPos) {
                mapEvents.push({
                  min: evMin,
                  sec: evSec,
                  timestamp: ev.timestamp,
                  type: 'DEATH',
                  position: evPos,
                  areaName: spatialInfo?.areaName || '不明エリア',
                  isolationLevel: spatialInfo?.isolationLevel || 'CLOSE',
                  closestAllyDistance: spatialInfo?.closestAllyDistance ?? null,
                  alliesCountNearby: spatialInfo?.alliesCountNearby ?? 0,
                  enemiesCountNearby: spatialInfo?.enemiesCountNearby ?? 0,
                  summary: `${evMin}分${evSec}秒: ${killerChamp}に討伐 (${spatialInfo?.areaName || ''})`,
                  killer: killerChamp,
                });
              }
            } else if (ev.killerId === myParticipantId) {
              if (evPos) {
                mapEvents.push({
                  min: evMin,
                  sec: evSec,
                  timestamp: ev.timestamp,
                  type: 'KILL',
                  position: evPos,
                  areaName: spatialInfo?.areaName || '不明エリア',
                  isolationLevel: spatialInfo?.isolationLevel || 'CLOSE',
                  closestAllyDistance: spatialInfo?.closestAllyDistance ?? null,
                  alliesCountNearby: spatialInfo?.alliesCountNearby ?? 0,
                  enemiesCountNearby: spatialInfo?.enemiesCountNearby ?? 0,
                  summary: `${evMin}分${evSec}秒: ${victimChamp}をキル (${spatialInfo?.areaName || ''})`,
                  victim: victimChamp,
                });
              }
            }

            // Lv1〜6(〜8分)のJG関連重要交戦
            if (evMin <= 8) {
              const locStr = spatialInfo ? ` [場所: ${spatialInfo.areaName}]` : '';
              if (ev.victimId === myParticipantId) {
                earlyLv1to6Events.push(`${evMin}分${evSec}秒: 【被キル】${killerChamp}に討伐${locStr}`);
              } else if (ev.killerId === myParticipantId) {
                earlyLv1to6Events.push(`${evMin}分${evSec}秒: 【キル獲得】${victimChamp}をキル${locStr}`);
              }
            }
          } else if (ev.type === 'ELITE_MONSTER_KILL') {
            const objMin = Math.floor(ev.timestamp / 60000);
            const killerTeam = ev.killerTeamId === me.teamId ? '味方' : '敵';
            const mName = ev.monsterType || ev.monsterSubType || '中立モンスター';
            if (objMin <= 15) {
              earlyLv1to6Events.push(`${objMin}分: 【${mName}】${killerTeam}が獲得`);
            }
            if (ev.position) {
              mapEvents.push({
                min: objMin,
                sec: evSec,
                timestamp: ev.timestamp,
                type: 'OBJECTIVE',
                position: ev.position,
                areaName: ev.position.y > 7500 ? '👾 バロン/グラブピット' : '🐉 ドラゴンピット',
                isolationLevel: 'CLOSE',
                closestAllyDistance: null,
                alliesCountNearby: 0,
                enemiesCountNearby: 0,
                summary: `${objMin}分: ${killerTeam}が${mName}を獲得`,
                objName: mName,
              });
            }
          }
        }
      }

      const FIGHT_WINDOW_MS = 20000;
      for (const d of rawDeaths) {
        const nearbyFightKills = Math.max(
          0,
          allKillTimestamps.filter((t) => Math.abs(t - d.timestamp) <= FIGHT_WINDOW_MS).length - 1
        );
        const fightNote = nearbyFightKills > 0
          ? `、前後20秒以内に他に${nearbyFightKills}件のキルが発生(集団戦の最中)`
          : d.spatialInfo?.isolationLevel === 'ISOLATED'
            ? `、味方最寄りまで距離${d.spatialInfo.closestAllyDistance}（完全孤立）`
            : '、味方近傍での被キャッチ';
        
        const locNote = d.spatialInfo ? `【${d.spatialInfo.areaName}】(周囲味方${d.spatialInfo.alliesCountNearby}人/敵${d.spatialInfo.enemiesCountNearby}人)` : '';
        deathTimeline.push(`${d.min}分${d.sec}秒(${d.phase}): ${d.killer}に討伐 ${locNote}${d.teamGoldDiffAtDeath !== null ? `（総ゴールド差: ${d.teamGoldDiffAtDeath >= 0 ? '+' : ''}${d.teamGoldDiffAtDeath}G）` : ''}${fightNote}`);
        deathEvents.push({ min: d.min, phase: d.phase, killer: d.killer, teamGoldDiffAtDeath: d.teamGoldDiffAtDeath, nearbyFightKills });
      }
    }
  } catch (e) {
    console.warn('[coachPostGame] タイムライン取得に失敗（続行）:', e);
  }

  const knowledgeCtx = await searchKnowledge([
    me.championName,
    ...(enemyLaner ? [enemyLaner.championName] : []),
    ...weaknesses.slice(0, 2).map((w) => w.split(' ')[0]),
  ]);
  const matchupCtx = await searchMatchupSentinel(me.championName).catch(() => '');

  const [mySpikePost, enemySpikePost] = await Promise.all([
    fetchPowerSpikeContext(me.championName).catch(() => ''),
    enemyLaner ? fetchPowerSpikeContext(enemyLaner.championName).catch(() => '') : Promise.resolve(''),
  ]);
  const spikeBlockPost = [mySpikePost, enemySpikePost].filter(Boolean).join('\n\n');

  const focus = opts.focus;
  const isJungle = lane === 'JUNGLE';

  const prompt = `あなたはLoLプロフェッショナルコーチです。特にジャングル（JG）の戦術理論、最序盤のルート選択、パワースパイク、オブジェクト判断、および連敗防止メンタルに精通しています。
以下の客観データを元に、抽象論を排して具体的に振り返り・添削を行ってください。

【プレイヤー情報】
・ロール: ${lane} ${isJungle ? '（※JGメインプレイヤー）' : ''}
・使用チャンピオン: ${me.championName} vs 敵JG/対面: ${enemyLaner ? enemyLaner.championName : '特定不可'}
・勝敗: ${me.win ? '✅ 勝利' : '❌ 敗北'}
・KDA: ${me.kills}/${me.deaths}/${me.assists} (比率: ${kda}) | ダメージ: ${me.damageDealtToChampions.toLocaleString()}
・CS/min: ${csPerMin} (JG基準: 5.5〜6.5/min) | Vision/min: ${visionPerMin} (JG目標: 0.8以上)

【弱点・課題特定】
${weaknesses.length > 0 ? weaknesses.map((w) => `・${w}`).join('\n') : '・特になし'}

【最序盤(Lv1〜8分)の重要イベント】
${earlyLv1to6Events.length > 0 ? earlyLv1to6Events.map((e) => `・${e}`).join('\n') : '・目立った早期イベントなし'}

【試合が壊れたターニングポイント】
${turningPoints.length > 0 ? turningPoints.map((tp) => `・${tp.summary}`).join('\n') : '・急激なゴールド差変動なし'}

【デス発生タイムライン】
${deathTimeline.length > 0 ? deathTimeline.map((d) => `・${d}`).join('\n') : '・デスなし'}

${spikeBlockPost ? `=== 時間帯別の強さ（パワースパイク）===\n${spikeBlockPost}\n` : ''}
${matchupCtx ? `=== ${me.championName} vs ${enemyLaner?.championName} 対面ナレッジ ===\n${matchupCtx}\n` : ''}
${knowledgeCtx ? `参考ナレッジ:\n${knowledgeCtx}\n` : ''}
${focus ? `\n=== この試合で意識すると宣言した「今日の焦点」===\n${focus}\n` : ''}

【コーチング指示】
以下の構成で日本語600字程度でアドバイスし、最後に必ずJSONブロックを出力してください:
1. 試合が崩れた根本要因の分析: ${isJungle ? 'JG視点での最序盤(Lv1〜6)のルート・スカトル争奪・ガンク成否、ヴォイドグラブ/ドラゴン前の主導権判断、およびターニングポイント時のポジショニング' : '序盤のレーン主導権とターニングポイント'}。
2. 対面JGとのパワースパイク比較: 自分と相手のどちらがどの時間帯に強かったか、無理な戦闘を仕掛けていなかったか。
3. 次戦の修正アクション（1〜2点）: 次の試合ですぐ実践できる具体的な行動。
${focus ? `4. 今日の焦点の達成度: 「${focus}」を【達成】または【未達成】と明記した上で根拠を述べる。` : ''}

必ず末尾に以下のJSONを出力してください:
\`\`\`json
{
  "rootCauses": ["根本原因タグ1", "根本原因タグ2"],
  "actionItems": [
    { "action": "次戦で必ずやる具体的行動(30字以内)", "why": "その理由(40字以内)" }
  ]
}
\`\`\``;

  const rawAdvice = await callGemini(prompt);

  let advice = rawAdvice;
  let rootCauses: string[] = [];
  let actionItems: { action: string; why: string }[] = [];

  try {
    const jsonMatch = rawAdvice.match(/```json\s*([\s\S]*?)\s*```/) || rawAdvice.match(/\{[\s\S]*"actionItems"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      if (Array.isArray(parsed.rootCauses)) rootCauses = parsed.rootCauses;
      if (Array.isArray(parsed.actionItems)) actionItems = parsed.actionItems;
      advice = rawAdvice.replace(/```json[\s\S]*```/, '').trim();
    }
  } catch (e) {
    console.warn('[coachPostGame] JSON parsing fallback:', e);
  }

  let focusAchieved: boolean | null = null;
  if (focus) {
    if (advice.includes('【達成】')) focusAchieved = true;
    else if (advice.includes('【未達成】')) focusAchieved = false;
  }

  try {
    await supabase
      .from('coach_analyses')
      .upsert({
        puuid,
        match_id: targetMatchId,
        champion: me.championName,
        role: lane,
        enemy_champion: enemyLaner ? enemyLaner.championName : null,
        win: me.win,
        kills: me.kills,
        deaths: me.deaths,
        assists: me.assists,
        kda_ratio: kda === 'Perfect' ? null : parseFloat(kda),
        cs_per_min: parseFloat(csPerMin),
        vision_per_min: parseFloat(visionPerMin),
        death_timeline: deathEvents,
        weaknesses,
        focus: focus || null,
        focus_achieved: focusAchieved,
        advice,
      }, { onConflict: 'puuid,match_id' });
  } catch (e) {
    console.warn('[coachPostGame] coach_analysesへの構造化保存に失敗（続行）:', e);
  }

  return {
    result: {
      win: me.win,
      champion: me.championName,
      enemyChampion: enemyLaner ? enemyLaner.championName : null,
      role: lane,
      kda: `${me.kills}/${me.deaths}/${me.assists}`,
      kdaRatio: kda,
      csPerMin,
      visionPerMin,
      damage: me.damageDealtToChampions,
      gameDuration: Math.floor(gameMins) + '分',
    },
    weaknesses,
    deathTimeline,
    advice,
    focus: focus || null,
    focusAchieved,
    matchId: targetMatchId,
    champion: me.championName,
    turningPoints: turningPoints.map(t => t.summary),
    rootCauses,
    actionItems,
    mapEvents,
  };
}

