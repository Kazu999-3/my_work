/**
 * MMR全再計算（performFullMmrRebuild）の実行スクリプト
 *
 *   npx tsx scripts/rebuild_mmr.ts --dry-run   … 何がどれだけ動くかだけ表示（DBは変更しない）
 *   npx tsx scripts/rebuild_mmr.ts --apply     … 実際に再計算して書き込む
 *
 * 【なぜ必要か】2026-09-23
 * mmr_delta と mmr_breakdown.final が食い違うレコードが133件あった。原因は
 *   1) performFullMmrRebuild が upsert 列に mmr_breakdown を含めていなかった
 *   2) riot/match-sync が calculateNewMMR()（内訳を返さない版）を使っていた
 * の2点で、どちらも修正済み。このスクリプトは**過去分の是正**のために全試合を
 * 時系列で計算し直す。
 *
 * ⚠️ 全プレイヤーのMMR・ランク・試合数が再計算される。実行前に必ず
 *    99_ARCHIVE/db_backups/ へバックアップを取ること（不可逆）。
 * ⚠️ API経由ではなくローカルのコードで動くため、**ローカルの lib/mmr.ts が
 *    最新であること**を確認してから実行する。
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');

type Snapshot = Record<string, { mmr: number; lanes: Record<string, number>; totalGames: number }>;

/** 現在のプレイヤーMMRを控える */
async function snapshot(supabase: any): Promise<Snapshot> {
  const { data } = await supabase
    .from('ktm_players')
    .select('name, mmr, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, games_top, games_jg, games_mid, games_adc, games_sup');
  const out: Snapshot = {};
  for (const p of data || []) {
    out[p.name] = {
      mmr: p.mmr ?? 0,
      lanes: { TOP: p.mmr_top ?? 0, JG: p.mmr_jg ?? 0, MID: p.mmr_mid ?? 0, ADC: p.mmr_adc ?? 0, SUP: p.mmr_sup ?? 0 },
      totalGames: (p.games_top ?? 0) + (p.games_jg ?? 0) + (p.games_mid ?? 0) + (p.games_adc ?? 0) + (p.games_sup ?? 0),
    };
  }
  return out;
}

function diffReport(before: Snapshot, after: Snapshot) {
  const rows: { name: string; from: number; to: number; delta: number }[] = [];
  for (const name of Object.keys(after)) {
    const b = before[name];
    const a = after[name];
    if (!b) continue;
    if (b.mmr !== a.mmr) rows.push({ name, from: b.mmr, to: a.mmr, delta: a.mmr - b.mmr });
  }
  rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  console.log(`\n総合MMRが変化する人数: ${rows.length} / ${Object.keys(after).length}名`);
  if (rows.length) {
    const max = Math.max(...rows.map((r) => Math.abs(r.delta)));
    console.log(`最大変動: ${max} ポイント\n`);
    console.log('  名前                  変更前 →  変更後   差');
    console.log('  ' + '-'.repeat(46));
    for (const r of rows.slice(0, 30)) {
      const sign = r.delta > 0 ? '+' : '';
      console.log(`  ${r.name.padEnd(20)} ${String(r.from).padStart(5)} → ${String(r.to).padStart(5)}  ${sign}${r.delta}`);
    }
    if (rows.length > 30) console.log(`  ...他 ${rows.length - 30}名`);
  }
}

/** mmr_delta と mmr_breakdown.final の食い違い件数 */
async function countMismatch(supabase: any): Promise<number> {
  let all: any[] = [];
  let off = 0;
  for (;;) {
    const { data } = await supabase
      .from('ktm_match_participants')
      .select('mmr_delta, mmr_breakdown')
      .order('id')
      .range(off, off + 499);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 500) break;
    off += 500;
  }
  return all.filter(
    (x) => x.mmr_breakdown && typeof x.mmr_breakdown === 'object' && x.mmr_breakdown.final !== x.mmr_delta
  ).length;
}

async function main() {
  const { supabaseAdmin } = await import('../src/lib/supabaseAdmin');
  const { performFullMmrRebuild } = await import('../src/lib/mmr');

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin が初期化できません（環境変数を確認してください）');
    process.exit(1);
  }

  console.log(APPLY ? '⚙️  MMR全再計算を実行します（--apply）' : '🔍 ドライラン（DBは変更しません）');

  const before = await snapshot(supabaseAdmin);
  const mismatchBefore = await countMismatch(supabaseAdmin);
  console.log(`実行前: ${Object.keys(before).length}名 / 内訳の食い違い ${mismatchBefore}件`);

  if (!APPLY) {
    console.log('\nドライランでは再計算そのものを走らせません。');
    console.log('performFullMmrRebuild は途中でDBへ書き込むため、安全に「試算だけ」はできないためです。');
    console.log('実行するには --apply を付けてください（事前バックアップ必須）。');
    return;
  }

  const t0 = Date.now();
  await performFullMmrRebuild(supabaseAdmin);
  console.log(`\n✅ 再計算完了 (${((Date.now() - t0) / 1000).toFixed(1)}秒)`);

  const after = await snapshot(supabaseAdmin);
  const mismatchAfter = await countMismatch(supabaseAdmin);
  diffReport(before, after);
  console.log(`\n内訳の食い違い: ${mismatchBefore}件 → ${mismatchAfter}件`);
}

main().catch((e) => {
  console.error('❌ 失敗:', e);
  process.exit(1);
});
