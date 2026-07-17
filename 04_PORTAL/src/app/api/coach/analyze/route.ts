import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchPuuidByRiotId,
  fetchRecentMatchIds,
  fetchMatchDetails,
  fetchMatchTimeline,
  fetchLeagueByPuuid,
} from '../../../../lib/riot';
// チャンピオン表記揺れの正規化は src/lib/championNames.ts に共通化済み
// （以前はこのファイルにだけローカル定義されており、他の場所で同じマップを
// 再実装する必要があった）。
import { getChampionSearchVariations, normalizeChampionName } from '../../../../lib/championNames';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================
// Gemini APIヘルパー
// 実体は src/lib/geminiClient.ts に一本化済み（リトライ・バックオフ・キャッシュ共通化）。
// cacheKey を渡す呼び出し元は同一プロンプトの再生成を24h抑止できる。
// ============================
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

async function callGemini(prompt: string, cacheKey?: string): Promise<string> {
  // 'gemini-2.0-flash-lite' はこのAPIキーではRPM/RPD上限が0（=常に429）だったため、
  // 最もクォータに余裕のある 'gemini-3.1-flash-lite'（15 RPM / 500 RPD）に変更
  // （Google AI Studioの利用状況で確認済み。'gemini-2.5-flash-lite'は10 RPM/20 RPDしかない）。
  return callGeminiWithRetry(prompt, {
    model: 'gemini-3.1-flash-lite',
    temperature: 0.7,
    maxOutputTokens: 2048, // 分析を深くした分、出力が途中で切れないよう引き上げ
    maxRetries: 3,
    cacheKey,
  });
}

// ============================
// ナレッジDB検索（アーカイブ・未マージ含む）
// ============================
async function searchKnowledge(keywords: string[]): Promise<string> {
  if (keywords.length === 0) return '';

  // 各キーワードに対して表記揺れを展開
  const expandedKeywords = keywords.flatMap(k => getChampionSearchVariations(k));

  // 1. championカラムで一致検索（最高精度）
  let championMatches: any[] = [];
  const champOr = expandedKeywords.map((k) => `champion.ilike.%${k}%`).join(',');
  const { data: champData } = await supabase
    .from('personal_knowledge')
    .select('title, content, champion, tags')
    .or(champOr)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  championMatches = champData || [];

  // 2. title + content の全文検索
  const textOr = expandedKeywords
    .flatMap((kw) => [
      `title.ilike.%${kw}%`,
      `content.ilike.%${kw}%`,
    ])
    .join(',');

  const { data: textMatches } = await supabase
    .from('personal_knowledge')
    .select('title, content, champion, tags')
    .or(textOr)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  // 重複排除
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

// ============================
// チャンピオン辞典検索（重複クリーンアップ付き）
// ============================
async function searchMatchupSentinel(champion: string): Promise<string> {
  const variations = getChampionSearchVariations(champion);
  const champQueries = variations.map(v => `champion.ilike.%${v}%`).join(',');

  // GLOBAL（基本戦略）を優先取得
  const { data: globalData } = await supabase
    .from('matchup_sentinel')
    .select('title, strategy, champion, enemy')
    .or(champQueries)
    .or('enemy.eq.GLOBAL,matchup_id.ilike.%GLOBAL%')
    .not('strategy', 'eq', '')
    .not('strategy', 'is', null)
    .limit(2);

  // マッチアップデータ（対面別）も取得
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
      return `【${d.champion || champion}${vsInfo}】\n${(d.strategy || '')}`;
    })
    .join('\n\n---\n\n');

  // 長すぎる場合は文字数カットで対応（Gemini呼び出し回数を節約）
  if (strategyText.length > 800) {
    strategyText = strategyText.slice(0, 800) + '\n...（省略）';
  }

  return strategyText;
}

// ============================
// 時間帯別の強さ（パワースパイク）コンテキスト取得
// champion_power_spikes（power_spike_generator.py が自動生成するテーブル）を読み、
// コーチのアドバイスに「いつ強い/弱いか」の時間軸を与える。
// これまでこの構造化データはチャンピオン辞典ページの表示にしか使われておらず、
// コーチAI側は活用できていなかった。
// ============================
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

// ============================
// プレイヤーの対敵過去勝率の集計
// ============================
async function getPlayerCounterStats(playerName: string, enemyChampion: string): Promise<string> {
  if (!playerName || !enemyChampion) return '';
  const enemyVariations = getChampionSearchVariations(enemyChampion);

  // 1. 直近の対戦履歴から、敵に対面チャンピオンが存在する試合を洗い出す
  // まずはプレイヤーの過去200件の参加レコードを取得
  const { data: participations } = await supabase
    .from('ktm_match_participants')
    .select('match_id, champion_name, team, ktm_matches(*)')
    .eq('player_name', playerName)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!participations || participations.length === 0) return '';

  const matchIds = participations.map((p) => p.match_id);

  // 2. それらの試合で、敵チームに対面チャンピオン（enemyChampion）がいたレコードを検索
  const { data: enemies } = await supabase
    .from('ktm_match_participants')
    .select('match_id, team, champion_name')
    .in('match_id', matchIds)
    .or(enemyVariations.map((v) => `champion_name.ilike.%${v}%`).join(','));

  if (!enemies || enemies.length === 0) return '';

  // 試合IDごとに敵チームの色と自分のチャンピオン、勝敗をマッピング
  const enemyMatchMap = new Map<string, string>(); // match_id -> enemy_team
  enemies.forEach((e) => {
    enemyMatchMap.set(e.match_id, e.team);
  });

  const statsMap = new Map<string, { win: number; loss: number }>();

  participations.forEach((p: any) => {
    const enemyTeam = enemyMatchMap.get(p.match_id);
    // 敵チームが自分と異なる場合のみ対面データとしてカウント
    if (enemyTeam && enemyTeam !== p.team && p.ktm_matches) {
      const matchData = Array.isArray(p.ktm_matches) ? p.ktm_matches[0] : p.ktm_matches;
      const winningTeam = matchData?.winning_team;
      const isWin = p.team === winningTeam;
      const myChamp = p.champion_name || 'Unknown';
      const stat = statsMap.get(myChamp) || { win: 0, loss: 0 };
      if (isWin) stat.win++;
      else stat.loss++;
      statsMap.set(myChamp, stat);
    }
  });

  if (statsMap.size === 0) return '';

  let statsStr = `【過去の対 ${enemyChampion} 実績データ】\n`;
  statsMap.forEach((val, champ) => {
    const total = val.win + val.loss;
    const rate = Math.round((val.win / total) * 100);
    statsStr += `・${champ}を使用時: ${val.win}勝 ${val.loss}敗 (勝率 ${rate}%)\n`;
  });

  return statsStr;
}

// ============================
// ティルト診断ロジック
// ============================
function diagnoseTilt(matches: any[]): {
  level: 'green' | 'yellow' | 'red';
  label: string;
  score: number;
  reasons: string[];
} {
  if (matches.length === 0) return { level: 'green', label: '正常', score: 0, reasons: [] };

  const recent = matches.slice(0, 5);
  const losses = recent.filter((m) => !m.win).length;
  const reasons: string[] = [];
  let score = 0;

  // 連敗チェック
  let streak = 0;
  for (const m of recent) {
    if (!m.win) streak++;
    else break;
  }
  if (streak >= 3) { score += 40; reasons.push(`${streak}連敗中`); }
  else if (streak === 2) { score += 20; reasons.push('2連敗中'); }

  // 直近5試合の負け率
  if (losses >= 4) { score += 30; reasons.push(`直近5試合で${losses}敗`); }
  else if (losses >= 3) { score += 15; reasons.push(`直近5試合で${losses}敗`); }

  // デス数が多い試合
  const highDeathGames = recent.filter((m) => m.deaths >= 7).length;
  if (highDeathGames >= 2) { score += 15; reasons.push(`デス7以上の試合が${highDeathGames}件`); }

  // KDA悪化チェック
  const avgKda = recent.reduce((s, m) => s + (m.kills + m.assists) / Math.max(m.deaths, 1), 0) / recent.length;
  if (avgKda < 1.5) { score += 15; reasons.push(`平均KDA ${avgKda.toFixed(1)} (低下傾向)`); }

  const level: 'green' | 'yellow' | 'red' =
    score >= 50 ? 'red' : score >= 25 ? 'yellow' : 'green';
  const label =
    level === 'red' ? '🔴 要休憩（ティルト高）' :
    level === 'yellow' ? '🟡 注意（やや負荷あり）' : '🟢 良好（続けてOK）';

  return { level, label, score, reasons };
}

// ============================
// coach_analyses の蓄積ログから傾向を集計する共通ヘルパー（trends / practice_menu 両モードで使用）
// ============================
interface TrendAggregates {
  count: number;
  winRate: number;
  totalDeaths: number;
  deathPhases: { 序盤: number; 中盤: number; 終盤: number };
  topKillers: { champion: string; count: number }[];
  topWeaknesses: { label: string; count: number }[];
  csTrend: { recent: number; older: number };
  visionTrend: { recent: number; older: number };
}

function computeTrendAggregates(analyses: any[]): TrendAggregates {
  const deathPhases = { 序盤: 0, 中盤: 0, 終盤: 0 };
  const killerCount: Record<string, number> = {};
  let totalDeaths = 0;
  for (const a of analyses) {
    for (const ev of (a.death_timeline || []) as { phase: string; killer: string }[]) {
      if (ev.phase && deathPhases[ev.phase as keyof typeof deathPhases] !== undefined) deathPhases[ev.phase as keyof typeof deathPhases]++;
      if (ev.killer && ev.killer !== '不明') killerCount[ev.killer] = (killerCount[ev.killer] || 0) + 1;
      totalDeaths++;
    }
  }
  const topKillers = Object.entries(killerCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([champion, count]) => ({ champion, count }));

  const weaknessCount: Record<string, number> = {};
  for (const a of analyses) {
    for (const w of (a.weaknesses || []) as string[]) {
      const cat = String(w).split(' ')[0].split('(')[0].trim();
      if (cat) weaknessCount[cat] = (weaknessCount[cat] || 0) + 1;
    }
  }
  const topWeaknesses = Object.entries(weaknessCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const half = Math.floor(analyses.length / 2);
  const recent = analyses.slice(0, half || 1);
  const older = analyses.slice(half || 1);
  const num = (a: any[], k: string) => a.map((x) => Number(x[k])).filter((v) => !isNaN(v));
  const csTrend = { recent: +avg(num(recent, 'cs_per_min')).toFixed(1), older: +avg(num(older, 'cs_per_min')).toFixed(1) };
  const visionTrend = { recent: +avg(num(recent, 'vision_per_min')).toFixed(2), older: +avg(num(older, 'vision_per_min')).toFixed(2) };
  const winRate = Math.round((analyses.filter((a) => a.win).length / analyses.length) * 100);

  return { count: analyses.length, winRate, totalDeaths, deathPhases, topKillers, topWeaknesses, csTrend, visionTrend };
}

// ============================
// メインAPI
// ============================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode: 'pre' | 'post' | 'matchup' | 'tilt' | 'trends' = body.mode || 'pre';
    const championInput: string = body.champion || '';
    const enemyChampionInput: string = body.enemyChampion || '';

    // 表記揺れの標準化
    const champion = normalizeChampionName(championInput);
    const enemyChampion = normalizeChampionName(enemyChampionInput);

    const apiKey = process.env.RIOT_API_KEY!;
    const gameName = process.env.RIOT_GAME_NAME!;
    const tagLine = process.env.RIOT_TAG_LINE!;

    if (!apiKey || !gameName || !tagLine) {
      return NextResponse.json({ error: 'Riot API環境変数が未設定です。' }, { status: 500 });
    }

    // PUUID取得
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    // ----------------------------
    // MODE: trends - 直近の傾向分析（coach_analysesの蓄積データを集計）
    // ----------------------------
    if (mode === 'trends') {
      const limit = Math.min(50, Math.max(5, Number(body.limit) || 20));
      const { data: rows } = await supabase
        .from('coach_analyses')
        .select('*')
        .eq('puuid', puuid)
        .order('created_at', { ascending: false })
        .limit(limit);

      const analyses = rows || [];
      if (analyses.length < 3) {
        return NextResponse.json({
          mode: 'trends',
          enough: false,
          count: analyses.length,
          message: '傾向分析には試合後振り返りの蓄積が3件以上必要です。「🔍 試合後」を数試合ぶん実行してください。',
        });
      }

      const agg = computeTrendAggregates(analyses);
      const { deathPhases: phaseCount, topKillers, topWeaknesses, csTrend, visionTrend, winRate, totalDeaths } = agg;

      // LLMで傾向の要約と今週のフォーカスを1つ提案
      const trendPrompt = `あなたはLoLの成長コーチです。あるプレイヤーの直近${analyses.length}試合の集計データから、繰り返し現れる課題を1つに絞り込み、今週の練習フォーカスを提案してください。

デス時間帯の分布（回数）: 序盤${phaseCount.序盤} / 中盤${phaseCount.中盤} / 終盤${phaseCount.終盤}
繰り返し狩られている相手: ${topKillers.map((k) => `${k.champion}(${k.count})`).join(', ') || 'なし'}
再発している弱点: ${topWeaknesses.map((w) => `${w.label}(${w.count})`).join(', ') || 'なし'}
CS/min傾向: 直近${csTrend.recent} ← 以前${csTrend.older}
Vision/min傾向: 直近${visionTrend.recent} ← 以前${visionTrend.older}
勝率: ${winRate}%

日本語300字程度で、(1)最も繰り返している課題の指摘、(2)その原因の仮説、(3)今週意識すべきフォーカスを1つだけ、具体的に述べてください。`;
      const summary = await callGemini(trendPrompt, `trends:${puuid}:${analyses.length}`);

      return NextResponse.json({
        mode: 'trends',
        enough: true,
        count: analyses.length,
        winRate,
        totalDeaths,
        deathPhases: phaseCount,
        topKillers,
        topWeaknesses,
        csTrend,
        visionTrend,
        summary,
      });
    }

    // ----------------------------
    // MODE: practice_menu - 蓄積データから今週の練習メニューを構造化生成
    // ----------------------------
    if (mode === 'practice_menu') {
      const limit = Math.min(50, Math.max(5, Number(body.limit) || 20));
      const { data: rows } = await supabase
        .from('coach_analyses')
        .select('*')
        .eq('puuid', puuid)
        .order('created_at', { ascending: false })
        .limit(limit);

      const analyses = rows || [];
      if (analyses.length < 3) {
        return NextResponse.json({
          mode: 'practice_menu',
          enough: false,
          count: analyses.length,
          message: '練習メニュー生成には試合後振り返りの蓄積が3件以上必要です。',
        });
      }

      const agg = computeTrendAggregates(analyses);
      const menuPrompt = `あなたはLoLの成長コーチです。あるプレイヤーの直近${analyses.length}試合の集計から、今週取り組むべき練習メニューを作ってください。

デス時間帯（回数）: 序盤${agg.deathPhases.序盤} / 中盤${agg.deathPhases.中盤} / 終盤${agg.deathPhases.終盤}
繰り返し狩られている相手: ${agg.topKillers.map((k) => `${k.champion}(${k.count})`).join(', ') || 'なし'}
再発している弱点: ${agg.topWeaknesses.map((w) => `${w.label}(${w.count})`).join(', ') || 'なし'}
CS/min: 直近${agg.csTrend.recent} / 以前${agg.csTrend.older}　Vision/min: 直近${agg.visionTrend.recent} / 以前${agg.visionTrend.older}　勝率: ${agg.winRate}%

上記データの弱点に直結する、具体的で実行可能な練習項目を3〜4個作ってください。必ず以下のJSON形式のみを出力（前置き・コードブロック禁止）。各項目は日本語:
{
  "menu": [
    { "title": "<練習の狙い(20字以内)>", "detail": "<具体的な練習内容・意識点(60字以内)>", "target": "<達成目標(例: 3戦, 10分デス0, CS7.0/min など)>" }
  ],
  "note": "<全体の一言アドバイス(50字以内)>"
}`;
      const raw = await callGemini(menuPrompt, `menu:${puuid}:${analyses.length}`);

      let parsed: any = null;
      try {
        let cleaned = raw.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart) cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        parsed = JSON.parse(cleaned);
      } catch {
        // パース失敗時は生テキストを1項目として返す（UI側で表示可能）
        parsed = { menu: [{ title: '今週の練習', detail: raw.slice(0, 200), target: '' }], note: '' };
      }

      return NextResponse.json({
        mode: 'practice_menu',
        enough: true,
        count: analyses.length,
        menu: Array.isArray(parsed.menu) ? parsed.menu : [],
        note: parsed.note || '',
      });
    }

    // ----------------------------
    // MODE: tilt - ティルト診断
    // ----------------------------
    if (mode === 'tilt') {
      const matchIds = await fetchRecentMatchIds(puuid, apiKey, 10, 420).catch(() =>
        fetchRecentMatchIds(puuid, apiKey, 10)
      );

      const matchDetails = await Promise.all(
        matchIds.slice(0, 10).map((id) => fetchMatchDetails(id, apiKey).catch(() => null))
      );

      const myMatches = matchDetails
        .filter(Boolean)
        .map((m) => {
          const me = m!.participants.find((p) => p.puuid === puuid);
          if (!me) return null;
          return {
            win: me.win,
            kills: me.kills,
            deaths: me.deaths,
            assists: me.assists,
            champion: me.championName,
          };
        })
        .filter(Boolean) as any[];

      const tilt = diagnoseTilt(myMatches);
      const knowledgeCtx = tilt.level !== 'green'
        ? await searchKnowledge(['メンタル', 'ティルト', '連敗', '休憩'])
        : '';

      const prompt = `あなたはLoLのメンタルコーチです。
プレイヤーの直近${myMatches.length}試合のデータ:
${myMatches.map((m, i) => `${i + 1}. ${m.champion} ${m.win ? '✅勝' : '❌負'} KDA: ${m.kills}/${m.deaths}/${m.assists}`).join('\n')}

ティルト判定: ${tilt.label} (スコア: ${tilt.score})
理由: ${tilt.reasons.join('、') || 'なし'}

${knowledgeCtx ? `参考ナレッジ:\n${knowledgeCtx}\n` : ''}

上記を踏まえて、今の状態への率直なメンタルアドバイスを日本語で200字以内で書いてください。
${tilt.level === 'red' ? '休憩を強く勧める内容にしてください。' : ''}
${tilt.level === 'green' ? 'ポジティブに背中を押す内容にしてください。' : ''}`;

      const advice = await callGemini(prompt);

      return NextResponse.json({ mode: 'tilt', tilt, recentMatches: myMatches, advice });
    }

    // ----------------------------
    // MODE: matchup - マッチアップ解析
    // ----------------------------
    if (mode === 'matchup') {
      if (!champion || !enemyChampion) {
        return NextResponse.json({ error: 'champion と enemyChampion を指定してください。' }, { status: 400 });
      }

      // ナレッジDB、チャンピオン辞典、過去勝率データ、時間帯別の強さを並行して取得
      const [knowledgeCtx, sentinelCtx, counterStats, mySpike, enemySpike] = await Promise.all([
        searchKnowledge([champion, enemyChampion, 'マッチアップ', 'matchup']),
        searchMatchupSentinel(champion),
        getPlayerCounterStats(gameName, enemyChampion),
        fetchPowerSpikeContext(champion),
        fetchPowerSpikeContext(enemyChampion),
      ]);

      const spikeBlock = [mySpike, enemySpike].filter(Boolean).join('\n\n');

      const prompt = `あなたはLoL攻略コーチです。
担当チャンピオン: ${champion}
対面の敵: ${enemyChampion}

以下の参考データやナレッジを踏まえ、このマッチアップで勝つための具体的なアドバイスを日本語で300字以内で述べてください。
ポイントは「序盤の動き方」「Lvスパイク」「気をつけるべき敵スキル」「有利な交戦タイミング」の4点を意識してください。
時間帯別の強さ（パワースパイク）が与えられている場合は、自分と相手の強い/弱い時間帯の差を必ず攻略に反映してください（例: 相手が終盤型なら序盤〜中盤で試合を決める）。

${counterStats ? `=== プレイヤーの対敵勝率実績 ===\n${counterStats}\n` : ''}
${spikeBlock ? `=== 時間帯別の強さ（パワースパイク）===\n${spikeBlock}\n` : ''}
=== ナレッジDB (攻略記事) ===
${knowledgeCtx || '（関連記事なし）'}

=== チャンピオン辞典 ===
${sentinelCtx || '（辞典データなし）'}`;

      const advice = await callGemini(prompt, `matchup:${champion}:${enemyChampion}`);

      return NextResponse.json({
        mode: 'matchup',
        myChampion: champion,
        enemyChampion,
        advice,
        counterStats: counterStats || '過去の対戦データなし',
        knowledgeSources: knowledgeCtx ? '✅ ナレッジDB参照済み' : '⚠️ 関連記事なし',
        sentinelSources: sentinelCtx ? '✅ チャンピオン辞典参照済み' : '⚠️ 辞典データなし',
      });
    }

    // ----------------------------
    // MODE: post - 試合後振り返り
    // ----------------------------
    if (mode === 'post') {
      const matchIds = await fetchRecentMatchIds(puuid, apiKey, 1);
      if (!matchIds.length) {
        return NextResponse.json({ error: '試合データが見つかりません。' }, { status: 404 });
      }

      const match = await fetchMatchDetails(matchIds[0], apiKey);
      const me = match.participants.find((p) => p.puuid === puuid);
      if (!me) return NextResponse.json({ error: '自分のデータが見つかりません。' }, { status: 404 });

      const gameMins = match.gameDuration / 60;
      const csPerMin = ((me.totalMinionsKilled + me.neutralMinionsKilled) / gameMins).toFixed(1);
      const visionPerMin = (me.visionScore / gameMins).toFixed(2);
      const kda = me.deaths === 0 ? 'Perfect' : ((me.kills + me.assists) / me.deaths).toFixed(2);

      // ロール（レーン）別の目標閾値の動的切り替え
      const lane = (me.lane || 'JUNGLE').toUpperCase();
      let targetCs = 6.0;
      let targetVision = 0.7;
      let isSupport = false;

      if (lane === 'JUNGLE') {
        targetCs = 5.0;
        targetVision = 0.8;
      } else if (lane === 'UTILITY' || lane === 'SUPPORT') {
        targetCs = 1.2; // サポートはCSが高すぎると逆に警告
        targetVision = 1.4;
        isSupport = true;
      } else if (lane === 'MIDDLE' || lane === 'MID' || lane === 'TOP') {
        targetCs = 6.5;
        targetVision = 0.5;
      } else if (lane === 'BOTTOM' || lane === 'ADC') {
        targetCs = 7.2;
        targetVision = 0.4;
      }

      // 弱点インジケーターの動的判定
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

      // 対面（同レーンの敵）を特定する
      const enemyLaner = match.participants.find((p) => p.teamId !== me.teamId && p.lane === me.lane);

      // タイムラインからデス発生タイミングと相手（キル者）を抽出する。
      // 失敗しても本筋のアドバイス自体は継続できるよう握りつぶす。
      const deathTimeline: string[] = [];
      // 構造化版（coach_analysesテーブルへの保存＆トレンド集計用）
      const deathEvents: { min: number; phase: string; killer: string }[] = [];
      try {
        const timeline = await fetchMatchTimeline(matchIds[0], apiKey);
        const participants: any[] = timeline?.info?.participants || [];
        const myParticipantId = participants.find((p) => p.puuid === puuid)?.participantId;
        const participantIdToChampion = new Map<number, string>();
        participants.forEach((p) => {
          const champ = match.participants.find((mp) => mp.puuid === p.puuid)?.championName;
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
        console.warn('[coach/analyze] タイムライン取得に失敗（デス分析なしで続行）:', e);
      }

      const knowledgeCtx = await searchKnowledge([
        me.championName,
        ...(enemyLaner ? [enemyLaner.championName] : []),
        ...weaknesses.slice(0, 2).map((w) => w.split(' ')[0]),
      ]);
      // searchMatchupSentinelはチャンピオン名のみで検索する仕様（enemy厳密一致ではない）ため、
      // 手持ちの対面別マッチアップデータがヒットすれば拾える、という位置づけで利用する。
      const matchupCtx = await searchMatchupSentinel(me.championName).catch(() => '');

      // 時間帯別の強さ（パワースパイク）: 自分と対面の強い時間帯をデス傾向と突き合わせる材料にする
      const [mySpikePost, enemySpikePost] = await Promise.all([
        fetchPowerSpikeContext(me.championName).catch(() => ''),
        enemyLaner ? fetchPowerSpikeContext(enemyLaner.championName).catch(() => '') : Promise.resolve(''),
      ]);
      const spikeBlockPost = [mySpikePost, enemySpikePost].filter(Boolean).join('\n\n');

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
${body.focus ? `\n=== この試合で意識すると宣言した「今日の焦点」===\n${body.focus}\n` : ''}

以下の観点を必ず含め、日本語600字程度で具体的にアドバイスしてください（データが乏しい項目は正直にその旨を述べた上で分かる範囲で分析すること）:
1. デスの傾向分析: デス発生タイミングが序盤/中盤/終盤のどこに偏っているか、誰にやられているかから読み取れるパターン（例: 同じ相手に連続で狩られている、終盤の集団戦での事故が多い等）を指摘する。パワースパイクデータがある場合は、デスが自分の弱い時間帯や相手の強い時間帯に集中していないかも分析する。
2. 対面関係を踏まえた具体策: ${enemyLaner ? `${enemyLaner.championName}という対面の特性（対面ナレッジがあれば引用）を踏まえ、次回このマッチアップで何を変えるべきか` : '対面が特定できない場合は、KDA/CS/Visionの数値から読み取れる立ち回りの課題'}を挙げる。
3. 次の試合での具体的アクション: 上記1・2を踏まえた、次回すぐ実践できる行動を1〜2つ提示する。${body.focus ? `\n4. 今日の焦点の達成度: 宣言した焦点「${body.focus}」を、この試合のデータ（KDA/デス傾向/CS/Vision等）に照らして達成できたか、できなかったかを最初に【達成】または【未達成】と明記した上で、その根拠を述べる。` : ''}`;

      const advice = await callGemini(prompt);

      // 「今日の焦点」の達成判定を、AIアドバイス本文の【達成】/【未達成】マーカーから拾う（課題C: ループ化）
      let focusAchieved: boolean | null = null;
      if (body.focus) {
        if (advice.includes('【達成】')) focusAchieved = true;
        else if (advice.includes('【未達成】')) focusAchieved = false;
      }

      // 同一日・同一チャンピオンの振り返りの重複防止（マージ保存）
      const todayStr = new Date().toISOString().slice(0, 10);
      const saveTitle = `[Coach振り返り] ${todayStr} ${me.championName}`;

      // 既存レコードがあるか確認
      const { data: existingData } = await supabase
        .from('personal_knowledge')
        .select('id, content')
        .eq('title', saveTitle)
        .maybeSingle();

      if (existingData) {
        // 既存アドバイスと今回のアドバイスをGeminiでスマートにマージ
        const mergePrompt = `以下の2つのコーチ振り返りログ（同一チャンピオン、同一日）を、
重複や無駄な繰り返しを排除した1つの綺麗なMarkdown形式の活動報告書にマージ・要約してください。
出力はMarkdownのみにしてください。

=== ログ 1 ===
${existingData.content}

=== ログ 2 ===
## 試合データ
- KDA: ${me.kills}/${me.deaths}/${me.assists}
- CS/min: ${csPerMin}
- Vision/min: ${visionPerMin}
- 結果: ${me.win ? '勝利' : '敗北'}

## AIコーチアドバイス
${advice}`;

        const mergedContent = await callGemini(mergePrompt);
        
        await supabase
          .from('personal_knowledge')
          .update({ content: mergedContent })
          .eq('id', existingData.id);
      } else {
        // 新規登録 (genre: 'LoL攻略' を明示付与)
        await supabase.from('personal_knowledge').insert({
          title: saveTitle,
          content: `## 試合データ\n- KDA: ${me.kills}/${me.deaths}/${me.assists}\n- CS/min: ${csPerMin}\n- Vision/min: ${visionPerMin}\n- 結果: ${me.win ? '勝利' : '敗北'}\n\n## AIコーチアドバイス\n${advice}`,
          genre: 'LoL攻略',
          tags: ['coach', 'review', me.championName],
          champion: me.championName,
        });
      }

      // 構造化ログを coach_analyses に保存（トレンド集計用）。
      // 同一試合の再分析はupsertで上書き（puuid+match_idの一意制約）。失敗しても本筋は継続。
      try {
        await supabase
          .from('coach_analyses')
          .upsert({
            puuid,
            match_id: matchIds[0],
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
            focus: body.focus || null, // 「今日の焦点」(課題C)が渡されていれば記録
            focus_achieved: focusAchieved,
          }, { onConflict: 'puuid,match_id' });
      } catch (e) {
        console.warn('[coach/analyze] coach_analysesへの構造化保存に失敗（続行）:', e);
      }

      return NextResponse.json({
        mode: 'post',
        result: {
          win: me.win,
          champion: me.championName,
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
        focus: body.focus || null,
        focusAchieved,
        saved: saveTitle,
      });
    }

    // ----------------------------
    // MODE: pre - 試合前アドバイス（デフォルト）
    // ----------------------------
    // Riotが2025年6月20日にby-summoner系ランクエンドポイントを廃止し、同時期に
    // summoner-v4のby-puuidレスポンスも`id`フィールドを返さなくなったため、
    // 旧来の「puuid→summoner.id→ランク」の流れは常に失敗し「未ランク」になっていた。
    // puuidから直接ランクを取得するfetchLeagueByPuuidに置き換え。
    const [matchIds, rankData] = await Promise.all([
      fetchRecentMatchIds(puuid, apiKey, 5, 420).catch(() => fetchRecentMatchIds(puuid, apiKey, 5)),
      fetchLeagueByPuuid(puuid, apiKey).catch(() => []),
    ]);
    const soloRank = (rankData as any[]).find((r: any) => r.queueType === 'RANKED_SOLO_5x5');

    const matchDetails = await Promise.all(
      matchIds.slice(0, 5).map((id) => fetchMatchDetails(id, apiKey).catch(() => null))
    );

    const recentChampions: string[] = [];
    const recentWins: boolean[] = [];
    for (const m of matchDetails.filter(Boolean)) {
      const me = m!.participants.find((p) => p.puuid === puuid);
      if (me) {
        recentChampions.push(me.championName);
        recentWins.push(me.win);
      }
    }

    const winRate = recentWins.length > 0
      ? Math.round((recentWins.filter(Boolean).length / recentWins.length) * 100)
      : null;

    // 対敵勝率データの取得
    const counterStats = enemyChampion ? await getPlayerCounterStats(gameName, enemyChampion) : '';

    // 時間帯別の強さ（パワースパイク）: 使いたいチャンプ・警戒対面それぞれ取得
    const [mySpike, enemySpikePre] = await Promise.all([
      champion ? fetchPowerSpikeContext(champion) : Promise.resolve(''),
      enemyChampion ? fetchPowerSpikeContext(enemyChampion) : Promise.resolve(''),
    ]);
    const spikeBlockPre = [mySpike, enemySpikePre].filter(Boolean).join('\n\n');

    const searchKeywords = [
      ...recentChampions.slice(0, 3),
      champion || '',
      'SOLO CARRY', 'PATCH', 'carry', 'meta', 'tier', 'winrate', 'OP',
      'jungle', 'macro', 'マクロ',
    ].filter(Boolean);
    const knowledgeCtx = await searchKnowledge(searchKeywords);

    const rankStr = soloRank
      ? `${soloRank.tier} ${soloRank.rank} (${soloRank.leaguePoints}LP)`
      : '未ランク';

    const prompt = `あなたはLoLの専属パーソナルコーチです。抽象的な精神論ではなく、以下のプレイヤーデータを具体的に根拠として引用しながら、今日のランク戦で実行すべき行動を深く分析してアドバイスしてください。

プレイヤー情報:
- 現在ランク: ${rankStr}
- 直近5試合の使用チャンピオン: ${recentChampions.join(', ') || '取得できず'}
- 直近5試合の勝率: ${winRate !== null ? winRate + '%' : '不明'}
- 直近試合結果: ${recentWins.map((w) => w ? '✅' : '❌').join(' ')}
${champion ? `- 今日使いたいチャンピオン: ${champion}` : ''}
${enemyChampion ? `- 警戒する敵対面チャンピオン: ${enemyChampion}` : ''}

${counterStats ? `=== プレイヤーの対敵勝率実績 ===\n${counterStats}\n` : ''}
${spikeBlockPre ? `=== 時間帯別の強さ（パワースパイク）===\n${spikeBlockPre}\n` : ''}
${knowledgeCtx ? `=== 参考ナレッジ（最新メタ・攻略記事・チャンピオン辞典）===\n${knowledgeCtx}\n` : ''}

以下の形式で、日本語800字程度で具体的にアドバイスしてください。各項目は一般論ではなく、上記データ（直近チャンピオン・勝率・対敵勝率実績・ナレッジ）を必ず名指しで引用して理由づけすること：
1. 今日のおすすめチャンピオン: 直近の使用チャンピオンや勝率実績のどれを根拠にその1体を選んだのかを明示し、想定されるレーン/ロールでの具体的な強みを説明する。時間帯別の強さ（パワースパイク）データがあれば、その強い時間帯をどう活かすか（例: 序盤型なら早期にリードを作る）も具体的に述べる。
2. 今日意識すべき最重要ポイント: 直近の試合結果や対敵勝率実績から読み取れる課題（例: 特定チャンピオンへの勝率の低さ、連敗パターンなど）を指摘し、それに対する具体的な改善アクション（ビルド、立ち回り、レーン戦の意識づけなど）を挙げる。
3. 警戒すべき敵対面: ${enemyChampion ? `${enemyChampion}に対する具体的な対策` : 'ナレッジや対敵実績から見える、今日特に注意すべき対面パターン'}を、参考ナレッジがあればそれを引用しつつ説明する。
4. 今日のメンタルセット: 直近の連勝/連敗傾向を踏まえた、精神面での具体的な心構え（格言的な1文で締める）。

ナレッジや対敵実績データが乏しい場合は、その旨を正直に述べた上で、直近チャンピオン・勝率の傾向から論理的に導ける範囲で深掘りしてください。`;

    const advice = await callGemini(prompt);

    return NextResponse.json({
      mode: 'pre',
      rank: rankStr,
      recentChampions,
      recentWinRate: winRate,
      recentResults: recentWins.map((w) => w ? 'win' : 'loss'),
      advice,
      counterStats: counterStats || null,
    });

  } catch (err: any) {
    console.error('[Coach API Error]', err);
    return NextResponse.json({ error: err.message || '分析に失敗しました。' }, { status: 500 });
  }
}
