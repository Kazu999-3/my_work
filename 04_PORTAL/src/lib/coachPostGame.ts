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

  const enemyLaner = match.participants.find((p: any) => p.teamId !== me.teamId && p.lane === me.lane);

  const deathTimeline: string[] = [];
  const deathEvents: { min: number; phase: string; killer: string }[] = [];
  try {
    const timeline = await fetchMatchTimeline(targetMatchId, apiKey);
    const participants: any[] = timeline?.info?.participants || [];
    const myParticipantId = participants.find((p) => p.puuid === puuid)?.participantId;
    const participantIdToChampion = new Map<number, string>();
    participants.forEach((p) => {
      const champ = match.participants.find((mp: any) => mp.puuid === p.puuid)?.championName;
      if (champ) participantIdToChampion.set(p.participantId, champ);
    });

    if (myParticipantId) {
      const frames: any[] = timeline?.info?.frames || [];
      for (const frame of frames) {
        for (const ev of frame.events || []) {
          if (ev.type === 'CHAMPION_KILL' && ev.victimId === myParticipantId) {
            const min = Math.floor(ev.timestamp / 60000);
            const killerChamp = participantIdToChampion.get(ev.killerId) || '不明';
            const phase = min <= 10 ? '序盤' : min <= 20 ? '中盤' : '終盤';
            deathTimeline.push(`${min}分(${phase}): ${killerChamp}に討たれた`);
            deathEvents.push({ min, phase, killer: killerChamp });
          }
        }
      }
    }
  } catch (e) {
    console.warn('[coachPostGame] タイムライン取得に失敗（デス分析なしで続行）:', e);
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
  const prompt = `あなたはLoL振り返りコーチです。抽象的な精神論ではなく、以下のデータを具体的に引用しながら深く分析してください。
試合結果: ${me.win ? '✅ 勝利' : '❌ 敗北'} (${me.championName} / ロール: ${lane})
対面（同レーンの敵）: ${enemyLaner ? enemyLaner.championName : '不明（ロール不一致のため特定できず）'}
KDA: ${me.kills}/${me.deaths}/${me.assists} (KDA比: ${kda})
CS/min: ${csPerMin} (レーン基準目標: ${isSupport ? '以下' : '以上'} ${targetCs}) | Vision/min: ${visionPerMin} (目標: ${targetVision})
ダメージ: ${me.damageDealtToChampions.toLocaleString()}

弱点として特定された項目:
${weaknesses.length > 0 ? weaknesses.map((w) => `・${w}`).join('\n') : '・特になし（良いパフォーマンスです）'}

デス発生タイミング（分・フェーズ・討ち取った相手）:
${deathTimeline.length > 0 ? deathTimeline.map((d) => `・${d}`).join('\n') : '・デスなし、またはタイムライン取得不可'}

${spikeBlockPost ? `=== 時間帯別の強さ（パワースパイク）===\n${spikeBlockPost}\n` : ''}
${matchupCtx ? `=== ${me.championName} vs ${enemyLaner?.championName} 対面ナレッジ ===\n${matchupCtx}\n` : ''}
${knowledgeCtx ? `参考ナレッジ:\n${knowledgeCtx}\n` : ''}
${focus ? `\n=== この試合で意識すると宣言した「今日の焦点」===\n${focus}\n` : ''}

以下の観点を必ず含め、日本語600字程度で具体的にアドバイスしてください（データが乏しい項目は正直にその旨を述べた上で分かる範囲で分析すること）:
1. デスの傾向分析: デス発生タイミングが序盤/中盤/終盤のどこに偏っているか、誰にやられているかから読み取れるパターン（例: 同じ相手に連続で狩られている、終盤の集団戦での事故が多い等）を指摘する。パワースパイクデータがある場合は、デスが自分の弱い時間帯や相手の強い時間帯に集中していないかも分析する。
2. 対面関係を踏まえた具体策: ${enemyLaner ? `${enemyLaner.championName}という対面の特性（対面ナレッジがあれば引用）を踏まえ、次回このマッチアップで何を変えるべきか` : '対面が特定できない場合は、KDA/CS/Visionの数値から読み取れる立ち回りの課題'}を挙げる。
3. 次の試合での具体的アクション: 上記1・2を踏まえた、次回すぐ実践できる行動を1〜2つ提示する。${focus ? `\n4. 今日の焦点の達成度: 宣言した焦点「${focus}」を、この試合のデータ（KDA/デス傾向/CS/Vision等）に照らして達成できたか、できなかったかを最初に【達成】または【未達成】と明記した上で、その根拠を述べる。` : ''}`;

  const advice = await callGemini(prompt);

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
  };
}
