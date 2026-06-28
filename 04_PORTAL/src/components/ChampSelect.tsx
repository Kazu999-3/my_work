import { useState, useEffect, useRef } from 'react';
import { getChampIcon } from '../lib/ddragonClient';

export const ALL_CHAMPIONS = [
  "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia", "Annie", "Aphelios", "Ashe", "Aurelion Sol", "Azir", 
  "Bard", "Bel'Veth", "Blitzcrank", "Brand", "Braum", "Briar", "Caitlyn", "Camille", "Cassiopeia", "Cho'Gath", "Corki", "Darius", "Diana", 
  "Dr. Mundo", "Draven", "Ekko", "Elise", "Evelynn", "Ezreal", "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank", "Garen", "Gnar", 
  "Gragas", "Graves", "Gwen", "Hecarim", "Heimerdinger", "Hwei", "Illaoi", "Irelia", "Ivern", "Janna", "Jarvan IV", "Jax", "Jayce", 
  "Jhin", "Jinx", "K'Sante", "Kai'Sa", "Kalista", "Karma", "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn", "Kennen", "Kha'Zix", 
  "Kindred", "Kled", "Kog'Maw", "LeBlanc", "Lee Sin", "Leona", "Lillia", "Lissandra", "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", 
  "Maokai", "Master Yi", "Mel", "Milio", "Miss Fortune", "Mordekaiser", "Morgana", "Naafiri", "Nami", "Nasus", "Nautilus", "Neeko", 
  "Nidalee", "Nilah", "Nocturne", "Nunu & Willump", "Olaf", "Orianna", "Ornn", "Pantheon", "Poppy", "Pyke", "Qiyana", "Quinn", "Rakan", 
  "Rammus", "Rek'Sai", "Rell", "Renata Glasc", "Renekton", "Rengar", "Riven", "Rumble", "Ryze", "Samira", "Sejuani", "Senna", "Seraphine", 
  "Sett", "Shaco", "Shen", "Shyvana", "Singed", "Sion", "Sivir", "Skarner", "Smolder", "Sona", "Soraka", "Swain", "Sylas", "Syndra", 
  "Tahm Kench", "Taliyah", "Talon", "Taric", "Teemo", "Thresh", "Tristana", "Trundle", "Tryndamere", "Twisted Fate", "Twitch", "Udyr", 
  "Urgot", "Varus", "Vayne", "Veigar", "Vel'Koz", "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear", "Warwick", "Wukong", "Xayah", 
  "Xerath", "Xin Zhao", "Yasuo", "Yone", "Yorick", "Yuumi", "Zac", "Zed", "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra"
];

export const CHAMPION_JA: Record<string, { ja: string; ruby: string }> = {
  "Aatrox": { ja: "アアトロックス", ruby: "ああとろっくす" },
  "Ahri": { ja: "アーリ", ruby: "あーり" },
  "Akali": { ja: "アカリ", ruby: "あかり" },
  "Akshan": { ja: "アクシャン", ruby: "あくしゃん" },
  "Alistar": { ja: "アリスター", ruby: "ありすたー" },
  "Ambessa": { ja: "アンベッサ", ruby: "あんべっさ" },
  "Amumu": { ja: "アムム", ruby: "あむむ" },
  "Anivia": { ja: "アニビア", ruby: "あにびあ" },
  "Annie": { ja: "アニー", ruby: "あにー" },
  "Aphelios": { ja: "アフェリオス", ruby: "あふぇりおす" },
  "Ashe": { ja: "アッシュ", ruby: "あっしゅ" },
  "Aurelion Sol": { ja: "オレリオン・ソル", ruby: "おれりおんそる" },
  "Azir": { ja: "アジール", ruby: "あじーる" },
  "Bard": { ja: "バード", ruby: "ばーど" },
  "Bel'Veth": { ja: "ベル＝ヴェス", ruby: "べるゔぇす" },
  "Blitzcrank": { ja: "ブリッツクランク", ruby: "ぶりっつくらんく" },
  "Brand": { ja: "ブランド", ruby: "ぶらんど" },
  "Braum": { ja: "ブラウム", ruby: "ぶらうむ" },
  "Briar": { ja: "ブライアー", ruby: "ぶらいあー" },
  "Caitlyn": { ja: "ケイトリン", ruby: "けいとりん" },
  "Camille": { ja: "カミール", ruby: "かみーる" },
  "Cassiopeia": { ja: "カシオペア", ruby: "かしおぺあ" },
  "Cho'Gath": { ja: "チョ＝ガス", ruby: "ちょがす" },
  "Corki": { ja: "コーキ", ruby: "こーき" },
  "Darius": { ja: "ダリウス", ruby: "だりうす" },
  "Diana": { ja: "ダイアナ", ruby: "だいあな" },
  "Dr. Mundo": { ja: "ドクター・ムンド", ruby: "どくたーむんど" },
  "Draven": { ja: "ドレイヴン", ruby: "どれいゔん" },
  "Ekko": { ja: "エコー", ruby: "えこー" },
  "Elise": { ja: "エリス", ruby: "えりす" },
  "Evelynn": { ja: "イブリン", ruby: "いぶりん" },
  "Ezreal": { ja: "エズリアル", ruby: "えずりある" },
  "Fiddlesticks": { ja: "フィドルスティックス", ruby: "ふぃどるすてぃっくす" },
  "Fiora": { ja: "フィオラ", ruby: "ふぃおら" },
  "Fizz": { ja: "フィズ", ruby: "ふぃず" },
  "Galio": { ja: "ガリオ", ruby: "がりお" },
  "Gangplank": { ja: "ガングプランク", ruby: "がんぐぷらんく" },
  "Garen": { ja: "ガレン", ruby: "がれん" },
  "Gnar": { ja: "ナー", ruby: "なー" },
  "Gragas": { ja: "グラガス", ruby: "ぐらがす" },
  "Graves": { ja: "グレイブス", ruby: "ぐれいぶす" },
  "Gwen": { ja: "グウェン", ruby: "ぐうぇん" },
  "Hecarim": { ja: "ヘカリム", ruby: "へかりむ" },
  "Heimerdinger": { ja: "ハイマーディンガー", ruby: "はいまーでぃんがー" },
  "Hwei": { ja: "フェイ", ruby: "ふぇい" },
  "Illaoi": { ja: "イラオイ", ruby: "いらおい" },
  "Irelia": { ja: "イレリア", ruby: "いれりあ" },
  "Ivern": { ja: "アイバーン", ruby: "あいばーん" },
  "Janna": { ja: "ジャンナ", ruby: "じゃんな" },
  "Jarvan IV": { ja: "ジャーヴァンIV", ruby: "じゃーゔぁん" },
  "Jax": { ja: "ジャックス", ruby: "じゃっくす" },
  "Jayce": { ja: "ジェイス", ruby: "じぇいす" },
  "Jhin": { ja: "ジン", ruby: "じん" },
  "Jinx": { ja: "ジンクス", ruby: "じんくす" },
  "K'Sante": { ja: "ク＝サンテ", ruby: "くさんて" },
  "Kai'Sa": { ja: "カイ＝サ", ruby: "かいさ" },
  "Kalista": { ja: "カリスタ", ruby: "かりすた" },
  "Karma": { ja: "カルマ", ruby: "かるま" },
  "Karthus": { ja: "カーサス", ruby: "かーさす" },
  "Kassadin": { ja: "カサディン", ruby: "かさでぃん" },
  "Katarina": { ja: "カタリーナ", ruby: "かたりーな" },
  "Kayle": { ja: "ケイル", ruby: "けいる" },
  "Kayn": { ja: "ケイン", ruby: "けいん" },
  "Kennen": { ja: "ケネン", ruby: "かねん" },
  "Kha'Zix": { ja: "カ＝ジックス", ruby: "かじっくす" },
  "Kindred": { ja: "キンドレッド", ruby: "きんどれっど" },
  "Kled": { ja: "クレッド", ruby: "くれっど" },
  "Kog'Maw": { ja: "コグ＝マウ", ruby: "こぐまう" },
  "LeBlanc": { ja: "ルブラン", ruby: "るぶらん" },
  "Lee Sin": { ja: "リー・シン", ruby: "りーしん" },
  "Leona": { ja: "レオナ", ruby: "れおな" },
  "Lillia": { ja: "リリア", ruby: "りりあ" },
  "Lissandra": { ja: "リサンドラ", ruby: "りさんどら" },
  "Lucian": { ja: "ルシアン", ruby: "るしあん" },
  "Lulu": { ja: "ルル", ruby: "るる" },
  "Lux": { ja: "ラックス", ruby: "らっくす" },
  "Malphite": { ja: "マルファイト", ruby: "まるふぁいと" },
  "Malzahar": { ja: "マルザハール", ruby: "まるざはーる" },
  "Maokai": { ja: "マオカイ", ruby: "まおかい" },
  "Master Yi": { ja: "マスター・イー", ruby: "ますたーいー" },
  "Mel": { ja: "メル", ruby: "める" },
  "Milio": { ja: "ミリオ", ruby: "みりお" },
  "Miss Fortune": { ja: "ミス・フォーチュン", ruby: "みすふぉーちゅん" },
  "Mordekaiser": { ja: "モルデカイザー", ruby: "もるでかいざー" },
  "Morgana": { ja: "モルガナ", ruby: "もるがな" },
  "Naafiri": { ja: "ナーフィリ", ruby: "なーふぃり" },
  "Nami": { ja: "ナミ", ruby: "なみ" },
  "Nasus": { ja: "ナサス", ruby: "なさす" },
  "Nautilus": { ja: "ノーチラス", ruby: "のーちらす" },
  "Neeko": { ja: "ニーコ", ruby: "にーこ" },
  "Nidalee": { ja: "ニダリー", ruby: "にだりー" },
  "Nilah": { ja: "ニーラ", ruby: "にーら" },
  "Nocturne": { ja: "ノクターン", ruby: "のくたーん" },
  "Nunu & Willump": { ja: "ヌヌ＆ウィランプ", ruby: "ぬぬうぃらんぷ" },
  "Olaf": { ja: "オラフ", ruby: "おらふ" },
  "Orianna": { ja: "オリアナ", ruby: "おりあな" },
  "Ornn": { ja: "オーン", ruby: "おーん" },
  "Pantheon": { ja: "パンテオン", ruby: "ぱんておん" },
  "Poppy": { ja: "ポッピー", ruby: "ぽっぴー" },
  "Pyke": { ja: "パイク", ruby: "ぱいく" },
  "Qiyana": { ja: "キヤナ", ruby: "きやな" },
  "Quinn": { ja: "クイン", ruby: "くいん" },
  "Rakan": { ja: "ラカン", ruby: "らかん" },
  "Rammus": { ja: "ラムス", ruby: "らむす" },
  "Rek'Sai": { ja: "レク＝サイ", ruby: "れくさい" },
  "Rell": { ja: "レル", ruby: "れる" },
  "Renata Glasc": { ja: "レナタ・グラスク", ruby: "れなたぐらすく" },
  "Renekton": { ja: "レネクトン", ruby: "れねくとん" },
  "Rengar": { ja: "レンガー", ruby: "れんがー" },
  "Riven": { ja: "リヴェン", ruby: "りゔぇん" },
  "Rumble": { ja: "ランブル", ruby: "らんぶる" },
  "Ryze": { ja: "ライズ", ruby: "らいず" },
  "Samira": { ja: "サミラ", ruby: "さみら" },
  "Sejuani": { ja: "セジュアニ", ruby: "せじゅあに" },
  "Senna": { ja: "セナ", ruby: "せな" },
  "Seraphine": { ja: "セラフィーン", ruby: "せらふぃーん" },
  "Sett": { ja: "セト", ruby: "せと" },
  "Shaco": { ja: "シャコ", ruby: "しゃこ" },
  "Shen": { ja: "シェン", ruby: "しぇん" },
  "Shyvana": { ja: "シヴァーナ", ruby: "しゔぁーな" },
  "Singed": { ja: "シンジド", ruby: "しんじど" },
  "Sion": { ja: "サイオン", ruby: "さいおん" },
  "Sivir": { ja: "シヴィア", ruby: "しゔぃあ" },
  "Skarner": { ja: "スカーナー", ruby: "すかーなー" },
  "Smolder": { ja: "スモルダー", ruby: "すもるだー" },
  "Sona": { ja: "ソナ", ruby: "そな" },
  "Soraka": { ja: "ソラカ", ruby: "そらか" },
  "Swain": { ja: "スウェイン", ruby: "すうぇいん" },
  "Sylas": { ja: "サイラス", ruby: "さいらす" },
  "Syndra": { ja: "シンドラ", ruby: "しんどら" },
  "Tahm Kench": { ja: "タム・ケンチ", ruby: "たむけんち" },
  "Taliyah": { ja: "タリヤ", ruby: "たりや" },
  "Talon": { ja: "タロン", ruby: "たろん" },
  "Taric": { ja: "タリック", ruby: "たりっく" },
  "Teemo": { ja: "ティーモ", ruby: "てぃーも" },
  "Thresh": { ja: "スレッシュ", ruby: "すれっしゅ" },
  "Tristana": { ja: "トリスターナ", ruby: "とりすたーな" },
  "Trundle": { ja: "トランドル", ruby: "とらんどる" },
  "Tryndamere": { ja: "トリンダメア", ruby: "とりんだめあ" },
  "Twisted Fate": { ja: "ツイステッド・フェイト", ruby: "ついすてっどふぇいと" },
  "Twitch": { ja: "トゥイッチ", ruby: "とぅいっち" },
  "Udyr": { ja: "ウディア", ruby: "うでぃあ" },
  "Urgot": { ja: "アーゴット", ruby: "あーごっと" },
  "Varus": { ja: "ヴァルス", ruby: "ゔぁるす" },
  "Vayne": { ja: "ヴェイン", ruby: "ゔぇいん" },
  "Veigar": { ja: "ベイガー", ruby: "べいがー" },
  "Vel'Koz": { ja: "ヴェル＝コズ", ruby: "べるこず" },
  "Vex": { ja: "ヴェックス", ruby: "ゔぇっくす" },
  "Vi": { ja: "バイ", ruby: "ばい" },
  "Viego": { ja: "ヴィエゴ", ruby: "ゔぃえご" },
  "Viktor": { ja: "ビクター", ruby: "びくたー" },
  "Vladimir": { ja: "ブラッドミア", ruby: "ぶらっどみあ" },
  "Volibear": { ja: "ボリベア", ruby: "ぼりべあ" },
  "Warwick": { ja: "ワーウィック", ruby: "わーうぃっく" },
  "Wukong": { ja: "ウーコン", ruby: "うーこん" },
  "Xayah": { ja: "ザヤ", ruby: "ざや" },
  "Xerath": { ja: "ゼラス", ruby: "ぜらす" },
  "Xin Zhao": { ja: "シン・ジャオ", ruby: "しんじゃお" },
  "Yasuo": { ja: "ヤスオ", ruby: "やすお" },
  "Yone": { ja: "ヨネ", ruby: "よね" },
  "Yorick": { ja: "ヨリック", ruby: "よりっく" },
  "Yuumi": { ja: "ユーミ", ruby: "ゆーみ" },
  "Zac": { ja: "ザック", ruby: "ざっく" },
  "Zed": { ja: "ゼド", ruby: "ぜど" },
  "Zeri": { ja: "ゼリ", ruby: "ぜり" },
  "Ziggs": { ja: "ジグス", ruby: "じぐす" },
  "Zilean": { ja: "ジリアン", ruby: "じりあん" },
  "Zoe": { ja: "ゾーイ", ruby: "ぞーい" },
  "Zyra": { ja: "ザイラ", ruby: "ざいら" }
};

interface ChampSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** 複数選択モード用: リストからクリック選択された時に呼ばれる */
  onSelect?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ChampSelect({ value, onChange, onSelect, placeholder = "チャンピオン名", className = "" }: ChampSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 選択された値が変わったら、表示中の文字列をその日本語名にする
    if (!isOpen) {
      setSearchTerm(CHAMPION_JA[value]?.ja || value);
    }
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 英語名、日本語名(カタカナ)、ひらがな(ルビ)の部分一致でフィルタリング
  const filteredChamps = ALL_CHAMPIONS.filter(c => {
    const term = searchTerm.toLowerCase();
    const jaData = CHAMPION_JA[c];
    
    const matchEnglish = c.toLowerCase().includes(term) || c.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(term);
    if (!jaData) return matchEnglish;

    const matchJapanese = jaData.ja.includes(term) || jaData.ruby.includes(term);
    return matchEnglish || matchJapanese;
  });

  const handleSelect = (champ: string) => {
    if (onSelect) {
      // 複数選択モード: 選択後に入力欄をクリア
      onSelect(champ);
      setSearchTerm('');
      onChange('');
    } else {
      // 単体選択モード: 従来通り
      setSearchTerm(CHAMPION_JA[champ]?.ja || champ);
      onChange(champ);
    }
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          // 完全一致するものがあれば親ステートを更新
          const matchedChamp = ALL_CHAMPIONS.find(c => 
            c.toLowerCase() === e.target.value.toLowerCase() || 
            CHAMPION_JA[c]?.ja === e.target.value ||
            CHAMPION_JA[c]?.ruby === e.target.value
          );
          onChange(matchedChamp || e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`w-full bg-[var(--color-surface)] border border-white/5 focus:border-[#c89b3c]/50 rounded-xl p-3 text-white outline-none transition-colors shadow-inner ${className}`}
      />
      
      {isOpen && filteredChamps.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-[#0a0b10] border border-white/10 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] max-h-60 overflow-y-auto custom-scrollbar">
          {filteredChamps.map((champ) => (
            <div
              key={champ}
              className="flex items-center gap-3 p-3 hover:bg-white/10 cursor-pointer transition-colors border-b border-white/5 last:border-none"
              onClick={() => handleSelect(champ)}
            >
              <img 
                src={getChampIcon(champ)} 
                alt={champ} 
                className="w-8 h-8 rounded-full border border-white/10 shadow-sm animate-fade-in"
                onError={(e) => { (e.target as HTMLImageElement).src = '/favicon.ico'; }}
              />
              <div className="flex flex-col">
                <span className="font-bold text-sm text-gray-200">{CHAMPION_JA[champ]?.ja || champ}</span>
                <span className="text-[10px] text-gray-500 font-mono">{champ}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
