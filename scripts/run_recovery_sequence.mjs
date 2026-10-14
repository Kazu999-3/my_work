#!/usr/bin/env node
/**
 * ==============================================================================
 * KTM DB復旧シーケンス マスター一括実行スクリプト (run_recovery_sequence.mjs)
 * ==============================================================================
 *
 * 【目的】
 *   Supabaseの月次制限（402 Quota）解除直後に、運用者がコマンド1発で
 *   1. 疎通確認 ➔ 2. お詫びログボ付与 ➔ 3. 旧チケット換金 ➔ 4. 参加者分析＆レポート保存
 *   までを全自動・安全に完遂する。
 *
 * 【実行方法】
 *   # 1. 安全シミュレーション（Dry-Run）
 *   node scripts/run_recovery_sequence.mjs
 *
 *   # 2. 本番適用（Live-Run）
 *   node scripts/run_recovery_sequence.mjs --execute
 * ==============================================================================
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 引数判定
const args = process.argv.slice(2);
const isExecute = args.includes('--execute') || args.includes('-e') || args.includes('--live');

console.log('='.repeat(70));
console.log('👑 Sovereign OS KTM - DB復旧シーケンス マスターランナー');
console.log(`実行モード: ${isExecute ? '🚀 【本番実行 (LIVE / DB書き込み適用)】' : '🧪 【DRY-RUN (シミュレーション / 変更は書き込まれません)】'}`);
if (!isExecute) {
  console.log('💡 ヒント: 本番適用するには `--execute` を付与して実行してください。');
}
console.log('='.repeat(70));

// .env から SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を取得
function loadEnv() {
  const envPaths = [
    path.join(ROOT_DIR, '.env'),
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '04_PORTAL', '.env.local'),
  ];
  const env = { ...process.env };
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!env[key]) env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ------------------------------------------------------------------------------
// Step 0: 疎通確認（402 Quota解除チェック）
// ------------------------------------------------------------------------------
async function checkSupabaseConnectivity() {
  process.stdout.write('\n[Step 0/3] 🌐 Supabase 疎通＆クォータ制限(402)解除チェック... ');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('❌ 失敗');
    console.error('エラー: SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません。');
    process.exit(1);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ktm_players?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (res.status === 402) {
      console.log('⚠️ 制限中 (402 Quota)');
      const text = await res.text();
      console.log('\n❌ 現在もSupabaseのEgress制限（402 Quota）が継続しています。');
      console.log(`   レスポンス: ${text.slice(0, 150)}...`);
      console.log('\n👉 請求サイクルの更新・制限解除を確認してから、再度本コマンドを実行してください。');
      process.exit(1);
    }

    if (!res.ok) {
      console.log(`❌ 接続エラー (HTTP ${res.status})`);
      const text = await res.text();
      console.error(`   詳細: ${text}`);
      process.exit(1);
    }

    console.log('✅ 正常疎通！ (402解除確認)');
    return true;
  } catch (err) {
    console.log('❌ ネットワーク障害');
    console.error(`   通信例外: ${err.message}`);
    process.exit(1);
  }
}

// ------------------------------------------------------------------------------
// サブスクリプト実行ヘルパー
// ------------------------------------------------------------------------------
function runSubScript(stepNum, title, scriptFile, extraArgs = []) {
  console.log(`\n[Step ${stepNum}/3] 📦 ${title}`);
  console.log(`実行ファイル: scripts/${scriptFile}`);
  console.log('-'.repeat(55));

  const cmdArgs = [path.join(__dirname, scriptFile), ...extraArgs];
  if (isExecute) {
    cmdArgs.push('--execute');
  }

  try {
    execSync(`node ${cmdArgs.join(' ')}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env,
    });
    console.log(`✅ Step ${stepNum} 完了`);
  } catch (err) {
    console.error(`\n❌ Step ${stepNum} でエラーが発生しました。処理を安全に中断します。`);
    process.exit(1);
  }
}

// ------------------------------------------------------------------------------
// メインシーケンス
// ------------------------------------------------------------------------------
async function main() {
  // Step 0: 疎通チェック
  await checkSupabaseConnectivity();

  // Step 1: お詫びログボ一括付与 (+600コイン)
  runSubScript(1, 'お詫びログボ（+600コイン / 3日分）安全一括付与', 'grant_maintenance_compensation.mjs');

  // Step 2: 撤去チケット自動換金
  runSubScript(2, '撤去チケット（旧仕様アイテム）自動満額換金', 'refund_deprecated_tickets.mjs');

  // Step 3: 参加者分析 ＆ 2部屋分けしきい値レポート保存
  runSubScript(3, 'カスタム参加者 ランク帯＆MMR実数分析 ＆ レポート自動保存', 'analyze_custom_participants.mjs', ['--save']);

  console.log('\n' + '='.repeat(70));
  console.log('🎉 【全シーケンス完了】すべての復旧・補填・分析タスクが正常終了しました！');
  console.log('📊 生成された分析レポート: 02_FACTORY/custom_participants_analysis_report.md');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('\n予期せぬエラー:', err);
  process.exit(1);
});
