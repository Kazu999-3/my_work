import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import {
  fetchPuuidByRiotId,
  fetchRankedSoloMatchIds,
  fetchMatchDetails,
  fetchMatchTimeline,
  fetchLeagueByPuuid,
} from '../../../../lib/riot';
// チャンピオン表記揺れの正規化は src/lib/championNames.ts に共通化済み
// （以前はこのファイルにだけローカル定義されており、他の場所で同じマップを
// 再実装する必要があった）。
import { getChampionSearchVariations, normalizeChampionName } from '../../../../lib/championNames';
// 統一知識取得レイヤー（#50 フェーズA）: champion_facts/notes を鮮度・出典順で合成
import { getChampionKnowledge } from '../../../../lib/championKnowledge';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { runPostGameReview } from '../../../../lib/coachPostGame';
import { computeTrendAggregates, formatMainRoleLine, formatDeathContextBlock } from '../../../../lib/coachTrends';
import { getTimingContext, buildPlayRecommendation } from '../../../../lib/soloqTiming';

// tilt/pre診断はRiot APIの複数回fetch(最大10並列)+Gemini呼び出し(429時最大3リトライで
// 最大14秒消費)を直列実行するため、Vercelのデフォルト関数タイムアウトに抵触しうる。
// フロント側は60秒待つ設計(coach/page.tsx)のため、それを上回る余裕を明示する。
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// ============================
// Gemini APIヘルパー
// 実体は src/lib/geminiClient.ts に一本化済み（リトライ・バックオフ・キャッシュ共通化）。
// cacheKey を渡す呼び出し元は同一プロンプトの再生成を24h抑止できる。
// ============================
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

async function callGemini(prompt: string, cacheKey?: string): Promise<string> {
  // 'gemini-2.0-flash-lite' はこのAPIキーではRPM/RPD上限が0（=常に429）だったため、
  // 最もクォータに余裕のある 'gemini-3.1-flash-lite'（15 RPM / 500 RPD）に変更
  // （Google AI Studioの利用状況で確認済み。'gemini-2.5-flash-lite'はAI Studio上は10RPM/20RPDと
  // 表示されるが、実際のAPI呼び出しでは404 NOT_FOUNDでモデルID自体を呼び出せないと
  // gemini-model-health-checkスキルで判明、2026-08-10）。
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
  // #50 フェーズA: まず構造化テーブル(champion_facts/notes)を鮮度・出典順で取得。
  // データがあればそれを使い、無ければ従来の matchup_sentinel 読み取りにフォールバック。
  try {
    const knowledge = await getChampionKnowledge(supabase, champion);
    if (knowledge.hasData) return knowledge.text;
  } catch (e) {
    console.warn('[coach] getChampionKnowledge失敗、matchup_sentinelにフォールバック:', e);
  }

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

async function fetchJungleTimingContext(champion: string): Promise<string> {
  if (!champion) return '';
  try {
    const { data } = await supabase
      .from('champion_jungle_timing_agg')
      .select('avg_first_core_sec, avg_second_core_sec, external_fastest_clear_sec')
      .ilike('champion', champion)
      .maybeSingle();

    if (!data) return '';
    const fmt = (s: number | null) => (s ? `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒` : '未計測');
    const parts: string[] = [];
    if (data.external_fastest_clear_sec) {
      parts.push(`- 最速フルクリア基準: ${fmt(data.external_fastest_clear_sec)} (2:55スカトル/5:00ドラゴンへの初動テンポ基準)`);
    }
    if (data.avg_first_core_sec) {
      parts.push(`- 1stコア平均完成: ${fmt(data.avg_first_core_sec)}`);
    }
    if (data.avg_second_core_sec) {
      parts.push(`- 2ndコア平均完成: ${fmt(data.avg_second_core_sec)}`);
    }
    if (parts.length === 0) return '';
    return `【${champion} のジャングルテンポ基準（チャンピオン辞典）】\n${parts.join('\n')}`;
  } catch {
    return '';
  }
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

  const matchIds = participations.map((p: any) => p.match_id);

  // 2. それらの試合で、敵チームに対面チャンピオン（enemyChampion）がいたレコードを検索
  const { data: enemies } = await supabase
    .from('ktm_match_participants')
    .select('match_id, team, champion_name')
    .in('match_id', matchIds)
    .or(enemyVariations.map((v) => `champion_name.ilike.%${v}%`).join(','));

  if (!enemies || enemies.length === 0) return '';

  // 試合IDごとに敵チームの色と自分のチャンピオン、勝敗をマッピング
  const enemyMatchMap = new Map<string, string>(); // match_id -> enemy_team
  enemies.forEach((e: any) => {
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
// ランクを「絶対LP」(ティア跨ぎで単調増加する数値)に正規化する (課題: シーズン目標トラッカー)
// 例: IRON IV 0LP=0 / GOLD IV 0LP=1200 / DIAMOND I 0LP=2700 / MASTER 30LP=2830
// ============================
const TIER_BASE: Record<string, number> = {
  IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200, PLATINUM: 1600,
  EMERALD: 2000, DIAMOND: 2400, MASTER: 2800, GRANDMASTER: 2800, CHALLENGER: 2800,
};
const DIV_OFFSET: Record<string, number> = { IV: 0, III: 100, II: 200, I: 300 };
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

function toAbsLp(tier: string, division: string, lp: number): number {
  const t = (tier || '').toUpperCase();
  const base = TIER_BASE[t] ?? 0;
  if (APEX.has(t)) return base + (lp || 0);
  return base + (DIV_OFFSET[(division || 'IV').toUpperCase()] ?? 0) + (lp || 0);
}

function absLpToLabel(abs: number): string {
  const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
  if (abs >= 2800) return `MASTER+ (${abs - 2800}LP)`;
  const tierIdx = Math.min(tiers.length - 1, Math.floor(abs / 400));
  const within = abs - tierIdx * 400;
  const divIdx = Math.min(3, Math.floor(within / 100));
  const divs = ['IV', 'III', 'II', 'I'];
  const lp = within - divIdx * 100;
  return `${tiers[tierIdx]} ${divs[divIdx]} (${lp}LP)`;
}

// ============================
// メインAPI
// ============================
export async function POST(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  // env固定の単一アカウント(RIOT_GAME_NAME/RIOT_TAG_LINE)を分析する個人用機能で、
  // ページ(coach/page.tsx)自体は既に管理者ログイン必須だが、APIルート単体には
  // チェックが無く誰でも叩けてGemini/Riot APIのクォータを消費できてしまっていた。
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const body = await req.json();
    const mode: 'pre' | 'post' | 'post_latest' | 'post_lookup' | 'history' | 'matchup' | 'tilt' | 'trends' | 'practice_menu' | 'goal' | 'chat' = body.mode || 'pre';
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

${formatMainRoleLine(agg)}
デス時間帯の分布（回数）: 序盤${phaseCount.序盤} / 中盤${phaseCount.中盤} / 終盤${phaseCount.終盤}
${formatDeathContextBlock(agg)}
繰り返し狩られている相手: ${topKillers.map((k) => `${k.champion}(${k.count})`).join(', ') || 'なし'}
再発している弱点: ${topWeaknesses.map((w) => `${w.label}(${w.count})`).join(', ') || 'なし'}
CS/min傾向: 直近${csTrend.recent} ← 以前${csTrend.older}
Vision/min傾向: 直近${visionTrend.recent} ← 以前${visionTrend.older}
勝率: ${winRate}%

上記の「主にプレイしているロール」に即した具体的なアドバイスにすること（実際のロールと矛盾する助言をしないこと）。
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

${formatMainRoleLine(agg)}
デス時間帯（回数）: 序盤${agg.deathPhases.序盤} / 中盤${agg.deathPhases.中盤} / 終盤${agg.deathPhases.終盤}
${formatDeathContextBlock(agg)}
繰り返し狩られている相手: ${agg.topKillers.map((k) => `${k.champion}(${k.count})`).join(', ') || 'なし'}
再発している弱点: ${agg.topWeaknesses.map((w) => `${w.label}(${w.count})`).join(', ') || 'なし'}
CS/min: 直近${agg.csTrend.recent} / 以前${agg.csTrend.older}　Vision/min: 直近${agg.visionTrend.recent} / 以前${agg.visionTrend.older}　勝率: ${agg.winRate}%

上記データの弱点および「主にプレイしているロール」に直結する、具体的で実行可能な練習項目を3〜4個作ってください（実際のロールと矛盾する項目は作らないこと）。必ず以下のJSON形式のみを出力（前置き・コードブロック禁止）。各項目は日本語:
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
    // MODE: goal - シーズン目標トラッカー（目標ランクまでの到達予測）
    // ----------------------------
    if (mode === 'goal') {
      // 現在のランクを取得し、当日のスナップショットを記録
      const leagues = await fetchLeagueByPuuid(puuid, apiKey).catch(() => []);
      const solo = (leagues as any[]).find((r) => r.queueType === 'RANKED_SOLO_5x5');
      if (!solo) {
        return NextResponse.json({ mode: 'goal', ranked: false, message: 'ソロQのランクが未取得です（プレイスメント未消化の可能性）。' });
      }
      const currentAbs = toAbsLp(solo.tier, solo.rank, solo.leaguePoints);

      // 当日のスナップショットをupsert（サービスロールが必要な場合もあるが、coach用clientはservice roleキー優先）
      const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      try {
        await supabase.from('soloq_lp_history').upsert({
          puuid, tier: solo.tier, division: solo.rank, lp: solo.leaguePoints,
          abs_lp: currentAbs, snapshot_date: jstDate,
        }, { onConflict: 'puuid,snapshot_date' });
      } catch (e) {
        console.warn('[coach/analyze goal] LPスナップショット保存に失敗（続行）:', e);
      }

      // 目標の解釈
      const targetTier = String(body.targetTier || '').toUpperCase();
      const targetDivision = String(body.targetDivision || 'IV').toUpperCase();
      const targetLp = Number(body.targetLp) || 0;
      if (!targetTier || !TIER_BASE[targetTier]) {
        return NextResponse.json({
          mode: 'goal', ranked: true,
          current: { abs: currentAbs, label: `${solo.tier} ${solo.rank} (${solo.leaguePoints}LP)` },
          message: '目標ティアを指定してください。',
        });
      }
      const targetAbs = toAbsLp(targetTier, targetDivision, targetLp);

      // 履歴から LP/日 の傾きを算出
      const { data: hist } = await supabase
        .from('soloq_lp_history')
        .select('abs_lp, snapshot_date')
        .eq('puuid', puuid)
        .order('snapshot_date', { ascending: true })
        .limit(120);
      const points = (hist || []).map((h: any) => ({ abs: Number(h.abs_lp), date: h.snapshot_date }));

      let lpPerDay: number | null = null;
      let daySpan = 0;
      if (points.length >= 2) {
        const first = points[0], last = points[points.length - 1];
        daySpan = Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000));
        lpPerDay = +((last.abs - first.abs) / daySpan).toFixed(1);
      }

      const gap = targetAbs - currentAbs;
      let projection: any = null;
      if (gap <= 0) {
        projection = { reached: true };
      } else if (lpPerDay && lpPerDay > 0) {
        const days = Math.ceil(gap / lpPerDay);
        const reachDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        // 1勝約+22LP/1敗約-18LPと仮定した必要勝利数の目安（純増4LP/試合ではなく、勝敗差で概算）
        const netPerWin = 20;
        const gamesNeeded = Math.ceil(gap / netPerWin);
        projection = { reached: false, days, reachDate, gamesNeeded };
      } else {
        projection = { reached: false, insufficientTrend: true };
      }

      return NextResponse.json({
        mode: 'goal',
        ranked: true,
        current: { abs: currentAbs, label: `${solo.tier} ${solo.rank} (${solo.leaguePoints}LP)` },
        target: { abs: targetAbs, label: absLpToLabel(targetAbs) },
        gap,
        lpPerDay,
        daySpan,
        snapshots: points.length,
        projection,
        history: points.slice(-30),
      });
    }

    // ----------------------------
    // MODE: tilt - ティルト診断
    // ----------------------------
    if (mode === 'tilt') {
      // ランクソロのみ（ノーマル/ARAMを混ぜない）
      const matchIds = await fetchRankedSoloMatchIds(puuid, apiKey, 10);

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

      // ティルト相関分析（課題: ティルト相関トラッカー）
      // myMatches は新しい順。連敗と「連敗後の勝率」の相関から“やめどき”を判定する。
      const chrono = [...myMatches].reverse(); // 古い→新しい
      // 現在の連続記録（最新から同じ結果が何連続か）
      let currentStreak = 0;
      let streakType: 'win' | 'loss' | null = null;
      if (myMatches.length > 0) {
        streakType = myMatches[0].win ? 'win' : 'loss';
        for (const m of myMatches) {
          if ((m.win ? 'win' : 'loss') === streakType) currentStreak++;
          else break;
        }
      }
      // 「直前が負け」の次の試合の勝率 vs 全体勝率
      let afterLossGames = 0, afterLossWins = 0;
      let afterLossStreakGames = 0, afterLossStreakWins = 0; // 2連敗以上の直後
      let lossRun = 0;
      for (let i = 0; i < chrono.length; i++) {
        if (i > 0) {
          const prevLoss = !chrono[i - 1].win;
          if (prevLoss) { afterLossGames++; if (chrono[i].win) afterLossWins++; }
          if (lossRun >= 2) { afterLossStreakGames++; if (chrono[i].win) afterLossStreakWins++; }
        }
        lossRun = chrono[i].win ? 0 : lossRun + 1;
      }
      const overallWins = myMatches.filter((m) => m.win).length;
      const streakAnalysis = {
        currentStreak,
        streakType,
        overallWinRate: myMatches.length ? Math.round((overallWins / myMatches.length) * 100) : 0,
        afterLossWinRate: afterLossGames ? Math.round((afterLossWins / afterLossGames) * 100) : null,
        afterLossStreakWinRate: afterLossStreakGames ? Math.round((afterLossStreakWins / afterLossStreakGames) * 100) : null,
        // “やめどき”判定: 現在2連敗以上、かつ連敗後勝率が全体を大きく下回る
        stopRecommended: streakType === 'loss' && currentStreak >= 2,
      };

      // 曜日×時間帯の過去勝率＋連敗ストッパーも加味して「次の試合に行くべきか」を判定する
      const timing = await getTimingContext(supabase, puuid);
      const playRecommendation = buildPlayRecommendation(tilt, timing, streakAnalysis);
      const timingLabel = timing.scope === 'hour' ? `${timing.dayLabel}曜${timing.hour}時台` : `${timing.dayLabel}曜全体`;

      const knowledgeCtx = tilt.level !== 'green'
        ? await searchKnowledge(['メンタル', 'ティルト', '連敗', '休憩'])
        : '';

      const userText: string = body.text || '';
      const quickChoice = body.quickChoice as import('../../../../lib/tiltBlameDetector').QuickChoiceOption | undefined;

      const prompt = `あなたはLoLのメンタルコーチおよび言語感情分析アナリストです。
プレイヤーの直近${myMatches.length}試合のデータ:
${myMatches.map((m, i) => `${i + 1}. ${m.champion} ${m.win ? '✅勝' : '❌負'} KDA: ${m.kills}/${m.deaths}/${m.assists}`).join('\n')}

ティルト判定: ${tilt.label} (スコア: ${tilt.score})
理由: ${tilt.reasons.join('、') || 'なし'}
ユーザーの振り返りテキスト・コメント: ${userText ? `"${userText}"` : '（なし）'}

【出力フォーマット要求】
1. メンタルアドバイス文 (日本語で150字程度。負けた後の勝率や時間帯勝率が低い場合は具体的に根拠を数値で示してください。)
2. 文章の感情トーン解析結果を以下のJSON形式で末尾に付与してください:
\`\`\`json
{
  "aiBlameScore": 0から100の数値 (味方への愚痴・攻撃的表現・責任転嫁の強さ),
  "aiCalmScore": 0から100の数値 (自責・客観的理由・前向きな課題意識の強さ),
  "sentimentAnalysis": "他罰感情優位" | "冷静な事実分析" | "中立"
}
\`\`\``;

      const rawResponse = await callGemini(prompt, `tilt:${puuid}:${matchIds[0] || 'none'}:${userText ? userText.slice(0, 30) : 'none'}`);

      let advice = rawResponse;
      let aiBlameScore = 0;
      let aiCalmScore = 50;
      let sentimentAnalysis = '中立';

      try {
        const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/\{[\s\S]*"aiBlameScore"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          aiBlameScore = typeof parsed.aiBlameScore === 'number' ? parsed.aiBlameScore : 0;
          aiCalmScore = typeof parsed.aiCalmScore === 'number' ? parsed.aiCalmScore : 50;
          sentimentAnalysis = parsed.sentimentAnalysis || '中立';
          advice = rawResponse.replace(/```json[\s\S]*```/, '').trim();
        }
      } catch (e) {
        console.warn('[coach/analyze tilt] JSON parsing fallback:', e);
      }

      // 統合スコア計算 (1秒チェック 30% + 戦績 30% + AIトーン 40%)
      const { calculateIntegratedTiltScore } = await import('../../../../lib/tiltBlameDetector');
      const integratedResult = calculateIntegratedTiltScore({
        quickChoice,
        aiBlameScore,
        aiCalmScore,
        lossStreak: streakAnalysis.currentStreak,
        text: userText,
      });

      return NextResponse.json({
        mode: 'tilt',
        tilt,
        streakAnalysis,
        timing,
        playRecommendation,
        recentMatches: myMatches,
        advice,
        aiBlameScore,
        aiCalmScore,
        sentimentAnalysis,
        integratedResult,
      });
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
    // MODE: post_latest - 「試合後」タブ用。手動ボタンを廃止し、日次Cronが
    // 既に自動生成・保存済みの最新の振り返りをそのまま返す（Gemini/Riot API呼び出し無し）。
    // ----------------------------
    if (mode === 'post_latest') {
      const { data: latest } = await supabase
        .from('coach_analyses')
        .select('*')
        .eq('puuid', puuid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest) {
        return NextResponse.json({ mode: 'post_latest', found: false });
      }

      return NextResponse.json({
        mode: 'post_latest',
        found: true,
        result: {
          win: latest.win,
          champion: latest.champion,
          kda: `${latest.kills}/${latest.deaths}/${latest.assists}`,
          kdaRatio: latest.kda_ratio === null ? 'Perfect' : String(latest.kda_ratio),
          csPerMin: String(latest.cs_per_min),
          visionPerMin: String(latest.vision_per_min),
        },
        weaknesses: latest.weaknesses || [],
        advice: latest.advice || '',
        focus: latest.focus,
        focusAchieved: latest.focus_achieved,
        createdAt: latest.created_at,
        saved: true,
      });
    }

    // ----------------------------
    // MODE: post_lookup - 「1分ソロQ振り返り」モーダルで、選択した特定の試合について
    // 既にAI分析済み(coach_analyses)かどうかを安価に確認する（Gemini/Riot追加呼び出し無し）。
    // 日次Cronがまだその試合を処理していない場合はfound:falseを返すので、
    // フロント側は見つからなければ「post」モードで明示的に生成をトリガーする。
    // ----------------------------
    if (mode === 'post_lookup') {
      const matchId: string = body.matchId || '';
      if (!matchId) return NextResponse.json({ error: 'matchIdを指定してください。' }, { status: 400 });

      const { data: row } = await supabase
        .from('coach_analyses')
        .select('*')
        .eq('puuid', puuid)
        .eq('match_id', matchId)
        .maybeSingle();

      if (!row) return NextResponse.json({ mode: 'post_lookup', found: false });

      return NextResponse.json({
        mode: 'post_lookup',
        found: true,
        result: {
          win: row.win,
          champion: row.champion,
          kda: `${row.kills}/${row.deaths}/${row.assists}`,
          kdaRatio: row.kda_ratio === null ? 'Perfect' : String(row.kda_ratio),
          csPerMin: String(row.cs_per_min),
          visionPerMin: String(row.vision_per_min),
        },
        weaknesses: row.weaknesses || [],
        advice: row.advice || '',
        focus: row.focus,
        focusAchieved: row.focus_achieved,
        createdAt: row.created_at,
      });
    }

    // ----------------------------
    // MODE: history - AI自動分析ログ(coach_analyses)の一覧。「3. 試合後振り返り」
    // タブで、日次Cron・手動生成いずれで作られた分析も1試合ずつ見返せるようにする。
    // ----------------------------
    if (mode === 'history') {
      const limit = Math.min(50, Math.max(1, Number(body.limit) || 20));
      const { data: rows } = await supabase
        .from('coach_analyses')
        .select('*')
        .eq('puuid', puuid)
        .order('created_at', { ascending: false })
        .limit(limit);

      return NextResponse.json({
        mode: 'history',
        analyses: (rows || []).map((row: any) => ({
          matchId: row.match_id,
          win: row.win,
          champion: row.champion,
          enemyChampion: row.enemy_champion,
          role: row.role,
          kda: `${row.kills}/${row.deaths}/${row.assists}`,
          kdaRatio: row.kda_ratio === null ? 'Perfect' : String(row.kda_ratio),
          csPerMin: String(row.cs_per_min),
          visionPerMin: String(row.vision_per_min),
          weaknesses: row.weaknesses || [],
          advice: row.advice || '',
          focus: row.focus,
          focusAchieved: row.focus_achieved,
          createdAt: row.created_at,
        })),
      });
    }

    // ----------------------------
    // MODE: chat - AIコーチとの対話（試合の深掘り質問やJG戦術相談）
    // ----------------------------
    if (mode === 'chat') {
      const userMessage: string = body.message || '';
      const matchContext: any = body.matchContext || null;
      if (!userMessage.trim()) {
        return NextResponse.json({ error: 'メッセージを入力してください。' }, { status: 400 });
      }

      const prompt = `あなたはLoLの専属パーソナルコーチです。プレイヤーはジャングル（JG）メインです。
精神論や他責ではなく、客観的なゲーム理論（レーン主導権、フルクリアvsガンク判断、オブジェクト管理、逆サイドでのトレード、パワースパイク、連敗防止メンタル）に基づいて論理的かつ具体的に回答してください。

${matchContext ? `【対象の試合コンテキスト】
・使用チャンピオン: ${matchContext.champion || '不明'} vs 敵: ${matchContext.enemyChampion || '不明'} (${matchContext.win ? '勝利' : '敗北'})
・KDA: ${matchContext.kda || '不明'} | CS/min: ${matchContext.csPerMin || '不明'} | Vision/min: ${matchContext.visionPerMin || '不明'}
${matchContext.weaknesses?.length ? `・弱点: ${matchContext.weaknesses.join(', ')}` : ''}
${matchContext.turningPoints?.length ? `・ターニングポイント: ${matchContext.turningPoints.join('\n')}` : ''}
${matchContext.advice ? `・前回の添削要約: ${matchContext.advice.slice(0, 300)}...` : ''}` : ''}

【プレイヤーからの質問・相談】
"${userMessage}"

回答は親しみやすく論理的な日本語で、250〜400字程度で簡潔かつ即効性のあるアクション（次戦ですぐ試せること）を1〜2点交えて答えてください。`;

      const reply = await callGemini(prompt);
      return NextResponse.json({ mode: 'chat', reply });
    }

    // ----------------------------
    // MODE: post - 試合後振り返り（matchId省略時は最新のランクソロ試合が対象）
    // ----------------------------
    if (mode === 'post') {
      // 中身は lib/coachPostGame.ts に切り出し済み（日次Cronからも同じロジックで
      // 呼べるようにするため）。ここは薄い委譲のみ。
      try {
        const review = await runPostGameReview({ matchId: body.matchId, focus: body.focus });
        return NextResponse.json({ mode: 'post', ...review, saved: true });
      } catch (e: any) {
        return NextResponse.json({ error: e.message || '振り返り分析に失敗しました。' }, { status: 404 });
      }
    }

    // ----------------------------
    // MODE: pre - 試合前アドバイス（デフォルト）
    // ----------------------------
    // Riotが2025年6月20日にby-summoner系ランクエンドポイントを廃止し、同時期に
    // summoner-v4のby-puuidレスポンスも`id`フィールドを返さなくなったため、
    // 旧来の「puuid→summoner.id→ランク」の流れは常に失敗し「未ランク」になっていた。
    // puuidから直接ランクを取得するfetchLeagueByPuuidに置き換え。
    const [matchIds, rankData] = await Promise.all([
      fetchRankedSoloMatchIds(puuid, apiKey, 5),
      fetchLeagueByPuuid(puuid, apiKey).catch(() => []),
    ]);
    const soloRank = (rankData as any[]).find((r: any) => r.queueType === 'RANKED_SOLO_5x5');

    // シーズン目標トラッカー用に、その日のLPスナップショットを記録（1日1件・上書き）。
    if (soloRank) {
      try {
        const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        await supabase.from('soloq_lp_history').upsert({
          puuid, tier: soloRank.tier, division: soloRank.rank, lp: soloRank.leaguePoints,
          abs_lp: toAbsLp(soloRank.tier, soloRank.rank, soloRank.leaguePoints), snapshot_date: jstDate,
        }, { onConflict: 'puuid,snapshot_date' });
      } catch (e) {
        console.warn('[coach/analyze pre] LPスナップショット保存に失敗（続行）:', e);
      }
    }

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

    // 時間帯別の強さ（パワースパイク）とジャングルテンポ基準: 使いたいチャンプ・警戒対面それぞれ取得
    const [mySpike, enemySpikePre, myTimingPre, enemyTimingPre] = await Promise.all([
      champion ? fetchPowerSpikeContext(champion) : Promise.resolve(''),
      enemyChampion ? fetchPowerSpikeContext(enemyChampion) : Promise.resolve(''),
      champion ? fetchJungleTimingContext(champion) : Promise.resolve(''),
      enemyChampion ? fetchJungleTimingContext(enemyChampion) : Promise.resolve(''),
    ]);
    const spikeBlockPre = [mySpike, enemySpikePre].filter(Boolean).join('\n\n');
    const timingBlockPre = [myTimingPre, enemyTimingPre].filter(Boolean).join('\n\n');

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
${timingBlockPre ? `=== ジャングルテンポ・フルクリア基準（初動予測）===\n${timingBlockPre}\n` : ''}
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
