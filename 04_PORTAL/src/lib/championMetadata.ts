import { ALL_CHAMPIONS, CHAMPION_JA } from './championConstants';

export type RegionKey =
  | 'Ionia'
  | 'Demacia'
  | 'Noxus'
  | 'Piltover'
  | 'Zaun'
  | 'Freljord'
  | 'Shurima'
  | 'Targon'
  | 'Bilgewater'
  | 'ShadowIsles'
  | 'Ixtal'
  | 'Void'
  | 'BandleCity'
  | 'Runeterra';

export const REGIONS: Record<RegionKey, { name: string; icon: string; description: string }> = {
  Ionia: { name: 'アイオニア', icon: '🌸', description: '自然と魔力が調和する初生の地' },
  Demacia: { name: 'デマーシア', icon: '🛡️', description: '正義と規律を重んじる強国' },
  Noxus: { name: 'ノクサス', icon: '🪓', description: '力こそがすべての軍事帝国' },
  Piltover: { name: 'ピルトーヴァー', icon: '⚙️', description: '進歩と科学の輝く都市' },
  Zaun: { name: 'ゾウン', icon: '🧪', description: '地下に広がる過激な化学都市' },
  Freljord: { name: 'フレヨルド', icon: '❄️', description: '氷雪吹き荒れる過酷な戦士の極北' },
  Shurima: { name: 'シュリーマ', icon: '☀️', description: '砂漠に眠る古代の超越者帝国' },
  Targon: { name: 'ターゴン', icon: '🏔️', description: '天界と交わる聖なる霊峰' },
  Bilgewater: { name: 'ビルジウォーター', icon: '🏴‍☠️', description: '海賊と無法者が蠢く港湾都市' },
  ShadowIsles: { name: 'シャドウアイル', icon: '👻', description: '黒き霧に呪われた亡霊の諸島' },
  Ixtal: { name: 'イシュタル', icon: '🌿', description: '密林の奥深くに隠された元素魔法の古王国' },
  Void: { name: 'ヴォイド', icon: '🟣', description: '世界を呑み込もうとする虚無の異界' },
  BandleCity: { name: 'バンドルシティ', icon: '🍄', description: 'ヨードルたちが暮らす不思議な異次元' },
  Runeterra: { name: 'ルーンテラ（出身不定・放浪）', icon: '🌌', description: '各地を放浪する神話・天界・ダークイン' },
};

export type ChampionRole = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
export const ROLES_LIST: ChampionRole[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

export type ChampionClass = 'Fighter' | 'Mage' | 'Assassin' | 'Marksman' | 'Tank' | 'Support';
export const CLASSES: Record<ChampionClass, { name: string; icon: string }> = {
  Fighter: { name: 'ファイター', icon: '⚔️' },
  Mage: { name: 'メイジ', icon: '🔮' },
  Assassin: { name: 'アサシン', icon: '🗡️' },
  Marksman: { name: 'マークスマン', icon: '🏹' },
  Tank: { name: 'タンク', icon: '🛡️' },
  Support: { name: 'サポート', icon: '✨' },
};

export interface ChampionMeta {
  id: string;
  name: string;
  ruby: string;
  region: RegionKey;
  roles: ChampionRole[];
  class: ChampionClass;
}

export const CHAMPION_METADATA: Record<string, ChampionMeta> = {
  Aatrox: { id: 'Aatrox', name: 'エイトロックス', ruby: 'えいとろっくす', region: 'Runeterra', roles: ['TOP'], class: 'Fighter' },
  Ahri: { id: 'Ahri', name: 'アーリ', ruby: 'あり', region: 'Ionia', roles: ['MID'], class: 'Mage' },
  Akali: { id: 'Akali', name: 'アカリ', ruby: 'あかり', region: 'Ionia', roles: ['MID', 'TOP'], class: 'Assassin' },
  Akshan: { id: 'Akshan', name: 'アクシャン', ruby: 'あくしゃん', region: 'Shurima', roles: ['MID', 'TOP'], class: 'Marksman' },
  Alistar: { id: 'Alistar', name: 'アリスター', ruby: 'ありすた', region: 'Runeterra', roles: ['SUP'], class: 'Tank' },
  Ambessa: { id: 'Ambessa', name: 'アンベッサ', ruby: 'あんべっさ', region: 'Noxus', roles: ['TOP', 'JG'], class: 'Fighter' },
  Amumu: { id: 'Amumu', name: 'アムム', ruby: 'あむむ', region: 'Shurima', roles: ['JG', 'SUP'], class: 'Tank' },
  Anivia: { id: 'Anivia', name: 'アニビア', ruby: 'あにびあ', region: 'Freljord', roles: ['MID'], class: 'Mage' },
  Annie: { id: 'Annie', name: 'アニー', ruby: 'あに', region: 'Noxus', roles: ['MID', 'SUP'], class: 'Mage' },
  Aphelios: { id: 'Aphelios', name: 'アフェリオス', ruby: 'あふぇりおす', region: 'Targon', roles: ['ADC'], class: 'Marksman' },
  Ashe: { id: 'Ashe', name: 'アッシュ', ruby: 'あっしゅ', region: 'Freljord', roles: ['ADC', 'SUP'], class: 'Marksman' },
  AurelionSol: { id: 'AurelionSol', name: 'オレリオン・ソル', ruby: 'おれりおんそる', region: 'Targon', roles: ['MID'], class: 'Mage' },
  Aurora: { id: 'Aurora', name: 'オーロラ', ruby: 'おろら', region: 'Freljord', roles: ['MID', 'TOP'], class: 'Mage' },
  Azir: { id: 'Azir', name: 'アジール', ruby: 'あじる', region: 'Shurima', roles: ['MID'], class: 'Mage' },
  Bard: { id: 'Bard', name: 'バード', ruby: 'ばど', region: 'Runeterra', roles: ['SUP'], class: 'Support' },
  Belveth: { id: 'Belveth', name: 'ベル＝ヴェス', ruby: 'べるゔぇす', region: 'Void', roles: ['JG'], class: 'Fighter' },
  Blitzcrank: { id: 'Blitzcrank', name: 'ブリッツクランク', ruby: 'ぶりっつくらんく', region: 'Zaun', roles: ['SUP'], class: 'Tank' },
  Brand: { id: 'Brand', name: 'ブランド', ruby: 'ぶらんど', region: 'Freljord', roles: ['SUP', 'MID', 'JG'], class: 'Mage' },
  Braum: { id: 'Braum', name: 'ブラウム', ruby: 'ぶらうむ', region: 'Freljord', roles: ['SUP'], class: 'Support' },
  Briar: { id: 'Briar', name: 'ブライアー', ruby: 'ぶらいあ', region: 'Noxus', roles: ['JG'], class: 'Fighter' },
  Caitlyn: { id: 'Caitlyn', name: 'ケイトリン', ruby: 'けいとりん', region: 'Piltover', roles: ['ADC'], class: 'Marksman' },
  Camille: { id: 'Camille', name: 'カミール', ruby: 'かみる', region: 'Piltover', roles: ['TOP'], class: 'Fighter' },
  Cassiopeia: { id: 'Cassiopeia', name: 'カシオペア', ruby: 'かしおぺあ', region: 'Noxus', roles: ['MID'], class: 'Mage' },
  Chogath: { id: 'Chogath', name: 'チョ＝ガス', ruby: 'ちょがす', region: 'Void', roles: ['TOP', 'MID'], class: 'Tank' },
  Corki: { id: 'Corki', name: 'コーキ', ruby: 'こき', region: 'BandleCity', roles: ['MID', 'ADC'], class: 'Marksman' },
  Darius: { id: 'Darius', name: 'ダリウス', ruby: 'だりうす', region: 'Noxus', roles: ['TOP'], class: 'Fighter' },
  Diana: { id: 'Diana', name: 'ダイアナ', ruby: 'だいあな', region: 'Targon', roles: ['JG', 'MID'], class: 'Assassin' },
  DrMundo: { id: 'DrMundo', name: 'ドクター・ムンド', ruby: 'どくたむんど', region: 'Zaun', roles: ['TOP', 'JG'], class: 'Tank' },
  Draven: { id: 'Draven', name: 'ドレイヴン', ruby: 'どれいゔん', region: 'Noxus', roles: ['ADC'], class: 'Marksman' },
  Ekko: { id: 'Ekko', name: 'エコー', ruby: 'えこ', region: 'Zaun', roles: ['JG', 'MID'], class: 'Assassin' },
  Elise: { id: 'Elise', name: 'エリス', ruby: 'えりす', region: 'ShadowIsles', roles: ['JG'], class: 'Mage' },
  Evelynn: { id: 'Evelynn', name: 'イブリン', ruby: 'いぶりん', region: 'Runeterra', roles: ['JG'], class: 'Assassin' },
  Ezreal: { id: 'Ezreal', name: 'エズリアル', ruby: 'えずりある', region: 'Piltover', roles: ['ADC'], class: 'Marksman' },
  Fiddlesticks: { id: 'Fiddlesticks', name: 'フィドルスティックス', ruby: 'ふぃどるすてぃっくす', region: 'Runeterra', roles: ['JG'], class: 'Mage' },
  Fiora: { id: 'Fiora', name: 'フィオラ', ruby: 'ふぃおら', region: 'Demacia', roles: ['TOP'], class: 'Fighter' },
  Fizz: { id: 'Fizz', name: 'フィズ', ruby: 'ふぃず', region: 'Bilgewater', roles: ['MID'], class: 'Assassin' },
  Galio: { id: 'Galio', name: 'ガリオ', ruby: 'がりお', region: 'Demacia', roles: ['MID', 'SUP'], class: 'Tank' },
  Gangplank: { id: 'Gangplank', name: 'ガングプランク', ruby: 'がんぐぷらんく', region: 'Bilgewater', roles: ['TOP', 'MID'], class: 'Fighter' },
  Garen: { id: 'Garen', name: 'ガレン', ruby: 'がれん', region: 'Demacia', roles: ['TOP'], class: 'Fighter' },
  Gnar: { id: 'Gnar', name: 'ナー', ruby: 'な', region: 'Freljord', roles: ['TOP'], class: 'Fighter' },
  Gragas: { id: 'Gragas', name: 'グラガス', ruby: 'ぐらがす', region: 'Freljord', roles: ['TOP', 'JG', 'MID'], class: 'Fighter' },
  Graves: { id: 'Graves', name: 'グレイブス', ruby: 'ぐれいぶす', region: 'Bilgewater', roles: ['JG'], class: 'Marksman' },
  Gwen: { id: 'Gwen', name: 'グウェン', ruby: 'ぐうぇん', region: 'ShadowIsles', roles: ['TOP'], class: 'Fighter' },
  Hecarim: { id: 'Hecarim', name: 'ヘカリム', ruby: 'へかりむ', region: 'ShadowIsles', roles: ['JG'], class: 'Fighter' },
  Heimerdinger: { id: 'Heimerdinger', name: 'ハイマーディンガー', ruby: 'はいまでぃんが', region: 'Piltover', roles: ['TOP', 'MID', 'SUP'], class: 'Mage' },
  Hwei: { id: 'Hwei', name: 'フェイ', ruby: 'ふぇい', region: 'Ionia', roles: ['MID'], class: 'Mage' },
  Illaoi: { id: 'Illaoi', name: 'イラオイ', ruby: 'いらおい', region: 'Bilgewater', roles: ['TOP'], class: 'Fighter' },
  Irelia: { id: 'Irelia', name: 'イレリア', ruby: 'いれりあ', region: 'Ionia', roles: ['TOP', 'MID'], class: 'Fighter' },
  Ivern: { id: 'Ivern', name: 'アイバーン', ruby: 'あいばん', region: 'Ionia', roles: ['JG'], class: 'Support' },
  Janna: { id: 'Janna', name: 'ジャンナ', ruby: 'じゃんな', region: 'Zaun', roles: ['SUP'], class: 'Support' },
  JarvanIV: { id: 'JarvanIV', name: 'ジャーヴァンⅣ', ruby: 'じゃゔぁん', region: 'Demacia', roles: ['JG'], class: 'Tank' },
  Jax: { id: 'Jax', name: 'ジャックス', ruby: 'じゃっくす', region: 'Runeterra', roles: ['TOP', 'JG'], class: 'Fighter' },
  Jayce: { id: 'Jayce', name: 'ジェイス', ruby: 'じぇいす', region: 'Piltover', roles: ['TOP', 'MID'], class: 'Fighter' },
  Jhin: { id: 'Jhin', name: 'ジン', ruby: 'じん', region: 'Ionia', roles: ['ADC'], class: 'Marksman' },
  Jinx: { id: 'Jinx', name: 'ジンクス', ruby: 'じんくす', region: 'Zaun', roles: ['ADC'], class: 'Marksman' },
  KSante: { id: 'KSante', name: 'カ・サンテ', ruby: 'かさんて', region: 'Shurima', roles: ['TOP'], class: 'Tank' },
  Kaisa: { id: 'Kaisa', name: 'カイ＝サ', ruby: 'かいさ', region: 'Void', roles: ['ADC'], class: 'Marksman' },
  Kalista: { id: 'Kalista', name: 'カリスタ', ruby: 'かりすた', region: 'ShadowIsles', roles: ['ADC'], class: 'Marksman' },
  Karma: { id: 'Karma', name: 'カルマ', ruby: 'かるま', region: 'Ionia', roles: ['SUP', 'MID'], class: 'Mage' },
  Karthus: { id: 'Karthus', name: 'カーサス', ruby: 'かさす', region: 'ShadowIsles', roles: ['JG', 'ADC'], class: 'Mage' },
  Kassadin: { id: 'Kassadin', name: 'カサディン', ruby: 'かさでぃん', region: 'Void', roles: ['MID'], class: 'Assassin' },
  Katarina: { id: 'Katarina', name: 'カタリナ', ruby: 'かたりな', region: 'Noxus', roles: ['MID'], class: 'Assassin' },
  Kayle: { id: 'Kayle', name: 'ケイル', ruby: 'けいる', region: 'Demacia', roles: ['TOP', 'MID'], class: 'Fighter' },
  Kayn: { id: 'Kayn', name: 'ケイン', ruby: 'けいん', region: 'Ionia', roles: ['JG'], class: 'Fighter' },
  Kennen: { id: 'Kennen', name: 'ケネン', ruby: 'けねん', region: 'Ionia', roles: ['TOP'], class: 'Mage' },
  Khazix: { id: 'Khazix', name: 'カ＝ジックス', ruby: 'かじっくす', region: 'Void', roles: ['JG'], class: 'Assassin' },
  Kindred: { id: 'Kindred', name: 'キンドレッド', ruby: 'きんどれっど', region: 'Runeterra', roles: ['JG'], class: 'Marksman' },
  Kled: { id: 'Kled', name: 'クレッド', ruby: 'くれっど', region: 'Noxus', roles: ['TOP'], class: 'Fighter' },
  KogMaw: { id: 'KogMaw', name: 'コグ＝マウ', ruby: 'こぐまう', region: 'Void', roles: ['ADC', 'MID'], class: 'Marksman' },
  Leblanc: { id: 'Leblanc', name: 'ルブラン', ruby: 'るぶらん', region: 'Noxus', roles: ['MID'], class: 'Assassin' },
  LeeSin: { id: 'LeeSin', name: 'リー・シン', ruby: 'りしん', region: 'Ionia', roles: ['JG'], class: 'Fighter' },
  Leona: { id: 'Leona', name: 'レオナ', ruby: 'れおな', region: 'Targon', roles: ['SUP'], class: 'Tank' },
  Lillia: { id: 'Lillia', name: 'リリア', ruby: 'りりあ', region: 'Ionia', roles: ['JG', 'TOP'], class: 'Fighter' },
  Lissandra: { id: 'Lissandra', name: 'リサンドラ', ruby: 'りさんどら', region: 'Freljord', roles: ['MID'], class: 'Mage' },
  Lucian: { id: 'Lucian', name: 'ルシアン', ruby: 'るしあん', region: 'Demacia', roles: ['ADC', 'MID'], class: 'Marksman' },
  Lulu: { id: 'Lulu', name: 'ルル', ruby: 'るる', region: 'BandleCity', roles: ['SUP'], class: 'Support' },
  Lux: { id: 'Lux', name: 'ラックス', ruby: 'らっくす', region: 'Demacia', roles: ['MID', 'SUP'], class: 'Mage' },
  Malphite: { id: 'Malphite', name: 'マルファイト', ruby: 'まるふぁいと', region: 'Ixtal', roles: ['TOP', 'MID'], class: 'Tank' },
  Malzahar: { id: 'Malzahar', name: 'マルザハール', ruby: 'まるざはる', region: 'Void', roles: ['MID'], class: 'Mage' },
  Maokai: { id: 'Maokai', name: 'マオカイ', ruby: 'まおかい', region: 'ShadowIsles', roles: ['SUP', 'TOP', 'JG'], class: 'Tank' },
  MasterYi: { id: 'MasterYi', name: 'マスター・イー', ruby: 'ますたい', region: 'Ionia', roles: ['JG'], class: 'Assassin' },
  Mel: { id: 'Mel', name: 'メル', ruby: 'める', region: 'Piltover', roles: ['MID', 'SUP'], class: 'Mage' },
  Milio: { id: 'Milio', name: 'ミリオ', ruby: 'みりお', region: 'Ixtal', roles: ['SUP'], class: 'Support' },
  MissFortune: { id: 'MissFortune', name: 'ミス・フォーチュン', ruby: 'みすふぉちゅん', region: 'Bilgewater', roles: ['ADC'], class: 'Marksman' },
  Mordekaiser: { id: 'Mordekaiser', name: 'モルデカイザー', ruby: 'もるでかいざ', region: 'Noxus', roles: ['TOP'], class: 'Fighter' },
  Morgana: { id: 'Morgana', name: 'モルガナ', ruby: 'もるがな', region: 'Demacia', roles: ['SUP', 'MID', 'JG'], class: 'Mage' },
  Naafiri: { id: 'Naafiri', name: 'ナフィーリ', ruby: 'なふぃり', region: 'Shurima', roles: ['MID'], class: 'Assassin' },
  Nami: { id: 'Nami', name: 'ナミ', ruby: 'なみ', region: 'Targon', roles: ['SUP'], class: 'Support' },
  Nasus: { id: 'Nasus', name: 'ナサス', ruby: 'なさす', region: 'Shurima', roles: ['TOP'], class: 'Fighter' },
  Nautilus: { id: 'Nautilus', name: 'ノーチラス', ruby: 'のうちらす', region: 'Bilgewater', roles: ['SUP'], class: 'Tank' },
  Neeko: { id: 'Neeko', name: 'ニーコ', ruby: 'にこ', region: 'Ixtal', roles: ['MID', 'SUP'], class: 'Mage' },
  Nidalee: { id: 'Nidalee', name: 'ニダリー', ruby: 'にだり', region: 'Ixtal', roles: ['JG'], class: 'Assassin' },
  Nilah: { id: 'Nilah', name: 'ニーラ', ruby: 'にら', region: 'Bilgewater', roles: ['ADC'], class: 'Fighter' },
  Nocturne: { id: 'Nocturne', name: 'ノクターン', ruby: 'のくたん', region: 'Runeterra', roles: ['JG'], class: 'Assassin' },
  Nunu: { id: 'Nunu', name: 'ヌヌ＆ウィランプ', ruby: 'ぬぬうぃらんぷ', region: 'Freljord', roles: ['JG'], class: 'Tank' },
  Olaf: { id: 'Olaf', name: 'オラフ', ruby: 'おらふ', region: 'Freljord', roles: ['TOP', 'JG'], class: 'Fighter' },
  Orianna: { id: 'Orianna', name: 'オリアナ', ruby: 'おりあな', region: 'Piltover', roles: ['MID'], class: 'Mage' },
  Ornn: { id: 'Ornn', name: 'オーン', ruby: 'おん', region: 'Freljord', roles: ['TOP'], class: 'Tank' },
  Pantheon: { id: 'Pantheon', name: 'パンテオン', ruby: 'ぱんておん', region: 'Targon', roles: ['MID', 'TOP', 'SUP'], class: 'Fighter' },
  Poppy: { id: 'Poppy', name: 'ポッピー', ruby: 'ぽっぴ', region: 'Demacia', roles: ['TOP', 'JG', 'SUP'], class: 'Tank' },
  Pyke: { id: 'Pyke', name: 'パイク', ruby: 'ぱいく', region: 'Bilgewater', roles: ['SUP'], class: 'Assassin' },
  Qiyana: { id: 'Qiyana', name: 'キヤナ', ruby: 'きやな', region: 'Ixtal', roles: ['MID', 'JG'], class: 'Assassin' },
  Quinn: { id: 'Quinn', name: 'クイン', ruby: 'くいん', region: 'Demacia', roles: ['TOP'], class: 'Marksman' },
  Rakan: { id: 'Rakan', name: 'ラカン', ruby: 'らかん', region: 'Ionia', roles: ['SUP'], class: 'Support' },
  Rammus: { id: 'Rammus', name: 'ラムス', ruby: 'らむす', region: 'Shurima', roles: ['JG'], class: 'Tank' },
  RekSai: { id: 'RekSai', name: 'レク＝サイ', ruby: 'れくさい', region: 'Void', roles: ['JG', 'TOP'], class: 'Fighter' },
  Rell: { id: 'Rell', name: 'レル', ruby: 'れる', region: 'Noxus', roles: ['SUP', 'JG'], class: 'Tank' },
  Renata: { id: 'Renata', name: 'レナータ・グラスク', ruby: 'れなたぐらすく', region: 'Zaun', roles: ['SUP'], class: 'Support' },
  Renekton: { id: 'Renekton', name: 'レネクトン', ruby: 'れねくとん', region: 'Shurima', roles: ['TOP'], class: 'Fighter' },
  Rengar: { id: 'Rengar', name: 'レンガー', ruby: 'れんが', region: 'Ixtal', roles: ['JG', 'TOP'], class: 'Assassin' },
  Riven: { id: 'Riven', name: 'リヴェン', ruby: 'りゔぇん', region: 'Noxus', roles: ['TOP'], class: 'Fighter' },
  Rumble: { id: 'Rumble', name: 'ランブル', ruby: 'らんぶる', region: 'BandleCity', roles: ['TOP', 'MID'], class: 'Fighter' },
  Ryze: { id: 'Ryze', name: 'ライズ', ruby: 'らいず', region: 'Runeterra', roles: ['MID', 'TOP'], class: 'Mage' },
  Samira: { id: 'Samira', name: 'サミーラ', ruby: 'さみら', region: 'Noxus', roles: ['ADC'], class: 'Marksman' },
  Sejuani: { id: 'Sejuani', name: 'セジュアニ', ruby: 'せじゅあに', region: 'Freljord', roles: ['JG', 'TOP'], class: 'Tank' },
  Senna: { id: 'Senna', name: 'セナ', ruby: 'せな', region: 'ShadowIsles', roles: ['SUP', 'ADC'], class: 'Marksman' },
  Seraphine: { id: 'Seraphine', name: 'セラフィーン', ruby: 'せらふぃん', region: 'Piltover', roles: ['SUP', 'ADC', 'MID'], class: 'Mage' },
  Sett: { id: 'Sett', name: 'セト', ruby: 'せと', region: 'Ionia', roles: ['TOP', 'SUP'], class: 'Fighter' },
  Shaco: { id: 'Shaco', name: 'シャコ', ruby: 'しゃこ', region: 'Runeterra', roles: ['JG', 'SUP'], class: 'Assassin' },
  Shen: { id: 'Shen', name: 'シェン', ruby: 'しぇん', region: 'Ionia', roles: ['TOP', 'SUP'], class: 'Tank' },
  Shyvana: { id: 'Shyvana', name: 'シヴァーナ', ruby: 'しゔぁな', region: 'Demacia', roles: ['JG'], class: 'Fighter' },
  Singed: { id: 'Singed', name: 'シンジド', ruby: 'しんじど', region: 'Zaun', roles: ['TOP'], class: 'Tank' },
  Sion: { id: 'Sion', name: 'サイオン', ruby: 'さいおん', region: 'Noxus', roles: ['TOP'], class: 'Tank' },
  Sivir: { id: 'Sivir', name: 'シヴィア', ruby: 'しゔぃあ', region: 'Shurima', roles: ['ADC'], class: 'Marksman' },
  Skarner: { id: 'Skarner', name: 'スカーナー', ruby: 'すかな', region: 'Ixtal', roles: ['TOP', 'JG'], class: 'Tank' },
  Smolder: { id: 'Smolder', name: 'スモルダー', ruby: 'すもるだ', region: 'Runeterra', roles: ['ADC', 'MID'], class: 'Marksman' },
  Sona: { id: 'Sona', name: 'ソナ', ruby: 'そな', region: 'Demacia', roles: ['SUP'], class: 'Support' },
  Soraka: { id: 'Soraka', name: 'ソラカ', ruby: 'そらか', region: 'Targon', roles: ['SUP'], class: 'Support' },
  Swain: { id: 'Swain', name: 'スウェイン', ruby: 'すうぇいん', region: 'Noxus', roles: ['MID', 'SUP', 'ADC'], class: 'Mage' },
  Sylas: { id: 'Sylas', name: 'サイラス', ruby: 'さいらす', region: 'Demacia', roles: ['MID', 'TOP'], class: 'Mage' },
  Syndra: { id: 'Syndra', name: 'シンドラ', ruby: 'しんどら', region: 'Ionia', roles: ['MID'], class: 'Mage' },
  TahmKench: { id: 'TahmKench', name: 'タム・ケンチ', ruby: 'たむけんち', region: 'Bilgewater', roles: ['TOP', 'SUP'], class: 'Tank' },
  Taliyah: { id: 'Taliyah', name: 'タリヤ', ruby: 'たりや', region: 'Shurima', roles: ['JG', 'MID'], class: 'Mage' },
  Talon: { id: 'Talon', name: 'タロン', ruby: 'たろん', region: 'Noxus', roles: ['MID', 'JG'], class: 'Assassin' },
  Taric: { id: 'Taric', name: 'タリック', ruby: 'たりっく', region: 'Targon', roles: ['SUP'], class: 'Support' },
  Teemo: { id: 'Teemo', name: 'ティーモ', ruby: 'てぃも', region: 'BandleCity', roles: ['TOP'], class: 'Marksman' },
  Thresh: { id: 'Thresh', name: 'スレッシュ', ruby: 'すれっしゅ', region: 'ShadowIsles', roles: ['SUP'], class: 'Support' },
  Tristana: { id: 'Tristana', name: 'トリスターナ', ruby: 'とりすたな', region: 'BandleCity', roles: ['ADC', 'MID'], class: 'Marksman' },
  Trundle: { id: 'Trundle', name: 'トランドル', ruby: 'とらんどる', region: 'Freljord', roles: ['TOP', 'JG'], class: 'Fighter' },
  Tryndamere: { id: 'Tryndamere', name: 'トリンダメア', ruby: 'とりんだめあ', region: 'Freljord', roles: ['TOP', 'MID'], class: 'Fighter' },
  TwistedFate: { id: 'TwistedFate', name: 'ツイステッド・フェイト', ruby: 'ついすてっどふぇいと', region: 'Bilgewater', roles: ['MID', 'ADC'], class: 'Mage' },
  Twitch: { id: 'Twitch', name: 'トゥイッチ', ruby: 'とぅいっち', region: 'Zaun', roles: ['ADC'], class: 'Marksman' },
  Udyr: { id: 'Udyr', name: 'ウディア', ruby: 'うでぃあ', region: 'Freljord', roles: ['JG', 'TOP'], class: 'Fighter' },
  Urgot: { id: 'Urgot', name: 'アーゴット', ruby: 'あごっと', region: 'Zaun', roles: ['TOP'], class: 'Fighter' },
  Varus: { id: 'Varus', name: 'ヴァルス', ruby: 'ゔぁるす', region: 'Ionia', roles: ['ADC', 'MID'], class: 'Marksman' },
  Vayne: { id: 'Vayne', name: 'ヴェイン', ruby: 'ゔぇいん', region: 'Demacia', roles: ['ADC', 'TOP'], class: 'Marksman' },
  Veigar: { id: 'Veigar', name: 'ベイガー', ruby: 'べいが', region: 'BandleCity', roles: ['MID', 'ADC'], class: 'Mage' },
  Velkoz: { id: 'Velkoz', name: 'ヴェル＝コズ', ruby: 'ゔぇるこず', region: 'Void', roles: ['SUP', 'MID'], class: 'Mage' },
  Vex: { id: 'Vex', name: 'ヴェックス', ruby: 'ゔぇっくす', region: 'BandleCity', roles: ['MID'], class: 'Mage' },
  Vi: { id: 'Vi', name: 'ヴァイ', ruby: 'ゔぁい', region: 'Piltover', roles: ['JG'], class: 'Fighter' },
  Viego: { id: 'Viego', name: 'ヴィエゴ', ruby: 'ゔぃえご', region: 'ShadowIsles', roles: ['JG'], class: 'Assassin' },
  Viktor: { id: 'Viktor', name: 'ビクター', ruby: 'びくた', region: 'Zaun', roles: ['MID'], class: 'Mage' },
  Vladimir: { id: 'Vladimir', name: 'ブラッドミア', ruby: 'ぶらっどみあ', region: 'Noxus', roles: ['MID', 'TOP'], class: 'Mage' },
  Volibear: { id: 'Volibear', name: 'ボリベア', ruby: 'ぼりべあ', region: 'Freljord', roles: ['TOP', 'JG'], class: 'Fighter' },
  Warwick: { id: 'Warwick', name: 'ワーウィック', ruby: 'わうぃっく', region: 'Zaun', roles: ['JG', 'TOP'], class: 'Fighter' },
  Wukong: { id: 'Wukong', name: 'ウーコン', ruby: 'うこん', region: 'Ionia', roles: ['TOP', 'JG'], class: 'Fighter' },
  Xayah: { id: 'Xayah', name: 'ザヤ', ruby: 'ざや', region: 'Ionia', roles: ['ADC'], class: 'Marksman' },
  Xerath: { id: 'Xerath', name: 'ゼラス', ruby: 'ぜらす', region: 'Shurima', roles: ['SUP', 'MID'], class: 'Mage' },
  XinZhao: { id: 'XinZhao', name: 'シン・ジャオ', ruby: 'しんじゃお', region: 'Demacia', roles: ['JG'], class: 'Fighter' },
  Yasuo: { id: 'Yasuo', name: 'ヤスオ', ruby: 'やすお', region: 'Ionia', roles: ['MID', 'TOP', 'ADC'], class: 'Fighter' },
  Yone: { id: 'Yone', name: 'ヨネ', ruby: 'よね', region: 'Ionia', roles: ['MID', 'TOP'], class: 'Fighter' },
  Yorick: { id: 'Yorick', name: 'ヨリック', ruby: 'よりっく', region: 'ShadowIsles', roles: ['TOP'], class: 'Fighter' },
  Yuumi: { id: 'Yuumi', name: 'ユーミ', ruby: 'ゆみ', region: 'BandleCity', roles: ['SUP'], class: 'Support' },
  Zac: { id: 'Zac', name: 'ザック', ruby: 'ざっく', region: 'Zaun', roles: ['JG', 'TOP', 'SUP'], class: 'Tank' },
  Zed: { id: 'Zed', name: 'ゼド', ruby: 'ぜど', region: 'Ionia', roles: ['MID', 'JG'], class: 'Assassin' },
  Zeri: { id: 'Zeri', name: 'ゼリ', ruby: 'ぜり', region: 'Zaun', roles: ['ADC'], class: 'Marksman' },
  Ziggs: { id: 'Ziggs', name: 'ジグス', ruby: 'じぐす', region: 'Zaun', roles: ['ADC', 'MID'], class: 'Mage' },
  Zilean: { id: 'Zilean', name: 'ジリアン', ruby: 'じりあん', region: 'Runeterra', roles: ['SUP', 'MID'], class: 'Support' },
  Zoe: { id: 'Zoe', name: 'ゾーイ', ruby: 'ぞい', region: 'Targon', roles: ['MID', 'SUP'], class: 'Mage' },
  Zyra: { id: 'Zyra', name: 'ザイラ', ruby: 'ざいら', region: 'Ixtal', roles: ['SUP'], class: 'Mage' },
};

export function getChampionMetadata(id: string): ChampionMeta {
  if (CHAMPION_METADATA[id]) {
    return CHAMPION_METADATA[id];
  }
  const ja = CHAMPION_JA[id] || { ja: id, ruby: '' };
  return {
    id,
    name: ja.ja,
    ruby: ja.ruby,
    region: 'Runeterra',
    roles: ['MID'],
    class: 'Fighter',
  };
}

export const ALL_METADATA_CHAMPIONS: ChampionMeta[] = Object.values(CHAMPION_METADATA);

export interface FestivalTheme {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'mechanics' | 'theme' | 'rivalry' | 'ktm';
  champIds: string[];
}

export const FESTIVAL_THEMES: FestivalTheme[] = [
  // ⚔️ 1. 戦闘スタイル・メカニクス系
  {
    id: 'hook',
    name: 'オール・フック＆キャッチ祭り',
    icon: '🪝',
    description: '誰かが引っ張られたら即集団戦！視界とステップ勝負の牽制戦',
    category: 'mechanics',
    champIds: [
      'Blitzcrank', 'Thresh', 'Nautilus', 'Pyke', 'Amumu',
      'Swain', 'Morgana', 'Lux', 'Skarner', 'Darius', 'Sett'
    ]
  },
  {
    id: 'knockup',
    name: '打ち上げドカン！ヤスオシナジー',
    icon: '🌀',
    description: '全員で打ち上げて全員で特大コンボを合わせる爽快感MAX構成',
    category: 'mechanics',
    champIds: [
      'Yasuo', 'Malphite', 'Diana', 'Alistar', 'Zac',
      'Orianna', 'Wukong', 'Nautilus', 'Rakan', 'Chogath',
      'Yone', 'Gragas', 'Janna', 'Rell', 'Ornn'
    ]
  },
  {
    id: 'global',
    name: '全体・超長距離Ult（グローバル砲）',
    icon: '🌍',
    description: 'どこにいようが空からUltが飛んでくる弾幕＆爆撃カスタム',
    category: 'mechanics',
    champIds: [
      'Karthus', 'Jinx', 'Ezreal', 'Gangplank', 'Draven',
      'Senna', 'Ashe', 'Ziggs', 'Pantheon', 'TwistedFate',
      'Shen', 'Briar', 'Vex', 'Soraka'
    ]
  },
  {
    id: 'nowall',
    name: '徒歩勢ガチ相撲（ブリンク禁止）',
    icon: '💨',
    description: 'ブリンクで逃げる軟弱者はお断り！泥臭いステゴロ真っ向勝負',
    category: 'mechanics',
    champIds: [
      'Garen', 'Darius', 'DrMundo', 'Nasus', 'Udyr',
      'Olaf', 'Sett', 'Brand', 'Ashe', 'Mordekaiser',
      'Illaoi', 'Trundle', 'Singed', 'Sion', 'Annie'
    ]
  },
  {
    id: 'nomana',
    name: 'ノーマナ・気勢ラッシュ（スキル連打）',
    icon: '⚡',
    description: 'マナ切れ知らず！気・怒り・完全ノーコスト勢による超ハイスピード戦',
    category: 'mechanics',
    champIds: [
      'Aatrox', 'Akali', 'Briar', 'DrMundo', 'Garen',
      'Gnar', 'Katarina', 'Kennen', 'Kled', 'LeeSin',
      'Mordekaiser', 'RekSai', 'Renekton', 'Riven', 'Rumble',
      'Shen', 'Shyvana', 'Viego', 'Vladimir', 'Yasuo',
      'Yone', 'Zac', 'Sett'
    ]
  },
  {
    id: 'super_poke',
    name: '超長射程・弾幕スナイパー戦',
    icon: '🎯',
    description: '遠距離ポーク・爆撃スキルで削り合い！接近戦お断りの弾幕戦',
    category: 'mechanics',
    champIds: [
      'Xerath', 'Ziggs', 'Jayce', 'Varus', 'Velkoz',
      'Lux', 'Caitlyn', 'Jhin', 'Zoe', 'KogMaw',
      'Hwei', 'Nidalee', 'Ezreal', 'Kaisa'
    ]
  },
  {
    id: 'ultra_tank_sustain',
    name: '超回復・ゾンビシールド合戦',
    icon: '💉',
    description: '削っても削っても自己回復やシールドで復活！不死身の泥沼耐久マッチ',
    category: 'mechanics',
    champIds: [
      'DrMundo', 'Warwick', 'Aatrox', 'Vladimir', 'TahmKench',
      'Zac', 'Illaoi', 'Swain', 'Volibear', 'Olaf',
      'Briar', 'Maokai', 'Sion', 'Shen', 'Taric', 'Soraka'
    ]
  },
  {
    id: 'game_changer_ult',
    name: '最強Ult大乱闘（一撃必殺集団戦）',
    icon: '🌪️',
    description: '集団戦を一瞬でひっくり返す最強アルティメット持ち集結！Ult即開戦！',
    category: 'mechanics',
    champIds: [
      'Malphite', 'Amumu', 'Fiddlesticks', 'Kennen', 'Orianna',
      'Diana', 'JarvanIV', 'Neeko', 'Hecarim', 'Rakan',
      'MissFortune', 'Gangplank', 'Seraphine', 'Rell', 'Sona'
    ]
  },

  // ⚔️ 2. 地域抗争シリーズ
  {
    id: 'demacia_vs_noxus',
    name: 'デマーシア vs ノクサス（王道帝国戦争）',
    icon: '🛡️🪓',
    description: '正義と規律のデマーシア軍 vs 力こそ正義のノクサス軍による全面激突！',
    category: 'rivalry',
    champIds: [
      'Garen', 'JarvanIV', 'Lux', 'Fiora', 'Galio',
      'Kayle', 'Lucian', 'Morgana', 'Poppy', 'Quinn',
      'Shyvana', 'Sona', 'Sylas', 'Vayne', 'XinZhao',
      'Darius', 'Draven', 'Katarina', 'Swain', 'Talon',
      'Vladimir', 'Ambessa', 'Annie', 'Briar', 'Cassiopeia',
      'Kled', 'Leblanc', 'Mordekaiser', 'Rell', 'Riven',
      'Samira', 'Sion'
    ]
  },
  {
    id: 'piltover_vs_zaun',
    name: 'ピルトーヴァー vs ゾウン（進歩と化学）',
    icon: '⚙️🧪',
    description: '進歩と科学の輝く都市 vs 地下に広がる過激化学都市のサイバー抗争！',
    category: 'rivalry',
    champIds: [
      'Caitlyn', 'Camille', 'Ezreal', 'Heimerdinger', 'Jayce',
      'Mel', 'Orianna', 'Seraphine', 'Vi',
      'Blitzcrank', 'DrMundo', 'Ekko', 'Janna', 'Jinx',
      'Renata', 'Singed', 'Twitch', 'Urgot', 'Viktor',
      'Warwick', 'Zac', 'Zeri', 'Ziggs'
    ]
  },
  {
    id: 'ionia_showdown',
    name: 'アイオニア決戦（自然・武芸・霊的調和）',
    icon: '🌸',
    description: '忍、剣士、精霊魔法使いが集う初生の地の頂上決戦！',
    category: 'rivalry',
    champIds: [
      'Ahri', 'Akali', 'Hwei', 'Irelia', 'Ivern',
      'Jhin', 'Karma', 'Kayn', 'Kennen', 'LeeSin',
      'Lillia', 'MasterYi', 'Rakan', 'Sett', 'Shen',
      'Syndra', 'Varus', 'Wukong', 'Xayah', 'Yasuo',
      'Yone', 'Zed'
    ]
  },
  {
    id: 'shurima_vs_targon',
    name: 'シュリーマ vs ターゴン（砂漠超越者vs天界）',
    icon: '☀️🏔️',
    description: '古代砂漠帝国の超越者皇帝 vs 天界霊峰の巨神星霊たちの激突！',
    category: 'rivalry',
    champIds: [
      'Azir', 'Nasus', 'Renekton', 'Xerath', 'Sivir',
      'Amumu', 'Akshan', 'KSante', 'Naafiri', 'Rammus', 'Taliyah',
      'AurelionSol', 'Diana', 'Leona', 'Pantheon', 'Soraka',
      'Taric', 'Zoe', 'Aphelios'
    ]
  },
  {
    id: 'bilgewater_vs_shadowisles',
    name: 'ビルジウォーター vs シャドウアイル',
    icon: '🏴‍☠️👻',
    description: '無法の港湾海賊団 vs 黒き霧に呪われしアンデッド亡霊軍団！',
    category: 'rivalry',
    champIds: [
      'Gangplank', 'MissFortune', 'Graves', 'Pyke', 'Nautilus',
      'Illaoi', 'TwistedFate', 'TahmKench', 'Fizz', 'Nilah',
      'Viego', 'Hecarim', 'Thresh', 'Kalista', 'Karthus',
      'Gwen', 'Senna', 'Elise', 'Maokai', 'Yorick'
    ]
  },
  {
    id: 'freljord_tribes',
    name: 'フレヨルド氷雪抗争（三姉妹のサバイバル）',
    icon: '❄️',
    description: 'アヴァローサ、ウィンターズクロウ、フロストガードの過酷な極北バトル！',
    category: 'rivalry',
    champIds: [
      'Ashe', 'Sejuani', 'Lissandra', 'Braum', 'Anivia',
      'Volibear', 'Ornn', 'Olaf', 'Trundle', 'Tryndamere',
      'Gragas', 'Nunu', 'Udyr', 'Aurora', 'Gnar'
    ]
  },

  // 🐾 3. テーマ・種族・ビジュアル系
  {
    id: 'yordle',
    name: 'ヨードル軍団（ちびっこ大行進）',
    icon: '🍄',
    description: '全員ちっちゃいのに全員嫌がらせ性能がカンストしている混沌戦',
    category: 'theme',
    champIds: [
      'Teemo', 'Tristana', 'Lulu', 'Poppy', 'Heimerdinger',
      'Corki', 'Veigar', 'Vex', 'Kled', 'Gnar',
      'Kennen', 'Ziggs', 'Fizz', 'Rumble', 'Amumu'
    ]
  },
  {
    id: 'monster',
    name: '人外・モンスター・怪獣大決戦',
    icon: '🐲',
    description: '人間キャラ完全禁止！サモナーズリフトが怪獣映画の舞台に',
    category: 'theme',
    champIds: [
      'Chogath', 'RekSai', 'KogMaw', 'Anivia', 'Volibear',
      'Renekton', 'Skarner', 'Ornn', 'Malphite', 'Velkoz',
      'Gnar', 'Khazix', 'Hecarim', 'Naafiri', 'AurelionSol',
      'Belveth', 'Rammus', 'Warwick', 'Zac'
    ]
  },
  {
    id: 'cyborg',
    name: 'メカ・サイボーグ・鋼鉄の進歩',
    icon: '🤖',
    description: 'ピルトーヴァーとゾウンの科学技術の結晶縛り',
    category: 'theme',
    champIds: [
      'Blitzcrank', 'Viktor', 'Orianna', 'Camille', 'Urgot',
      'Jayce', 'Heimerdinger'
    ]
  },

  // 🔰 5. KTMカスタム・身内おもしろ枠
  {
    id: 'beginner',
    name: '初心者おすすめ・操作かんたん枠',
    icon: '🌱',
    description: '操作で迷わない！初心者やお久しぶりの方でも安心活躍プール',
    category: 'ktm',
    champIds: [
      'Garen', 'Malphite', 'Annie', 'Ashe', 'Amumu',
      'Warwick', 'Sona', 'Leona', 'MissFortune', 'Morgana',
      'Lux', 'MasterYi', 'DrMundo', 'Volibear', 'Nunu'
    ]
  },
  {
    id: 'veteran_handicap',
    name: '上級者・師匠ハンデ枠（超高難易度）',
    icon: '👑',
    description: '高レート勢や師匠がこれを引いたら腕前が試される鬼縛り',
    category: 'ktm',
    champIds: [
      'LeeSin', 'Yasuo', 'Riven', 'Azir', 'Aphelios',
      'Nidalee', 'Kalista', 'Draven', 'KSante', 'Gangplank',
      'Qiyana', 'Hwei', 'Bard', 'Irelia', 'Fiora'
    ]
  }
];

export const FESTIVAL_THEME_CATEGORIES = {
  mechanics: { label: '戦闘・メカニクス縛り', icon: '⚡' },
  rivalry: { label: '地域抗争シリーズ', icon: '⚔️' },
  theme: { label: 'ビジュアル・種族縛り', icon: '🐾' },
  ktm: { label: '初心者・ハンデ枠', icon: '🌱' },
} as const;



