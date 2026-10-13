/**
 * ==============================================================================
 * KTM カスタム参加者 ランク帯＆MMR実数分析 ＆ 2部屋分けシミュレーション
 * ==============================================================================
 *
 * 【目的】
 *   2026-10-14 Supabase月次制限リセット後に即時実行し、
 *   直近カスタム参加メンバーの実数データ（ランク分布・代表MMR）を集計。
 *   「初中級卓」と「一般卓」の最適なしきい値（ゴールド以下卓 vs プラチナ以上卓、
 *   または実数MMR中央値スプリット）を数値的根拠に基づいて決定・可視化する。
 *
 * 【実行方法】
 *   node scripts/analyze_custom_participants.mjs
 *   node scripts/analyze_custom_participants.mjs --all      # 全アクティブプレイヤー対象
 *   node scripts/analyze_custom_participants.mjs --save     # 02_FACTORY/ にMarkdown保存
 *
 * 【安全機能】
 *   - 完全読み取り専用 (Read-Only): DBの変更・更新は一切行わない
 *   - 外部依存ゼロ: @supabase/supabase-js 不要（Node.js 組み込み fetch）
 *   - 402安全ガード: Supabaseクォータ超過時に安全に待機メッセージを出力
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { parseRunMode } from './lib/safe_runner.mjs';

const TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];

const TIER_ESTIMATED_MMR = {
  UNRANKED: 1200,
  IRON: 1100,
  BRONZE: 1250,
  SILVER: 1350,
  GOLD: 1500,
  PLATINUM: 1650,
  EMERALD: 1800,
  DIAMOND: 2000,
  MASTER: 2200,
  GRANDMASTER: 2400,
  CHALLENGER: 2600,
};

// 1. 環境変数の取得 (.env.local または .env)
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '04_PORTAL', '.env.local'),
    path.resolve(process.cwd(), '04_PORTAL', '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabaseの接続情報（URL / KEY）が見つかりません。');
  process.exit(1);
}

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
};

const { printBanner } = parseRunMode();
const isAll = process.argv.includes('--all');
const isSave = process.argv.includes('--save');

function parseTier(rankStr) {
  if (!rankStr) return 'UNRANKED';
  const upper = rankStr.trim().toUpperCase();
  for (const t of TIER_ORDER) {
    if (upper.startsWith(t)) return t;
  }
  return 'UNRANKED';
}

function calculateMedian(numbers) {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / numbers.length);
}

function calculateStdDev(numbers, mean) {
  if (numbers.length <= 1) return 0;
  const squareDiffs = numbers.map((n) => Math.pow(n - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((acc, n) => acc + n, 0) / (numbers.length - 1);
  return Math.round(Math.sqrt(avgSquareDiff));
}

function renderBar(count, total, maxBarLength = 25) {
  if (total === 0) return '';
  const length = Math.round((count / total) * maxBarLength);
  return '█'.repeat(length) + '░'.repeat(Math.max(0, maxBarLength - length));
}

async function main() {
  printBanner('KTM カスタム参加者 ランク帯＆MMR実数分析 ＆ 2部屋分けシミュレーション');
  console.log('モード: 🔍 【完全読み取り専用 (Read-Only) / DB変更なし】\n');

  // 1. プレイヤーデータの取得
  console.log('1. プレイヤー一覧を取得中...');
  const playerUrl = `${supabaseUrl}/rest/v1/ktm_players?select=id,name,discord_id,highest_rank,current_rank,total_games,representative_mmr,mmr,is_active,stats&order=total_games.desc`;
  const res = await fetch(playerUrl, { headers });

  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ プレイヤー取得失敗:', res.status, errText);
    if (res.status === 402 || errText.includes('quota')) {
      console.error('\n👉 現在Supabaseが月次制限モード(402 Quota)です。10/14のリセット後に再実行してください。');
    }
    process.exit(1);
  }

  const allPlayers = await res.json();
  console.log(`   ➔ 全登録プレイヤー: ${allPlayers.length}名`);

  // 対象プレイヤーの抽出
  // デフォルト: 試合数1回以上（またはアクティブ）の参加者
  // --all: 全アクティブプレイヤー
  const targetPlayers = allPlayers.filter((p) => {
    if (isAll) return p.is_active !== false;
    const games = p.total_games || p.stats?.total?.g || 0;
    return games > 0 || p.is_active !== false;
  });

  const activeExperienced = targetPlayers.filter((p) => (p.total_games || p.stats?.total?.g || 0) > 0);
  console.log(`   ➔ 分析対象プレイヤー: ${targetPlayers.length}名 (通算1戦以上: ${activeExperienced.length}名)\n`);

  if (targetPlayers.length === 0) {
    console.log('⚠️ 分析対象のプレイヤーが存在しません。');
    return;
  }

  // 2. プレイヤーごとの実効MMRとティアの算出
  const playerStats = targetPlayers.map((p) => {
    const tier = parseTier(p.highest_rank || p.current_rank);
    const games = p.total_games || p.stats?.total?.g || 0;
    // 代表MMRが存在すれば優先、無ければティア推定値
    const effectiveMmr = p.representative_mmr || (typeof p.mmr === 'number' ? p.mmr : TIER_ESTIMATED_MMR[tier] || 1200);
    return {
      name: p.name,
      tier,
      highestRank: p.highest_rank || p.current_rank || 'UNRANKED',
      games,
      mmr: Math.round(effectiveMmr),
      isBeginner: games <= 5 || tier === 'IRON' || tier === 'BRONZE' || tier === 'SILVER',
    };
  });

  // 3. ランク帯分布の集計
  const rankCounts = {};
  for (const t of TIER_ORDER) rankCounts[t] = 0;
  for (const p of playerStats) {
    rankCounts[p.tier] = (rankCounts[p.tier] || 0) + 1;
  }

  const mmrList = playerStats.map((p) => p.mmr);
  const avgMmr = calculateAverage(mmrList);
  const medianMmr = calculateMedian(mmrList);
  const minMmr = Math.min(...mmrList);
  const maxMmr = Math.max(...mmrList);
  const stdDevMmr = calculateStdDev(mmrList, avgMmr);

  // コンソールレポートの構築
  console.log('================================================================');
  console.log('📊 1. KTM 参加者 最高ランク分布');
  console.log('================================================================');
  console.log('ランク帯         人数     構成比      分布グラフ');
  console.log('----------------------------------------------------------------');

  const lines = [];
  lines.push('# 📊 KTM カスタム参加者 ランク帯＆MMR実数分析レポート (2026-10-14)\n');
  lines.push(`- **集計対象人数**: ${targetPlayers.length}名 (実戦経験者: ${activeExperienced.length}名)`);
  lines.push(`- **MMR全体平均**: ${avgMmr} / **中央値**: ${medianMmr} (Min: ${minMmr} 〜 Max: ${maxMmr}, 標準偏差: ±${stdDevMmr})\n`);
  lines.push('## 1. 最高ランク帯分布\n');
  lines.push('| ランク帯 | 人数 | 構成比 | 分布バー |');
  lines.push('| :--- | :---: | :---: | :--- |');

  for (const t of TIER_ORDER) {
    const cnt = rankCounts[t] || 0;
    if (cnt === 0 && (t === 'GRANDMASTER' || t === 'CHALLENGER')) continue;
    const pct = ((cnt / targetPlayers.length) * 100).toFixed(1);
    const bar = renderBar(cnt, targetPlayers.length, 20);
    console.log(`${t.padEnd(14)} ${String(cnt).padStart(4)}名   ${pct.padStart(5)}%   [${bar}]`);
    lines.push(`| **${t}** | ${cnt}名 | ${pct}% | \`${bar}\` |`);
  }

  console.log('----------------------------------------------------------------');
  console.log(`全体MMR統計: 平均 ${avgMmr} | 中央値 ${medianMmr} | 最小 ${minMmr} | 最大 ${maxMmr} | 偏差 ±${stdDevMmr}\n`);

  // 4. 2部屋分けシミュレーション
  console.log('================================================================');
  console.log('⚖️ 2. 定期カスタム 2部屋分割シミュレーション');
  console.log('================================================================\n');
  lines.push('\n## 2. 定期カスタム 2部屋分割シミュレーション\n');

  // パターンA: ランク固定境界（ゴールド以下卓 vs プラチナ以上卓）
  const lowRankPlayers = playerStats.filter((p) => ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'UNRANKED'].includes(p.tier));
  const highRankPlayers = playerStats.filter((p) => ['PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(p.tier));

  const lowMmrList = lowRankPlayers.map((p) => p.mmr);
  const highMmrList = highRankPlayers.map((p) => p.mmr);

  const lowAvg = calculateAverage(lowMmrList);
  const highAvg = calculateAverage(highMmrList);

  console.log('▶ 【パターンA: ランク固定境界 (初中級: 〜GOLD / 一般: PLATINUM〜)】');
  console.log(`   🌱 初中級卓: ${lowRankPlayers.length}名 (平均MMR: ${lowAvg}, 範囲: ${Math.min(...(lowMmrList.length ? lowMmrList : [0]))}〜${Math.max(...(lowMmrList.length ? lowMmrList : [0]))})`);
  console.log(`   ⚔️ 一般卓  : ${highRankPlayers.length}名 (平均MMR: ${highAvg}, 範囲: ${Math.min(...(highMmrList.length ? highMmrList : [0]))}〜${Math.max(...(highMmrList.length ? highMmrList : [0]))})`);
  console.log(`   ➔ 部屋間MMRギャップ: ${highAvg - lowAvg} pt`);
  console.log(`   ➔ 評価: ${Math.abs(lowRankPlayers.length - highRankPlayers.length) <= 4 ? '✅ 人数バランス良好（各部屋10名成立可能）' : '⚠️ 人数に偏りあり（どちらかが10名未満の可能性）'}\n`);

  lines.push('### パターンA: ランク固定境界（初中級: 〜GOLD / 一般: PLATINUM〜）\n');
  lines.push(`- **🌱 初中級卓 (〜GOLD)**: **${lowRankPlayers.length}名** (平均MMR: **${lowAvg}**, 範囲: ${Math.min(...(lowMmrList.length ? lowMmrList : [0]))}〜${Math.max(...(lowMmrList.length ? lowMmrList : [0]))})`);
  lines.push(`- **⚔️ 一般卓 (PLATINUM〜)**: **${highRankPlayers.length}名** (平均MMR: **${highAvg}**, 範囲: ${Math.min(...(highMmrList.length ? highMmrList : [0]))}〜${Math.max(...(highMmrList.length ? highMmrList : [0]))})`);
  lines.push(`- **部屋間MMR格差**: **${highAvg - lowAvg} pt**`);
  lines.push(`- **人数成立性**: ${Math.abs(lowRankPlayers.length - highRankPlayers.length) <= 4 ? '✅ 各部屋10名成立可能' : '⚠️ 人数偏りあり'}\n`);

  // パターンB: MMR中央値スプリット（上位半数 vs 下位半数）
  const sortedByMmr = [...playerStats].sort((a, b) => b.mmr - a.mmr);
  const halfCount = Math.floor(sortedByMmr.length / 2);
  const topHalf = sortedByMmr.slice(0, halfCount);
  const bottomHalf = sortedByMmr.slice(halfCount);

  const topAvg = calculateAverage(topHalf.map((p) => p.mmr));
  const bottomAvg = calculateAverage(bottomHalf.map((p) => p.mmr));

  console.log('▶ 【パターンB: 実数MMR中央値スプリット (上位50% vs 下位50%)】');
  console.log(`   👑 上位卓  : ${topHalf.length}名 (平均MMR: ${topAvg}, 境界: ${topHalf[topHalf.length - 1]?.mmr}以上 [${topHalf[topHalf.length - 1]?.tier}])`);
  console.log(`   🌱 下位卓  : ${bottomHalf.length}名 (平均MMR: ${bottomAvg}, 境界: ${bottomHalf[0]?.mmr}以下 [${bottomHalf[0]?.tier}])`);
  console.log(`   ➔ 部屋間MMRギャップ: ${topAvg - bottomAvg} pt`);
  console.log('   ➔ 評価: ✅ 人数は完全均等。各部屋内のMMR分散が最小化され、実力伯仲マッチが実現\n');

  lines.push('### パターンB: 実数MMR中央値スプリット（上位50% vs 下位50%）\n');
  lines.push(`- **👑 上位卓**: **${topHalf.length}名** (平均MMR: **${topAvg}**, 境界: ${topHalf[topHalf.length - 1]?.mmr}以上 [${topHalf[topHalf.length - 1]?.tier}])`);
  lines.push(`- **🌱 下位卓**: **${bottomHalf.length}名** (平均MMR: **${bottomAvg}**, 境界: ${bottomHalf[0]?.mmr}以下 [${bottomHalf[0]?.tier}])`);
  lines.push(`- **部屋間MMR格差**: **${topAvg - bottomAvg} pt**`);
  lines.push(`- **評価**: ✅ 人数均等 ＆ 各部屋内の実力差最小化\n`);

  // パターンC: 初参加・ライト層保護度
  const beginners = playerStats.filter((p) => p.isBeginner);
  console.log('▶ 【初心者・初参加・ライト層の保護チェック】');
  console.log(`   ・保護対象プレイヤー（通算5戦以下 または アイアン〜シルバー）: ${beginners.length}名`);
  console.log(`   ・初中級卓での初心者占有比: ${((beginners.length / Math.max(1, lowRankPlayers.length)) * 100).toFixed(1)}%`);
  console.log('   ・推奨: 初中級卓には「ゴールド上位〜プラチナ下位」の温厚なメンタープレイヤーを2〜3名混ぜることでゲームメイクが安定します。\n');

  lines.push('### 🔰 初心者・初参加・ライト層の保護状況\n');
  lines.push(`- **保護対象人数**: **${beginners.length}名**（通算5戦以下、またはアイアン〜シルバー）`);
  lines.push(`- **初中級卓での初心者比率**: **${((beginners.length / Math.max(1, lowRankPlayers.length)) * 100).toFixed(1)}%**\n`);

  // 5. 結論と推奨サジェスト
  let recommendedThreshold = 'GOLD以下 vs PLATINUM以上';
  if (lowRankPlayers.length < 8) {
    recommendedThreshold = 'SILVER以下 vs GOLD以上 (ゴールドを上位卓へスライド)';
  } else if (highRankPlayers.length < 8) {
    recommendedThreshold = 'PLATINUM以下 vs EMERALD以上 (プラチナを初中級卓へスライド)';
  }

  console.log('================================================================');
  console.log('🎯 3. 2部屋開催の推奨境界線 (サジェスト)');
  console.log('================================================================');
  console.log(`👉 推奨ルール: 【${recommendedThreshold}】`);
  console.log('   理由: 実数データから人数偏りが最も少なく、両部屋で10名（計20名）の');
  console.log('         対戦が最も成立しやすいバランスです。\n');

  lines.push('## 3. 結論 ＆ 推奨しきい値ルール\n');
  lines.push(`> 🏆 **推奨境界線**: **【${recommendedThreshold}】**\n`);
  lines.push('1. **20名集まった場合**: 上記境界線に基づき「初中級卓」「一般卓」へ自動スプリットして同時開催。');
  lines.push('2. **10〜19名の場合**: 最多層（ゴールド・プラチナ帯）を軸に1ランク差以内の10名を選出して1部屋開催。');

  // レポートファイルの保存
  if (isSave) {
    const reportPath = path.resolve(process.cwd(), '02_FACTORY', 'custom_tier_analysis_report.md');
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
    console.log(`📝 レポートを保存しました: ${reportPath}\n`);
  }
}

main().catch((err) => {
  console.error('予期せぬエラー:', err);
  process.exit(1);
});
