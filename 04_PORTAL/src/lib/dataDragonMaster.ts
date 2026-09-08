import fs from 'fs';
import path from 'path';

export interface ChampionSkillInfo {
  slot?: string;
  name_ja: string;
  name_en: string;
  cooldown?: number[];
  cost?: number[];
  description_ja?: string;
}

export interface DDragonMasterDict {
  patch: string;
  champions: Record<string, { id: string; key: string; name_ja: string; name_en: string; title_ja: string }>;
  skills: Record<string, ChampionSkillInfo>; // "Champion:Q" or "Champion:Passive"
  items: Record<string, { id: string; name_ja: string; name_en: string; gold: number; plaintext_ja: string }>;
  runes: Record<string, { id: string; tree_ja: string; name_ja: string; name_en: string }>;
  summoner_spells: Record<string, { id: string; name_ja: string; name_en: string; cooldown: number }>;
  alias_to_champion: Record<string, string>;
  item_name_to_ja: Record<string, string>;
  rune_name_to_ja: Record<string, string>;
}

let cachedDict: DDragonMasterDict | null = null;

export function getDDragonMaster(): DDragonMasterDict | null {
  if (cachedDict) return cachedDict;
  try {
    const jsonPath = path.resolve(process.cwd(), '../01_INTEL/_LOL/ddragon_master_dict.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      cachedDict = JSON.parse(raw);
      return cachedDict;
    }
  } catch (err) {
    console.warn('[dataDragonMaster] Failed to load local master dict, fallback to empty:', err);
  }
  return null;
}

/**
 * チャンピオンID、英語名、日本語名から正規化された champion_id (例: 'Ahri', 'TwistedFate') を返す
 */
export function normalizeChampionId(input: string): string | null {
  if (!input) return null;
  const dict = getDDragonMaster();
  if (!dict) return input.trim();

  const clean = input.trim().toLowerCase();
  return dict.alias_to_champion[clean] || dict.alias_to_champion[input.trim()] || null;
}

/**
 * チャンピオンの全スキル情報（P, Q, W, E, R）を公式日本語名付きで取得
 */
export function getChampionSkills(champId: string): Record<string, ChampionSkillInfo> {
  const dict = getDDragonMaster();
  if (!dict) return {};

  const normalized = normalizeChampionId(champId) || champId;
  const result: Record<string, ChampionSkillInfo> = {};

  for (const slot of ['Passive', 'Q', 'W', 'E', 'R']) {
    const key = `${normalized}:${slot}`;
    if (dict.skills[key]) {
      result[slot] = dict.skills[key];
    }
  }
  return result;
}

/**
 * テキスト中の英語アイテム名・ルーン名・スキル名を公式日本語名に正規化
 */
export function normalizeLoLTerms(text: string, champId?: string): string {
  if (!text) return text;
  const dict = getDDragonMaster();
  if (!dict) return text;

  let normalized = text;

  // 1. スキル名の正規化 (champIdが指定されている場合)
  if (champId) {
    const normChamp = normalizeChampionId(champId) || champId;
    for (const slot of ['Passive', 'Q', 'W', 'E', 'R']) {
      const skill = dict.skills[`${normChamp}:${slot}`];
      if (skill?.name_en && skill?.name_ja) {
        // 例: "Orb of Deception" -> "Q「幻惑のオーブ」"
        const regex = new RegExp(`\\b${escapeRegExp(skill.name_en)}\\b`, 'gi');
        normalized = normalized.replace(regex, `${slot === 'Passive' ? 'P' : slot}「${skill.name_ja}」`);
      }
    }
  }

  // 2. アイテム名の正規化 (大文字小文字無視)
  for (const [nameEn, nameJa] of Object.entries(dict.item_name_to_ja)) {
    if (nameEn.length >= 4) { // 誤爆防止のため短すぎる単語は除外
      const regex = new RegExp(`\\b${escapeRegExp(nameEn)}\\b`, 'gi');
      normalized = normalized.replace(regex, nameJa);
    }
  }

  // 3. ルーン名の正規化
  for (const [runeEn, runeJa] of Object.entries(dict.rune_name_to_ja)) {
    if (runeEn.length >= 4) {
      const regex = new RegExp(`\\b${escapeRegExp(runeEn)}\\b`, 'gi');
      normalized = normalized.replace(regex, runeJa);
    }
  }

  return normalized;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
