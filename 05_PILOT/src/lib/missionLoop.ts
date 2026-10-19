// 1試合1課題ループ（2026-10-19）。試合前に課題を1つだけ出し、次のランク戦の実測で達成かを判定し、次の課題を決める。
// ここは課題の選び方・目標値・判定だけを持つ純粋関数（DB・Riot API には触らない。テスト: __tests__/missionLoop.test.ts）。
//
// 課題の材料は「試合詳細だけで測れる指標」に限る（タイムラインは1試合1MB前後あり、Riot の回数制限も厳しいため）。
// 比べる相手は目標ランク・同じロールの実測平均（rank_benchmark_samples）。無い時は自分の直近平均から少し上を狙う。
// AI は使わない。課題の文言も数値も、実測と固定の文面だけで作る。

export type MissionMetricKey =
  | 'cs_per_min' | 'deaths' | 'vision_per_min' | 'control_wards_bought' | 'kill_participation' | 'damage_share';

export interface MissionMetricDef {
  key: MissionMetricKey;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  /** 目標値の小数桁（0 = 整数） */
  digits: number;
  /** この課題を出さないロール */
  excludeRoles?: string[];
  /** 試合中に意識すること（固定の文面。数値の根拠は目標値の方にある） */
  focus: string;
}

export const MISSION_METRICS: MissionMetricDef[] = [
  { key: 'deaths', label: 'デス数', unit: '回以下', lowerIsBetter: true, digits: 0,
    focus: '相手の位置が見えていない時に前へ出ない。デスした場面は試合後の詳細分析で確認する' },
  { key: 'cs_per_min', label: 'CS/分', unit: '以上', lowerIsBetter: false, digits: 1, excludeRoles: ['UTILITY'],
    focus: 'リコールはウェーブを押し込んでから。集団戦の合間はサイドのウェーブを回収する' },
  { key: 'vision_per_min', label: '視界スコア/分', unit: '以上', lowerIsBetter: false, digits: 2,
    focus: 'トリンケットを使い切ったままにしない。リコールのたびにワードを置き直す' },
  { key: 'control_wards_bought', label: 'コントロールワード購入', unit: '個以上', lowerIsBetter: false, digits: 0,
    focus: 'リコールで買い物をする時、毎回コントロールワードを1個入れる' },
  { key: 'kill_participation', label: 'キル関与率', unit: '%以上', lowerIsBetter: false, digits: 0,
    focus: 'オブジェクト（ドラゴン・ヴォイドグラブ・ヘラルド）の湧き1分前には近くへ寄る' },
  { key: 'damage_share', label: 'チーム内ダメージ割合', unit: '%以上', lowerIsBetter: false, digits: 0, excludeRoles: ['UTILITY', 'JUNGLE'],
    focus: '集団戦でスキルを撃てる距離を保つ。前に出すぎず、何もせずに終わらない' },
];

export const MISSION_METRIC_BY_KEY: Record<MissionMetricKey, MissionMetricDef> =
  Object.fromEntries(MISSION_METRICS.map((m) => [m.key, m])) as Record<MissionMetricKey, MissionMetricDef>;

/** 1試合分の指標（postgame-deep-analytics の statsOf と同じ計算） */
export type MatchMetrics = Record<MissionMetricKey, number>;

export interface MissionHistoryEntry {
  metric: MissionMetricKey;
  status: 'active' | 'achieved' | 'missed' | 'skipped';
}

export interface MissionPlan {
  metric: MissionMetricKey;
  target: number;
  baseline: number;
  benchmark: number | null;
  /** なぜこの課題か（画面に出す） */
  reason: string;
}

/** 同じ指標の課題を、この回数続けて達成したら次の指標へ移る */
export const MASTERY_STREAK = 2;
/** 同じ指標でこの回数続けて届かなかったら、いったん別の指標へ移る（同じ壁に当たり続けないため） */
export const GIVE_UP_STREAK = 3;
/** 平均を出すのに必要な試合数 */
export const MIN_MATCHES = 3;

/** Match-V5 の参加者1人分から指標を計算する */
export function metricsFromParticipant(
  p: { kills: number; deaths: number; assists: number; totalMinionsKilled: number; neutralMinionsKilled: number;
       visionScore: number; visionWardsBoughtInGame?: number; damageDealtToChampions: number; teamId: number },
  teammates: { kills: number; damageDealtToChampions: number; teamId: number }[],
  gameDurationSec: number,
): MatchMetrics {
  const mates = teammates.filter((x) => x.teamId === p.teamId);
  const tk = mates.reduce((a, x) => a + x.kills, 0);
  const td = mates.reduce((a, x) => a + x.damageDealtToChampions, 0);
  const min = Math.max(1, gameDurationSec / 60);
  return {
    deaths: p.deaths,
    cs_per_min: Number(((p.totalMinionsKilled + p.neutralMinionsKilled) / min).toFixed(1)),
    vision_per_min: Number((p.visionScore / min).toFixed(2)),
    control_wards_bought: p.visionWardsBoughtInGame || 0,
    kill_participation: tk > 0 ? Math.round(((p.kills + p.assists) / tk) * 100) : 0,
    damage_share: td > 0 ? Math.round((p.damageDealtToChampions / td) * 100) : 0,
  };
}

function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** 目標値: 目標ランク平均との中間（1試合で届く範囲に抑える）。平均が無ければ自分の平均の少し上 */
export function targetFor(def: MissionMetricDef, baseline: number, benchmark: number | null): number {
  let t: number;
  if (benchmark != null && (def.lowerIsBetter ? baseline > benchmark : baseline < benchmark)) {
    t = (baseline + benchmark) / 2;
  } else if (def.lowerIsBetter) {
    t = baseline * 0.85;
  } else {
    t = baseline * 1.1;
  }
  if (def.digits === 0) {
    // 整数の指標は「今より確実に1つ良い」値を最低ラインにする（平均 0.4 個 → 1 個以上 など）
    t = def.lowerIsBetter ? Math.min(Math.floor(t), Math.ceil(baseline) - 1) : Math.max(Math.ceil(t), Math.floor(baseline) + 1);
    if (def.lowerIsBetter) t = Math.max(0, t);
  } else {
    t = round(t, def.digits);
    if (!def.lowerIsBetter && t <= baseline) t = round(baseline + 10 ** -def.digits, def.digits);
  }
  return t;
}

export function isAchieved(metric: MissionMetricKey, actual: number, target: number): boolean {
  return MISSION_METRIC_BY_KEY[metric].lowerIsBetter ? actual <= target : actual >= target;
}

/** 直近 history（新しい順）の先頭から、同じ指標の課題が何回続けて status だったか */
function streakOf(history: MissionHistoryEntry[], metric: MissionMetricKey, status: 'achieved' | 'missed'): number {
  let n = 0;
  for (const h of history) {
    if (h.status === 'skipped' || h.status === 'active') continue;
    if (h.metric !== metric || h.status !== status) break;
    n++;
  }
  return n;
}

/**
 * 次の課題を決める。
 *  1. 直前の課題と同じ指標を、MASTERY_STREAK 回続けて達成するまで続ける（1回の達成では定着しないため）
 *  2. それ以外は、目標ランク平均との差（割合）が一番大きい指標
 *  3. 全指標で目標ランク平均を超えていれば、平均に一番近い（＝余裕の少ない）指標を上積み
 * exclude: 「別の課題にする」で外した指標
 */
export function selectMission(input: {
  role: string;
  recent: MatchMetrics[];
  benchmark: Partial<Record<MissionMetricKey, number | null>> | null;
  history: MissionHistoryEntry[];
  exclude?: MissionMetricKey[];
}): MissionPlan | null {
  const { role, recent, benchmark, history } = input;
  if (recent.length < MIN_MATCHES) return null;
  const exclude = new Set(input.exclude || []);

  const candidates = MISSION_METRICS
    .filter((d) => !(d.excludeRoles || []).includes(role) && !exclude.has(d.key))
    .map((d) => {
      const baseline = round(recent.reduce((a, m) => a + m[d.key], 0) / recent.length, Math.max(1, d.digits));
      const bench = benchmark?.[d.key] ?? null;
      // 目標ランク平均に対して何割足りないか（正 = 足りない）
      const gap = bench != null && bench > 0
        ? (d.lowerIsBetter ? (baseline - bench) / bench : (bench - baseline) / bench)
        : null;
      return { d, baseline, bench, gap };
    });
  if (candidates.length === 0) return null;

  const plan = (c: (typeof candidates)[number], reason: string): MissionPlan => ({
    metric: c.d.key,
    target: targetFor(c.d, c.baseline, c.bench),
    baseline: c.baseline,
    benchmark: c.bench,
    reason,
  });

  // 1. 定着するまで同じ課題を続ける（ただし続けて届かない時はいったん離れる）
  const last = history.find((h) => h.status === 'achieved' || h.status === 'missed');
  let lastMetric: MissionMetricKey | null = null;
  if (last) {
    const cont = candidates.find((c) => c.d.key === last.metric);
    const wins = streakOf(history, last.metric, 'achieved');
    const misses = streakOf(history, last.metric, 'missed');
    if (cont && wins < MASTERY_STREAK && misses < GIVE_UP_STREAK) {
      return plan(cont, last.status === 'achieved'
        ? `前回達成。${MASTERY_STREAK}回続けて達成するまで同じ課題を続けます`
        : `前回は届かなかったので、同じ課題をもう一度（${misses + 1}回目の挑戦・${GIVE_UP_STREAK}回続けて届かなければ別の課題へ）`);
    }
    lastMetric = last.metric;
  }

  // 2. 目標ランク平均との差が一番大きい指標
  const withGap = candidates
    .filter((c) => c.gap != null && c.gap > 0 && c.d.key !== lastMetric)
    .sort((a, b) => (b.gap as number) - (a.gap as number));
  if (withGap.length > 0) {
    const c = withGap[0];
    return plan(c, `目標ランク平均（${c.bench}）との差が一番大きい指標（直近${recent.length}試合の平均 ${c.baseline}）`);
  }

  // 3. 平均を出せない・全部上回っている → 余裕が一番少ない指標を上積み
  const rest = candidates
    .filter((c) => c.d.key !== lastMetric)
    .sort((a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity));
  const c = rest[0] || candidates[0];
  return plan(c, c.bench != null
    ? `目標ランク平均（${c.bench}）を上回っている中で、一番余裕の少ない指標を上積み（直近平均 ${c.baseline}）`
    : `直近${recent.length}試合の平均 ${c.baseline} から上積み（目標ランク平均のデータなし）`);
}

/** 画面用の目標の書き方（例: 「デス数 5回以下」「CS/分 6.4以上」） */
export function describeTarget(metric: MissionMetricKey, target: number): string {
  const d = MISSION_METRIC_BY_KEY[metric];
  return `${d.label} ${target}${d.unit}`;
}
