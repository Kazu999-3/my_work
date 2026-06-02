/**
 * 💾 データベース操作層 (SpreadsheetAppアクセスラッパー)
 */

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(sheetName);
}

function applyPlayerRankStyles(sheet) {
  const lastRow = sheet.getLastRow(); if (lastRow < 2) return;
  const range = sheet.getRange("N2:R" + lastRow); 
  range.setHorizontalAlignment("center").setFontWeight("bold");
  sheet.clearConditionalFormatRules();
  const rules = []; 
  const config = [
    { name: 'PLATINUM', bg: '#CFE2F3', fg: '#0B5394' }, 
    { name: 'GOLD', bg: '#FFF2CC', fg: '#BF9000' }, 
    { name: 'SILVER', bg: '#EFEFEF', fg: '#666666' }, 
    { name: 'BRONZE', bg: '#F9CB9C', fg: '#783F04' }, 
    { name: 'IRON', bg: '#D9D9D9', fg: '#434343' }
  ];
  config.forEach(c => { 
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(c.name).setBackground(c.bg).setFontColor(c.fg).setRanges([range]).build()); 
  });
  sheet.setConditionalFormatRules(rules);
}

function getPlayerMMR(data, name, role) {
  const rowIdx = data.findIndex(r => String(r[0]).trim() === name);
  const colIdx = ['TOP','JG','MID','ADC','SUP'].indexOf(role) + 7;
  return rowIdx !== -1 ? Number(data[rowIdx][colIdx]) : 1200;
}

function getPlayerAttr(data, name, attr) {
  const rowIdx = data.findIndex(r => String(r[0]).trim() === name);
  const colIdx = data[0].findIndex(c => String(c) === attr);
  return rowIdx !== -1 ? data[rowIdx][colIdx] : 'UNRANKED';
}

function updatePlayerMMR(sheet, name, role, mmr) {
  const data = sheet.getDataRange().getValues();
  const rowIdx = data.findIndex(r => String(r[0]).trim() === String(name).trim()) + 1;
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const colIdx = roles.indexOf(role) + 8;
  if (rowIdx > 0) { 
    sheet.getRange(rowIdx, colIdx).setValue(mmr); 
    sheet.getRange(rowIdx, roles.indexOf(role) + 14).setValue(getKtmRank(mmr)); 
  }
}

function updatePlayerPity(sheet, name, pts) {
  const data = sheet.getDataRange().getValues();
  const rowIdx = data.findIndex(r => String(r[0]).trim() === name) + 1;
  const colIdx = 13;
  if (rowIdx > 1) { 
    const val = (pts === 0) ? 0 : (Number(data[rowIdx-1][colIdx-1]) || 0) + pts; 
    sheet.getRange(rowIdx, colIdx).setValue(val); 
  }
}

function getColumnByName(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  const idx = headers.indexOf(name);
  return idx !== -1 ? idx + 1 : -1;
}

function updatePlayerNameInBulk(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  if (!bulkSheet) return;
  const lastRow = bulkSheet.getLastRow();
  if (lastRow < 2) return;
  
  const dataRange = bulkSheet.getRange(2, 1, lastRow - 1, bulkSheet.getLastColumn());
  const data = dataRange.getValues();
  let modified = false;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    for (let rIdx = 0; rIdx < 5; rIdx++) {
      const bColIdx = 2 + (rIdx * 6);
      const rColIdx = 5 + (rIdx * 6);
      if (String(row[bColIdx]).trim() === oldName) { row[bColIdx] = newName; modified = true; }
      if (String(row[rColIdx]).trim() === oldName) { row[rColIdx] = newName; modified = true; }
    }
  }
  
  if (modified) {
    dataRange.setValues(data);
  }
}
