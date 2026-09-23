import { supabaseAdmin as supabase } from './supabaseAdmin';

/**
 * コイン増減の台帳（coin_transactions）への記録。
 *
 * 2026-09-22 新設。それまでコインは残高スナップショット（ktm_players.coins /
 * role_preferences.coins）しか持っておらず、「誰にいつどれだけ発行・消費されたか」を
 * まったく追えなかった。そのため供給過多かどうかを実測で判断できず、
 * 「1試合あたり約2,550コイン発行」「おみくじの期待値165コイン」といった
 * 机上の推定しか出せなかった。
 *
 * ⚠️ 記録の失敗でゲーム本体を止めてはならない。台帳はあくまで観測用なので、
 *    例外は握りつぶして warn に落とす（コインの更新自体は既に済んでいる）。
 */

/** 変動理由。集計の軸になるので自由記述を避け、ここに定義した語だけを使う */
export type CoinReason =
  | 'daily_omikuji'      // デイリーおみくじ
  | 'rescue_insurance'   // 破産救済保険（月1回）
  | 'match_settle'       // 試合精算（参加賞・勝利・MVP・各種賞）
  | 'bet_place'          // 勝敗予想ベットの投入（マイナス）
  | 'bet_payout'         // 勝敗予想ベットの的中払い戻し
  | 'slot'               // スロット（1スピンの純増減）
  | 'crash'              // ポロ・クラッシュ（2026-09-23 にゲームを削除。過去データが残るため型は維持）
  | 'baccarat'           // バカラ
  | 'shop_purchase'      // ショップ購入
  | 'handicap'           // ハンデ発動
  | 'tip_send'           // チップ送金（送り手・マイナス）
  | 'tip_receive'        // チップ送金（受け手）
  | 'lottery_prize'      // 宝くじの当選・還元
  | 'jackpot_claim'      // ジャックポット総取り
  | 'admin_adjust';      // 管理者による手動調整

export interface CoinTxInput {
  player: { id?: number | null; name?: string | null; discord_id?: string | null };
  /** 増減額。0 のときは記録しない */
  delta: number;
  /** 変動後の残高 */
  balanceAfter: number;
  reason: CoinReason;
  /** 倍率・オッズ・購入アイテムなど、後から分析したくなる補足 */
  metadata?: Record<string, any>;
}

export async function recordCoinTransaction(input: CoinTxInput): Promise<void> {
  const { player, delta, balanceAfter, reason, metadata } = input;

  // 増減が無い更新（インベントリのみの変更など）は台帳を汚すだけなので記録しない
  if (!delta || !Number.isFinite(delta)) return;
  if (!supabase) return;

  try {
    await supabase.from('coin_transactions').insert({
      player_id: player?.id ?? null,
      player_name: player?.name || 'unknown',
      discord_id: player?.discord_id ?? null,
      delta: Math.trunc(delta),
      balance_after: Math.trunc(balanceAfter),
      reason,
      metadata: metadata ?? null,
    });
  } catch (err) {
    // 台帳の失敗でコイン処理を巻き戻さない（既に残高は更新済みのため）
    console.warn('[coinLedger] 記録に失敗（処理は続行）:', err);
  }
}

/**
 * 直近N日の発行(+)・消費(-)を reason 別に集計する。
 * 「供給が多すぎるか」を推測ではなく実測で判断するための入口。
 */
export async function summarizeCoinFlow(days = 30): Promise<
  Array<{ reason: string; issued: number; spent: number; net: number; count: number }>
> {
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data, error } = await supabase
    .from('coin_transactions')
    .select('reason, delta')
    .gte('created_at', since);

  if (error || !data) return [];

  const acc = new Map<string, { issued: number; spent: number; count: number }>();
  for (const row of data as Array<{ reason: string; delta: number }>) {
    const cur = acc.get(row.reason) || { issued: 0, spent: 0, count: 0 };
    if (row.delta > 0) cur.issued += row.delta;
    else cur.spent += -row.delta;
    cur.count += 1;
    acc.set(row.reason, cur);
  }

  return Array.from(acc.entries())
    .map(([reason, v]) => ({ reason, ...v, net: v.issued - v.spent }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}
