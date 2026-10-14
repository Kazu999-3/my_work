#!/usr/bin/env node
/**
 * 🎁 メンテナンス補填（3日分ログインボーナス一括付与スクリプト）
 *
 * 【目的】
 * 2026-10-12〜10-15のSupabase停止（Egress上限超過による一時制限）に伴い、
 * ログインボーナスを受け取れなかった全プレイヤーへ3日分（一律 +600コイン）を安全に補填・付与する。
 *
 * 【実行方法】
 *   1. プレビュー（安全確認・DB変更なし）:
 *      node scripts/grant_maintenance_compensation.mjs
 *
 *   2. 本番実行（10/15 DB復旧後に実行）:
 *      node scripts/grant_maintenance_compensation.mjs --execute
 *
 * 【安全機能】
 *   - 外部依存ゼロ: @supabase/supabase-js 不要（Node組み込みfetchによるゼロ依存設計）
 *   - 二重付与防止: coin_transactions の一意タグ（maintenance_compensation_20261012）を照合
 *   - 希望レーン保護: role_preferences 内の primary/secondary 等の設定を破壊せずマージ
 *   - 台帳記録: coin_transactions へ admin_adjust として正式に記録
 */

import fs from 'fs';
import path from 'path';
import { parseRunMode } from './lib/safe_runner.mjs';

const COMPENSATION_TAG = 'maintenance_compensation_20261012';
const BONUS_AMOUNT = 600; // 3日分（200コイン × 3日）

// 1. 環境変数のロード (04_PORTAL/.env.local または OS環境変数)
function loadEnv() {
  const env = { ...process.env };
  const envPaths = [
    path.resolve('04_PORTAL/.env.local'),
    path.resolve('.env.local'),
    path.resolve('.env'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const text = fs.readFileSync(envPath, 'utf8');
      for (const line of text.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let val = match[2] || '';
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[match[1]]) env[match[1]] = val.trim();
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
  console.error('   04_PORTAL/.env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。');
  process.exit(1);
}

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
};

const { isExecute, printBanner } = parseRunMode();

function getPlayerCoins(player) {
  if (!player) return 1000;
  if (typeof player.coins === 'number' && player.coins !== 1000) return player.coins;
  if (typeof player.role_preferences?.coins === 'number') return player.role_preferences.coins;
  if (typeof player.metadata?.coins === 'number') return player.metadata.coins;
  if (typeof player.coins === 'number') return player.coins;
  return 1000;
}

async function main() {
  printBanner(`KTM メンテナンス補填（2日分ログボ: +${BONUS_AMOUNT}コイン一括付与）`);
  console.log('');

  // 1. 全プレイヤー取得
  console.log('1. プレイヤー一覧を取得中...');
  const res = await fetch(`${supabaseUrl}/rest/v1/ktm_players?select=id,name,discord_id,coins,role_preferences,metadata,is_active&order=name.asc`, {
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ プレイヤー取得失敗:', res.status, errText);
    if (res.status === 402 || errText.includes('quota')) {
      console.error('👉 現在Supabaseが制限モード(402)です。10/14のリセット後に実行してください。');
    }
    process.exit(1);
  }

  const players = await res.json();
  console.log(`   ➔ 取得完了: ${players.length}名\n`);

  // 2. 過去の付与台帳をチェック (二重付与防止)
  console.log('2. 付与履歴（二重付与防止）を照合中...');
  let alreadyGrantedIds = new Set();
  try {
    const txRes = await fetch(`${supabaseUrl}/rest/v1/coin_transactions?select=player_name,discord_id,metadata&reason=eq.admin_adjust`, {
      headers,
    });

    if (txRes.ok) {
      const existingTxs = await txRes.json();
      for (const tx of existingTxs) {
        if (tx.metadata?.tag === COMPENSATION_TAG) {
          alreadyGrantedIds.add(tx.discord_id || tx.player_name);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ 台帳照合警告（テーブル未存在等の可能性）:', e.message);
  }

  console.log(`   ➔ 既に付与済み: ${alreadyGrantedIds.size}名\n`);

  // 3. 対象プレイヤーの仕分け
  const targetPlayers = [];
  const skippedPlayers = [];

  for (const p of players) {
    const key = p.discord_id || p.name;
    const currentCoins = getPlayerCoins(p);
    const newCoins = currentCoins + BONUS_AMOUNT;

    if (alreadyGrantedIds.has(key)) {
      skippedPlayers.push({ player: p, currentCoins, reason: '既に付与済み' });
    } else {
      targetPlayers.push({ player: p, currentCoins, newCoins });
    }
  }

  console.log('【付与対象サマリー】');
  console.log(`- 付与対象: ${targetPlayers.length}名`);
  console.log(`- スキップ（付与済み等）: ${skippedPlayers.length}名`);
  console.log(`- 総付与コイン量: ${(targetPlayers.length * BONUS_AMOUNT).toLocaleString()} コイン\n`);

  console.log('【付与対象プレビュー（抜粋）】');
  targetPlayers.slice(0, 10).forEach(({ player, currentCoins, newCoins }, idx) => {
    console.log(`  [${(idx + 1).toString().padStart(2)}] ${player.name.padEnd(14)} : ${currentCoins.toString().padStart(6)} ➔ ${newCoins.toString().padStart(6)} コイン (+${BONUS_AMOUNT})`);
  });
  if (targetPlayers.length > 10) {
    console.log(`  ... 他 ${targetPlayers.length - 10}名`);
  }
  console.log('');

  // 4. Dry-Run 終了判定
  if (!isExecute) {
    console.log('----------------------------------------------------');
    console.log('ℹ️  現在はプレビュー表示（Dry-Run）です。DBの変更は一切行われていません。');
    console.log('👉 10/14のDB復旧後に本番付与を行うには、以下のコマンドを実行してください:');
    console.log('   node scripts/grant_maintenance_compensation.mjs --execute');
    console.log('----------------------------------------------------');
    return;
  }

  // 5. 本番更新
  console.log('🚨 本番付与を開始します...');
  let successCount = 0;
  let failCount = 0;

  for (const { player, currentCoins, newCoins } of targetPlayers) {
    try {
      // 既存の role_preferences を安全にマージ（希望レーン保護）
      const existingPrefs = (player.role_preferences && typeof player.role_preferences === 'object')
        ? player.role_preferences
        : {};

      const updatedPrefs = {
        ...existingPrefs,
        coins: newCoins,
        lastCompensationGrantedAt: new Date().toISOString(),
      };

      // A. ktm_players 更新 (PATCH)
      const upRes = await fetch(`${supabaseUrl}/rest/v1/ktm_players?id=eq.${player.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          coins: newCoins,
          role_preferences: updatedPrefs,
        }),
      });

      if (!upRes.ok) {
        const upErr = await upRes.text();
        throw new Error(upErr);
      }

      // B. coin_transactions 台帳記録 (POST)
      try {
        await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            player_name: player.name,
            discord_id: player.discord_id || null,
            delta: BONUS_AMOUNT,
            balance_after: newCoins,
            reason: 'admin_adjust',
            metadata: {
              tag: COMPENSATION_TAG,
              description: '2026-10-12〜14 メンテナンス補填（2日分ログインボーナス）',
              days: 2,
              grantedAt: new Date().toISOString(),
            },
          }),
        });
      } catch (txErr) {
        console.warn(`  ⚠️ 台帳記録スキップ (${player.name}):`, txErr.message);
      }

      successCount++;
      process.stdout.write(`\r進捗: [${successCount}/${targetPlayers.length}] 付与完了...`);
    } catch (err) {
      failCount++;
      console.error(`\n❌ 付与失敗 (${player.name}):`, err.message);
    }
  }

  console.log('\n\n====================================================');
  console.log('🎉 メンテナンス補填の付与が完了しました！');
  console.log(`- 成功: ${successCount}名`);
  console.log(`- 失敗: ${failCount}名`);
  console.log(`- 発行総数: ${(successCount * BONUS_AMOUNT).toLocaleString()} コイン`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
