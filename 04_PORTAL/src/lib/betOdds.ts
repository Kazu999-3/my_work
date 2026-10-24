/**
 * 勝敗予想ベットのオッズ算出（ベイズ平滑化対応パリミュチュエル方式）
 *
 * ⚠️ 2026-09-22 セキュリティ修正:
 * 以前は casino/page.tsx がブラウザ上で計算した odds をそのまま POST /api/bet が受け取り、
 * 検証も再計算もせず edge_tasks.payload へ保存し、精算時(match/record)もその値で
 * 払い戻していた。つまり `odds: 99999` を投げれば賭け金の99,999倍を得られた。
 * オッズは必ずこのモジュールでサーバー側が算出し、クライアント申告値は捨てること。
 *
 * ⚠️ 2026-10-24 オッズ平滑化（ベイズ平滑化 / 仮想プール）導入:
 * 従来は集まったコインの比率（blue / total）をそのまま除算していたため、
 * 1人目がBLUEに100pt賭けた瞬間、比率が 100% vs 0% になり、2人目のREDオッズが
 * 即座に上限MAXの10.0倍に跳ね上がるという極端な歪み（2人目だけチート級に儲かる）が発生していた。
 * 仮想初期プール（各1,000pt）を母数に加えることで、投票初期の急激な乱高下を防ぎ、
 * 大勢が投票して実際に偏ったときに初めて高倍率が付く健全なオッズ推移を実現する。
 */

/** 取り扱いオッズの下限・上限（ハウス側の損失を有限に保つためのクランプ） */
export const BET_ODDS_MIN = 1.15;
export const BET_ODDS_MAX = 10.0;

/** まだ誰もベットしていないときの初期オッズ */
export const BET_ODDS_INITIAL = { blue: 1.85, red: 1.95 };

/**
 * オッズ平滑化のための仮想初期プール（片側あたりのコイン数）
 * 1人目や2人目がベットした際の過剰なオッズ跳ね上がり（即10倍確定等）を防ぎ、
 * 投票数が少ない初期段階でもなめらかにオッズが推移するようにする（ベイズ平滑化）
 */
export const VIRTUAL_POOL_PER_TEAM = 1000;

/** 比率がゼロに近づいたときにオッズが発散しないための下限比率 */
const MIN_RATIO = 0.05;

/** 控除率（テラ銭）。0.95 = 5%をハウスが取る */
const PAYOUT_RATE = 0.95;

/**
 * 現在の投票額からBLUE/REDのオッズを算出する。
 * ベイズ平滑化（仮想プール）を適用した実効比率に反比例し、BET_ODDS_MIN〜BET_ODDS_MAX にクランプされる。
 */
export function calculateBetOdds(blueAmount: number, redAmount: number): { blue: number; red: number } {
  // NaN / Infinity / 負数が入るとオッズがNaNになり、クランプも効かなくなるため先に潰す
  const toAmount = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const blue = toAmount(blueAmount);
  const red = toAmount(redAmount);
  const total = blue + red;

  if (total <= 0) {
    return { ...BET_ODDS_INITIAL };
  }

  // 仮想初期プール（各1,000pt）を加算した実効比率を計算（ベイズ平滑化）
  const effectiveBlue = blue + VIRTUAL_POOL_PER_TEAM;
  const effectiveRed = red + VIRTUAL_POOL_PER_TEAM;
  const effectiveTotal = effectiveBlue + effectiveRed;

  const blueRatio = effectiveBlue / effectiveTotal;
  const redRatio = effectiveRed / effectiveTotal;

  const clamp = (raw: number) =>
    Number(Math.min(BET_ODDS_MAX, Math.max(BET_ODDS_MIN, raw)).toFixed(2));

  return {
    blue: clamp(PAYOUT_RATE / Math.max(blueRatio, MIN_RATIO)),
    red: clamp(PAYOUT_RATE / Math.max(redRatio, MIN_RATIO)),
  };
}

/**
 * ベットを「ラウンド」で絞り込む。
 *
 * 精算(match/record)は balancer_predictions の未確定行を1ラウンドとみなすため、
 * 各ベットの payload.round_id にそのラウンドIDを持たせている。ここではオッズ集計と精算の
 * どちらでも同じ絞り込み規則を使うことで、2ラウンド同時進行時に別ラウンドのベットを
 * 巻き込む事故（別試合の結果で精算される）を防ぐ。
 *
 * - `roundId` 未指定(null/undefined)なら全件を返す（ラウンドを特定できない場合のレガシー動作）。
 * - `round_id` を持たないレガシーbet(null)は、どのラウンドの集計・精算にも巻き込めるよう常に含める
 *   （紐付け導入前に作られたベットを取りこぼして宙に浮かせないため）。
 */
export function filterBetsByRound<T extends { round_id?: string | number | null }>(
  bets: T[],
  roundId: string | number | null | undefined
): T[] {
  if (roundId === null || roundId === undefined) return bets;
  return bets.filter((b) => {
    const rid = b?.round_id ?? null;
    return rid === null || rid === roundId;
  });
}

/**
 * 未精算(pending)の custom_bet から現在の投票額を集計する。
 * オッズ算出の入力となるため、必ずサーバー側でこの関数を通して取得すること。
 *
 * `roundId` を渡すとそのラウンドのベット（＋ラウンド未紐付けのレガシーbet）だけを集計する。
 * 省略すると全件を集計する（従来動作）。
 */
export async function fetchPendingBetTotals(
  supabase: any,
  roundId?: string | number | null
): Promise<{ blueAmount: number; redAmount: number; blueCount: number; redCount: number }> {
  const empty = { blueAmount: 0, redAmount: 0, blueCount: 0, redCount: 0 };
  if (!supabase) return empty;

  try {
    const { data } = await supabase
      .from('edge_tasks')
      .select('payload')
      .eq('task_type', 'custom_bet')
      .eq('status', 'pending');

    if (!data || data.length === 0) return empty;

    const bets = filterBetsByRound(
      data.map((t: any) => t.payload).filter(Boolean),
      roundId
    );
    const sum = (team: string) =>
      bets.filter((b: any) => b.team === team).reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);

    return {
      blueAmount: sum('BLUE'),
      redAmount: sum('RED'),
      blueCount: bets.filter((b: any) => b.team === 'BLUE').length,
      redCount: bets.filter((b: any) => b.team === 'RED').length,
    };
  } catch {
    return empty;
  }
}

/**
 * 精算時に適用する倍率をサニタイズする。
 * 過去に保存された（クライアント申告由来の）不正な odds を払い戻しに使わないための最終防衛線。
 */
export function sanitizeStoredOdds(rawOdds: unknown): number {
  const n = Number(rawOdds);
  if (!Number.isFinite(n) || n <= 0) return 2.0;
  return Math.min(BET_ODDS_MAX, Math.max(BET_ODDS_MIN, n));
}
