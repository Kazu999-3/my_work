#!/usr/bin/env node
/**
 * 到達不能コード（デッドコード）検出
 *
 * Next.js の規約ファイル（page/layout/route/proxy 等）をエントリポイントとして、
 * import を辿れるファイルを「到達可能」とみなす。どこからも辿れないファイルを列挙する。
 *
 *   実行: node scripts/find_dead_code.mjs        （04_PORTAL 直下で）
 *        node scripts/find_dead_code.mjs --json  （機械可読な出力）
 *
 * ⚠️ 前提と限界:
 *  - `import(\`...\${x}\`)` のような**動的に解決されるパスは追えない**。
 *    実行時に「動的import: N件」と出たら、その分だけ結果を疑うこと
 *    （2026-09-22 時点では0件だったため、検出結果はそのまま信用できた）。
 *  - 到達不能＝バンドルに含まれていないので、**削除してもJSサイズや応答速度は改善しない**。
 *    効果はAIのコンテキスト消費削減・保守性・無駄な編集の防止にある。
 *  - 更新履歴で告知済みの機能が混ざっていることがある。機械的に消さず、
 *    削除か復活かは必ずユーザーに判断を仰ぐこと（02_FACTORY/TODO.md 参照）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';

const SRC = 'src';
const EXTS = ['.ts', '.tsx'];

/** Next.js が自動的にエントリポイントとして扱うファイル名 */
const CONVENTION_FILES = new Set([
  'page.tsx', 'layout.tsx', 'route.ts', 'loading.tsx', 'error.tsx', 'not-found.tsx',
  'template.tsx', 'default.tsx', 'global-error.tsx', 'middleware.ts',
  // Next.js 16 で middleware.ts は proxy.ts に置き換わった
  'proxy.ts',
  'sitemap.ts', 'robots.ts', 'opengraph-image.tsx', 'icon.tsx', 'apple-icon.tsx',
  'manifest.ts', 'instrumentation.ts',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTS.some((e) => entry.name.endsWith(e))) out.push(full.split('\\').join('/'));
  }
  return out;
}

const files = walk(SRC).filter((f) => !f.includes('__tests__'));
const texts = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const fileSet = new Set(files);

const IMPORT_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\(\s*[`]|import\(\s*[^'"`)]/g;

/** 相対 / '@/' エイリアスの指定を実ファイルへ解決する */
function resolve(importer, spec) {
  let base;
  if (spec.startsWith('.')) base = posix.normalize(posix.join(dirname(importer), spec));
  else if (spec.startsWith('@/')) base = posix.join(SRC, spec.slice(2));
  else return null; // node_modules

  for (const cand of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`, base]) {
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

// 動的importの件数を数える（この数が多いほど結果の信頼度が下がる）
let dynamicCount = 0;
for (const t of texts.values()) dynamicCount += (t.match(DYNAMIC_RE) || []).length;

const entries = files.filter((f) => CONVENTION_FILES.has(f.split('/').pop()));
const reached = new Set();
const stack = [...entries];

while (stack.length) {
  const cur = stack.pop();
  if (reached.has(cur)) continue;
  reached.add(cur);
  const text = texts.get(cur) || '';
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(text)) !== null) {
    const target = resolve(cur, m[1]);
    if (target && !reached.has(target)) stack.push(target);
  }
}

const dead = files
  .filter((f) => !reached.has(f))
  .map((f) => ({ file: f, bytes: statSync(f).size }))
  .sort((a, b) => b.bytes - a.bytes);

const totalKb = dead.reduce((s, d) => s + d.bytes, 0) / 1024;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ entries: entries.length, reached: reached.size, dead }, null, 2));
} else {
  console.log(`エントリポイント ${entries.length}件 / 到達可能 ${reached.size}件 / 到達不能 ${dead.length}件`);
  console.log(`到達不能ファイルの合計: ${totalKb.toFixed(1)}KB`);
  console.log(`テンプレート文字列を含む動的import: ${dynamicCount}件（0でなければ結果を疑うこと）\n`);
  for (const d of dead) {
    console.log(`   ${(d.bytes / 1024).toFixed(1).padStart(7)}KB  ${d.file}`);
  }
  if (dead.length) {
    console.log('\n⚠️ 削除してもJSサイズ・応答速度は改善しない（既にバンドル対象外のため）。');
    console.log('   告知済み機能が混ざっている場合があるので、消す前に 02_FACTORY/TODO.md の判断項目を確認すること。');
  }
}
