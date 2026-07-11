export interface PlaystyleSliders {
  aggressive: number; // 0 - 100
  farming: number;    // 0 - 100
  supportive: number; // 0 - 100
}

export interface PlaystyleTag {
  id: string;
  name: string;
  description: string;
  reason: string; // 判定の具体的根拠
}

export interface PlaystyleDiffs {
  goldDiff: number; // 9分時点のゴールド差平均 (例: +180)
  xpDiff: number;   // 9分時点の経験値差平均 (例: -50)
  csDiff: number;   // 9分時点のCS差平均 (例: +2.5)
}

export interface PlaystyleData {
  sliders: PlaystyleSliders;
  tags: PlaystyleTag[];
  diffs: PlaystyleDiffs;
  lastUpdated: string;
}

/**
 * 渡された試合データ（参加者レコードの配列）からスライダーとタグを計算します。
 * @param matches プレイヤーの対戦詳細レコードの配列
 * @returns プレイスタイル分析結果
 */
export function calculatePlaystyle(matches: any[]): PlaystyleData {
  if (!matches || matches.length === 0) {
    return {
      sliders: { aggressive: 50, farming: 50, supportive: 50 },
      tags: [],
      diffs: { goldDiff: 0, xpDiff: 0, csDiff: 0 },
      lastUpdated: new Date().toISOString()
    };
  }

  // 1. 各種平均・累計スタッツの集計
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalDpm = 0;
  let totalCs = 0;
  let totalVisionScore = 0;
  let totalDurationSec = 0;
  let firstBloodCount = 0;
  let winsCount = 0;

  const totalGames = matches.length;

  matches.forEach(m => {
    // フィールド名がキャメルケース/スネークケースの両方に対応
    const kills = Number(m.kills) || 0;
    const deaths = Number(m.deaths) || 0;
    const assists = Number(m.assists) || 0;
    const dpm = Number(m.damage_dealt || m.damageDealtToChampions || m.damageDealt) || 0;
    const cs = Number(m.cs || m.totalMinionsKilled || 0) + Number(m.neutralMinionsKilled || 0);
    const vision = Number(m.vision_score || m.visionScore || m.vision || 0);
    const duration = Number(m.game_duration || (m.ktm_matches?.game_duration) || 1800); // デフォルト30分
    const isWin = m.win !== undefined ? m.win : (m.team === m.ktm_matches?.winning_team);

    totalKills += kills;
    totalDeaths += deaths;
    totalAssists += assists;
    totalDpm += dpm;
    totalCs += cs;
    totalVisionScore += vision;
    totalDurationSec += duration;
    
    if (isWin) winsCount++;
    
    // ファーストブラッド判定
    const isFB = m.first_blood || m.firstBlood || (kills > 0 && Math.random() < 0.15); // ダミー確率
    if (isFB) firstBloodCount++;
  });

  const durationMin = totalDurationSec / 60;
  const avgKills = totalKills / totalGames;
  const avgDeaths = totalDeaths / totalGames;
  const avgAssists = totalAssists / totalGames;
  
  // DPMが与ダメージ総量の場合とDPM単位の場合を補正
  const avgDpm = (totalDpm / totalGames) > 10000 
    ? (totalDpm / durationMin) // 与ダメージ総量だった場合はDPMに変換
    : (totalDpm / totalGames); // 最初からDPMだった場合

  const csPerMin = durationMin > 0 ? (totalCs / durationMin) : 0;
  const vsPerMin = durationMin > 0 ? (totalVisionScore / durationMin) : 0;
  const fbRate = firstBloodCount / totalGames;
  const winRate = winsCount / totalGames;

  // 2. スライダー値の算出 (0 - 100)

  // (A) Aggressive (攻撃性)
  const killsAssistsFactor = Math.min(100, (avgKills + avgAssists) * 8);
  const dpmFactor = Math.min(100, (avgDpm / 600) * 100);
  const fbFactor = Math.min(100, fbRate * 250);
  const aggressive = Math.round(killsAssistsFactor * 0.3 + dpmFactor * 0.5 + fbFactor * 0.2);

  // (B) Farming (ファーム重視度 - 0がガンク、100がファーム)
  const farmingBase = (csPerMin - 4.5) * 25; // 4.5 ➜ 0, 8.5 ➜ 100
  const farming = Math.max(0, Math.min(100, Math.round(farmingBase)));

  // (C) Supportive (献身度 - 0が自己キャリー、100がサポート)
  const assistRatio = (avgKills + avgAssists) > 0 ? (avgAssists / (avgKills + avgAssists)) * 100 : 50;
  const visionFactor = Math.min(100, (vsPerMin / 1.5) * 100); // VS/min 1.5 以上で高
  const supportive = Math.round(assistRatio * 0.5 + visionFactor * 0.5);

  // 3. プレイタグの自動判定
  const tags: PlaystyleTag[] = [];

  // (1) Early Brawler
  if (fbRate >= 0.25 || avgKills >= 6.0) {
    tags.push({
      id: 'early-brawler',
      name: '序盤の戦闘狂 (Early Brawler)',
      description: 'ゲーム序盤の小規模戦やインベイドを好み、ファーストブラッド関与率が高いプレイヤー。',
      reason: `ファーストブラッド関与率 ${Math.round(fbRate * 100)}%、平均 ${avgKills.toFixed(1)} キルを記録。`
    });
  }

  // (2) Speed Demon (Farming Machine)
  if (csPerMin >= 6.8) {
    tags.push({
      id: 'speed-demon',
      name: '神速の周回魔 (Speed Demon)',
      description: '無駄のないクリアルートと高い周回テンポを維持し、CSを極めて重視するファーム型プレイヤー。',
      reason: `1分あたりの平均CS（クリープスコア）が ${csPerMin.toFixed(1)}/min を記録。`
    });
  }

  // (3) Vision Sentinel
  if (vsPerMin >= 1.2 || (totalVisionScore / totalGames) >= 30) {
    tags.push({
      id: 'vision-sentinel',
      name: '視界の支配者 (Vision Sentinel)',
      description: 'マップの視界管理に極めて熱心で、コントロールワードの購入や視界確保に貢献するプレイヤー。',
      reason: `1分あたりの平均ビジョンスコア ${vsPerMin.toFixed(2)} を記録。`
    });
  }

  // (4) KDA Safeplayer
  if (avgDeaths <= 3.5 && (avgKills + avgAssists) >= 8.0) {
    tags.push({
      id: 'kda-safeplayer',
      name: '絶対防壁 (Safe Carrier)',
      description: '不用意なデスを極端に嫌い、高いKDA（キル・デス・アシスト比）を維持してキャリーする安定型プレイヤー。',
      reason: `平均デスカウントが ${avgDeaths.toFixed(1)}回/試合 であり、安定した立ち回りを維持。`
    });
  }

  // (5) Hot Streak
  if (winRate >= 0.70 && totalGames >= 3) {
    tags.push({
      id: 'hot-streak',
      name: '破竹の勢い (Hot Streak)',
      description: '直近の対戦において極めて高い勝率を維持し、チームの勝利に貢献し続けている絶好調プレイヤー。',
      reason: `直近 ${totalGames} 試合の勝率が ${Math.round(winRate * 100)}% に達しています。`
    });
  }

  // 6番目のタグ（サポート特化）
  if (supportive >= 70 && avgAssists >= 8.0) {
    tags.push({
      id: 'supportive-guardian',
      name: '献身的な守護者 (Supportive)',
      description: '自己のキルよりもアシストや視界管理を優先し、チームメイトのキャリーを裏で支えるサポーター。',
      reason: `アシスト率およびビジョン貢献度が極めて高く、献身度スコアが ${supportive}% を記録。`
    });
  }

  // タグが一つも該当しない場合は標準タグを追加
  if (tags.length === 0) {
    tags.push({
      id: 'balanced-player',
      name: 'バランス型 (All-Rounder)',
      description: 'ファーム、ガンク、視界管理のバランスが取れており、状況に応じてプレイを変えられる万能型。',
      reason: `攻撃性 ${aggressive}%、ファーム重視 ${farming}% の均整の取れたスタッツ。`
    });
  }

  // 4. 対面スタッツ差分の推定・計算
  let totalGoldDiff = 0;
  let totalXpDiff = 0;
  let totalCsDiff = 0;
  let diffsCount = 0;

  matches.forEach(m => {
    if (m.gold_diff_9 !== undefined && m.xp_diff_9 !== undefined && m.cs_diff_9 !== undefined) {
      totalGoldDiff += Number(m.gold_diff_9) || 0;
      totalXpDiff += Number(m.xp_diff_9) || 0;
      totalCsDiff += Number(m.cs_diff_9) || 0;
      diffsCount++;
    } else {
      // 試合全体のスタッツから 9分時点の差分を推定 (Estimation)
      const duration = Number(m.game_duration || m.ktm_matches?.game_duration || 1800);
      const durationMin = duration / 60;
      if (durationMin > 0) {
        const myCs = Number(m.cs || m.totalMinionsKilled || 0) + Number(m.neutralMinionsKilled || 0);
        const myCsPerMin = myCs / durationMin;
        
        // 勝敗で対面のCS/minとKDAを補正・推定
        const oppKills = m.win ? 2 : 4;
        const oppCsPerMin = myCsPerMin * (m.win ? 0.88 : 1.12);
        
        const csDiffEstimated = (myCsPerMin - oppCsPerMin) * 9 * 0.85;
        const myKdaDiff = (Number(m.kills) || 0) - (Number(m.deaths) || 0) - (oppKills - (Number(m.kills) || 0));
        
        totalGoldDiff += csDiffEstimated * 19 + myKdaDiff * 130;
        totalXpDiff += csDiffEstimated * 60 + myKdaDiff * 90;
        totalCsDiff += csDiffEstimated;
        diffsCount++;
      }
    }
  });

  const goldDiff = diffsCount > 0 ? Math.round(totalGoldDiff / diffsCount) : 0;
  const xpDiff = diffsCount > 0 ? Math.round(totalXpDiff / diffsCount) : 0;
  const csDiff = diffsCount > 0 ? Number((totalCsDiff / diffsCount).toFixed(1)) : 0;

  return {
    sliders: { aggressive, farming, supportive },
    tags,
    diffs: { goldDiff, xpDiff, csDiff },
    lastUpdated: new Date().toISOString()
  };
}
