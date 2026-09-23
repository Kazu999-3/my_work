/**
 * ポロ・クラッシュのアンチチート誤検知で没収された賭け金の返還
 *
 *   npx tsx scripts/refund_crash_antifraud.ts             … ドライラン（DBは変更しない）
 *   npx tsx scripts/refund_crash_antifraud.ts --apply     … 実際に返還する
 *
 * 【背景】2026-09-23
 * 利確(CASHOUT)は多重利確ロックで status を settled にしたあと、
 * 「申告倍率が到達不可能なら400で拒否」というアンチチート判定を通っていた。
 * crash_sessions.started_at が DEFAULT now() 任せでボタン押下の約0.8秒後に
 * 打たれていたため、クライアントの申告が常に先行し、許容マージン0.5秒を
 * 超えて誤検知していた。拒否された時点でロックは通過済みなので、
 * **払い戻しも返金もされずに賭け金だけが消える**。
 * クライアントはこの400を💥クラッシュとして描いていたため、プレイヤーには
 * 「利確を押したのに爆発した」としか見えなかった。
 *
 * 【対象の絞り方】
 * コイン台帳(coin_transactions)は 2026-09-22 12:45 からしか存在しないため、
 * それ以前は「払い戻しが無い」ことを証明できない。よって台帳がある期間の
 * 「status=settled なのに払い戻しの記録が無いラウンド」だけを対象にする。
 * 返すのは賭け金のみ（本来勝っていれば倍率ぶん増えたはずだが、それは推定に
 * なるため含めない）。
 *
 * 【二重返還の防止】
 * 返還したラウンドは settle_note.refunded = true を立てる。再実行しても
 * 対象から外れる。
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
/** コイン台帳が記録を開始した時刻。これ以前は没収を証明できない */
const LEDGER_START = '2026-09-22T12:45:00Z';

async function main() {
  const { supabaseAdmin } = await import('../src/lib/supabaseAdmin');
  const { getPlayerCoins, updatePlayerCoinsAndInventory } = await import('../src/lib/playerCoins');

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin が初期化できません（環境変数を確認してください）');
    process.exit(1);
  }

  const { data: sessions } = await supabaseAdmin
    .from('crash_sessions')
    .select('*')
    .gte('started_at', LEDGER_START)
    .eq('status', 'settled')
    .order('started_at');

  const { data: tx } = await supabaseAdmin
    .from('coin_transactions')
    .select('*')
    .eq('reason', 'crash')
    .order('created_at');

  const cashouts = (tx || []).filter((t: any) => t.metadata?.phase === 'cashout');

  // 払い戻し記録は「爆発値 ＋ 賭け額 ＋ 直後120秒以内」で厳密に突き合わせる
  const paid = new Set<string>();
  for (const c of cashouts) {
    const ct = new Date(c.created_at).getTime();
    const cand = (sessions || []).filter(
      (s: any) =>
        s.crash_point === c.metadata.actualCrash &&
        s.bet_amount === c.metadata.betAmount &&
        new Date(s.started_at).getTime() < ct &&
        ct - new Date(s.started_at).getTime() < 120000
    );
    if (cand.length) paid.add(cand[cand.length - 1].game_id);
  }

  const targets = (sessions || []).filter(
    (s: any) => !paid.has(s.game_id) && s.settle_note?.refunded !== true
  );

  if (targets.length === 0) {
    console.log('返還対象はありません（すでに返還済みか、没収が無い）。');
    return;
  }

  // プレイヤーごとにまとめる
  const byUser: Record<string, { total: number; rounds: any[] }> = {};
  for (const t of targets) {
    byUser[t.discord_id] = byUser[t.discord_id] || { total: 0, rounds: [] };
    byUser[t.discord_id].total += t.bet_amount;
    byUser[t.discord_id].rounds.push(t);
  }

  console.log(APPLY ? '⚙️  返還を実行します（--apply）' : '🔍 ドライラン（DBは変更しません）');
  console.log(`対象ラウンド ${targets.length} 件 / 対象者 ${Object.keys(byUser).length} 名\n`);

  let grand = 0;
  for (const [discordId, info] of Object.entries(byUser)) {
    const { data: player } = await supabaseAdmin
      .from('ktm_players')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (!player) {
      console.log(`⚠️  ${discordId}: プレイヤーが見つからないためスキップ`);
      continue;
    }

    const before = getPlayerCoins(player);
    const after = before + info.total;
    grand += info.total;

    console.log(`■ ${player.name} (${discordId})`);
    for (const r of info.rounds) {
      console.log(`    ${r.started_at.slice(0, 19)}  ${String(r.bet_amount).padStart(4)}枚  爆発値${r.crash_point}`);
    }
    console.log(`    返還 ${info.total} コイン: ${before} → ${after}`);

    if (!APPLY) continue;

    const res = await updatePlayerCoinsAndInventory({
      player,
      newCoins: after,
      reason: 'admin_adjust',
      reasonMetadata: {
        kind: 'crash_antifraud_refund',
        note: 'ポロ・クラッシュのアンチチート誤検知で没収された賭け金の返還',
        rounds: info.rounds.map((r: any) => ({
          gameId: r.game_id,
          startedAt: r.started_at,
          betAmount: r.bet_amount,
          crashPoint: r.crash_point,
        })),
      },
    });

    if (!res.success) {
      console.log(`    ❌ 失敗: ${res.error}`);
      continue;
    }

    // 二重返還の防止マーク
    for (const r of info.rounds) {
      await supabaseAdmin
        .from('crash_sessions')
        .update({
          settle_note: {
            ...(r.settle_note && typeof r.settle_note === 'object' ? r.settle_note : {}),
            refunded: true,
            refundedAt: new Date().toISOString(),
            refundedAmount: r.bet_amount,
            refundReason: 'anti_fraud_false_positive',
          },
        })
        .eq('game_id', r.game_id);
    }
    console.log('    ✅ 返還完了');
  }

  console.log(`\n合計 ${grand} コイン`);
  if (!APPLY) console.log('実際に返還するには --apply を付けてください。');
}

main().catch((e) => {
  console.error('❌ 失敗:', e);
  process.exit(1);
});
