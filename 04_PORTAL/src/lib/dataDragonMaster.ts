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

// 追加の略称・サモスペ・スラング辞書
const CUSTOM_TERM_MAP: Record<string, string> = {
  // サモナースペル
  'Flash': 'フラッシュ',
  'Smite': 'スマイト',
  'Ignite': 'イグナイト',
  'Teleport': 'テレポート',
  'Ghost': 'ゴースト',
  'Heal': 'ヒール',
  'Barrier': 'バリア',
  'Cleanse': 'クレンズ',
  'Exhaust': 'イグゾースト',

  // アイテム略称・通称
  'Shojin': 'ショウジンの矛',
  'Spear of Shojin': 'ショウジンの矛',
  'Death\'s Dance': 'デス ダンス',
  'Deaths Dance': 'デス ダンス',
  'Death Dance': 'デス ダンス',
  'Trinity Force': 'トリニティ フォース',
  'Trinity': 'トリニティ フォース',
  'Black Cleaver': 'ブラック クリーバー',
  'Cleaver': 'ブラック クリーバー',
  'The Collector': 'コレクター',
  'Collector': 'コレクター',
  'Jak\'Sho': 'ジャック=ショー',
  'JakSho': 'ジャック=ショー',
  'Jak\'Sho, The Protean': 'ジャック=ショー',
  'Kraken Slayer': 'クラーケン スレイヤー',
  'Kraken': 'クラーケン スレイヤー',
  'Youmuu\'s Ghostblade': '妖夢の霊剣',
  'Ghostblade': '妖夢の霊剣',
  'Bork': 'ルインドキング ブレード',
  'BOTRK': 'ルインドキング ブレード',
  'Blade of the Ruined King': 'ルインドキング ブレード',
  'Infinity Edge': 'インフィニティ エッジ',
  'Rabadon\'s Deathcap': 'ラバドン デスキャップ',
  'Deathcap': 'ラバドン デスキャップ',
  'Zhonya\'s Hourglass': 'ゾーニャの砂時計',
  'Zhonyas': 'ゾーニャの砂時計',
  'Zhonya': 'ゾーニャの砂時計',
  'Guinsoo\'s Rageblade': 'グインソー レイジブレード',
  'Rageblade': 'グインソー レイジブレード',
  'Sterak\'s Gage': 'ステラックの篭手',
  'Steraks Gage': 'ステラックの篭手',
  'Steraks': 'ステラックの篭手',
  'Sundered Sky': 'サンダード スカイ',
  'Profane Hydra': 'プロフェイン ハイドラ',
  'Ravenous Hydra': 'ラバナス ハイドラ',
  'Titanic Hydra': 'タイタニック ハイドラ',
  'Heartsteel': 'ハートスチール',
  'Kaenic Rookern': 'ケイニック ルーコーン',
  'Rookern': 'ケイニック ルーコーン',
  'Frozen Heart': 'フローズン ハート',
  'Thornmail': 'ソーンメイル',
  'Sunfire Aegis': 'サンファイア イージス',
  'Hollow Radiance': 'ホロウ レディアンス',
  'Liandry\'s Torment': 'ライアンドリーの苦悶',
  'Liandrys': 'ライアンドリーの苦悶',
  'Liandry': 'ライアンドリーの苦悶',
  'Ludens Companion': 'ルーデン コンパニオン',
  'Luden\'s Companion': 'ルーデン コンパニオン',
  'Ludens': 'ルーデン コンパニオン',
  'Shadowflame': 'シャドウフレイム',
  'Stormsurge': 'ストームサージ',
  'Nashor\'s Tooth': 'ナッシャー トゥース',
  'Nashors': 'ナッシャー トゥース',
  'Rylai\'s Crystal Scepter': 'クリスタル セプター',
  'Rylais': 'クリスタル セプター',
  'Cryptbloom': 'クリプトブルーム',
  'Void Staff': 'ヴォイド スタッフ',
  'Lord Dominik\'s Regards': 'ドミニク リガード',
  'LDR': 'ドミニク リガード',
  'Mortal Reminder': 'モータル リマインダー',
  'Rapid Firecannon': 'ラピッド ファイアキャノン',
  'RFC': 'ラピッド ファイアキャノン',
  'Phantom Dancer': 'ファントム ダンサー',
  'Bloodthirster': 'ブラッドサースター',
  'BT': 'ブラッドサースター',
  'Essence Reaver': 'エッセンス リーバー',
  'ER': 'エッセンス リーバー',
  'Eclipse': '赤月の刃',
  'Hubris': 'ヒュブリス',
  'Opportunity': 'オポチュニティ',
  'Voltaic Cyclosword': 'ボルテック サイクロソード',
  'Serylda\'s Grudge': 'セリルダの怨恨',
  'Seryldas': 'セリルダの怨恨',
  'Warmog\'s Armor': 'ワーモグ アーマー',
  'Warmogs': 'ワーモグ アーマー',
  'Force of Nature': '自然の力',
  'Dead Man\'s Plate': 'デッドマン プレート',
  'Randuin\'s Omen': 'ランデュイン オーメン',
  'Randuins': 'ランデュイン オーメン',
  'Spirit Visage': 'スピリット ビサージュ',
  'Abyssal Mask': 'アビサル マスク',
  'Maw of Malmortius': 'マルモティウスの胃袋',
  'Maw': 'マルモティウスの胃袋',
  'Mercurial Scimitar': 'マーキュリアル シミター',
  'QSS': 'サッシュ・シルバー',
  'Quicksilver Sash': 'サッシュ・シルバー',

  // ルーン略称
  'Conqueror': '征服者',
  'Conq': '征服者',
  'Lethal Tempo': 'リーサルテンポ',
  'Press the Attack': 'プレスアタック',
  'Press The Attack': 'プレスアタック',
  'PTA': 'プレスアタック',
  'Fleet Footwork': 'フリートフットワーク',
  'Fleet': 'フリートフットワーク',
  'Electrocute': '電撃',
  'Dark Harvest': '魂の収穫',
  'Phase Rush': 'フェイズラッシュ',
  'Arcane Comet': '秘術の彗星',
  'Comet': '秘術の彗星',
  'Summon Aery': 'エアリー召喚',
  'Aery': 'エアリー召喚',
  'Grasp of the Undying': '不死者の握撃',
  'Grasp': '不死者の握撃',
  'Aftershock': 'アフターショック',
  'Guardian': 'ガーディアン',
  'Glacial Augment': 'グレイシャルオーグメント',
  'Glacial': 'グレイシャルオーグメント',
  'First Strike': 'ファーストストライク',
  'Presence of Mind': '冷静沈着',
  'POM': '冷静沈着',
  'Legend: Alacrity': '迅速',
  'Alacrity': '迅速',
  'Legend: Bloodline': '血脈',
  'Bloodline': '血脈',
  'Legend: Haste': 'ヘイスト',
  'Coup de Grace': '最期の慈悲',
  'Cut Down': '切り崩し',
  'Last Stand': '背水の陣',
  'Taste of Blood': '血の味わい',
  'Cheap Shot': '追い打ち',
  'Sudden Impact': 'サドンステルス',
  'Eyeball Collection': '目玉コレクター',
  'Treasure Hunter': '執拗な賞金首狩り',
  'Ultimate Hunter': '至極の賞金首狩り',
  'Relentless Hunter': '執拗な賞金首狩り',
  'Manaflow Band': 'マナフローバンド',
  'Transcendence': '至高',
  'Scorch': '追火',
  'Gathering Storm': '強まる嵐',
  'Demolish': '打ちこわし',
  'Shield Bash': 'シールドバッシュ',
  'Conditioning': '心身調整',
  'Second Wind': '息継ぎ',
  'Bone Plating': 'ボーンアーマー',
  'Overgrowth': '超成長',
  'Revitalize': '生気付与',
  'Unflinching': '気迫',
  'Magical Footwear': '魔法の靴',
  'Cosmic Insight': '宇宙の英知',
  'Biscuits': 'ビスケットデリバリー',
  'Biscuit Delivery': 'ビスケットデリバリー',

  // ゲーム用語
  'Ult': 'アルティメット(R)',
  'ULT': 'アルティメット(R)',
  'Ultimate': 'アルティメット(R)',
  'Omnivamp': '全ダメージ吸血',
  'Lifesteal': 'ライフスティール',
  'Life Steal': 'ライフスティール',
  'Tenacity': '行動妨害耐性',
  'Armor Penetration': '物理防御貫通',
  'Magic Penetration': '魔法防御貫通',
  'Ability Haste': 'スキルヘイスト',
  'Attack Speed': '攻撃速度',
  'Movement Speed': '移動速度',
  'Critical Strike': 'クリティカル',
  'Crit': 'クリティカル',
  'Cooldown': 'クールダウン',
};

/**
 * テキスト中の英語アイテム名・ルーン名・スキル名・サモスペ・チャンピオン名を公式日本語名に正規化
 */
export function normalizeLoLTerms(text: string, champId?: string): string {
  if (!text) return text;
  const dict = getDDragonMaster();
  if (!dict) return text;

  let normalized = text;

  // 1. スキル名の正規化 (champIdが指定されている場合)
  if (champId && dict.skills) {
    const normChamp = normalizeChampionId(champId) || champId;
    for (const slot of ['Passive', 'Q', 'W', 'E', 'R']) {
      const skill = dict.skills[`${normChamp}:${slot}`];
      if (skill?.name_en && skill?.name_ja) {
        const regex = new RegExp(`\\b${escapeRegExp(skill.name_en)}\\b`, 'gi');
        normalized = normalized.replace(regex, `${slot === 'Passive' ? 'P' : slot}「${skill.name_ja}」`);
      }
    }
  }

  // 2. 統合置換辞書（長い単語順にソートして誤爆防止）
  const fullDict: Record<string, string> = {
    ...CUSTOM_TERM_MAP,
    ...(dict.item_name_to_ja || {}),
    ...(dict.rune_name_to_ja || {}),
  };

  // チャンピオン英語名も追加
  for (const [id, c] of Object.entries(dict.champions || {})) {
    if (c.name_ja) {
      fullDict[id] = c.name_ja;
      if (c.name_en) fullDict[c.name_en] = c.name_ja;
    }
  }

  const sortedEntries = Object.entries(fullDict).sort((a, b) => b[0].length - a[0].length);
  const seen = new Set<string>();

  for (const [en, ja] of sortedEntries) {
    if (en.length < 3 || seen.has(en.toLowerCase())) continue;
    seen.add(en.toLowerCase());
    if (en.toLowerCase() === ja.toLowerCase()) continue;

    const regex = new RegExp(`\\b${escapeRegExp(en)}\\b`, 'gi');
    normalized = normalized.replace(regex, ja);
  }

  return normalized;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
