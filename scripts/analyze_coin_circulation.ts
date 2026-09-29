import { supabaseAdmin as supabase } from '../04_PORTAL/src/lib/supabaseAdmin';
import { getPlayerCoins } from '../04_PORTAL/src/lib/playerCoins';

async function main() {
  console.log('=== 🪙 コイン流通量 ＆ 経済循環 分析レポート ===\n');

  // 1. 全プレイヤー残高の取得
  const { data: players, error: pErr } = await supabase
    .from('ktm_players')
    .select('id, name, coins, role_preferences, metadata, is_active, created_at');

  if (pErr) throw pErr;

  const playerBalances = (players || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    coins: getPlayerCoins(p),
    isActive: p.is_active,
  })).sort((a: any, b: any) => b.coins - a.coins);

  const totalCoins = playerBalances.reduce((sum: number, p: any) => sum + p.coins, 0);
  const activePlayers = playerBalances.filter((p: any) => p.isActive);
  const activeCoins = activePlayers.reduce((sum: number, p: any) => sum + p.coins, 0);
  const avgCoins = Math.round(totalCoins / (playerBalances.length || 1));
  const medianCoins = playerBalances.length > 0 ? playerBalances[Math.floor(playerBalances.length / 2)].coins : 0;

  console.log('【1. 全体流通量サマリー】');
  console.log(`- 登録総プレイヤー数: ${playerBalances.length}名 (アクティブ: ${activePlayers.length}名)`);
  console.log(`- 総流通コイン量: ${totalCoins.toLocaleString()} コイン (アクティブ分: ${activeCoins.toLocaleString()} コイン)`);
  console.log(`- 1人あたり平均残高: ${avgCoins.toLocaleString()} コイン`);
  console.log(`- 中央値: ${medianCoins.toLocaleString()} コイン`);
  console.log(`- 最大残高: ${playerBalances[0]?.coins.toLocaleString()} コイン (${playerBalances[0]?.name})`);
  console.log(`- 最小残高: ${playerBalances[playerBalances.length - 1]?.coins.toLocaleString()} コイン (${playerBalances[playerBalances.length - 1]?.name})\n`);

  console.log('【長者番付 TOP 5】');
  playerBalances.slice(0, 5).forEach((p: any, i: number) => {
    const share = ((p.coins / totalCoins) * 100).toFixed(1);
    console.log(`  #${i + 1} ${p.name.padEnd(12)} : ${p.coins.toLocaleString().padStart(6)} コイン (${share}%)`);
  });
  console.log('');

  // 2. トランザクション台帳の集計 (coin_transactions)
  const { data: txs, error: txErr } = await supabase
    .from('coin_transactions')
    .select('id, delta, reason, created_at, player_name')
    .order('created_at', { ascending: false });

  if (txErr) {
    console.log('coin_transactions テーブル取得エラー:', txErr.message);
    return;
  }

  const txList = txs || [];
  console.log(`【2. 取引台帳 (coin_transactions) 集計】`);
  console.log(`- 記録開始日: ${txList.length > 0 ? txList[txList.length - 1].created_at : 'なし'}`);
  console.log(`- 総トランザクション数: ${txList.length} 件\n`);

  // 理由別集計 (全期間)
  const reasonSummary: Record<string, { count: number; totalIn: number; totalOut: number; net: number }> = {};

  for (const tx of txList) {
    const r = tx.reason || 'unknown';
    if (!reasonSummary[r]) {
      reasonSummary[r] = { count: 0, totalIn: 0, totalOut: 0, net: 0 };
    }
    reasonSummary[r].count++;
    if (tx.delta > 0) {
      reasonSummary[r].totalIn += tx.delta;
    } else {
      reasonSummary[r].totalOut += Math.abs(tx.delta);
    }
    reasonSummary[r].net += tx.delta;
  }

  console.log('【要因別 収支内訳 (全期間)】');
  console.log('--------------------------------------------------------------------------------');
  console.log('変動要因 (Reason)      件数       流入(+)       流出(-)       純増減 (Net)');
  console.log('--------------------------------------------------------------------------------');
  let grandTotalIn = 0;
  let grandTotalOut = 0;
  let grandNet = 0;

  for (const [r, s] of Object.entries(reasonSummary).sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))) {
    grandTotalIn += s.totalIn;
    grandTotalOut += s.totalOut;
    grandNet += s.net;
    const rPad = r.padEnd(20);
    const cPad = s.count.toString().padStart(6);
    const inPad = `+${s.totalIn.toLocaleString()}`.padStart(12);
    const outPad = `-${s.totalOut.toLocaleString()}`.padStart(12);
    const netSign = s.net >= 0 ? '+' : '';
    const netPad = `${netSign}${s.net.toLocaleString()}`.padStart(14);
    console.log(`${rPad} ${cPad}  ${inPad}  ${outPad}   ${netPad}`);
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(`合計                   ${txList.length.toString().padStart(6)}  +${grandTotalIn.toLocaleString().padStart(11)}  -${grandTotalOut.toLocaleString().padStart(11)}   ${grandNet >= 0 ? '+' : ''}${grandNet.toLocaleString().padStart(13)}`);
  console.log('--------------------------------------------------------------------------------\n');

  // 直近7日間の動向
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentTxs = txList.filter((tx: any) => new Date(tx.created_at) >= sevenDaysAgo);

  let recentIn = 0;
  let recentOut = 0;
  for (const tx of recentTxs) {
    if (tx.delta > 0) recentIn += tx.delta;
    else recentOut += Math.abs(tx.delta);
  }
  const recentNet = recentIn - recentOut;

  console.log(`【直近7日間の経済トレンド】`);
  console.log(`- 取引件数: ${recentTxs.length} 件`);
  console.log(`- 新規供給 (流入): +${recentIn.toLocaleString()} コイン`);
  console.log(`- 回収・消費 (流出): -${recentOut.toLocaleString()} コイン`);
  console.log(`- 7日間の純増減: ${recentNet >= 0 ? '+' : ''}${recentNet.toLocaleString()} コイン`);
  const burnRate = recentIn > 0 ? ((recentOut / recentIn) * 100).toFixed(1) : '0';
  console.log(`- 回収率 (Burn Rate): ${burnRate}% (供給に対してカジノ/ショップ等で回収された割合)`);
}

main().catch(console.error);
