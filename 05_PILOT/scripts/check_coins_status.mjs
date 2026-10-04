import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// .env.local をパース
const envText = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sb = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 [Coin Audit] コイン関係の実態・健全性監査を開始...');

  // 1. ktm_players のコイン残高調査
  const { data: players, error: pErr } = await sb
    .from('ktm_players')
    .select('id, name, discord_id, coins, role_preferences, is_active')
    .order('coins', { ascending: false });

  if (pErr) {
    console.error('❌ ktm_players 取得エラー:', pErr);
    return;
  }

  const activePlayers = (players || []).filter(p => p.is_active !== false);
  console.log(`\n👥 登録プレイヤー数: ${players?.length} 名（アクティブ: ${activePlayers.length} 名）`);

  // コイン残高の計算
  const playerStats = activePlayers.map(p => {
    const colCoins = typeof p.coins === 'number' ? p.coins : null;
    const prefCoins = typeof p.role_preferences?.coins === 'number' ? p.role_preferences.coins : null;
    const finalCoins = colCoins !== null ? colCoins : (prefCoins !== null ? prefCoins : 1000);
    return {
      name: p.name,
      discordId: p.discord_id,
      coins: finalCoins,
      colCoins,
      prefCoins,
    };
  }).sort((a, b) => b.coins - a.coins);

  console.log('\n🏆 所持コイン TOP 10:');
  playerStats.slice(0, 10).forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.name.padEnd(16)} : ${p.coins.toLocaleString()} コイン (col: ${p.colCoins}, pref: ${p.prefCoins})`);
  });

  // 異常値チェック
  const negativeCoins = playerStats.filter(p => p.coins < 0);
  const nanCoins = playerStats.filter(p => isNaN(p.coins));
  const defaultCoins = playerStats.filter(p => p.coins === 1000);
  const changedCoins = playerStats.filter(p => p.coins !== 1000);

  console.log('\n📊 コイン残高の健全性:');
  console.log(`・コイン増減実績あり（プレイ中）: ${changedCoins.length} 名`);
  console.log(`・初期値（1,000コイン）維持: ${defaultCoins.length} 名`);
  console.log(`・負の残高（バグ）: ${negativeCoins.length} 件`);
  console.log(`・NaN / 不正値: ${nanCoins.length} 件`);

  if (negativeCoins.length > 0) {
    console.warn('⚠️ 負の残高プレイヤー:', negativeCoins);
  }

  // 2. coin_transactions（取引台帳）の調査
  try {
    const { data: txs, count: txCount, error: txErr } = await sb
      .from('coin_transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(20);

    if (txErr) {
      console.warn('⚠️ coin_transactions テーブル取得エラー:', txErr.message);
    } else {
      console.log(`\n📜 コイン取引台帳（coin_transactions）: 累計 ${txCount ?? 0} 件`);
      console.log('直近の取引ログ 5件:');
      (txs || []).slice(0, 5).forEach(t => {
        const deltaStr = t.delta > 0 ? `+${t.delta}` : `${t.delta}`;
        console.log(`  [${t.created_at?.slice(0, 19)}] ${t.player_name || t.player_id} | ${deltaStr} コイン | 残高: ${t.balance_after} | 理由: ${t.reason}`);
      });

      // 理由別集計
      const { data: allTxs } = await sb.from('coin_transactions').select('reason');
      const reasonCounts = {};
      for (const r of allTxs || []) {
        reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
      }
      console.log('理由別取引内訳:', reasonCounts);
    }
  } catch (e) {
    console.warn('coin_transactions check exception:', e);
  }

  // 3. bet_history（ベット履歴）の調査
  try {
    const { data: bets, count: betCount, error: bErr } = await sb
      .from('bet_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);

    if (!bErr) {
      console.log(`\n🎲 カジノ・ベット履歴（bet_history）: 累計 ${betCount ?? 0} 件`);
      if (bets && bets.length > 0) {
        console.log('直近のベット 3件:');
        bets.slice(0, 3).forEach(b => {
          console.log(`  [${b.created_at?.slice(0, 19)}] ${b.player_name || b.user_id} | game: ${b.game || b.game_type} | bet: ${b.bet_amount} | payout: ${b.payout || b.win_amount}`);
        });
      }
    }
  } catch (e) {}

  // 4. crash_sessions（ポロ・クラッシュ）の調査
  try {
    const { count: crashCount, error: cErr } = await sb
      .from('crash_sessions')
      .select('*', { count: 'exact', head: true });

    if (!cErr) {
      console.log(`\n🚀 ポロ・クラッシュセッション（crash_sessions）: 累計 ${crashCount ?? 0} 回`);
    }
  } catch (e) {}
}

main().catch(console.error);
