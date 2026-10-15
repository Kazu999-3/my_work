#!/usr/bin/env node
/**
 * ==============================================================================
 * DB正本 (SSoT) ➔ Git自動バックアップ同期スクリプト (sync_db_to_git_tactics.mjs)
 * ==============================================================================
 *
 * 【目的】
 *   Web/PWA/Coach画面（Supabase）で編集・追記された戦術ノート（matchup_sentinel）を
 *   ローカルのGitリポジトリ（01_INTEL/tactics/*_tactics_bible.md）へ自動同期・Markdown化し、
 *   原本を破壊することなくGitバックアップと履歴管理を完遂する。
 *
 * 【設計思想】
 *   - DBが正本（SSoT: Single Source of Truth）
 *   - 原本非破壊: 既存ファイルのフロントマター、基本方針、手順書、没理由はそのまま保護。
 *   - 冪等性: 何度実行しても同じ状態になり、差分がなければGitコミットしない。
 *
 * 【使用方法】
 *   # 1. 差分シミュレーション (Dry-Run)
 *   node scripts/sync_db_to_git_tactics.mjs
 *
 *   # 2. 本番ファイル反映 (Live-Run)
 *   node scripts/sync_db_to_git_tactics.mjs --execute
 *
 *   # 3. 本番反映 ＆ Git自動コミット
 *   node scripts/sync_db_to_git_tactics.mjs --execute --commit
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TACTICS_DIR = path.join(ROOT_DIR, '01_INTEL', 'tactics');

// 引数判定
const args = process.argv.slice(2);
const isExecute = args.includes('--execute') || args.includes('-e');
const isCommit = args.includes('--commit') || args.includes('-c');

console.log('='.repeat(70));
console.log('🛡️  Sovereign OS - DB正本 ➔ Git戦術バイブル自動同期');
console.log(`実行モード: ${isExecute ? '🚀 【本番実行 (LIVE / ファイル書き込み)】' : '🧪 【DRY-RUN (シミュレーション / 変更は書き込まれません)】'}`);
if (isCommit) {
  console.log('📦 Git自動コミット: 有効');
}
console.log('='.repeat(70));

// 環境変数の読み込み
function loadEnv() {
  const env = {};
  const envPaths = [
    path.join(ROOT_DIR, '04_PORTAL', '.env.local'),
    path.join(ROOT_DIR, '05_PILOT', '.env.local'),
    path.join(ROOT_DIR, '.env'),
  ];
  for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
      const text = fs.readFileSync(ep, 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
          let val = m[2] || '';
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[m[1]]) env[m[1]] = val.trim();
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabaseの接続情報が見つかりません。');
  console.error('   .env または 04_PORTAL/.env.local を確認してください。');
  process.exit(1);
}

// ページングで全件取得
async function fetchAllMatchups() {
  const allRows = [];
  const limit = 1000;
  let offset = 0;
  let hasMore = true;

  console.log('📡 Supabaseから matchup_sentinel を全件取得中...');

  while (hasMore) {
    const url = `${supabaseUrl}/rest/v1/matchup_sentinel?select=id,champion,enemy,strategy,created_at&limit=${limit}&offset=${offset}&champion=neq.&enemy=neq.`;
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Supabase取得エラー: HTTP ${res.status} ${await res.text()}`);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...rows);
      offset += limit;
      if (rows.length < limit) hasMore = false;
    }
  }

  console.log(`  ➔ 合計 ${allRows.length} 件の対面レコードを取得完了`);
  return allRows;
}

// チャンピオン名サニタイズ（ファイル名用）
function normalizeChampKey(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// デフォルトのバイブルテンプレート生成
function generateDefaultBible(champ) {
  const today = new Date().toISOString().split('T')[0];
  return `---
title: "${champ} 対面戦術バイブル"
status: verified
source_type: empirical
published_at: ${today}
captured_at: ${today}
verified_at: ${today}
tags: ['LoL', 'Tactics', '${champ}']
---

# ⚔️ ${champ} 対面戦術バイブル

## 📌 基本方針 ＆ パワースパイク
- **戦術概要**: Supabase DB正本（SSoT）から自動同期された戦術データです。

---

## 🎯 主要対面特化ミクロ (Matchup Tips)

<!-- MATCHUP_TIPS_START -->
<!-- MATCHUP_TIPS_END -->

---

## 📜 イミュータブル変更履歴 (Immutable Log)
- **${today}**: DB正本自動同期スクリプトにより初期生成。
`;
}

// Markdown内の 対面ミクロセクションを原本非破壊で更新
function updateMatchupSection(fileContent, matchups) {
  // 対面メモブロックを生成
  const sortedEnemies = Object.keys(matchups).sort();
  const tipsBlocks = sortedEnemies.map(enemy => {
    const data = matchups[enemy];
    const text = (data.strategy || '').trim();
    return `### vs ${enemy}\n${text}`;
  }).join('\n\n');

  const markerStart = '<!-- DB_MATCHUP_SENTINEL_START -->';
  const markerEnd = '<!-- DB_MATCHUP_SENTINEL_END -->';
  const dbSection = `${markerStart}\n${tipsBlocks}\n${markerEnd}`;

  // 1. 既にマーカーがある場合 ➔ マーカー内のみを最新DBデータで更新
  if (fileContent.includes(markerStart) && fileContent.includes(markerEnd)) {
    const regex = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`);
    return fileContent.replace(regex, dbSection);
  }

  // 2. マーカーがまだない場合 ➔ ## 🎯 主要対面特化ミクロ の末尾（次セクションの直前）に挿入
  const tipsHeader = '## 🎯 主要対面特化ミクロ (Matchup Tips)';
  if (fileContent.includes(tipsHeader)) {
    const parts = fileContent.split(tipsHeader);
    const beforeHeader = parts[0] + tipsHeader + '\n';
    const rest = parts[1];

    const nextH2 = rest.search(/\n## /);
    if (nextH2 !== -1) {
      const sectionBody = rest.slice(0, nextH2).trimEnd();
      const afterSection = rest.slice(nextH2);
      return `${beforeHeader}${sectionBody}\n\n${dbSection}\n${afterSection}`;
    } else {
      return `${beforeHeader}${rest.trimEnd()}\n\n${dbSection}\n`;
    }
  }

  // 3. セクションヘッダー自体がない場合 ➔ 履歴の前または末尾に追加
  if (fileContent.includes('## 📜 イミュータブル変更履歴')) {
    const parts = fileContent.split('## 📜 イミュータブル変更履歴');
    return `${parts[0]}## 🎯 主要対面特化ミクロ (Matchup Tips)\n\n${dbSection}\n\n---\n\n## 📜 イミュータブル変更履歴${parts[1]}`;
  } else {
    return `${fileContent.trim()}\n\n---\n\n## 🎯 主要対面特化ミクロ (Matchup Tips)\n\n${dbSection}\n`;
  }
}

async function main() {
  const rows = await fetchAllMatchups();

  // チャンピオンごとにグループ化
  const champMap = new Map();

  for (const row of rows) {
    const champ = row.champion?.trim();
    const enemy = row.enemy?.trim();
    const strategy = row.strategy?.trim();

    if (!champ || !enemy || !strategy) continue;

    if (!champMap.has(champ)) {
      champMap.set(champ, {});
    }
    champMap.get(champ)[enemy] = {
      strategy,
      updated_at: row.updated_at || row.created_at,
    };
  }

  console.log(`\n📊 同期対象チャンピオン数: ${champMap.size} 体`);

  let modifiedCount = 0;
  let createdCount = 0;
  let untouchedCount = 0;

  for (const [champ, matchups] of champMap.entries()) {
    const key = normalizeChampKey(champ);
    const fileName = `${key}_tactics_bible.md`;
    const filePath = path.join(TACTICS_DIR, fileName);

    let originalContent = '';
    let isNew = false;

    if (fs.existsSync(filePath)) {
      originalContent = fs.readFileSync(filePath, 'utf8');
    } else {
      originalContent = generateDefaultBible(champ);
      isNew = true;
    }

    const updatedContent = updateMatchupSection(originalContent, matchups);

    if (originalContent !== updatedContent) {
      if (isNew) {
        createdCount++;
        console.log(`  ✨ [新規作成] ${fileName} (${Object.keys(matchups).length} 対面)`);
      } else {
        modifiedCount++;
        console.log(`  📝 [更新] ${fileName} (${Object.keys(matchups).length} 対面)`);
      }

      if (isExecute) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
      }
    } else {
      untouchedCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 同期処理結果サマリー:');
  console.log(`  - 新規作成: ${createdCount} ファイル`);
  console.log(`  - 更新差分: ${modifiedCount} ファイル`);
  console.log(`  - 差分なし: ${untouchedCount} ファイル`);
  console.log('='.repeat(70));

  if (!isExecute) {
    console.log('\n💡 これは DRY-RUN です。実際に反映するには以下を実行してください:');
    console.log('   node scripts/sync_db_to_git_tactics.mjs --execute --commit\n');
    return;
  }

  if (isCommit && (createdCount > 0 || modifiedCount > 0)) {
    console.log('\n📦 Gitコミットを実行します...');
    try {
      execSync('git add 01_INTEL/tactics/*.md', { cwd: ROOT_DIR, stdio: 'inherit' });
      const msg = `feat(tactics): DB正本(matchup_sentinel)からGitへ戦術バイブル自動同期 (${createdCount}新規 / ${modifiedCount}更新)`;
      execSync(`git commit -m "${msg}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
      console.log('✅ Gitコミットが完了しました！');
    } catch (err) {
      console.error('⚠️ Gitコミット中にエラーまたは差分なし:', err.message);
    }
  }
}

main().catch(err => {
  console.error('❌ 致命的エラー:', err);
  process.exit(1);
});
