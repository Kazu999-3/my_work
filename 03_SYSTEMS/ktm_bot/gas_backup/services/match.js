/**
 * 📝 デイリーマッチ処理 (データ転送とレート更新)
 */


function uiUpdateRatesBlueWin() { uiUpdateRates('BLUE'); }
function uiUpdateRatesRedWin() { uiUpdateRates('RED'); }
function uiProcessBulkMatches() { uiUpdateRates(); }

/**
 * MMR計算コアロジック (対面回数補正あり)
 */
function calculateNewMMR(c, o, w, k, m, numGames, matchupCount, totalWinRate) {
  // ① Elo基本計算
  const expectedWin = 1 / (1 + Math.pow(10, (o - c) / 400));
  const elo = K * ((w ? 1 : 0) - expectedWin);

  // ② KDAボーナス
  let kdaB = (k - 3) * 8;
  kdaB = Math.max(-20, Math.min(20, kdaB));

  // ③ ランク収束引力
  const rankTarget = RANKS[m] || 1200;
  const rankDiff = rankTarget - c;
  let grav = 0;
  if (Math.abs(rankDiff) > 100) {
    let gravStrength = 0.001;
    if (numGames < 5) gravStrength = 0.005;
    else if (numGames < 10) gravStrength = 0.003;
    grav = rankDiff * gravStrength;
  }

  // ④ 勝率補正 (地獄のデバフループ) は削除されました
  let wrCorrection = 0;

  // ⑤ 合算と制限
  let baseDelta = elo + kdaB + grav + wrCorrection;
  
  // ⑥ 習熟度と対面回数による倍率調整
  let multiplier = 1.0;
  if (numGames < 5) multiplier = 3.0;
  else if (numGames < 10) multiplier = 2.0;

  // 【新設】対面との対戦回数による増減率の調整
  // 1戦目(0回)は1.5倍、回数を重ねるごとに1.0に収束
  let matchupMultiplier = Math.max(1.0, 1.5 - (matchupCount * 0.1));
  
  let finalDelta = Math.round(baseDelta * multiplier * matchupMultiplier);
  
  // ★ 追加: 高勝率プレイヤー(60%以上)の敗北ペナルティ (インフレ抑制)
  if (!w && totalWinRate > 60) {
    const winRatePenalty = Math.min(8, (totalWinRate - 60) * 0.5);
    finalDelta -= Math.round(winRatePenalty);
  }

  // 最終的な増減のガード
  if (w) {
    finalDelta = Math.max(10, finalDelta); // 勝利時は最低 +10
  } else {
    // 変更: 下限を -35 から -45 に拡大し、インフレ抑制の減少を正しく許容する
    finalDelta = Math.max(-45, Math.min(-5, finalDelta)); 
  }

  return c + finalDelta;
}

function uiUpdateRates(winnerArg, isSilent = false, spectators = []) {
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  if (!bulkSheet || !playerSheet) return;

  const bulkData = bulkSheet.getDataRange().getValues();
  const playerData = playerSheet.getDataRange().getValues();
  if (bulkData.length < 2) return;

  // 📈 累積統計を管理するマップ
  const dynamicStatsMap = {}; 
  const matchupMap = {}; // key: "A<=>B:ROLE"
  const roles = ['TOP','JG','MID','ADC','SUP'];

  const updateStats = (name, role, isWin) => {
    const key = name.toUpperCase();
    if (!dynamicStatsMap[key]) dynamicStatsMap[key] = { games: 0, wins: 0, roles: {} };
    if (!dynamicStatsMap[key].roles[role]) dynamicStatsMap[key].roles[role] = { games: 0, wins: 0 };
    dynamicStatsMap[key].games++;
    dynamicStatsMap[key].roles[role].games++;
    if (isWin) {
      dynamicStatsMap[key].wins++;
      dynamicStatsMap[key].roles[role].wins++;
    }
  };

  // 1. まず「✅計算済」の行から累積統計を構築
  for (let i = 1; i < bulkData.length; i++) {
    const row = bulkData[i];
    const winningTeam = String(row[1]).trim().toUpperCase();
    const status = String(row[32]).trim();
    if (!status.includes('✅') || (winningTeam !== 'BLUE' && winningTeam !== 'RED')) continue;
    
    roles.forEach((r, rIdx) => {
      const bName = String(row[2 + (rIdx * 6)]).trim().toUpperCase();
      const rName = String(row[5 + (rIdx * 6)]).trim().toUpperCase();
      if (bName) updateStats(bName, r, winningTeam === 'BLUE');
      if (rName) updateStats(rName, r, winningTeam === 'RED');
      
      // 対面履歴の更新
      if (bName && rName) {
        const matchupKey = [bName, rName].sort().join("<=>") + ":" + r;
        matchupMap[matchupKey] = (matchupMap[matchupKey] || 0) + 1;
      }
    });
  }

  let updateCount = 0;
  const playedParticipants = new Set();

  for (let i = 1; i < bulkData.length; i++) {
    const row = bulkData[i];
    const winningTeam = String(row[1]).trim().toUpperCase();
    const status = String(row[32]).trim();

    if ((winningTeam === 'BLUE' || winningTeam === 'RED') && !status.includes('✅')) {
      const matchRowInfo = [];
      const roles = ['TOP','JG','MID','ADC','SUP'];
      roles.forEach((r, rIdx) => {
        const baseCol = 2 + (rIdx * 6);
        matchRowInfo.push({ name: String(row[baseCol]), role: r, team: 'BLUE', kda: Number(row[baseCol+1]) || 3.0 });
        matchRowInfo.push({ name: String(row[baseCol+3]), role: r, team: 'RED', kda: Number(row[baseCol+4]) || 3.0 });
      });

      const getMMR = (n, r) => {
        const pIdx = playerData.findIndex(x => String(x[0]).trim() === n);
        const colIdx = roles.indexOf(r) + 7;
        return pIdx !== -1 ? Number(playerData[pIdx][colIdx]) : 1200;
      };

      matchRowInfo.forEach(p => {
        const isWin = (p.team === winningTeam);
        const curMMR = getMMR(p.name, p.role);
        const pIdx = playerData.findIndex(x => String(x[0]).trim() === p.name);
        if (pIdx === -1) return;

        const maxRank = String(playerData[pIdx][1]).toUpperCase().trim();
        const opponent = matchRowInfo.find(x => x.role === p.role && x.team !== p.team);
        let oppMMR = getMMR(opponent.name, p.role);
        
        const roleIdx = roles.indexOf(p.role);
        const cellCol = 5 + (roleIdx * 6) + (p.team === 'BLUE' ? 0 : 3);
        const oldDelta = Number(row[cellCol - 1]) || 0;
        const revertedBaseMMR = curMMR - oldDelta;

        const userStats = dynamicStatsMap[p.name.toUpperCase()] || { games: 0, wins: 0, roles: {} };
        const roleStats = (userStats.roles && userStats.roles[p.role]) ? userStats.roles[p.role] : { games: 0, wins: 0 };
        const roleGames = roleStats.games;
        const totalGames = userStats.games;
        const totalWinRate = (totalGames >= 5) ? (userStats.wins / totalGames * 100) : null;

        // 対面回数の取得
        const matchupKey = [p.name.toUpperCase(), opponent.name.toUpperCase()].sort().join("<=>") + ":" + p.role;
        const mCount = matchupMap[matchupKey] || 0;

        const newMMR = calculateNewMMR(revertedBaseMMR, oppMMR, isWin, p.kda, maxRank, roleGames, mCount, totalWinRate);
        const delta = newMMR - revertedBaseMMR;

        const roleColIdx = roles.indexOf(p.role) + 7;
        playerData[pIdx][roleColIdx] = newMMR;
        playerSheet.getRange(pIdx + 1, roleColIdx + 1).setValue(newMMR);
        playerSheet.getRange(pIdx + 1, roleColIdx + 7).setValue(getKtmRank(newMMR));
        playedParticipants.add(p.name);

        const mainRole = String(playerData[pIdx][2]).trim().toUpperCase();
        const subRole = String(playerData[pIdx][3]).trim().toUpperCase();
        const currentPity = Number(playerData[pIdx][12]) || 0;
        let nextPity = 0;
        
        if (mainRole === 'ALL' || p.role === mainRole) nextPity = 0; 
        else if (p.role === subRole) nextPity = currentPity + 2; 
        else nextPity = currentPity + 5; 
        
        playerSheet.getRange(pIdx + 1, 13).setValue(nextPity); 
        bulkSheet.getRange(i + 1, cellCol).setValue((delta >= 0 ? "+" : "") + delta);
        
        // 🔄 計算が終わったプレイヤーの統計をその場で更新
        updateStats(p.name, p.role, isWin);
        
        // 対面回数をインクリメント（片側だけで良いので一回だけ実行するように調整）
        if (p.team === 'BLUE') {
          matchupMap[matchupKey] = mCount + 1;
        }
      });

      bulkSheet.getRange(i + 1, 33).setValue("✅計算済");
      updateCount++;
    }
  }

  if (updateCount > 0) {
    const freshPlayerData = playerSheet.getDataRange().getValues();
    if (spectators && spectators.length > 0) {
      spectators.forEach(name => {
        const pIdx = freshPlayerData.findIndex(x => String(x[0]).trim() === String(name).trim());
        if (pIdx !== -1) {
          const currentPity = Number(freshPlayerData[pIdx][12]) || 0;
          playerSheet.getRange(pIdx + 1, 13).setValue(currentPity + 10);
        }
      });
    }

    applyPlayerRankStyles(playerSheet);
    const ui = (isSilent) ? null : SpreadsheetApp.getUi();
    if (ui) ui.alert(`${updateCount} 件の対戦データを反映しました！`);
  } else {
  }
}

/**
 * 現在の「対戦入力」シートの内容を Discord へ送信する
 */
function uiPostCurrentTeamsDirectly() {
  const inputSheet = getSheet(SHEET_NAMES.INPUT);
  if (!inputSheet) return;

  const data = inputSheet.getRange('A2:D11').getValues();
  const teamBlue = [];
  const teamRed = [];
  
  data.forEach(r => {
    const name = String(r[0]).trim();
    if (!name) return;
    
    const player = {
      name: name,
      role: String(r[1]).trim().toUpperCase(),
      team: String(r[2]).trim().toUpperCase(),
      mmr: Number(r[3]) || 1200
    };
    
    if (player.team === 'BLUE') teamBlue.push(player);
    else if (player.team === 'RED') teamRed.push(player);
  });

  if (teamBlue.length === 0 && teamRed.length === 0) {
    SpreadsheetApp.getUi().alert('送信するチームデータがありません。A列〜C列を確認してください。');
    return;
  }

  // 観戦者の取得
  const spectData = inputSheet.getRange('A14:A20').getValues();
  const spectators = spectData.map(r => String(r[0]).trim()).filter(n => n);

  try {
    postTeamsToDiscord(teamBlue, teamRed, spectators);
    SpreadsheetApp.getUi().alert('Discordへ送信しました！');
  } catch (e) {
    SpreadsheetApp.getUi().alert('送信エラー: ' + e.message);
  }
}

/**
 * 📝 自動リザルト＆MVPレポート（キュー処理）
 */
function scheduleMatchReport(teamBlue, teamRed, winner) {
  const queueJson = PropertiesService.getScriptProperties().getProperty('MATCH_REPORT_QUEUE') || "[]";
  const queue = JSON.parse(queueJson);
  queue.push({ teamBlue, teamRed, winner, timestamp: Date.now() });
  PropertiesService.getScriptProperties().setProperty('MATCH_REPORT_QUEUE', JSON.stringify(queue));
  
  // トリガーを3分後にセット
  ScriptApp.newTrigger('processMatchReportQueue').timeBased().after(3 * 60 * 1000).create();
}

function processMatchReportQueue(e) {
  // トリガーの自己消去
  if (e && e.triggerUid) {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getUniqueId() === e.triggerUid) ScriptApp.deleteTrigger(t);
    });
  }

  const queueJson = PropertiesService.getScriptProperties().getProperty('MATCH_REPORT_QUEUE') || "[]";
  const queue = JSON.parse(queueJson);
  if (queue.length === 0) return;

  const currentMatch = queue.shift();
  PropertiesService.getScriptProperties().setProperty('MATCH_REPORT_QUEUE', JSON.stringify(queue));

  try {
    coreExecuteMatchReport(currentMatch.teamBlue, currentMatch.teamRed, currentMatch.winner);
  } catch (err) {
    console.error("Auto Report Error:", err);
    const cfUrl = PropertiesService.getScriptProperties().getProperty('CF_WORKER_URL');
    const secret = PropertiesService.getScriptProperties().getProperty('INTERNAL_GAS_SECRET') || "ktm_v3_internal_secret_2026";
    if (cfUrl) {
      UrlFetchApp.fetch(cfUrl + "/post-report", {
        method: "post",
        headers: { "x-gas-secret": secret, "Content-Type": "application/json" },
        payload: JSON.stringify({ content: `⚠️ **MVP自動レポート内部エラー**: ${err.message}` })
      });
    }
  }
}

/**
 * 実際のRiot API通信とDiscord投稿処理
 */
function coreExecuteMatchReport(teamBlue, teamRed, winner, spectators = []) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('RIOT_API_KEY');
  if (!apiKey) return;
  
  const allPlayers = [...teamBlue, ...teamRed];
  if (allPlayers.length === 0) return;
  
  // プレイヤーDBから最低1人のPUUIDを取得する
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  const playerData = playerSheet.getDataRange().getValues();
  const ignColIdx = getColumnByName(playerSheet, "LoL IGN") - 1;
  const discordIdColIdx = 6;
  
  let searchPuuid = null;
  const puuidToDiscordName = {};
  
  for (const p of allPlayers) {
    const row = playerData.find(r => String(r[0]).trim() === String(p.name).trim() || String(r[discordIdColIdx]).trim() === String(p.name).trim());
    if (row && ignColIdx >= 0 && row[ignColIdx]) {
      const ign = row[ignColIdx];
      const puuid = getCachedPuuid(ign);
      if (puuid) {
        if (!searchPuuid) searchPuuid = puuid;
        puuidToDiscordName[puuid] = String(p.name).trim();
      }
    }
  }
  
  if (!searchPuuid) {
    const cfUrl = PropertiesService.getScriptProperties().getProperty('CF_WORKER_URL');
    const secret = PropertiesService.getScriptProperties().getProperty('INTERNAL_GAS_SECRET') || "ktm_v3_internal_secret_2026";
    if (cfUrl) {
      UrlFetchApp.fetch(cfUrl + "/post-report", {
        method: "post",
        headers: { "x-gas-secret": secret, "Content-Type": "application/json" },
        payload: JSON.stringify({ content: "⚠️ **MVP自動レポート失敗**: 参加者のRiot IGNが登録されていないか、PUUIDが取得できませんでした。" })
      });
    }
    console.warn("No PUUID found for Match Report");
    return;
  }

  // 直近5試合を取得
  const matchesUrl = `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${searchPuuid}/ids?start=0&count=5&api_key=${apiKey}`;
  const matchIdsRes = UrlFetchApp.fetch(matchesUrl, { muteHttpExceptions: true });
  if (matchIdsRes.getResponseCode() !== 200) return;
  
  const matchIds = JSON.parse(matchIdsRes.getContentText());
  let targetMatch = null;
  
  // マッチ詳細を順に確認し、カスタムゲームを探す
  for (const matchId of matchIds) {
    const detailUrl = `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${apiKey}`;
    const detailRes = UrlFetchApp.fetch(detailUrl, { muteHttpExceptions: true });
    if (detailRes.getResponseCode() !== 200) continue;
    
    const matchData = JSON.parse(detailRes.getContentText());
    if (matchData.info.gameType === "CUSTOM_GAME") {
      targetMatch = matchData;
      break;
    }
  }
  
  if (!targetMatch) {
    console.warn("No recent CUSTOM_GAME found for Match Report");
    return;
  }
  
  // ライバルシステムのタイムライン解析を実行
  if (typeof processRivalryTimeline === "function") {
    processRivalryTimeline(targetMatch, targetMatch.metadata.matchId, apiKey);
  }
  
  // MVPの計算とEmbedの作成
  const participants = targetMatch.info.participants;
  let mvp = null;
  let maxScore = -1;
  
  const blueFields = [];
  const redFields = [];
  
  participants.forEach(p => {
    const k = p.kills;
    const d = p.deaths;
    const a = p.assists;
    const score = (k + a) / Math.max(1, d) + (p.visionScore * 0.1);
    
    if (score > maxScore) {
      maxScore = score;
      mvp = p;
    }
    
    const isWin = p.win;
    const teamName = p.teamId === 100 ? "BLUE" : "RED";
    const dName = puuidToDiscordName[p.puuid] || p.riotIdGameName || p.summonerName;
    const line = `**${dName}** - \`${k}/${d}/${a}\` (視界:${p.visionScore})`;
    
    if (teamName === "BLUE") blueFields.push(line);
    else redFields.push(line);
  });
  
  const mvpName = mvp ? (puuidToDiscordName[mvp.puuid] || mvp.riotIdGameName || mvp.summonerName) : "不明";
  
  // ━━━ Riot APIのKDA/パフォーマンススコアをBULKシートに反映 ━━━
  try {
    const bulkSheet = getSheet(SHEET_NAMES.BULK);
    if (bulkSheet) {
      const bulkData = bulkSheet.getDataRange().getValues();
      const roles = ['TOP','JG','MID','ADC','SUP'];
      
      const blueKills = participants.filter(p => p.teamId === 100).reduce((sum, p) => sum + p.kills, 0);
      const redKills = participants.filter(p => p.teamId === 200).reduce((sum, p) => sum + p.kills, 0);
      
      // 参加者名 → ロール のマッピング
      const playerRoleMap = {};
      allPlayers.forEach(p => {
        playerRoleMap[p.name.toUpperCase()] = p.role;
      });
      
      // 参加者名 → 総合パフォーマンススコア のマップを作成
      const kdaFromRiot = {};
      participants.forEach(p => {
        const dName = puuidToDiscordName[p.puuid] || p.riotIdGameName || p.summonerName;
        if (dName) {
          const role = playerRoleMap[dName.toUpperCase()] || 'MID';
          const teamKills = p.teamId === 100 ? blueKills : redKills;
          const perfScore = calculatePerformanceScore(p, role, targetMatch.info.gameDuration, teamKills);
          kdaFromRiot[dName] = perfScore;
        }
      });
      
      // 最新の未計算行（✅計算済でないもの）を検索してKDAを更新
      for (let i = bulkData.length - 1; i >= 1; i--) {
        const row = bulkData[i];
        const winningTeam = String(row[1]).trim().toUpperCase();
        if ((winningTeam === 'BLUE' || winningTeam === 'RED') && !String(row[32]).includes('✅')) {
          roles.forEach((r, rIdx) => {
            const blueNameCol = 2 + (rIdx * 6); // 0-indexed
            const blueKdaCol  = 3 + (rIdx * 6);
            const redNameCol  = 5 + (rIdx * 6);
            const redKdaCol   = 6 + (rIdx * 6);
            
            const blueName = String(row[blueNameCol]).trim();
            const redName  = String(row[redNameCol]).trim();
            
            if (blueName && kdaFromRiot[blueName] !== undefined) {
              bulkSheet.getRange(i + 1, blueKdaCol + 1).setValue(kdaFromRiot[blueName]);
            }
            if (redName && kdaFromRiot[redName] !== undefined) {
              bulkSheet.getRange(i + 1, redKdaCol + 1).setValue(kdaFromRiot[redName]);
            }
          });
          console.log(`BULKシート行${i+1}のKDAをRiot APIデータ(パフォーマンススコア)で更新しました`);
          break; // 最新1件のみ更新
        }
      }
    }
  } catch (kdaErr) {
    console.error("BULK KDA更新エラー:", kdaErr);
  }
  
  const embed = {
    title: "🏅 試合リザルト ＆ MVP発表",
    description: `マッチID: \`${targetMatch.metadata.matchId}\`\nゲーム時間: ${Math.floor(targetMatch.info.gameDuration / 60)}分${targetMatch.info.gameDuration % 60}秒`,
    color: winner === "BLUE" ? 0x3498db : 0xe74c3c,
    fields: [
      { name: "🟦 TEAM BLUE", value: blueFields.join("\n") || "データなし", inline: true },
      { name: "🟥 TEAM RED", value: redFields.join("\n") || "データなし", inline: true },
      { name: "👑 MVP (KDA + Vision)", value: `**${mvpName}**\n\`${mvp.kills}/${mvp.deaths}/${mvp.assists}\` (スコア: ${maxScore.toFixed(2)})`, inline: false }
    ],
    timestamp: new Date().toISOString()
  };
  
  postEmbedToDiscord([embed], CONFIG.MATCH_CHANNEL_ID || "1485636511679651871", "🔄 **自動リザルトレポート**");

  // ━━━ MMRの自動計算・更新の実行 ━━━
  try {
    console.log("MMRの自動更新を実行します...");
    uiUpdateRates(winner, true, spectators);
    console.log("MMRの自動更新が完了しました。");
  } catch (updateErr) {
    console.error("MMRの自動更新中にエラーが発生しました:", updateErr);
  }
}

/**
 * 一括入力シートの全ての「✅計算済」フラグを解除する
 */
function uiClearAllBulkCalculatedFlags() {
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  if (!bulkSheet) return;
  const lastRow = bulkSheet.getLastRow();
  if (lastRow < 2) return;

  const range = bulkSheet.getRange(2, 33, lastRow - 1, 1);
  const values = range.getValues();
  const cleared = values.map(r => [String(r[0]).replace(/✅計算済/g, "").trim()]);
  range.setValues(cleared);
}

/**
 * 📊 Riot APIスタッツに基づき、ロールに応じた総合パフォーマンススコア(1.0〜8.0)を算出する
 */
function calculatePerformanceScore(p, role, gameDurationSec, teamKills) {
  const durationMin = gameDurationSec / 60;
  if (durationMin <= 0) return 3.0;
  
  const rawKda = (p.kills + p.assists) / Math.max(1, p.deaths);
  
  const csPerMin = ((p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0)) / durationMin;
  const dmgPerMin = (p.totalDamageDealtToChampions || 0) / durationMin;
  const tankPerMin = ((p.totalDamageTaken || 0) + (p.damageSelfMitigated || 0)) / durationMin;
  const visionPerMin = (p.visionScore || 0) / durationMin;
  
  const kp = teamKills > 0 ? (p.kills + p.assists) / teamKills : 0;
  
  // 早期降参などのショートゲーム（15分未満）の場合はスタッツのペナルティ・ボーナスを評価しない
  const isShortGame = gameDurationSec < 900;
  
  let score = rawKda;
  
  switch(role) {
    case 'TOP':
      if (!isShortGame) {
        score += (csPerMin - 6.0) * 0.3;
        score += (tankPerMin - 800) * 0.0005;
      }
      break;
    case 'JG':
      score += (kp - 0.5) * 1.0;
      if (!isShortGame) {
        score += (tankPerMin - 600) * 0.0003;
      }
      break;
    case 'MID':
      if (!isShortGame) {
        score += (csPerMin - 6.5) * 0.3;
        score += (dmgPerMin - 600) * 0.001;
      }
      break;
    case 'ADC':
      if (!isShortGame) {
        score += (csPerMin - 7.0) * 0.3;
        score += (dmgPerMin - 700) * 0.001;
      }
      break;
    case 'SUP':
      score += (visionPerMin - 1.2) * 0.5;
      score += (kp - 0.5) * 1.0;
      break;
  }
  
  // 制限ガード
  score = Math.max(1.0, Math.min(8.0, score));
  return Math.round(score * 10) / 10;
}
