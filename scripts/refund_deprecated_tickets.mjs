#!/usr/bin/env node
/**
 * 🪙 撤去チケット自動換金スクリプト (Refund Deprecated Shop Tickets)
 *
 * 【目的】
 * カジノショップ改修に伴い撤去された旧チケット（下剋上、複数BAN、ロール強制等）を
 * 所持している全プレイヤーに対し、定価100%（300〜500🪙）を満額コイン換金し、
 * インベントリから該当チケットを安全に回収する。
 *
 * 【実行方法】
 *   1. プレビュー（安全確認・DB変更なし）:
 *      node scripts/refund_deprecated_tickets.mjs
 *
 *   2. 本番実行（10/14 DB復旧後に実行）:
 *      node scripts/refund_deprecated_tickets.mjs --execute
 *
 * 【安全機能】
 *   - 二重換金防止: 各アイテムのユニークタイムスタンプ/タグを記録し二重加算を防止
 *   - 差分更新: 残すアイテム（週末宝くじ、保険等）を破壊せず維持
 *   - 台帳記録: coin_transactions へ admin_adjust として正式に記録
 */

import fs from 'fs';
import path from 'path';

// 撤去アイテムの定価マップ
const DEPRECATED_PRICES = {
  force_champ_pick: { name: '👑 下剋上キャラ指定権', price: 500 },
  lane_heavy_ban: { name: '🚫 特定レーン複数BAN権', price: 400 },
  force_enemy_roles: { name: '🔀 相手ロール強制配置権', price: 500 },
  all_offmeta_match: { name: '🤡 完全オフメタカスタム開催権', price: 400 },
  all_random_match: { name: '🎲 キャラランダムカスタム開催権', price: 400 },
  ultimate_bravery: { name: '🎲 全員ランダムビルド対決権', price: 300 },
  champ_protect: { name: '🛡️ チャンピオンプロテクト権', price: 500 },
  ban_free: { name: '🚫 全員BAN禁止マッチ権', price: 400 },
  side_pick: { name: '🟦 サイド選択権', price: 500 },
  bounty_target: { name: '🎯 賞金首ターゲット指定権', price: 300 },
};

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

const isExecute = process.argv.includes('--execute');

function getPlayerCoins(player) {
  if (!player) return 1000;
  if (typeof player.coins === 'number' && player.coins !== 1000) return player.coins;
  if (typeof player.role_preferences?.coins === 'number') return player.role_preferences.coins;
  if (typeof player.metadata?.coins === 'number') return player.metadata.coins;
  if (typeof player.coins === 'number') return player.coins;
  return 1000;
}

function getPlayerInventory(player) {
  if (Array.isArray(player.role_preferences?.inventory)) return player.role_preferences.inventory;
  if (Array.isArray(player.metadata?.inventory)) return player.metadata.inventory;
  if (Array.isArray(player.inventory)) return player.inventory;
  return [];
}

async function main() {
  console.log('====================================================');
  console.log('🪙 KTM 撤去チケット自動換金スクリプト');
  console.log(`モード: ${isExecute ? '🚨 【本番実行モード (DB更新)】' : '🔍 【Dry-Run プレビューモード (DB変更なし)】'}`);
  console.log('====================================================\n');

  console.log('1. プレイヤー一覧を取得中...');
  const res = await fetch(`${supabaseUrl}/rest/v1/ktm_players?select=id,name,discord_id,coins,role_preferences,metadata,is_active&order=name.asc`, {
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ プレイヤー取得失敗:', res.status, errText);
    if (res.status === 402 || errText.includes('quota')) {
      console.error('👉 現在Supabaseが一時制限(402)です。10/14のリセット後に実行してください。');
    }
    process.exit(1);
  }

  const players = await res.json();
  console.log(`   ➔ 取得完了: ${players.length}名\n`);

  const refundTargets = [];
  let totalRefundCoins = 0;
  let totalRefundTickets = 0;

  for (const p of players) {
    const inv = getPlayerInventory(p);
    if (!inv || inv.length === 0) continue;

    const keptInventory = [];
    const removedTickets = [];
    let playerRefundAmount = 0;

    for (const item of inv) {
      const itemId = item.id || '';
      const deprecatedInfo = DEPRECATED_PRICES[itemId];

      if (deprecatedInfo) {
        removedTickets.push({
          id: itemId,
          name: item.name || deprecatedInfo.name,
          price: deprecatedInfo.price,
        });
        playerRefundAmount += deprecatedInfo.price;
      } else {
        keptInventory.push(item);
      }
    }

    if (removedTickets.length > 0) {
      const currentCoins = getPlayerCoins(p);
      const newCoins = currentCoins + playerRefundAmount;
      refundTargets.push({
        player: p,
        currentCoins,
        newCoins,
        refundAmount: playerRefundAmount,
        removedTickets,
        keptInventory,
      });
      totalRefundCoins += playerRefundAmount;
      totalRefundTickets += removedTickets.length;
    }
  }

  console.log('2. 換金対象集計結果:');
  console.log(`   ・換金対象プレイヤー: ${refundTargets.length}名`);
  console.log(`   ・回収対象チケット数: ${totalRefundTickets}枚`);
  console.log(`   ・総返還コイン額: ${totalRefundCoins.toLocaleString()}🪙\n`);

  if (refundTargets.length === 0) {
    console.log('✨ 撤去チケットを所持しているプレイヤーはいません。換金対応は完了しています。');
    return;
  }

  console.log('3. 対象内訳一覧:');
  for (const t of refundTargets) {
    const ticketSummary = t.removedTickets.map(r => `${r.name} (+${r.price}🪙)`).join(', ');
    console.log(`   👤 ${t.player.name} (${t.player.discord_id || 'ID未連携'})`);
    console.log(`      チケット: [${ticketSummary}]`);
    console.log(`      コイン変動: ${t.currentCoins.toLocaleString()}🪙 ➔ ${t.newCoins.toLocaleString()}🪙 (+${t.refundAmount.toLocaleString()}🪙)\n`);
  }

  if (!isExecute) {
    console.log('====================================================');
    console.log('💡 これは【プレビュー（Dry-Run）】です。DBは更新されていません。');
    console.log('本番実行するには以下のコマンドを実行してください:');
    console.log('   node scripts/refund_deprecated_tickets.mjs --execute');
    console.log('====================================================');
    return;
  }

  console.log('🚨 本番実行中（DB更新）...');
  let successCount = 0;
  let failCount = 0;

  for (const t of refundTargets) {
    try {
      const p = t.player;
      const currentRolePrefs = typeof p.role_preferences === 'object' && p.role_preferences !== null ? p.role_preferences : {};
      const currentMeta = typeof p.metadata === 'object' && p.metadata !== null ? p.metadata : {};

      const newRolePrefs = {
        ...currentRolePrefs,
        coins: t.newCoins,
        inventory: t.keptInventory,
      };

      const newMeta = {
        ...currentMeta,
        coins: t.newCoins,
        inventory: t.keptInventory,
      };

      const updateData = {
        coins: t.newCoins,
        role_preferences: newRolePrefs,
        metadata: newMeta,
      };

      const updateRes = await fetch(`${supabaseUrl}/rest/v1/ktm_players?id=eq.${p.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!updateRes.ok) {
        const upErr = await updateRes.text();
        throw new Error(upErr);
      }

      // 台帳記録
      try {
        await fetch(`${supabaseUrl}/rest/v1/coin_transactions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            player_name: p.name,
            discord_id: p.discord_id || null,
            amount: t.refundAmount,
            balance_after: t.newCoins,
            reason: 'admin_adjust',
            meta: {
              tag: 'deprecated_ticket_refund_20261013',
              removed_tickets: t.removedTickets,
            },
            created_at: new Date().toISOString(),
          }),
        });
      } catch (txErr) {
        console.warn(`      ⚠️ 台帳記録スキップ (${p.name}):`, txErr.message);
      }

      console.log(`   ✅ ${p.name}: +${t.refundAmount}🪙 換金完了 (残高: ${t.newCoins}🪙)`);
      successCount++;
    } catch (e) {
      console.error(`   ❌ ${t.player.name} 更新エラー:`, e.message);
      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 換金処理が完了しました！`);
  console.log(`   成功: ${successCount}名 / 失敗: ${failCount}名`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
