import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_PATH = path.resolve(__dirname, '../src/data/ddragon_master_dict.json');
const TARGET_PATH = path.resolve(__dirname, '../src/data/item_dictionary.json');

const master = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf-8'));
const base = master.item_name_to_ja || {};

const itemDict = {};

// 1. DDragon公式辞書の取り込み
for (const [k, v] of Object.entries(base)) {
  if (k && v && typeof v === 'string') {
    itemDict[k] = v;
  }
}

// 2. 英語名・機械翻訳・誤訳の手動マッピング
const manualMappings = {
  // 英語名
  "Luden's Companion": 'ルーデン コンパニオン',
  'Shadowflame': 'シャドウフレイム',
  "Zhonya's Hourglass": 'ゾーニャの砂時計',
  'Infinity Edge': 'インフィニティ エッジ',
  'Kraken Slayer': 'クラーケン スレイヤー',
  'Blade of the Ruined King': 'ルインドキング ブレード',
  'Black Cleaver': 'ブラック クリーバー',
  'The Black Cleaver': 'ブラック クリーバー',
  'Eclipse': 'イクリプス',
  'Sundered Sky': 'サンダード スカイ',
  'Malignance': 'マリグナンス',
  'Stormsurge': 'ストームサージ',
  'Cryptbloom': 'クリプトブルーム',
  'Bloodthirster': 'ブラッドサースター',
  'The Bloodthirster': 'ブラッドサースター',
  "Lord Dominik's Regards": 'ドミニク リガード',
  'Mortal Reminder': 'モータル リマインダー',
  'Rapid Firecannon': 'ラピッド ファイアキャノン',
  'Phantom Dancer': 'ファントム ダンサー',
  "Rabadon's Deathcap": 'ラバドン デスキャップ',
  'Void Staff': 'ヴォイド スタッフ',
  "Banshee's Veil": 'バンシー ヴェール',
  "Nashor's Tooth": 'ナッシャー トゥース',
  'Lich Bane': 'リッチ ベイン',
  'Cosmic Drive': 'コズミック ドライブ',
  'Horizon Focus': 'ホライゾン フォーカス',
  'Riftmaker': 'リフトメーカー',
  "Liandry's Torment": 'ライアンドリーの苦悶',
  'Rod of Ages': 'ロッド オブ エイジス',
  "Archangel's Staff": '大天使の杖',
  "Seraph's Embrace": 'セラフ エンブレイス',
  'Muramana': 'ムラマナ',
  'Manamune': 'マナムネ',
  'Trinity Force': 'トリニティ フォース',
  "Sterak's Gage": 'ステラックの篭手',
  'Titanic Hydra': 'タイタン ハイドラ',
  'Ravenous Hydra': 'ラヴァナス ハイドラ',
  'Profane Hydra': 'プロフェイン ハイドラ',
  'Hubris': 'ヒューブリス',
  'Opportunity': 'オポチュニティ',
  'Voltaic Cyclosword': 'ボルテック サイクロソード',
  "Serylda's Grudge": 'セリルダの怨恨',
  'Edge of Night': 'ナイト エッジ',
  "Youmuu's Ghostblade": '妖夢の霊剣',
  "Death's Dance": 'デス ダンス',
  'Maw of Malmortius': 'マルモティウスの胃袋',
  'Guardian Angel': 'ガーディアン エンジェル',
  "Warmog's Armor": 'ワーモグ アーマー',
  'Sunfire Aegis': 'サンファイア イージス',
  'Hollow Radiance': 'ホロウ レディアンス',
  'Heartsteel': 'ハートスチール',
  "Jak'Sho, The Protean": 'ジャック=ショー',
  "Jak'Sho": 'ジャック=ショー',
  'Kaenic Rookern': 'ケイニック ルーコーン',
  'Thornmail': 'ソーンメイル',
  "Randuin's Omen": 'ランデュイン オーメン',
  'Frozen Heart': 'フローズン ハート',
  'Iceborn Gauntlet': 'アイスボーン ガントレット',
  'Abyssal Mask': 'アビサル マスク',
  'Force of Nature': '自然の力',
  'Spirit Visage': 'スピリット ビサージュ',
  "Dead Man's Plate": 'デッドマン プレート',
  'Hullbreaker': 'ハルブレイカー',
  "Overlord's Bloodmail": 'オーバーロード ブラッドメイル',
  'Moonstone Renewer': 'ムーンストーンの再生',
  'Echoes of Helia': 'ヘリアの残響',
  'Imperial Mandate': '帝国の指令',
  'Staff of Flowing Water': 'フロー ウォーター スタッフ',
  'Ardent Censer': 'アーデント センサー',
  'Redemption': 'リデンプション',
  "Mikael's Blessing": 'ミカエルの祝福',
  'Dawncore': 'ドーンコア',
  "Shurelya's Battlesong": 'シュレリアの戦歌',
  'Locket of the Iron Solari': 'ソラリのロケット',
  "Knight's Vow": '騎士の誓い',
  "Zeke's Convergence": 'ジーク コンバージェンス',
  'Trailblazer': 'トレイルブレイザー',
  // 機械翻訳・誤訳修正
  'ルナラン・ハリケーン': 'ルナーン・ハリケーン',
  'ルナラン ハリケーン': 'ルナーン・ハリケーン',
  '不死弓': 'イモータル シールドボウ',
  '不死身の盾弓': 'イモータル シールドボウ',
  'バスティオンブレイカー': 'ハルブレイカー',
  'ヴォイドグラブの爪': 'ストライドブレイカー',
};

for (const [k, v] of Object.entries(manualMappings)) {
  itemDict[k] = v;
}

fs.writeFileSync(TARGET_PATH, JSON.stringify(itemDict, null, 2), 'utf-8');
console.log('✅ item_dictionary.json 生成完了:', Object.keys(itemDict).length, '件');
