/**
 * 🚪 ルーター: API エントリーポイント
 */

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('⚔️ KTM管理')
      .addItem('チーム分け実行', 'uiBalanceTeams')
      .addItem('Discordへ結果を送信', 'uiPostCurrentTeamsDirectly')
      .addItem('一括更新 (Bulk Update)', 'uiUpdateRates')
      .addSeparator()
      .addItem('MMR試算レポートを作成 (Riot連携)', 'uiInitializeMMRsWithRiotForce')
      .addItem('試算結果をMMRに一括反映', 'uiApplyReportedMMRs')
      .addSeparator()
      .addItem('🔥 【禁断】全リセット＆全試合再計算', 'uiFullAutomatedRecalculate')
      .addSeparator()
      .addItem('「対戦入力」の準備', 'uiSetupInputSheet')
      .addItem('「一括入力」の準備', 'uiSetupBulkInputSheet')
      .addSeparator()
      .addItem('【メンテ】YouTube連携の承認', 'uiAuthorizeYouTube')
      .addToUi();
  } catch (e) {
    console.error("onOpen Error: " + e.message);
  }
}

function doGet(e) {
  // Webhook フォールバック
  const msg = e.parameter.msg || "KTM System Status: Online";
  return ContentService.createTextOutput(msg);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const type = payload.type;

    if (type === "VC_SYNC") {
      const inputSheet = getSheet(SHEET_NAMES.INPUT);
      if (!inputSheet) return ContentService.createTextOutput("Error: Input sheet not found");
      const names = payload.names || [];
      const rows = new Array(10).fill([""]);
      names.slice(0, 10).forEach((name, i) => { rows[i] = [name]; });
      inputSheet.getRange('A2:A11').setValues(rows);
      return ContentService.createTextOutput("SUCCESS: Sync done");
    }

    if (type === "AUTO_BALANCE") {
      const inputSheet = getSheet(SHEET_NAMES.INPUT);
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      if (!inputSheet || !playerSheet) return ContentService.createTextOutput("Error: Sheets not found");

      // プレイヤーDBの正式名称リストを取得 (正規化用)
      const playerData = playerSheet.getDataRange().getValues();
      const officialNames = playerData.slice(1).map(r => String(r[0]).trim());

      // 重複排除してから処理
      const rawNames = [...new Set((payload.names || []).map(n => String(n).trim()).filter(n => n))];
      const fixedSpectators = (payload.fixed || []).map(n => String(n).trim());
      
      // Discordからの名前をDBの正式名称に変換する関数 (入力規則エラー対策)
      const normalizeName = (name) => {
        const found = officialNames.find(on => on.toUpperCase() === name.toUpperCase());
        return found || name; // 見つからなければそのまま（エラーになる可能性はあるが最善を尽くす）
      };

      const players = rawNames.filter(n => !fixedSpectators.includes(n)).map(normalizeName);
      const totalSpectators = [...fixedSpectators].map(normalizeName);
      
      // チーム分け対象（最大10名）
      const gamePlayers = players.slice(0, 10);
      const spilledSpectators = players.slice(10);
      const finalSpectators = [...totalSpectators, ...spilledSpectators];

      // 1. 名前をシートに同期 (ここでの書き込みが入力規則に適合するように正規化済み)
      const syncRows = new Array(10).fill([""]);
      gamePlayers.forEach((name, i) => { syncRows[i] = [name]; });
      inputSheet.getRange('A2:A11').setValues(syncRows);
      
      // 2. 観戦枠をクリア＆同期
      inputSheet.getRange('A14:A20').clearContent();
      if (finalSpectators.length > 0) {
        const spectRows = new Array(7).fill([""]);
        finalSpectators.slice(0, 7).forEach((name, i) => { spectRows[i] = [name]; });
        inputSheet.getRange('A14:A20').setValues(spectRows);
      }
      
      SpreadsheetApp.flush();

      // 3. 自動チーム分けは行わず、同期完了のみを返す
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "SUCCESS", 
        message: `SYNCED: ${gamePlayers.length} players. Please run balancing manually from the menu.`,
        spectators: finalSpectators 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "RECORD_RESULT") {
      const winner = String(payload.winner).toUpperCase();
      const kdaMap = payload.kdaMap || {}; 
      const spectators = payload.spectators || []; 
      const bulkSheet = getSheet(SHEET_NAMES.BULK);
      if (!bulkSheet) return ContentService.createTextOutput("Error: Bulk sheet not found");
      
      const now = new Date();
      const bulkRow = new Array(33).fill(""); 
      bulkRow[0] = now;
      bulkRow[1] = winner; 
      
      if (payload.teamBlue) {
        payload.teamBlue.forEach(p => {
          const roleIdx = ['TOP','JG','MID','ADC','SUP'].indexOf(p.role);
          if (roleIdx !== -1) {
            const col = 2 + (roleIdx * 6);
            bulkRow[col] = p.name;
            bulkRow[col+1] = kdaMap[p.name] || 3.0;
          }
        });
      }
      
      if (payload.teamRed) {
        payload.teamRed.forEach(p => {
          const roleIdx = ['TOP','JG','MID','ADC','SUP'].indexOf(p.role);
          if (roleIdx !== -1) {
            const col = 5 + (roleIdx * 6);
            bulkRow[col] = p.name;
            bulkRow[col+1] = kdaMap[p.name] || 3.0;
          }
        });
      }
      
      bulkSheet.appendRow(bulkRow);
      
      // uiUpdateRates(null, true, spectators); // 自動更新を停止し、入力のみにする
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "GET_STATS") {
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      const playerData = playerSheet.getDataRange().getValues();
      const discordId = String(payload.discordId).trim();
      const pIdx = playerData.findIndex(r => String(r[6]).trim() === discordId);
      if (pIdx === -1) return ContentService.createTextOutput(JSON.stringify({ status: "NOT_FOUND" })).setMimeType(ContentService.MimeType.JSON);
      
      const playerName = String(playerData[pIdx][0]).trim();
      
      // Discord 名の更新 (A列)
      if (payload.discordName && payload.discordName !== playerName) {
        playerSheet.getRange(pIdx + 1, 1).setValue(payload.discordName);
        updatePlayerNameInBulk(playerName, payload.discordName);
      }

      const stats = getPlayerStatsData(playerName, payload.period || "ALL");
      const ranks = { TOP: playerData[pIdx][13], JG: playerData[pIdx][14], MID: playerData[pIdx][15], ADC: playerData[pIdx][16], SUP: playerData[pIdx][17] };
      const mmrs = { TOP: playerData[pIdx][7], JG: playerData[pIdx][8], MID: playerData[pIdx][9], ADC: playerData[pIdx][10], SUP: playerData[pIdx][11] };
      
      let rivalry = null;
      const ignColIdx = getColumnByName(playerSheet, "LoL IGN") - 1;
      if (ignColIdx >= 0 && playerData[pIdx][ignColIdx]) {
        const puuid = getCachedPuuid(playerData[pIdx][ignColIdx]);
        if (puuid) {
          const rStats = getRivalryStats(puuid);
          
          const getNameFromPuuid = (p) => {
            for (let i = 1; i < playerData.length; i++) {
              if (playerData[i][ignColIdx]) {
                const targetPuuid = getCachedPuuid(playerData[i][ignColIdx]);
                if (targetPuuid === p) return String(playerData[i][0]).trim();
              }
            }
            return "不明";
          };
          
          rivalry = {
            nemesis: rStats.nemesis ? { name: getNameFromPuuid(rStats.nemesis.puuid), count: rStats.nemesis.count } : null,
            prey: rStats.prey ? { name: getNameFromPuuid(rStats.prey.puuid), count: rStats.prey.count } : null
          };
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "SUCCESS", player: playerName, stats: stats, ranks: ranks, mmrs: mmrs, pity: playerData[pIdx][12], rivalry: rivalry
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "GET_LIVE_STATUS") {
      const discordIds = payload.discordIds || [];
      const results = coreGetLiveStatuses(discordIds);
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", statuses: results })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "SCHEDULE_MATCH_REPORT") {
      scheduleMatchReport(payload.teamBlue || [], payload.teamRed || [], payload.winner || "BLUE");
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "GET_OPGG_URLS") {
      const urls = coreGetOpggUrls(payload.teamBlue || [], payload.teamRed || []);
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", blueUrl: urls.blue, redUrl: urls.red })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "UPDATE_LANE") {
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      const playerData = playerSheet.getDataRange().getValues();
      const discordId = String(payload.discordId || "").trim();
      const pIdx = playerData.findIndex(r => String(r[6]).trim() === discordId);
      
      if (pIdx === -1) return ContentService.createTextOutput(JSON.stringify({ status: "NOT_FOUND", message: "ID未登録です" })).setMimeType(ContentService.MimeType.JSON);
      
      const rN = pIdx + 1;

      // Discord 名の更新 (A列)
      const oldName = String(playerData[pIdx][0]).trim();
      if (payload.discordName && payload.discordName !== oldName) {
        playerSheet.getRange(rN, 1).setValue(payload.discordName);
        updatePlayerNameInBulk(oldName, payload.discordName);
      }

      const lolIgn = String(payload.lolIgn || "").trim();
      const mainRole = String(payload.main || "").toUpperCase().trim();
      const subRole = String(payload.sub || "").toUpperCase().trim();
      const ng1Role = String(payload.ng1 || "").toUpperCase().trim();
      const ng2Role = String(payload.ng2 || "").toUpperCase().trim();

      if (lolIgn) {
        let col = getColumnByName(playerSheet, "LoL IGN");
        if (col === -1) {
          col = playerSheet.getLastColumn() + 1;
          playerSheet.getRange(1, col).setValue("LoL IGN").setBackground("#cfe2f3").setFontWeight("bold");
        }
        playerSheet.getRange(rN, col).setValue(lolIgn);
      }
      if (mainRole) playerSheet.getRange(rN, 3).setValue(mainRole);
      
      if (mainRole === 'ALL') {
        playerSheet.getRange(rN, 4).clearContent(); // ALLの場合は「サブ」は不要なのでクリア
      } else if (subRole) {
        playerSheet.getRange(rN, 4).setValue(subRole);
      }

      // NGレーンはメインがALLであっても個別に指定があれば保存する。
      // 「指定なし」または空文字の場合はセルをクリアする。
      if (ng1Role && ng1Role !== "指定なし") {
        playerSheet.getRange(rN, 5).setValue(ng1Role);
      } else if (ng1Role === "指定なし" || !ng1Role) {
        playerSheet.getRange(rN, 5).clearContent();
      }

      if (ng2Role && ng2Role !== "指定なし") {
        playerSheet.getRange(rN, 6).setValue(ng2Role);
      } else if (ng2Role === "指定なし" || !ng2Role) {
        playerSheet.getRange(rN, 6).clearContent();
      }

      if (playerSheet.getRange(1, 21).getValue() === "") {
        playerSheet.getRange(1, 21, 1, 2).setValues([["こだわり度(Weight)", "格上許可(AllowHigher)"]]).setBackground("#fff2cc").setFontWeight("bold");
      }
      if (payload.weight !== undefined) playerSheet.getRange(rN, 21).setValue(payload.weight);
      if (payload.allowHigher !== undefined) playerSheet.getRange(rN, 22).setValue(payload.allowHigher);
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "MIGRATE_V4") {
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      playerSheet.getRange(1, 21, 1, 2).setValues([["こだわり度(Weight)", "格上許可(AllowHigher)"]]).setBackground("#fff2cc").setFontWeight("bold");
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", message: "Database headers updated to v4." })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "GET_PLAYERS") {
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      const lastRow = playerSheet.getLastRow();
      if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", players: [] })).setMimeType(ContentService.MimeType.JSON);
      
      const values = playerSheet.getRange(2, 1, lastRow - 1, playerSheet.getLastColumn()).getValues();
      const ignColIdx = getColumnByName(playerSheet, "LoL IGN") - 1;
      const discordIdColIdx = 6; // G列(7列目)固定
      
      const players = values.map(row => ({
        name: row[0],
        lolIgn: (ignColIdx >= 0) ? row[ignColIdx] : "",
        discordId: row[discordIdColIdx]
      }));
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", players: players })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "GET_SYSTEM_SUMMARY") {
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      return ContentService.createTextOutput(JSON.stringify({
        status: "SUCCESS", timestamp: new Date().toISOString(), stats: { total_players: playerSheet.getLastRow() - 1, sheet_health: "OK" }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "FIX_LAST_MATCH") {
      const bulkSheet = getSheet(SHEET_NAMES.BULK);
      const lastRow = bulkSheet.getLastRow();
      if (lastRow < 2) return ContentService.createTextOutput("Error: No history");
      bulkSheet.getRange(lastRow, 2).setValue(payload.winner);
      bulkSheet.getRange(lastRow, 33).clear();
      // uiUpdateRates(null, true); // 自動更新を停止
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "ADJUST_MMR") {
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      updatePlayerMMR(playerSheet, String(payload.targetName).trim(), String(payload.role).toUpperCase(), Number(payload.amount));
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "SYNC_MEMBERS") {
      const sheet = getSheet(SHEET_NAMES.PLAYERS);
      const lastRow = sheet.getLastRow();
      const values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 10).getValues() : [];
      // シート構成: [名前, ..., DiscordID(7列目/G列)]
      const existingIds = new Map(values.map((row, i) => [String(row[6]), { name: String(row[0]), row: i + 2 }])); 
      
      let addedCount = 0;
      let updatedCount = 0;
      payload.members.forEach(m => {
        const existing = existingIds.get(String(m.id));
        if (!existing) {
          // [名前, メイン, サブ, NG1, NG2, DiscordID, MMR_TOP, ...]
          const row = new Array(20).fill("");
          row[0] = m.name;
          row[6] = m.id;
          sheet.appendRow(row);
          addedCount++;
        } else if (m.name && m.name !== existing.name) {
          // 名前が変わっている場合は更新
          sheet.getRange(existing.row, 1).setValue(m.name);
          updatePlayerNameInBulk(existing.name, m.name);
          updatedCount++;
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", added: addedCount, updated: updatedCount })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "SYNC_TO_INPUT") {
      const inputSheet = getSheet(SHEET_NAMES.INPUT);
      if (!inputSheet) return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", message: "Input sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      
      // 既存のデータをクリア
      inputSheet.getRange('A2:D11').clearContent();
      inputSheet.getRange('A14:A20').clearContent();
      
      // プレイヤーデータの取得 (MMR参照用)
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      const playerData = playerSheet.getDataRange().getValues();
      
      // 参加者の書き込み
      if (payload.players && payload.players.length > 0) {
        const rows = payload.players.slice(0, 10).map(name => {
          // A列: 名前, D列: MMR (簡易的に平均MMRを取得)
          const pIdx = playerData.findIndex(r => String(r[0]).trim() === String(name).trim());
          let mmr = 1200;
          if (pIdx !== -1) {
            // G-K列 (7-11番目) の平均
            const mmrs = [playerData[pIdx][7], playerData[pIdx][8], playerData[pIdx][10], playerData[pIdx][11], playerData[pIdx][12]];
            mmr = Math.round(mmrs.reduce((a, b) => Number(a) + Number(b), 0) / 5);
          }
          return [name, "", "", mmr];
        });
        inputSheet.getRange(2, 1, rows.length, 4).setValues(rows);
      }
      
      // 観戦者の書き込み
      if (payload.spectators && payload.spectators.length > 0) {
        const spectRows = payload.spectators.slice(0, 7).map(name => [name]);
        inputSheet.getRange(14, 1, spectRows.length, 1).setValues(spectRows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "SYNC_RANKS") {
      const sheet = getSheet(SHEET_NAMES.PLAYERS);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return ContentService.createTextOutput("No players");
      const values = sheet.getRange(2, 1, lastRow - 1, 19).getValues();
      
      payload.updates.forEach(upd => {
        const pIdx = values.findIndex(row => String(row[6]) === String(upd.id));
        if (pIdx !== -1) {
          const rN = pIdx + 2;
          // 14列目(N列)からランク情報を更新
          sheet.getRange(rN, 14, 1, 5).setValues([[upd.top, upd.jg, upd.mid, upd.adc, upd.sup]]);
          // MMRも更新（もし提供されていれば）
          if (upd.mmrs) {
             sheet.getRange(rN, 8, 1, 5).setValues([[upd.mmrs.top, upd.mmrs.jg, upd.mmrs.mid, upd.mmrs.adc, upd.mmrs.sup]]);
          }
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "WRITE_TEMP_NAMES") {
      const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
      const mappings = payload.mappings || []; 
      const data = playerSheet.getDataRange().getValues();
      const col = payload.column || 20; 
      
      if (mappings.length === 0) {
        playerSheet.getRange(1, col, playerSheet.getLastRow(), 1).clear();
        return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
      }

      // カラム1(A列)の場合はヘッダーを上書きしない
      if (col !== 1) {
        playerSheet.getRange(1, col).setValue("Discord取得名").setBackground("#d9ead3").setFontWeight("bold");
      }
      
      mappings.forEach(m => {
        const pIdx = data.findIndex(r => String(r[6]).trim() === m.discordId);
        if (pIdx !== -1) {
          playerSheet.getRange(pIdx + 1, col).setValue(m.name);
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "INITIALIZE_MMR") {
      const isOverwriteAll = !!payload.isOverwriteAll;
      const isForceRiot = !!payload.isForceRiot;
      const result = executeInitializeMMR(isOverwriteAll, isForceRiot);
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", message: result })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "TRIGGER_RIOT_SYNC") {
      const result = coreSyncRiotRanks();
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", message: result })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "GET_API_STATUS") {
      const props = PropertiesService.getScriptProperties().getProperties();
      const status = {
        hasRiotKey: !!props['RIOT_API_KEY'],
        riotKeyLength: props['RIOT_API_KEY'] ? props['RIOT_API_KEY'].length : 0,
        hasCfUrl: !!props['CF_WORKER_URL'],
        ignColumn: getColumnByName(getSheet(SHEET_NAMES.PLAYERS), "LoL IGN")
      };
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", config: status })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "YOUTUBE_GET_TASKS") {
      const tasks = getYouTubePlaylistTasks();
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", tasks: tasks })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "YOUTUBE_DEBUG_LIST") {
      const tasks = getYouTubePlaylistTasks();
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", tasks: tasks })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "YOUTUBE_REMOVE_ITEM") {
      const success = removeYouTubePlaylistItem(payload.playlistItemId);
      return ContentService.createTextOutput(JSON.stringify({ status: success ? "SUCCESS" : "ERROR" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "MISSION_GET_QUEUE") {
      const missionSheet = getSheet(SHEET_NAMES.MISSIONS);
      if (!missionSheet) return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", missions: [] })).setMimeType(ContentService.MimeType.JSON);
      const lastRow = missionSheet.getLastRow();
      if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", missions: [] })).setMimeType(ContentService.MimeType.JSON);
      
      const values = missionSheet.getRange(2, 1, lastRow - 1, 3).getValues();
      const missions = values.map(row => ({
        champion: row[0],
        type: row[1],
        status: row[2]
      })).filter(m => m.status === "PENDING");
      
      // 取得したミッションを「PROCESSING」に更新
      values.forEach((row, i) => {
        if (row[2] === "PENDING") {
          missionSheet.getRange(i + 2, 3).setValue("PROCESSING");
        }
      });
      
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", missions: missions })).setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "MISSION_ADD") {
      const missionSheet = getSheet(SHEET_NAMES.MISSIONS) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAMES.MISSIONS);
      if (missionSheet.getLastRow() === 0) {
        missionSheet.appendRow(["Champion", "Type", "Status", "Timestamp"]);
      }
      missionSheet.appendRow([payload.champion, payload.mission_type || "STANDARD", "PENDING", new Date()]);
      return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("OK");
  } catch (err) { 
    return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", message: err.message })).setMimeType(ContentService.MimeType.JSON); 
  }
}
