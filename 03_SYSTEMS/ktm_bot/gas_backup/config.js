/**
 * ⚙️ 定数・設定定義
 */
const SHEET_NAMES = {
  PLAYERS: 'プレイヤー一覧',
  INPUT: '対戦入力',
  BULK: '一括入力',
  MISSIONS: 'MISSIONS'
};

const YOUTUBE_SETTINGS = {
  // 監視対象のプレイリストIDのリスト
  WATCH_PLAYLIST_IDS: [
    'PL7aNfKUA-1lvPVfUoYHpD6jaK0p44HQGM'
  ]
};

const K = 48; // Eloレート変動係数（旧32 → 48に引き上げ）

const RANKS = {
  'UNRANKED': 300, 'IRON': 500, 'BRONZE': 1000, 'SILVER': 1600, 'GOLD': 2300,
  'PLATINUM': 3200, 'EMERALD': 4300, 'DIAMOND': 5700, 'MASTER': 7500, 
  'GRANDMASTER': 10000, 'CHALLENGER': 15000
};

const KTM_TIERS = [
  { name: 'CHALLENGER', min: 15001 },
  { name: 'GRANDMASTER', min: 10001 },
  { name: 'MASTER', min: 7501 },
  { name: 'DIAMOND I', min: 7051 }, { name: 'DIAMOND II', min: 6601 }, { name: 'DIAMOND III', min: 6151 }, { name: 'DIAMOND IV', min: 5701 },
  { name: 'EMERALD I', min: 5351 }, { name: 'EMERALD II', min: 5001 }, { name: 'EMERALD III', min: 4651 }, { name: 'EMERALD IV', min: 4301 },
  { name: 'PLATINUM I', min: 4026 }, { name: 'PLATINUM II', min: 3751 }, { name: 'PLATINUM III', min: 3476 }, { name: 'PLATINUM IV', min: 3201 },
  { name: 'GOLD I', min: 2976 }, { name: 'GOLD II', min: 2751 }, { name: 'GOLD III', min: 2526 }, { name: 'GOLD IV', min: 2301 },
  { name: 'SILVER I', min: 2126 }, { name: 'SILVER II', min: 1951 }, { name: 'SILVER III', min: 1776 }, { name: 'SILVER IV', min: 1601 },
  { name: 'BRONZE I', min: 1451 }, { name: 'BRONZE II', min: 1301 }, { name: 'BRONZE III', min: 1151 }, { name: 'BRONZE IV', min: 1001 },
  { name: 'IRON I', min: 751 }, { name: 'IRON II', min: 501 }, { name: 'IRON III', min: 251 }, { name: 'IRON IV', min: 0 }
];

const KTM_WORKER_URL = "https://ktm-os-worker.arbor0aestiva.workers.dev";
const INTERNAL_GAS_SECRET = "ktm_v3_internal_secret_2026";

/** 汎用ヘルパー群 */
function getKtmRank(mmr) {
  const tier = KTM_TIERS.find(t => mmr >= t.min);
  return tier ? tier.name : 'KTM UNRANKED';
}

function getMultiplierByAffinity(pref1, pref2, targetRole) {
  const isAllMain = (pref1 === 'ALL' || pref1 === 'FILL');
  const isAllSub  = (pref2 === 'ALL' || pref2 === 'FILL');

  if (targetRole === pref1 || isAllMain) return 1.0; // メインロールまたはALL設定: 100%
  
  const soloLanes = ['TOP', 'MID'];
  const isSoloPref1   = soloLanes.includes(pref1);
  const isTargetSolo  = soloLanes.includes(targetRole);

  if (targetRole === pref2 || isAllSub) {
    // サブロール: ソロ同士なら85%、それ以外なら80%
    return (isSoloPref1 && isTargetSolo) ? 0.85 : 0.80;
  } else {
    // それ以外: ソロ同士でも75%、その他65%
    return (isSoloPref1 && isTargetSolo) ? 0.75 : 0.65;
  }
}

function getCombinations(a, s) { 
  const r = []; 
  function b(st, c) { 
    if (c.length === s) { r.push([...c]); return; } 
    for (let i = st; i < a.length; i++) { c.push(a[i]); b(i + 1, c); c.pop(); } 
  }
  b(0, []); 
  return r;
}

function getPermutations(a) {
  const res = []; 
  const generate = (arr, m = []) => { 
    if (arr.length === 0) { res.push(m); } 
    else {
      for (let i = 0; i < arr.length; i++) { 
        let curr = arr.slice(); 
        let next = curr.splice(i, 1); 
        generate(curr.slice(), m.concat(next)); 
      } 
    } 
  };
  generate(a); 
  return res;
}
