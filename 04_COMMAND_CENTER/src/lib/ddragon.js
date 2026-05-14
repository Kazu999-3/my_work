/**
 * Data Dragon ユーティリティ
 * チャンピオンアイコン・スプラッシュアートのURL生成
 */
const DDRAGON_VERSION = '14.10.1'
const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`

// チャンピオン名の正規化マップ（API名 → DDragon名）
const NAME_MAP = {
  'MonkeyKing': 'MonkeyKing',  // Wukong
  'FiddleSticks': 'Fiddlesticks',
  'LeBlanc': 'Leblanc',
}

export const getChampIcon = (name) => {
  if (!name) return null
  const normalized = NAME_MAP[name] || name
  return `${DDRAGON_BASE}/img/champion/${normalized}.png`
}

export const getChampSplash = (name, skin = 0) => {
  if (!name) return null
  const normalized = NAME_MAP[name] || name
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${normalized}_${skin}.jpg`
}
