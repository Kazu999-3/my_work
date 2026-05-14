/**
 * 📊 ランキング・統計集計ロジック
 */

function getPlayerStatsData(playerName, periodStr) {
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  if (!bulkSheet) return { error: "Bulk sheet not found" };
  const bulkData = bulkSheet.getDataRange().getValues();
  
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const stats = { total: { g: 0, w: 0, d: 0 }, roles: {}, recent: [] };
  roles.forEach(r => stats.roles[r] = { g: 0, w: 0, d: 0 });

  let startDate = null;
  if (periodStr === "7DAYS") startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  else if (periodStr === "30DAYS") startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (let i = bulkData.length - 1; i >= 1; i--) {
    const row = bulkData[i];
    if (!row[0]) continue;
    if (startDate && new Date(row[0]) < startDate) continue;
    
    const winTeam = String(row[1]).trim().toUpperCase();
    roles.forEach((role, rIdx) => {
      const bName = String(row[2 + (rIdx * 6)]||"").trim();
      const rName = String(row[5 + (rIdx * 6)]||"").trim();
      
      let matchRes = null;
      if (bName === playerName) matchRes = { win: (winTeam === 'BLUE'), delta: Number(row[4 + (rIdx * 6)]) || 0, role: role };
      else if (rName === playerName) matchRes = { win: (winTeam === 'RED'), delta: Number(row[7 + (rIdx * 6)]) || 0, role: role };

      if (matchRes) {
        stats.total.g++; if (matchRes.win) stats.total.w++; stats.total.d += matchRes.delta;
        stats.roles[role].g++; if (matchRes.win) stats.roles[role].w++; stats.roles[role].d += matchRes.delta;
        
        if (stats.recent.length < 5) {
          stats.recent.push({
            date: Utilities.formatDate(new Date(row[0]), "GMT+9", "MM/dd"),
            win: matchRes.win,
            delta: matchRes.delta,
            role: role
          });
        }
      }
    });
  }
  return stats;
}

function getGlobalStatsMap() {
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  if (!bulkSheet) return {};
  const bulkData = bulkSheet.getDataRange().getValues();
  const statsMap = {}; 

  for (let i = 1; i < bulkData.length; i++) {
    const row = bulkData[i];
    const winningTeam = String(row[1]).trim().toUpperCase();
    if (winningTeam !== 'BLUE' && winningTeam !== 'RED') continue;

    const rolesOrder = ['TOP','JG','MID','ADC','SUP'];
    rolesOrder.forEach((_, rIdx) => {
      const bName = String(row[2 + (rIdx * 6)] || "").trim();
      const rName = String(row[5 + (rIdx * 6)] || "").trim();
      const role = rolesOrder[rIdx];

      if (bName) {
        const key = bName.toUpperCase();
        if (!statsMap[key]) statsMap[key] = { games: 0, wins: 0, roles: {} };
        if (!statsMap[key].roles[role]) statsMap[key].roles[role] = { games: 0, wins: 0 };
        statsMap[key].games++; statsMap[key].roles[role].games++;
        if (winningTeam === 'BLUE') { statsMap[key].wins++; statsMap[key].roles[role].wins++; }
      }
      if (rName) {
        const key = rName.toUpperCase();
        if (!statsMap[key]) statsMap[key] = { games: 0, wins: 0, roles: {} };
        if (!statsMap[key].roles[role]) statsMap[key].roles[role] = { games: 0, wins: 0 };
        statsMap[key].games++; statsMap[key].roles[role].games++;
        if (winningTeam === 'RED') { statsMap[key].wins++; statsMap[key].roles[role].wins++; }
      }
    });
  }
  return statsMap;
}

/**
 * 対面プレイヤーごとの対戦回数を集計する (ロール別)
 */
function getMatchupStatsMap() {
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  if (!bulkSheet) return {};
  const bulkData = bulkSheet.getDataRange().getValues();
  const matchupMap = {}; // key: "PLAYER_A:PLAYER_B:ROLE" (名前はソート)

  for (let i = 1; i < bulkData.length; i++) {
    const row = bulkData[i];
    if (String(row[32]).trim() !== "✅計算済") continue; // 計算済みの過去データのみ参照

    const rolesOrder = ['TOP','JG','MID','ADC','SUP'];
    rolesOrder.forEach((role, rIdx) => {
      const bName = String(row[2 + (rIdx * 6)] || "").trim();
      const rName = String(row[5 + (rIdx * 6)] || "").trim();
      if (bName && rName) {
        const key = [bName.toUpperCase(), rName.toUpperCase()].sort().join("<=>") + ":" + role;
        matchupMap[key] = (matchupMap[key] || 0) + 1;
      }
    });
  }
  return matchupMap;
}

function getLeaderboardData() {
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  if (!playerSheet) return {};
  const playerData = playerSheet.getDataRange().getValues();
  const statsMap = getGlobalStatsMap();
  const rolesOrder = ['TOP','JG','MID','ADC','SUP'];
  const leaderboard = {};

  rolesOrder.forEach((role, rIdx) => {
    const roleRanking = [];
    for (let i = 1; i < playerData.length; i++) {
      const row = playerData[i];
      const name = String(row[0]).trim();
      if (!name) continue;

      const key = name.toUpperCase();
      const s = statsMap[key] || { games: 0, wins: 0, roles: {} };
      if (!s.roles[role] || s.roles[role].wins === 0) continue; 

      const rStats = s.roles[role];
      const winRate = rStats.games > 0 ? ((rStats.wins / rStats.games) * 100).toFixed(1) : "0.0";

      roleRanking.push({ name: name, mmr: Number(row[7 + rIdx]) || 0, winRate: winRate, games: rStats.games });
    }
    roleRanking.sort((a, b) => b.mmr - a.mmr);
    leaderboard[role] = roleRanking.slice(0, 5);
  });
  return leaderboard;
}

function getMatchupHistory() {
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  if (!bulkSheet) return new Set();
  const lastRow = bulkSheet.getLastRow();
  if (lastRow < 2) return new Set();
  
  const scanRows = 5;
  const startRow = Math.max(2, lastRow - scanRows + 1);
  const data = bulkSheet.getRange(startRow, 1, Math.min(scanRows, lastRow - 1), 30).getValues();
  
  const history = new Set();
  data.forEach(row => {
    const rolesCols = [[2,5], [8,11], [14,17], [20,23], [26,29]];
    rolesCols.forEach(cols => {
      const p1 = String(row[cols[0]]||"").trim(), p2 = String(row[cols[1]]||"").trim();
      if (p1 && p2) history.add([p1, p2].sort().join("<=>"));
    });
  });
  return history;
}

function getRivalryStats(puuid) {
  const rivalrySheet = getSheet('RIVALRY');
  if (!rivalrySheet || !puuid) return { nemesis: null, prey: null };
  const data = rivalrySheet.getDataRange().getValues();
  if (data.length < 2) return { nemesis: null, prey: null };
  
  const killedBy = {};
  const killed = {};
  
  for (let i = 1; i < data.length; i++) {
    const killer = String(data[i][1]).trim();
    const victim = String(data[i][2]).trim();
    
    if (killer === puuid) {
      killed[victim] = (killed[victim] || 0) + 1;
    }
    if (victim === puuid) {
      killedBy[killer] = (killedBy[killer] || 0) + 1;
    }
  }
  
  const getTop = (obj) => {
    let topId = null;
    let max = 0;
    for (const [id, count] of Object.entries(obj)) {
      if (count > max) { max = count; topId = id; }
    }
    return topId ? { puuid: topId, count: max } : null;
  };
  
  return {
    nemesis: getTop(killedBy),
    prey: getTop(killed)
  };
}
