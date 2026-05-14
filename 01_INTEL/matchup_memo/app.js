// ==========================================
// Matchup Vault - アプリケーションロジック
// ==========================================

const DDRAGON_VERSION = '16.9.1';
const DDRAGON_CDN = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`;
const STORAGE_KEY = 'matchup_vault_data';

// --- グローバル状態 ---
let allChampions = [];      // Data Dragonから取得したチャンプ一覧
let matchups = [];           // 保存済みマッチアップデータ
let selectedId = null;       // 現在選択中のID
let editingId = null;        // 編集中のID（null = 新規追加モード）

// --- DOM要素キャッシュ ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  searchInput: $('#search-input'),
  filterLane: $('#filter-lane'),
  filterAdvantage: $('#filter-advantage'),
  matchupList: $('#matchup-list'),
  entryCount: $('#entry-count'),
  btnAdd: $('#btn-add'),
  btnEdit: $('#btn-edit'),
  btnDelete: $('#btn-delete'),
  btnExportMd: $('#btn-export-md'),
  btnBackup: $('#btn-backup'),
  btnRestore: $('#btn-restore'),
  fileRestore: $('#file-restore'),

  // 詳細ビュー
  detailEmpty: $('#detail-empty'),
  detailContent: $('#detail-content'),
  detailMyIcon: $('#detail-my-icon'),
  detailMyName: $('#detail-my-name'),
  detailEnemyIcon: $('#detail-enemy-icon'),
  detailEnemyName: $('#detail-enemy-name'),
  detailLane: $('#detail-lane'),
  detailAdvantage: $('#detail-advantage'),
  detailDate: $('#detail-date'),
  detailCoreBuild: $('#detail-core-build'),
  detailStartItem: $('#detail-start-item'),
  detailRunes: $('#detail-runes'),
  detailSummoners: $('#detail-summoners'),
  detailStrategy: $('#detail-strategy'),
  detailPowerspike: $('#detail-powerspike'),
  detailCaution: $('#detail-caution'),

  // モーダル（追加/編集）
  modalOverlay: $('#modal-overlay'),
  modalTitle: $('#modal-title'),
  matchupForm: $('#matchup-form'),
  btnModalClose: $('#btn-modal-close'),
  btnCancel: $('#btn-cancel'),
  inputMyChamp: $('#input-my-champ'),
  inputEnemyChamp: $('#input-enemy-champ'),
  acMyChamp: $('#ac-my-champ'),
  acEnemyChamp: $('#ac-enemy-champ'),
  inputLane: $('#input-lane'),
  inputAdvantage: $('#input-advantage'),
  inputCoreBuild: $('#input-core-build'),
  inputStartItem: $('#input-start-item'),
  inputRunes: $('#input-runes'),
  inputSummoners: $('#input-summoners'),
  inputStrategy: $('#input-strategy'),
  inputPowerspike: $('#input-powerspike'),
  inputCaution: $('#input-caution'),

  // エクスポートモーダル
  exportOverlay: $('#export-overlay'),
  btnExportClose: $('#btn-export-close'),
  exportChampFilter: $('#export-champ-filter'),
  exportLaneFilter: $('#export-lane-filter'),
  exportOutput: $('#export-output'),
  btnCopyMd: $('#btn-copy-md'),
};

// ==========================================
// Data Dragon チャンピオンデータ取得
// ==========================================
async function loadChampions() {
  try {
    const res = await fetch(`${DDRAGON_CDN}/data/ja_JP/champion.json`);
    const data = await res.json();
    allChampions = Object.values(data.data).map(c => ({
      id: c.id,
      name: c.name,
      icon: `${DDRAGON_CDN}/img/champion/${c.id}.png`
    })).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  } catch (e) {
    console.warn('Data Dragon取得失敗、オフラインモードで動作します', e);
    allChampions = [];
  }
}

function getChampIcon(champId) {
  if (!champId) return '';
  // champIdがData Dragon IDの場合
  const found = allChampions.find(c => c.id === champId || c.name === champId);
  if (found) return found.icon;
  // フォールバック: IDをそのまま使う
  return `${DDRAGON_CDN}/img/champion/${champId}.png`;
}

function getChampDisplayName(champId) {
  const found = allChampions.find(c => c.id === champId);
  return found ? found.name : champId;
}

// ==========================================
// localStorage 永続化
// ==========================================
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matchups));
  updateEntryCount();
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    matchups = raw ? JSON.parse(raw) : [];
  } catch {
    matchups = [];
  }
  
  // Sovereign OS 自動同期データのマージ
  if (typeof AUTO_SYNC_MATCHUPS !== 'undefined' && Array.isArray(AUTO_SYNC_MATCHUPS)) {
    AUTO_SYNC_MATCHUPS.forEach(autoItem => {
      if (!matchups.find(m => m.id === autoItem.id)) {
        // [AUTO-SYNC]タグを明示的に付与
        autoItem.strategy = '🤖 [AUTO-SYNC] ' + (autoItem.strategy || '');
        matchups.push(autoItem);
      }
    });
  }
  
  updateEntryCount();
}

function updateEntryCount() {
  DOM.entryCount.textContent = `${matchups.length} entries`;
}

// ==========================================
// マッチアップリスト描画
// ==========================================
function renderList() {
  const search = DOM.searchInput.value.toLowerCase().trim();
  const laneFilter = DOM.filterLane.value;
  const advFilter = DOM.filterAdvantage.value;

  const filtered = matchups.filter(m => {
    if (laneFilter && m.lane !== laneFilter) return false;
    if (advFilter && m.advantage !== advFilter) return false;
    if (search) {
      const myName = getChampDisplayName(m.myChamp).toLowerCase();
      const enemyName = getChampDisplayName(m.enemyChamp).toLowerCase();
      const myId = m.myChamp.toLowerCase();
      const enemyId = m.enemyChamp.toLowerCase();
      if (!myName.includes(search) && !enemyName.includes(search) &&
          !myId.includes(search) && !enemyId.includes(search)) {
        return false;
      }
    }
    return true;
  });

  // 最終更新順（新しい順）
  filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  DOM.matchupList.innerHTML = filtered.length === 0
    ? `<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:0.85rem;">
         ${matchups.length === 0 ? 'まだデータがありません' : '該当なし'}
       </div>`
    : filtered.map(m => {
        const myName = getChampDisplayName(m.myChamp);
        const enemyName = getChampDisplayName(m.enemyChamp);
        const isActive = selectedId === m.id;
        return `
          <div class="matchup-item ${isActive ? 'active' : ''}" data-id="${m.id}">
            <div class="champ-icons">
              <img class="champ-icon" src="${getChampIcon(m.myChamp)}" alt="${myName}"
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect fill=%22%230E2236%22 width=%2232%22 height=%2232%22 rx=%2216%22/><text x=%2216%22 y=%2220%22 text-anchor=%22middle%22 fill=%22%23C89B3C%22 font-size=%2214%22>?</text></svg>'">
              <span class="vs-text">vs</span>
              <img class="champ-icon" src="${getChampIcon(m.enemyChamp)}" alt="${enemyName}"
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect fill=%22%230E2236%22 width=%2232%22 height=%2232%22 rx=%2216%22/><text x=%2216%22 y=%2220%22 text-anchor=%22middle%22 fill=%22%23C89B3C%22 font-size=%2214%22>?</text></svg>'">
            </div>
            <div class="matchup-info">
              <div class="matchup-names">${myName} vs ${enemyName}</div>
              <div class="matchup-tags">
                <span class="lane-tag">${m.lane}</span>
                <span class="advantage-tag ${m.advantage}">${m.advantage}</span>
              </div>
            </div>
          </div>`;
      }).join('');

  // クリックイベント再バインド
  DOM.matchupList.querySelectorAll('.matchup-item').forEach(el => {
    el.addEventListener('click', () => selectMatchup(el.dataset.id));
  });
}

// ==========================================
// 詳細ビュー表示
// ==========================================
function selectMatchup(id) {
  selectedId = id;
  const m = matchups.find(x => x.id === id);
  if (!m) {
    DOM.detailEmpty.hidden = false;
    DOM.detailContent.hidden = true;
    renderList();
    return;
  }

  DOM.detailEmpty.hidden = true;
  DOM.detailContent.hidden = false;

  const myName = getChampDisplayName(m.myChamp);
  const enemyName = getChampDisplayName(m.enemyChamp);

  DOM.detailMyIcon.src = getChampIcon(m.myChamp);
  DOM.detailMyIcon.alt = myName;
  DOM.detailMyName.textContent = myName;
  DOM.detailEnemyIcon.src = getChampIcon(m.enemyChamp);
  DOM.detailEnemyIcon.alt = enemyName;
  DOM.detailEnemyName.textContent = enemyName;

  DOM.detailLane.textContent = m.lane;
  DOM.detailAdvantage.textContent = m.advantage;
  DOM.detailAdvantage.className = `advantage-badge ${m.advantage}`;

  const date = new Date(m.updatedAt);
  DOM.detailDate.textContent = `更新: ${date.toLocaleDateString('ja-JP')}`;

  DOM.detailCoreBuild.textContent = m.coreBuild || '—';
  DOM.detailStartItem.textContent = m.startItem || '—';
  DOM.detailRunes.textContent = m.runes || '—';
  DOM.detailSummoners.textContent = m.summoners || '—';
  DOM.detailStrategy.textContent = m.strategy || '—';
  DOM.detailPowerspike.textContent = m.powerspike || '—';
  DOM.detailCaution.textContent = m.caution || '—';

  renderList();
}

// ==========================================
// モーダル制御（追加/編集）
// ==========================================
function openModal(id = null) {
  editingId = id;
  DOM.modalTitle.textContent = id ? 'マッチアップ編集' : 'マッチアップ追加';

  if (id) {
    const m = matchups.find(x => x.id === id);
    if (!m) return;
    DOM.inputMyChamp.value = m.myChamp;
    DOM.inputEnemyChamp.value = m.enemyChamp;
    DOM.inputLane.value = m.lane;
    DOM.inputAdvantage.value = m.advantage;
    DOM.inputCoreBuild.value = m.coreBuild || '';
    DOM.inputStartItem.value = m.startItem || '';
    DOM.inputRunes.value = m.runes || '';
    DOM.inputSummoners.value = m.summoners || '';
    DOM.inputStrategy.value = m.strategy || '';
    DOM.inputPowerspike.value = m.powerspike || '';
    DOM.inputCaution.value = m.caution || '';
  } else {
    DOM.matchupForm.reset();
  }

  DOM.modalOverlay.hidden = false;
  DOM.inputMyChamp.focus();
}

function closeModal() {
  DOM.modalOverlay.hidden = true;
  editingId = null;
  DOM.acMyChamp.hidden = true;
  DOM.acEnemyChamp.hidden = true;
}

// ==========================================
// フォーム保存
// ==========================================
function handleFormSubmit(e) {
  e.preventDefault();

  const data = {
    myChamp: DOM.inputMyChamp.value.trim(),
    enemyChamp: DOM.inputEnemyChamp.value.trim(),
    lane: DOM.inputLane.value,
    advantage: DOM.inputAdvantage.value,
    coreBuild: DOM.inputCoreBuild.value.trim(),
    startItem: DOM.inputStartItem.value.trim(),
    runes: DOM.inputRunes.value.trim(),
    summoners: DOM.inputSummoners.value.trim(),
    strategy: DOM.inputStrategy.value.trim(),
    powerspike: DOM.inputPowerspike.value.trim(),
    caution: DOM.inputCaution.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (editingId) {
    // 編集
    const idx = matchups.findIndex(x => x.id === editingId);
    if (idx >= 0) {
      data.id = editingId;
      data.createdAt = matchups[idx].createdAt;
      matchups[idx] = data;
    }
    selectedId = editingId;
    showToast('✅ マッチアップを更新しました');
  } else {
    // 新規追加
    data.id = crypto.randomUUID();
    data.createdAt = data.updatedAt;
    matchups.push(data);
    selectedId = data.id;
    showToast('✅ マッチアップを追加しました');
  }

  saveData();
  closeModal();
  renderList();
  selectMatchup(selectedId);
}

// ==========================================
// 削除
// ==========================================
function deleteMatchup() {
  if (!selectedId) return;
  const m = matchups.find(x => x.id === selectedId);
  if (!m) return;

  const myName = getChampDisplayName(m.myChamp);
  const enemyName = getChampDisplayName(m.enemyChamp);
  if (!confirm(`「${myName} vs ${enemyName}」を削除しますか？`)) return;

  matchups = matchups.filter(x => x.id !== selectedId);
  selectedId = null;
  saveData();
  renderList();
  DOM.detailEmpty.hidden = false;
  DOM.detailContent.hidden = true;
  showToast('🗑️ マッチアップを削除しました');
}

// ==========================================
// オートコンプリート
// ==========================================
function setupAutocomplete(input, dropdown) {
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const val = input.value.toLowerCase().trim();
      if (val.length < 1 || allChampions.length === 0) {
        dropdown.hidden = true;
        return;
      }

      const matches = allChampions.filter(c =>
        c.name.toLowerCase().includes(val) || c.id.toLowerCase().includes(val)
      ).slice(0, 12);

      if (matches.length === 0) {
        dropdown.hidden = true;
        return;
      }

      dropdown.innerHTML = matches.map(c => `
        <div class="ac-item" data-id="${c.id}">
          <img src="${c.icon}" alt="${c.name}"
               onerror="this.style.display='none'">
          <span>${c.name}</span>
        </div>
      `).join('');
      dropdown.hidden = false;

      dropdown.querySelectorAll('.ac-item').forEach(item => {
        item.addEventListener('click', () => {
          input.value = item.dataset.id;
          dropdown.hidden = true;
        });
      });
    }, 150);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { dropdown.hidden = true; }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdown.hidden = true;
  });
}

// ==========================================
// Markdownエクスポート（note記事用）
// ==========================================
function openExportModal() {
  // チャンプ選択肢を生成
  const champSet = new Set();
  matchups.forEach(m => champSet.add(m.myChamp));
  DOM.exportChampFilter.innerHTML = '<option value="">全チャンプ</option>';
  [...champSet].sort().forEach(id => {
    const name = getChampDisplayName(id);
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    DOM.exportChampFilter.appendChild(opt);
  });

  generateMarkdown();
  DOM.exportOverlay.hidden = false;
}

function generateMarkdown() {
  const champFilter = DOM.exportChampFilter.value;
  const laneFilter = DOM.exportLaneFilter.value;

  let filtered = matchups.filter(m => {
    if (champFilter && m.myChamp !== champFilter) return false;
    if (laneFilter && m.lane !== laneFilter) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (a.myChamp !== b.myChamp) return a.myChamp.localeCompare(b.myChamp);
    return a.enemyChamp.localeCompare(b.enemyChamp);
  });

  if (filtered.length === 0) {
    DOM.exportOutput.value = '（該当するマッチアップがありません）';
    return;
  }

  let md = `# マッチアップガイド\n\n`;

  // チャンプごとにグループ化
  const grouped = {};
  filtered.forEach(m => {
    if (!grouped[m.myChamp]) grouped[m.myChamp] = [];
    grouped[m.myChamp].push(m);
  });

  Object.entries(grouped).forEach(([champId, entries]) => {
    const champName = getChampDisplayName(champId);
    md += `## ${champName}\n\n`;

    entries.forEach(m => {
      const enemyName = getChampDisplayName(m.enemyChamp);
      const advEmoji = m.advantage === '有利' ? '🟢' : m.advantage === '不利' ? '🔴' : '🟡';
      md += `### vs ${enemyName}【${m.lane}】${advEmoji} ${m.advantage}\n\n`;

      if (m.coreBuild || m.startItem) {
        md += `**ビルド**\n`;
        if (m.coreBuild) md += `- コア: ${m.coreBuild}\n`;
        if (m.startItem) md += `- スタート: ${m.startItem}\n`;
        md += `\n`;
      }

      if (m.runes) md += `**ルーン**: ${m.runes}\n\n`;
      if (m.summoners) md += `**サモスペ**: ${m.summoners}\n\n`;

      if (m.strategy) {
        md += `**戦い方**\n${m.strategy}\n\n`;
      }

      if (m.powerspike) md += `**パワースパイク**: ${m.powerspike}\n\n`;
      if (m.caution) md += `**⚠️ 注意**: ${m.caution}\n\n`;

      md += `---\n\n`;
    });
  });

  DOM.exportOutput.value = md.trim();
}

function copyMarkdown() {
  DOM.exportOutput.select();
  navigator.clipboard.writeText(DOM.exportOutput.value).then(() => {
    showToast('📋 Markdownをコピーしました');
  }).catch(() => {
    // フォールバック
    document.execCommand('copy');
    showToast('📋 Markdownをコピーしました');
  });
}

// ==========================================
// JSONバックアップ / リストア
// ==========================================
function exportBackup() {
  const blob = new Blob([JSON.stringify(matchups, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `matchup_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 バックアップをダウンロードしました');
}

function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Invalid format');
      if (!confirm(`${data.length}件のデータを復元します。現在のデータは上書きされます。よろしいですか？`)) return;
      matchups = data;
      selectedId = null;
      saveData();
      renderList();
      DOM.detailEmpty.hidden = false;
      DOM.detailContent.hidden = true;
      showToast(`📤 ${data.length}件のデータを復元しました`);
    } catch (err) {
      showToast('❌ ファイルの読み込みに失敗しました');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// ==========================================
// トースト通知
// ==========================================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ==========================================
// イベントバインド
// ==========================================
function bindEvents() {
  // 検索 & フィルタ
  DOM.searchInput.addEventListener('input', renderList);
  DOM.filterLane.addEventListener('change', renderList);
  DOM.filterAdvantage.addEventListener('change', renderList);

  // 追加ボタン
  DOM.btnAdd.addEventListener('click', () => openModal());

  // 編集・削除
  DOM.btnEdit.addEventListener('click', () => openModal(selectedId));
  DOM.btnDelete.addEventListener('click', deleteMatchup);

  // モーダル制御
  DOM.btnModalClose.addEventListener('click', closeModal);
  DOM.btnCancel.addEventListener('click', closeModal);
  DOM.modalOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.modalOverlay) closeModal();
  });
  DOM.matchupForm.addEventListener('submit', handleFormSubmit);

  // オートコンプリート
  setupAutocomplete(DOM.inputMyChamp, DOM.acMyChamp);
  setupAutocomplete(DOM.inputEnemyChamp, DOM.acEnemyChamp);

  // エクスポート
  DOM.btnExportMd.addEventListener('click', openExportModal);
  DOM.btnExportClose.addEventListener('click', () => { DOM.exportOverlay.hidden = true; });
  DOM.exportOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.exportOverlay) DOM.exportOverlay.hidden = true;
  });
  DOM.exportChampFilter.addEventListener('change', generateMarkdown);
  DOM.exportLaneFilter.addEventListener('change', generateMarkdown);
  DOM.btnCopyMd.addEventListener('click', copyMarkdown);

  // バックアップ / リストア
  DOM.btnBackup.addEventListener('click', exportBackup);
  DOM.btnRestore.addEventListener('click', () => DOM.fileRestore.click());
  DOM.fileRestore.addEventListener('change', (e) => {
    if (e.target.files[0]) restoreBackup(e.target.files[0]);
    e.target.value = '';
  });

  // キーボードショートカット
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!DOM.modalOverlay.hidden) closeModal();
      if (!DOM.exportOverlay.hidden) DOM.exportOverlay.hidden = true;
    }
    // Ctrl+N で新規追加
    if (e.ctrlKey && e.key === 'n' && DOM.modalOverlay.hidden) {
      e.preventDefault();
      openModal();
    }
  });

  // 画像エラーハンドリング（詳細ビュー）
  [DOM.detailMyIcon, DOM.detailEnemyIcon].forEach(img => {
    img.addEventListener('error', () => {
      img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect fill="%230E2236" width="80" height="80" rx="40"/><text x="40" y="50" text-anchor="middle" fill="%23C89B3C" font-size="32">?</text></svg>`;
    });
  });
}

// ==========================================
// 初期化
// ==========================================
async function init() {
  loadData();
  await loadChampions();
  renderList();
  bindEvents();
}

init();
