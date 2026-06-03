/**
 * 宿命のライバルシステム (Rivalry Tracking)
 */

/**
 * 試合のタイムラインデータを解析し、キルログを保存する
 * @param {Object} matchData - /lol/match/v5/matches/{matchId} の結果
 * @param {string} matchId - 試合ID
 * @param {string} apiKey - Riot API Key
 */
function processRivalryTimeline(matchData, matchId, apiKey) {
  try {
    const url = `https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline?api_key=${apiKey}`;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      console.error("Timeline API Error:", res.getContentText());
      return;
    }
    
    const timeline = JSON.parse(res.getContentText());
    const participantsInfo = matchData.info.participants;
    
    const pMap = {};
    participantsInfo.forEach(p => {
      pMap[p.participantId] = p.puuid;
    });
    
    const kills = [];
    
    timeline.info.frames.forEach(frame => {
      frame.events.forEach(event => {
        if (event.type === "CHAMPION_KILL") {
          const killerId = event.killerId;
          const victimId = event.victimId;
          
          if (killerId > 0 && victimId > 0) {
            kills.push({
              killerPuuid: pMap[killerId],
              victimPuuid: pMap[victimId]
            });
          }
        }
      });
    });
    
    saveRivalryData(kills);
  } catch (err) {
    console.error("Rivalry Processing Error:", err);
  }
}

/**
 * キルデータを RIVALRY シートに保存する
 */
function saveRivalryData(kills) {
  if (kills.length === 0) return;
  
  let sheet = getSheet("RIVALRY");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("RIVALRY");
    sheet.appendRow(['Timestamp', 'Killer_PUUID', 'Victim_PUUID']);
  }
  
  const timestamp = new Date();
  const rows = kills.map(k => [timestamp, k.killerPuuid, k.victimPuuid]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
}
