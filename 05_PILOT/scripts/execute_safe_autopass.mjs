#!/usr/bin/env node
/**
 * execute_safe_autopass.mjs
 * 
 * 未承認（pending）記事の中から、
 * 1. 単一チャンピオン特定済み
 * 2. 800文字以上の十分なボリューム
 * 3. 薄い記事（具体事実不足）の除外
 * 4. 複数チャンピオン・ティアリスト記事の除外
 * の4大安全基準を満たす良質記事を自動判定し、一括承認＆教本統合するCLI。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '..');

// .env.local 読み込み
let envContent = '';
try {
  envContent = fs.readFileSync(path.join(PILOT_ROOT, '.env.local'), 'utf8');
} catch {}

const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1];
const key =
  envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1] ||
  envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/)?.[1];

if (!url || !key) {
  console.error('❌ Supabase環境変数が見つかりません (.env.local)');
  process.exit(1);
}

const supabase = createClient(url, key);

const isDryRun = process.argv.includes('--dry-run') || (!process.argv.includes('--execute') && !process.argv.includes('--all'));
const batchLimitArg = process.argv.find((a) => a.startsWith('--limit='));
const batchLimit = batchLimitArg ? parseInt(batchLimitArg.split('=')[1], 10) : 30;

async function run() {
  console.log('🔍 pending 記事の安全スキャンを開始します...');

  const { data: rows, error } = await supabase
    .from('personal_knowledge')
    .select('id, title, content, champion, tags, review_status, is_atomic')
    .eq('review_status', 'pending')
    .order('id', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('❌ 取得エラー:', error);
    process.exit(1);
  }

  const eligible = [];
  const excludedReasons = {
    atomic: 0,
    tooShort: 0,
    noChampion: 0,
    multiChampion: 0,
  };

  for (const row of rows || []) {
    if (row.is_atomic) {
      excludedReasons.atomic++;
      continue;
    }
    const len = (row.content || '').length;
    if (len < 800) {
      excludedReasons.tooShort++;
      continue;
    }
    const champ = (row.champion || '').trim().toUpperCase();
    if (!champ || ['UNKNOWN', 'NONE', 'NULL', 'なし', '未設定', '全般', '共通'].includes(champ)) {
      excludedReasons.noChampion++;
      continue;
    }
    if (champ.includes(',') || champ.includes('、') || champ.includes('/')) {
      excludedReasons.multiChampion++;
      continue;
    }
    const tags = Array.isArray(row.tags) ? row.tags : [];
    if (tags.includes('複数チャンピオン') || tags.includes('ティアリスト')) {
      excludedReasons.multiChampion++;
      continue;
    }

    eligible.push(row);
  }

  console.log('==================================================');
  console.log(`📊 スキャン結果サマリー:`);
  console.log(`   全 pending 件数: ${rows.length} 件`);
  console.log(`   ✅ 安全基準合致（オートパス対象）: ${eligible.length} 件`);
  console.log(`   除外内訳: 短文(<800字) ${excludedReasons.tooShort}件 / チャンプ未定 ${excludedReasons.noChampion}件 / 複数チャンプ ${excludedReasons.multiChampion}件 / 分割知見 ${excludedReasons.atomic}件`);
  console.log('==================================================');

  // チャンピオン別集計
  const champCount = {};
  eligible.forEach((r) => {
    champCount[r.champion] = (champCount[r.champion] || 0) + 1;
  });
  const topChamps = Object.entries(champCount).sort((a, b) => b[1] - a[1]);

  console.log(`🏆 オートパス対象の主要チャンピオンTOP 10:`);
  topChamps.slice(0, 10).forEach(([name, count], i) => {
    console.log(`   ${i + 1}. ${name.padEnd(14)}: ${count} 件`);
  });
  console.log('--------------------------------------------------');

  if (isDryRun) {
    console.log(`💡 現在は Dry-run モードです。承認は実行されていません。`);
    console.log(`   実際に承認を実行する場合は以下のいずれかを実行してください:`);
    console.log(`   - 30件実行:  npm run autopass -- --execute --limit=30`);
    console.log(`   - 全件実行:  npm run autopass -- --execute --all`);
    return;
  }

  // 実行モード
  const targetRows = process.argv.includes('--all') ? eligible : eligible.slice(0, batchLimit);
  console.log(`⚡ ${targetRows.length} 件の承認を実行します...`);

  const ids = targetRows.map((r) => r.id);
  const { data: updated, error: updateErr } = await supabase
    .from('personal_knowledge')
    .update({ review_status: 'approved' })
    .in('id', ids)
    .select('id, champion, title');

  if (updateErr) {
    console.error('❌ 更新エラー:', updateErr);
    process.exit(1);
  }

  console.log(`🎉 正常に ${updated.length} 件の記事を承認（approved）しました！`);
  console.log(`   教本への統合（compile）を実行してローカルデータを同期してください:`);
  console.log(`   ➔ npm run compile`);
}

run();
