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

// 追加の略称・サモスペ・スラング・オブジェクト辞書
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

  // オブジェクト・モンスター
  'Dragon': 'ドラゴン',
  'Baron': 'バロン',
  'Voidgrubs': 'ヴォイドグラブ',
  'Voidgrub': 'ヴォイドグラブ',
  'Herald': 'リフトヘラルド',
  'Rift Herald': 'リフトヘラルド',
  'Gromp': 'グロンプ',
  'Krugs': 'クルーグ',
  'Raptors': 'ラプター',
  'Wolves': 'ウルフ',
  'Red Buff': '赤バフ',
  'Blue Buff': '青バフ',
  'Scuttle Crab': 'スカトル',
  'Scuttle': 'スカトル',

  // ブーツ
  'Lucidity': 'アイオニア ブーツ',
  'Ionian Boots': 'アイオニア ブーツ',
  'Boots of Lucidity': 'アイオニア ブーツ',
  'Berserker\'s Greaves': 'バーサーカー ブーツ',
  'Berserkers Greaves': 'バーサーカー ブーツ',
  'Berserkers': 'バーサーカー ブーツ',
  'Plated Steelcaps': 'プレート スチールキャップ',
  'Steelcaps': 'プレート スチールキャップ',
  'Tabi': '忍者足袋(プレートスチールキャップ)',
  'Ninja Tabi': '忍者足袋(プレートスチールキャップ)',
  'Mercury\'s Treads': 'マーキュリー ブーツ',
  'Mercurys Treads': 'マーキュリー ブーツ',
  'Merc Treads': 'マーキュリー ブーツ',
  'Mercs': 'マーキュリー ブーツ',
  'Sorcerer\'s Shoes': 'ソーサラー シューズ',
  'Sorcerers Shoes': 'ソーサラー シューズ',
  'Sorcs': 'ソーサラー シューズ',
  'Boots of Swiftness': 'スイフトネス ブーツ',
  'Swifties': 'スイフトネス ブーツ',
  'Mobility Boots': 'モビリティ ブーツ',
  'Symbiotic Soles': '共生ソール',
  'Synchronized Souls': 'シンクロソウル',

  // アイテム略称・通称
  'Black Cleaver': 'ブラック クリーバー',
  'Cleaver': 'ブラック クリーバー',
  'Spear of Shojin': 'ショウジンの矛',
  'Shojin': 'ショウジンの矛',
  'Trinity Force': 'トリニティ フォース',
  'Trinity': 'トリニティ フォース',
  'Death\'s Dance': 'デス ダンス',
  'Deaths Dance': 'デス ダンス',
  'Death Dance': 'デス ダンス',
  'Infinity Edge': 'インフィニティ エッジ',
  'IE': 'インフィニティ エッジ',
  'Blade of the Ruined King': 'ルインドキング ブレード',
  'BotRK': 'ルインドキング ブレード',
  'Bork': 'ルインドキング ブレード',
  'BOTRK': 'ルインドキング ブレード',
  'Lord Dominik\'s Regards': 'ドミニク リガード',
  'Lord Dominiks': 'ドミニク リガード',
  'Lord Dominik': 'ドミニク リガード',
  'Dominik': 'ドミニク リガード',
  'Regards': 'ドミニク リガード',
  'LDR': 'ドミニク リガード',
  'Mortal Reminder': 'モータル リマインダー',
  'The Collector': 'コレクター',
  'Collector': 'コレクター',
  'Kraken Slayer': 'クラーケン スレイヤー',
  'Kraken': 'クラーケン スレイヤー',
  'Statikk Shiv': 'スタティック シヴ',
  'Shiv': 'スタティック シヴ',
  'Phantom Dancer': 'ファントム ダンサー',
  'PD': 'ファントム ダンサー',
  'Rapid Firecannon': 'ラピッド ファイアキャノン',
  'RFC': 'ラピッド ファイアキャノン',
  'Runaan\'s Hurricane': 'ルナーン ハリケーン',
  'Runaans Hurricane': 'ルナーン ハリケーン',
  'Runaan': 'ルナーン ハリケーン',
  'Guinsoo\'s Rageblade': 'グインソー レイジブレード',
  'Guinsoos Rageblade': 'グインソー レイジブレード',
  'Rageblade': 'グインソー レイジブレード',
  'Bloodthirster': 'ブラッドサースター',
  'BT': 'ブラッドサースター',
  'Essence Reaver': 'エッセンス リーバー',
  'ER': 'エッセンス リーバー',
  'Sundered Sky': 'サンダード スカイ',
  'Sterak\'s Gage': 'ステラックの篭手',
  'Steraks Gage': 'ステラックの篭手',
  'Steraks': 'ステラックの篭手',
  'Sterak': 'ステラックの篭手',
  'Titanic Hydra': 'タイタン ハイドラ',
  'Ravenous Hydra': 'ラバナス ハイドラ',
  'Profane Hydra': 'プロフェイン ハイドラ',
  'Profane': 'プロフェイン ハイドラ',
  'Stridebreaker': 'ストライドブレイカー',
  'Goredrinker': 'ゴアドリンカー',
  'Divine Sunderer': 'ディバイン サンダラー',
  'Heartsteel': 'ハートスチール',
  'Jak\'Sho, The Protean': '変幻自在のジャック＝ショー',
  'Jak\'Sho': '変幻自在のジャック＝ショー',
  'JakSho': '変幻自在のジャック＝ショー',
  'Kaenic Rookern': 'ケイニック ルーコーン',
  'Rookern': 'ケイニック ルーコーン',
  'Sunfire Aegis': 'サンファイア イージス',
  'Sunfire': 'サンファイア イージス',
  'Hollow Radiance': 'ホロウ レディアンス',
  'Unending Despair': '終わりなき絶望',
  'Thornmail': 'ソーンメイル',
  'Frozen Heart': 'フローズン ハート',
  'Iceborn Gauntlet': 'アイスボーン ガントレット',
  'Liandry\'s Torment': 'ライアンドリーの苦悶',
  'Liandrys Torment': 'ライアンドリーの苦悶',
  'Liandrys': 'ライアンドリーの苦悶',
  'Liandry': 'ライアンドリーの苦悶',
  'Rylai\'s Crystal Scepter': 'クリスタル セプター',
  'Rylais': 'クリスタル セプター',
  'Rylai': 'クリスタル セプター',
  'Rabadon\'s Deathcap': 'ラバドン デスキャップ',
  'Rabadons Deathcap': 'ラバドン デスキャップ',
  'Rabadons': 'ラバドン デスキャップ',
  'Deathcap': 'ラバドン デスキャップ',
  'Zhonya\'s Hourglass': 'ゾーニャの砂時計',
  'Zhonyas Hourglass': 'ゾーニャの砂時計',
  'Zhonyas': 'ゾーニャの砂時計',
  'Zhonya': 'ゾーニャの砂時計',
  'Banshee\'s Veil': 'バンシー ヴェール',
  'Banshees Veil': 'バンシー ヴェール',
  'Banshees': 'バンシー ヴェール',
  'Shadowflame': 'シャドウフレイム',
  'Stormsurge': 'ストームサージ',
  'Luden\'s Companion': 'ルーデン コンパニオン',
  'Ludens Companion': 'ルーデン コンパニオン',
  'Ludens Echo': 'ルーデン テンペスト',
  'Ludens': 'ルーデン コンパニオン',
  'Luden': 'ルーデン コンパニオン',
  'Malignance': 'マリグナンス',
  'Archangel\'s Staff': '大天使の杖',
  'Seraph\'s Embrace': 'セラフ エンブレイス',
  'Seraphs': 'セラフ エンブレイス',
  'Nashor\'s Tooth': 'ナッシャー トゥース',
  'Nashors Tooth': 'ナッシャー トゥース',
  'Nashors': 'ナッシャー トゥース',
  'Cosmic Drive': 'コズミック ドライブ',
  'Horizon Focus': 'ホライゾン フォーカス',
  'Void Staff': 'ヴォイド スタッフ',
  'Cryptbloom': 'クリプトブルーム',
  'Rod of Ages': 'ロッド オブ エイジス',
  'RoA': 'ロッド オブ エイジス',
  'Youmuu\'s Ghostblade': '妖夢の霊剣',
  'Youmuus Ghostblade': '妖夢の霊剣',
  'Ghostblade': '妖夢の霊剣',
  'Youmuus': '妖夢の霊剣',
  'Youmuu': '妖夢の霊剣',
  'Yomuu': '妖夢の霊剣',
  'Yomuus': '妖夢の霊剣',
  'Duskblade of Draktharr': 'ドラクサー ダスクブレード',
  'Duskblade': 'ドラクサー ダスクブレード',
  'Edge of Night': 'ナイト エッジ',
  'Opportunity': 'オポチュニティ',
  'Voltaic Cyclosword': 'ボルテック サイクロソード',
  'Cyclosword': 'ボルテック サイクロソード',
  'Hubris': 'ヒュブリス',
  'Serylda\'s Grudge': 'セリルダの怨恨',
  'Seryldas Grudge': 'セリルダの怨恨',
  'Seryldas': 'セリルダの怨恨',
  'Serylda': 'セリルダの怨恨',
  'Axiom Arc': 'アクシオム アーク',
  'Eclipse': '赤月の刃',
  'Umbral Glaive': 'アンブラル グレイブ',
  'Umbral': 'アンブラル グレイブ',
  'Navori Quickblades': 'ナヴォリ フリッカーブレード',
  'Navori Flickerblade': 'ナヴォリ フリッカーブレード',
  'Navori': 'ナヴォリ フリッカーブレード',
  'Warmog\'s Armor': 'ワーモグ アーマー',
  'Warmogs Armor': 'ワーモグ アーマー',
  'Warmogs': 'ワーモグ アーマー',
  'Force of Nature': '自然の力',
  'Dead Man\'s Plate': 'デッドマン プレート',
  'Dead Mans Plate': 'デッドマン プレート',
  'Randuin\'s Omen': 'ランデュイン オーメン',
  'Randuins Omen': 'ランデュイン オーメン',
  'Randuins': 'ランデュイン オーメン',
  'Spirit Visage': 'スピリット ビサージュ',
  'Abyssal Mask': 'アビサル マスク',
  'Maw of Malmortius': 'マルモティウスの胃袋',
  'Maw': 'マルモティウスの胃袋',
  'Mercurial Scimitar': 'マーキュリアル シミター',
  'Quicksilver Sash': 'サッシュ・シルバー',
  'QSS': 'サッシュ・シルバー',
  'Guardian Angel': 'ガーディアン エンジェル',
  'GA': 'ガーディアン エンジェル',
  'Moonstone Renewer': 'ムーンストーンの再生',
  'Moonstone': 'ムーンストーンの再生',
  'Echoes of Helia': 'ヘリアの残響',
  'Helia': 'ヘリアの残響',
  'Imperial Mandate': '帝国の指令',
  'Staff of Flowing Water': 'フロー ウォーター スタッフ',
  'Ardent Censer': 'アーデント センサー',
  'Redemption': 'リデンプション',
  'Mikael\'s Blessing': 'ミカエルの祝福',
  'Mikaels Blessing': 'ミカエルの祝福',
  'Mikaels': 'ミカエルの祝福',
  'Knight\'s Vow': '騎士の誓い',
  'Knights Vow': '騎士の誓い',
  'Zeke\'s Convergence': 'ジーク コンバージェンス',
  'Zekes Convergence': 'ジーク コンバージェンス',
  'Zekes': 'ジーク コンバージェンス',
  'Locket of the Iron Solari': 'ソラリのロケット',
  'Locket': 'ソラリのロケット',
  'Shurelya\'s Battlesong': 'シュレリアの戦歌',
  'Shurelyas Battlesong': 'シュレリアの戦歌',
  'Shurelyas': 'シュレリアの戦歌',

  // ルーン
  'Press the Attack': 'プレスアタック',
  'Press The Attack': 'プレスアタック',
  'PTA': 'プレスアタック',
  'Lethal Tempo': 'リーサルテンポ',
  'Fleet Footwork': 'フリートフットワーク',
  'Fleet': 'フリートフットワーク',
  'Conqueror': '征服者',
  'Conq': '征服者',
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
  'PoM': '冷静沈着',
  'POM': '冷静沈着',
  'Triumph': '凱旋',
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
  'Sudden Impact': 'サドンインパクト',
  'Eyeball Collection': '目玉コレクター',
  'Treasure Hunter': '宝賞金首狩り',
  'Ultimate Hunter': '至極の賞金首狩り',
  'Relentless Hunter': '執拗な賞金首狩り',
  'Ingenious Hunter': '巧妙な賞金首狩り',
  'Manaflow Band': 'マナフローバンド',
  'Manaflow': 'マナフローバンド',
  'Transcendence': '至高',
  'Celerity': '追風',
  'Absolute Focus': '生気集中',
  'Scorch': '追火',
  'Waterwalking': '水走り',
  'Gathering Storm': '強まる嵐',
  'Demolish': '打ちこわし',
  'Font of Life': '生命の泉',
  'Shield Bash': 'シールドバッシュ',
  'Conditioning': '心身調整',
  'Second Wind': '息継ぎ',
  'Bone Plating': 'ボーンアーマー',
  'Overgrowth': '超成長',
  'Revitalize': '生気付与',
  'Unflinching': '気迫',
  'Hextech Flashtraption': 'ヘクステックフラッシュ',
  'Magical Footwear': '魔法の靴',
  'Free Boots': '魔法の靴',
  'Cash Back': 'キャッシュバック',
  'Triple Tonic': 'トリプルトニック',
  'Time Warp Tonic': 'タイムワープトニック',
  'Cosmic Insight': '宇宙の英知',
  'Approach Velocity': '疾駆',
  'Jack of All Trades': '万能の天才',
  'Biscuit Delivery': 'ビスケットデリバリー',
  'Biscuits': 'ビスケットデリバリー',

  // ゲーム用語・略語・概念
  'Omnivamp': '全ダメージ吸血',
  'Lifesteal': 'ライフスティール',
  'Life Steal': 'ライフスティール',
  'Physical Vamp': '物理吸血',
  'Spell Vamp': 'スキル吸血',
  'Tenacity': '行動妨害耐性',
  'Lethality': '脅威',
  'Armor Penetration': '物理防御貫通',
  'Magic Penetration': '魔法防御貫通',
  'Ability Haste': 'スキルヘイスト',
  'Attack Speed': '攻撃速度',
  'Movement Speed': '移動速度',
  'Critical Strike': 'クリティカル',
  'Crit': 'クリティカル',
  'True Damage': '確定ダメージ',
  'Magic Damage': '魔法ダメージ',
  'Physical Damage': '物理ダメージ',
  'Crowd Control': '行動妨害(CC)',
  'Stealth': 'ステルス',
  'Invisibility': 'インビジブル',
  'Camouflage': 'カモフラージュ',
  'Gank': 'ガンク',
  'Roam': 'ローム',
  'Dive': 'タワーダイブ',
  'Sustain': 'サステイン',
  'Snowball': 'スノーボール',
  'Scaling': '後半スケール',
  'Power Spike': 'パワースパイク',
  'Powerspike': 'パワースパイク',
  'Waveclear': 'ウェーブクリア',
  'Wave Clear': 'ウェーブクリア',
  'Split Push': 'スプリットプッシュ',
  'Splitpush': 'スプリットプッシュ',
  'Teamfight': '集団戦',
  'Team Fight': '集団戦',
  'Skirmish': '小規模戦',
  'Engage': '仕掛け(エンゲージ)',
  'Disengage': '離脱(ディスエンゲージ)',
  'Flank': '側面奇襲(フランク)',
  'Kite': '引き撃ち(カイト)',
  'Kiting': '引き撃ち(カイト)',
  'Trade': 'ダメージトレード',
  'Trading': 'ダメージトレード',
  'Poke': 'ポーク',
  'Burst': '瞬間火力(バースト)',
  'Frontline': '前衛(フロントライン)',
  'Backline': '後衛(バックライン)',
  'Carry': 'キャリー',
  'Hyper Carry': 'ハイパーキャリー',
  'Bruiser': 'ファイター(ブルーザー)',
  'Assassin': 'アサシン',
  'Marksman': 'マークスマン',
  'Mage': 'メイジ',
  'Tank': 'タンク',
  'Enchanter': 'エンチャンター',
  'Caster': 'キャスター',
  'Dps': '継続火力(DPS)',
  'Cooldown': 'クールダウン',
  'Early Game': '序盤(アーリーゲーム)',
  'Mid Game': '中盤(ミッドゲーム)',
  'Late Game': '終盤(レイトゲーム)',
  'Early': '序盤',
  'Mid': '中盤',
  'Late': '終盤',
  'Ultimate': 'アルティメット(R)',
  'Ult': 'アルティメット(R)',
  'ULT': 'アルティメット(R)',
  'Invade': 'インベード',
  'Support': 'サポート',
  'Dash': 'ダッシュ(ブリンク)',
  'Blink': 'ブリンク',
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
        const regex = new RegExp(`(?<![a-zA-Z])${escapeRegExp(skill.name_en)}(?![a-zA-Z])`, 'gi');
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

  // URL保護
  const urls: string[] = [];
  normalized = normalized.replace(/https?:\/\/[^\s)]+/g, (m) => {
    urls.push(m);
    return `___URL_${urls.length - 1}___`;
  });

  for (const [en, ja] of sortedEntries) {
    if (en.length < 2 || seen.has(en.toLowerCase())) continue;
    seen.add(en.toLowerCase());
    if (en.toLowerCase() === ja.toLowerCase()) continue;

    const regex = new RegExp(`(?<![a-zA-Z])${escapeRegExp(en)}(?![a-zA-Z])`, 'gi');
    normalized = normalized.replace(regex, ja);
  }

  // URL復元
  urls.forEach((u, i) => {
    normalized = normalized.replace(`___URL_${i}___`, u);
  });

  return normalized;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
