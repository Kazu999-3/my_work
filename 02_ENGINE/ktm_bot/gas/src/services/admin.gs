/**
 * 🛠️ 管理者・メンテナンス機能 (Sheet 操作 / Riot API 連携)
 */

/**
 * MMR と 【不運度】を一括初期化する (コアロジック)
 * @param {boolean} isOverwriteAll trueなら既存のMMRを上書きする
 * @param {boolean} isForceRiot trueならKTM実績に関わらずRiot APIから習熟度を取得する
 */
function executeInitializeMMR(isOverwriteAll = false, isForceRiot = false, startIdx = 0, targetName = null) {
  const startTime = new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  if (!playerSheet) return "エラー: シートが見つかりません。";
  
  // レポート用シートの準備
  let reportSheet = ss.getSheetByName("MMR試算レポート");
  if (!reportSheet) {
    reportSheet = ss.insertSheet("MMR試算レポート");
  }
  // シートの列数が14未満なら拡張（旧バージョンとの互換性保証）
  const REPORT_COLS = 14;
  if (reportSheet.getMaxColumns() < REPORT_COLS) {
    reportSheet.insertColumnsAfter(reportSheet.getMaxColumns(), REPORT_COLS - reportSheet.getMaxColumns());
  }
  if (startIdx === 0 && !targetName) {
    reportSheet.clear();
    reportSheet.getRange(1, 1, 1, 14).setValues([["名前", "状態", "最高ランク", "理由/メモ", "TOP内訳", "JG内訳", "MID内訳", "ADC内訳", "SUP内訳", "rawTOP", "rawJG", "rawMID", "rawADC", "rawSUP"]]);
    reportSheet.setFrozenRows(1);
  }

  const rolesOrder = ["TOP", "JG", "MID", "ADC", "SUP"];
  const data = playerSheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  const ignColIdx = getColumnByName(playerSheet, "LoL IGN") - 1;
  const apiKey = PropertiesService.getScriptProperties().getProperty('RIOT_API_KEY');
  const statsMap = getGlobalStatsMap();

  let successCount = 0;
  let reportRows = [];
  
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    const playerName = String(row[0]).trim();
    if (!playerName) continue;
    if (targetName && playerName !== targetName) continue;

    // 中断判定 (270秒)
    if (!targetName && new Date().getTime() - startTime > 270000) {
      if (reportRows.length > 0) reportSheet.getRange(reportSheet.getLastRow() + 1, 1, reportRows.length, reportRows[0].length).setValues(reportRows);
      return `【一時中断】制限時間のため ${i + 1}人目 (${playerName}) で停止しました。\nもう一度メニューを実行するとここから再開できます。`;
    }

    const maxRank = String(row[1]).trim().toUpperCase();
    const pref1   = String(row[2]).trim().toUpperCase();
    const pref2   = String(row[3]).trim().toUpperCase();
    const currentMMRs = row.slice(7, 12);
    const playerStats = statsMap[playerName.toUpperCase()];
    const totalKtmGames = playerStats ? (playerStats.games || 0) : 0;

    let riotProficiency = null;
    let status = "✅ 完了";
    let skipReason = "-";

    try {
      // スキップ判定
      let shouldCheckRiot = true;
      if (!apiKey) {
        shouldCheckRiot = false;
        skipReason = "APIキー未設定";
      } else if (ignColIdx < 0 || !String(row[ignColIdx]).trim().includes('#')) {
        shouldCheckRiot = false;
        skipReason = "IGN(RiotID)未設定";
      } else if (!isForceRiot && totalKtmGames >= 3) {
        shouldCheckRiot = false;
        skipReason = `KTM実績十分(${totalKtmGames}戦)`;
      }

      if (shouldCheckRiot) {
        const puuidResult = getCachedPuuidInfo(String(row[ignColIdx]).trim());
        if (puuidResult.puuid) {
          riotProficiency = getRiotLaneProficiency(puuidResult.puuid, apiKey, 3);
          if (!riotProficiency || Object.values(riotProficiency).every(v => v === 0)) {
            skipReason = "Riot直近戦績なし (基本値適用)";
          }
        } else {
          status = "⚠️ 失敗";
          skipReason = `PUUID取得失敗(${puuidResult.code})`;
        }
      } else if (skipReason === "-") {
        status = "⏭️ スキップ";
      }

      let baseMMR = RANKS[maxRank] || 1200;
      let reason = skipReason;

      // 【スマート初期化】Riot API データがある場合、より詳細に初期値を決定
      if (apiKey && ignColIdx >= 0 && String(row[ignColIdx]).trim().includes('#')) {
        try {
          const [ignName, ignTag] = String(row[ignColIdx]).trim().split('#');
          const riotData = getRiotRank(ignName, ignTag);
          if (riotData) {
            const best = rankToMmrBest(riotData);
            if (best.tier !== 'UNRANKED') {
              baseMMR = best.mmr;
              reason = `RiotRank(${best.source}:${best.tier} ${best.rank})`;
            } else {
              // アンランクの場合：レベルで推定
              const lv = riotData.summonerLevel || 0;
              if (lv >= 300) { baseMMR = 3200; reason = `Unranked(Lv${lv}推定:PLAT)`; }
              else if (lv >= 150) { baseMMR = 2500; reason = `Unranked(Lv${lv}推定:GOLD)`; }
              else if (lv >= 50) { baseMMR = 1800; reason = `Unranked(Lv${lv}推定:SILVER)`; }
              else { baseMMR = 1200; reason = `Unranked(Lv${lv}推定:BRONZE)`; }
            }
          }
        } catch (riotErr) {
          console.error("SmartInit Error:", riotErr);
        }
      }

      // 【実績補正 (Performance Anchor)】KTMでの勝率が極端な場合、初期値を調整
      if (playerStats && playerStats.games >= 5) {
        const wr = (playerStats.wins / playerStats.games) * 100;
        if (wr < 35) {
          baseMMR *= 0.8; // 負け越しすぎている場合は20%カット
          reason += " + 勝率低迷補正(-20%)";
        } else if (wr > 65) {
          baseMMR *= 1.2; // 勝ち越しすぎている場合は20%バフ
          reason += " + 勝率無双補正(+20%)";
        }
      }

      const detailTexts = [];
      const rowMMRs = rolesOrder.map((role, rIdx) => {
        const currentVal = String(currentMMRs[rIdx]).trim();
        if (!isOverwriteAll && currentVal !== "" && currentVal !== "0" && currentVal !== "0.0") {
          detailTexts.push("既存維持");
          return Number(currentVal);
        }

        const affinityMult = getMultiplierByAffinity(pref1, pref2, role);
        let roleGames = playerStats?.roles?.[role]?.games ?? 0;
        if (roleGames === 0 && riotProficiency) roleGames = riotProficiency[role] || 0;

        let expMult = 1.0;
        if (roleGames >= 10) expMult = 1.05;
        else if (roleGames >= 5) expMult = 1.00;
        else if (roleGames >= 2) expMult = 0.95;
        else if (roleGames >= 1) expMult = 0.90;
        else expMult = 0.70;

        const finalMMR = Math.round(baseMMR * affinityMult * expMult);
        detailTexts.push(`${finalMMR}`);
        return finalMMR;
      });

      reportRows.push([playerName, status, maxRank, reason, ...detailTexts, ...rowMMRs]);

      if (!targetName) {
        const targetRow = i + 2;
        playerSheet.getRange(targetRow, 8, 1, 5).setValues([rowMMRs]);
        playerSheet.getRange(targetRow, 13).setValue(0);
        playerSheet.getRange(targetRow, 14, 1, 5).setValues([rowMMRs.map(mmr => getKtmRank(mmr))]);
        successCount++;
        // 1人完了するごとに次のインデックスを保存
        PropertiesService.getScriptProperties().setProperty('MMR_INIT_RESUME_IDX', i + 1);
        if (successCount % 5 === 0) SpreadsheetApp.flush();
      }
    } catch (e) {
      if (reportRows.length > 0 && !targetName) reportSheet.getRange(reportSheet.getLastRow() + 1, 1, reportRows.length, reportRows[0].length).setValues(reportRows);
      return `【エラー中断】${playerName} の処理中にエラーが発生しました: ${e.message}\n現在 ${i}人目として記録されています。解決後、再実行してください。`;
    }

    if (targetName) break;
  }

  if (reportRows.length > 0 && !targetName) {
    reportSheet.getRange(reportSheet.getLastRow() + 1, 1, reportRows.length, reportRows[0].length).setValues(reportRows);
  }
  
  if (targetName) {
    const r = reportRows[0];
    return r ? `【詳細試算結果: ${r[0]}】\n状態: ${r[1]}\nランク: ${r[2]}\n理由: ${r[3]}\n\nTOP: ${r[4]}\nJG: ${r[5]}\nMID: ${r[6]}\nADC: ${r[7]}\nSUP: ${r[8]}` : "対象が見つかりません。";
  }

  PropertiesService.getScriptProperties().deleteProperty('MMR_INIT_RESUME_IDX');
  applyPlayerRankStyles(playerSheet);
  return `【初期化完了】詳細は「MMR試算レポート」シートを確認してください。`;
}

/**
 * 試算レポートの数値をプレイヤー一覧に一括適用する
 */
function uiApplyReportedMMRs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportSheet = ss.getSheetByName("MMR試算レポート");
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  if (!reportSheet || !playerSheet) return;

  const data = reportSheet.getDataRange().getValues();
  if (data.length < 2) return;

  const playerData = playerSheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0]).trim();
    const status = String(data[i][1]);
    if (!name || status.includes("失敗")) continue;

    const pIdx = playerData.findIndex(r => String(r[0]).trim() === name);
    if (pIdx !== -1) {
      const rawMMRs = data[i].slice(9, 14); // rawTOP ~ rawSUP
      playerSheet.getRange(pIdx + 1, 8, 1, 5).setValues([rawMMRs]);
      playerSheet.getRange(pIdx + 1, 13).setValue(0); // 不運度リセット
      playerSheet.getRange(pIdx + 1, 14, 1, 5).setValues([rawMMRs.map(mmr => getKtmRank(mmr))]);
      count++;
    }
  }
  applyPlayerRankStyles(playerSheet);
  SpreadsheetApp.getUi().alert(`${count} 名のMMRを試算値に更新しました。`);
}

/**
 * 🔥 【禁断の奥義】全リセット＆全試合再計算
 */
function uiFullAutomatedRecalculate() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('【超重要】全リセット＆再計算', 
    '1. 全員のMMRをRiot APIベースの初期値にリセットします。\n' +
    '2. 全試合の「✅計算済」を解除します。\n' +
    '3. 1試合目から初回ブーストを適用して全て再計算します。\n\n' +
    'この操作は元に戻せません。実行しますか？', ui.ButtonSet.YES_NO);
  
  if (res !== ui.Button.YES) return;

  // 1. MMRリセット
  const initResult = executeInitializeMMR(true, true, 0);
  console.log(initResult);

  // 2. チェック解除
  uiClearAllBulkCalculatedFlags();

  // 3. 一括更新（逐次計算）
  uiUpdateRates(null, true);

  ui.alert('実行完了', '全てのMMRが再計算されました。', ui.ButtonSet.OK);
}

/**
 * スプレッドシートメニューからのMMR初期化
 */
function uiInitializeMMRs() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('MMR一括初期化', '全てのプレイヤーのMMRを初期値(Riotランクベース)にリセットしますか？\n(「いいえ」を選ぶと未設定プレイヤーのみ初期化します)', ui.ButtonSet.YES_NO_CANCEL);
  
  if (response === ui.Button.CANCEL) return;
  
  const isOverwriteAll = (response === ui.Button.YES);
  const result = executeInitializeMMR(isOverwriteAll, false, 0); // 通常初期化
  ui.alert('実行完了', result, ui.ButtonSet.OK);
}

/**
 * スプレッドシートメニューからのMMR初期化 (Riot連携強制)
 */
function uiInitializeMMRsWithRiotForce() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const resumeIdx = Number(props.getProperty('MMR_INIT_RESUME_IDX') || 0);
  
  let isOverwriteAll = true;
  let startIdx = 0;

  if (resumeIdx > 0) {
    const res = ui.alert('再開確認', `前回の実行が ${resumeIdx}人目で中断されています。ここから再開しますか？\n(「いいえ」を選ぶと最初からやり直します)`, ui.ButtonSet.YES_NO_CANCEL);
    if (res === ui.Button.CANCEL) return;
    if (res === ui.Button.YES) startIdx = resumeIdx;
  } else {
    const res = ui.alert('Riot連携(強制)でMMR初期化', '全プレイヤーに対してRiot APIから最新情報を取得し、MMRを再計算しますか？', ui.ButtonSet.YES_NO);
    if (res !== ui.Button.YES) return;
  }
  
  const result = executeInitializeMMR(true, true, startIdx);
  ui.alert('実行結果', result, ui.ButtonSet.OK);
}


/**
 * 「一括入力」シートの準備
 */
function uiSetupBulkInputSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let bulkSheet = ss.getSheetByName(SHEET_NAMES.BULK);
  if (!bulkSheet) bulkSheet = ss.insertSheet(SHEET_NAMES.BULK);
  
  bulkSheet.clear();
  const headers = [
    "日時", "勝利", 
    "TOP(B)", "KDA", "増減", "TOP(R)", "KDA", "増減",
    "JG(B)", "KDA", "増減", "JG(R)", "KDA", "増減",
    "MID(B)", "KDA", "増減", "MID(R)", "KDA", "増減",
    "ADC(B)", "KDA", "増減", "ADC(R)", "KDA", "増減",
    "SUP(B)", "KDA", "増減", "SUP(R)", "KDA", "増減", "ステータス"
  ];
  bulkSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#444444').setFontColor('#ffffff').setHorizontalAlignment('center');
  
  for (let i = 0; i < 5; i++) {
    const startCol = 3 + (i * 6);
    bulkSheet.getRange(1, startCol, 1, 3).setBackground('#cfe2f3').setFontColor('#0b5394');
    bulkSheet.getRange(1, startCol + 3, 1, 3).setBackground('#f4cccc').setFontColor('#990000');
  }
  bulkSheet.setFrozenRows(1);
  bulkSheet.setColumnWidths(1, 1, 150);
  SpreadsheetApp.getUi().alert('「一括入力」シートの準備が完了しました！');
}

/**
 * 「対戦入力」シートの準備
 */
function uiSetupInputSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let inputSheet = ss.getSheetByName(SHEET_NAMES.INPUT);
  if (!inputSheet) inputSheet = ss.insertSheet(SHEET_NAMES.INPUT);

  inputSheet.clear();
  inputSheet.getRange('A1:D1').setValues([["名前", "ロール", "チーム", "MMR"]]).setBackground('#444444').setFontColor('#ffffff').setFontWeight('bold');
  inputSheet.getRange('F1:H1').setValues([["勝敗", "固定", "固定対象"]]).setBackground('#444444').setFontColor('#ffffff').setFontWeight('bold');
  
  inputSheet.setColumnWidth(1, 150);
  inputSheet.getRange('A14').setValue('⏳ カスタム待機').setFontWeight('bold');
  
  SpreadsheetApp.getUi().alert('「対戦入力」シートの準備が完了しました！');
}
