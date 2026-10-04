/**
 * coach_analyses の蓄積ログから傾向を集計する共通ヘルパー。
 * 元々は api/cron/soloq-trends/route.ts と api/coach/analyze/route.ts (trends/practice_menu モード)
 * にほぼ同じロジックが別々に実装されており、片方だけ直すと食い違うバグの温床だったため、
 * ここへ一本化した(2026-08-10)。
 */
export interface TrendAggregates {
  count: number;
  winRate: number;
  totalDeaths: number;
  deathPhases: { 序盤: number; 中盤: number; 終盤: number };
  topKillers: { champion: string; count: number }[];
  topWeaknesses: { label: string; count: number }[];
  csTrend: { recent: number; older: number };
  visionTrend: { recent: number; older: number };
  // デスが「試合展開の結果」なのか「原因」なのかを区別するための内訳。
  // teamGoldDiffAtDeath(coachPostGame.tsがタイムラインから算出・保存)がこの閾値未満なら
  // 「既に明確に劣勢だった中でのデス」とみなす。デス時間帯が終盤に偏っていても、その大半が
  // whileBehindなら、デス自体ではなく劣勢を招いた序盤〜中盤の要因を主因とすべき。
  deathContext: { whileBehind: number; whileEvenOrAhead: number; unknown: number };
  // coach_analyses.role が集計・プロンプトのどちらにも一切反映されておらず、実際のロールと
  // 無関係な助言(サイドレーンでのファーム等)が生成される原因になっていた問題への対応。
  mainRole: string;
  roleCounts: Record<string, number>;
  coreTimingTrend?: {
    avgFirstCoreWinSec: number | null;
    avgFirstCoreLossSec: number | null;
    recentAvgFirstCoreSec: number | null;
    olderAvgFirstCoreSec: number | null;
  };
}

const BEHIND_GOLD_THRESHOLD = -1500;

export function computeTrendAggregates(analyses: any[]): TrendAggregates {
  const deathPhases = { 序盤: 0, 中盤: 0, 終盤: 0 };
  const killerCount: Record<string, number> = {};
  const deathContext = { whileBehind: 0, whileEvenOrAhead: 0, unknown: 0 };
  let totalDeaths = 0;
  for (const a of analyses) {
    for (const ev of (a.death_timeline || []) as { phase: string; killer: string; teamGoldDiffAtDeath?: number | null }[]) {
      if (ev.phase && deathPhases[ev.phase as keyof typeof deathPhases] !== undefined) deathPhases[ev.phase as keyof typeof deathPhases]++;
      if (ev.killer && ev.killer !== '不明') killerCount[ev.killer] = (killerCount[ev.killer] || 0) + 1;
      totalDeaths++;

      if (typeof ev.teamGoldDiffAtDeath === 'number') {
        if (ev.teamGoldDiffAtDeath < BEHIND_GOLD_THRESHOLD) deathContext.whileBehind++;
        else deathContext.whileEvenOrAhead++;
      } else {
        deathContext.unknown++;
      }
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

  const roleCounts: Record<string, number> = {};
  for (const a of analyses) {
    const r = String(a.role || '').toUpperCase();
    if (r) roleCounts[r] = (roleCounts[r] || 0) + 1;
  }
  const mainRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '不明';

  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const half = Math.floor(analyses.length / 2);
  const recent = analyses.slice(0, half || 1);
  const older = analyses.slice(half || 1);
  const num = (a: any[], k: string) => a.map((x) => Number(x[k])).filter((v) => !isNaN(v));
  const csTrend = { recent: +avg(num(recent, 'cs_per_min')).toFixed(1), older: +avg(num(older, 'cs_per_min')).toFixed(1) };
  const visionTrend = { recent: +avg(num(recent, 'vision_per_min')).toFixed(2), older: +avg(num(older, 'vision_per_min')).toFixed(2) };
  const winRate = Math.round((analyses.filter((a) => a.win).length / analyses.length) * 100);

  // 1stコア完成時間の集計 (秒)
  const getFirstCoreSec = (a: any): number | null => {
    if (a.timing_comparison?.actualFirstCoreSec) return Number(a.timing_comparison.actualFirstCoreSec);
    if (a.timingComparison?.actualFirstCoreSec) return Number(a.timingComparison.actualFirstCoreSec);
    return null;
  };
  const winCoreSecs = analyses.filter((a) => a.win).map(getFirstCoreSec).filter((v): v is number => v !== null);
  const lossCoreSecs = analyses.filter((a) => !a.win).map(getFirstCoreSec).filter((v): v is number => v !== null);
  const recentCoreSecs = recent.map(getFirstCoreSec).filter((v): v is number => v !== null);
  const olderCoreSecs = older.map(getFirstCoreSec).filter((v): v is number => v !== null);

  const coreTimingTrend = {
    avgFirstCoreWinSec: winCoreSecs.length ? Math.round(avg(winCoreSecs)) : null,
    avgFirstCoreLossSec: lossCoreSecs.length ? Math.round(avg(lossCoreSecs)) : null,
    recentAvgFirstCoreSec: recentCoreSecs.length ? Math.round(avg(recentCoreSecs)) : null,
    olderAvgFirstCoreSec: olderCoreSecs.length ? Math.round(avg(olderCoreSecs)) : null,
  };

  return { count: analyses.length, winRate, totalDeaths, deathPhases, topKillers, topWeaknesses, csTrend, visionTrend, deathContext, mainRole, roleCounts, coreTimingTrend };
}

/** プロンプトに埋め込む「主にプレイしているロール」の表示用テキスト。 */
export function formatMainRoleLine(agg: TrendAggregates): string {
  const others = Object.entries(agg.roleCounts).filter(([r]) => r !== agg.mainRole);
  return `主にプレイしているロール: ${agg.mainRole}${others.length > 0 ? `（他: ${others.map(([r, c]) => `${r}×${c}`).join(', ')}）` : ''}`;
}

/** プロンプトに埋め込む「デスが起きた時の試合展開」の内訳テキストと、因果関係の誤読を防ぐ指示。 */
export function formatDeathContextBlock(agg: TrendAggregates): string {
  const { whileBehind, whileEvenOrAhead, unknown } = agg.deathContext;
  return `デスが起きた時の試合展開: 既に大きく劣勢だった中でのデス${whileBehind}回 / 互角〜優勢だった中でのデス${whileEvenOrAhead}回${unknown > 0 ? `（内訳不明${unknown}回）` : ''}

【重要】デスの時間帯が終盤に偏っていても、それが「既に劣勢だった試合展開の結果」なのか「そのデス自体が負け筋を作った原因」なのかは、上記の「デスが起きた時の試合展開」の内訳から判断すること。互角〜優勢だった場面でのデスが多い場合のみ、デス自体を課題として指摘してよい。既に劣勢だった場面でのデスが大半を占める場合は、デスそのものではなく、劣勢を招いた序盤〜中盤の要因（CS/min・Vision/min・弱点リスト等）を主因として指摘すること。`;
}
