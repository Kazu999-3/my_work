import { useState, useEffect, useRef } from 'react';
import { getChampIcon } from '../lib/ddragonClient';

export const ALL_CHAMPIONS = ["Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia", "Annie", "Aphelios", "Ashe", "AurelionSol", "Aurora", "Azir", "Bard", "Belveth", "Blitzcrank", "Brand", "Braum", "Briar", "Caitlyn", "Camille", "Cassiopeia", "Chogath", "Corki", "Darius", "Diana", "DrMundo", "Draven", "Ekko", "Elise", "Evelynn", "Ezreal", "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank", "Garen", "Gnar", "Gragas", "Graves", "Gwen", "Hecarim", "Heimerdinger", "Hwei", "Illaoi", "Irelia", "Ivern", "Janna", "JarvanIV", "Jax", "Jayce", "Jhin", "Jinx", "KSante", "Kaisa", "Kalista", "Karma", "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn", "Kennen", "Khazix", "Kindred", "Kled", "KogMaw", "Leblanc", "LeeSin", "Leona", "Lillia", "Lissandra", "Locke", "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", "Maokai", "MasterYi", "Mel", "Milio", "MissFortune", "Mordekaiser", "Morgana", "Naafiri", "Nami", "Nasus", "Nautilus", "Neeko", "Nidalee", "Nilah", "Nocturne", "Nunu", "Olaf", "Orianna", "Ornn", "Pantheon", "Poppy", "Pyke", "Qiyana", "Quinn", "Rakan", "Rammus", "RekSai", "Rell", "Renata", "Renekton", "Rengar", "Riven", "Rumble", "Ryze", "Samira", "Sejuani", "Senna", "Seraphine", "Sett", "Shaco", "Shen", "Shyvana", "Singed", "Sion", "Sivir", "Skarner", "Smolder", "Sona", "Soraka", "Swain", "Sylas", "Syndra", "TahmKench", "Taliyah", "Talon", "Taric", "Teemo", "Thresh", "Tristana", "Trundle", "Tryndamere", "TwistedFate", "Twitch", "Udyr", "Urgot", "Varus", "Vayne", "Veigar", "Velkoz", "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear", "Warwick", "Wukong", "Xayah", "Xerath", "XinZhao", "Yasuo", "Yone", "Yorick", "Yunara", "Yuumi", "Zaahen", "Zac", "Zed", "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra"];

export const CHAMPION_JA: Record<string, { ja: string; ruby: string }> = {
  "Aatrox": { ja: "エイトロックス", ruby: "えいとろっくす" },
  "Ahri": { ja: "アーリ", ruby: "あり" },
  "Akali": { ja: "アカリ", ruby: "あかり" },
  "Akshan": { ja: "アクシャン", ruby: "あくしゃん" },
  "Alistar": { ja: "アリスター", ruby: "ありすた" },
  "Ambessa": { ja: "アンベッサ", ruby: "あんべっさ" },
  "Amumu": { ja: "アムム", ruby: "あむむ" },
  "Anivia": { ja: "アニビア", ruby: "あにびあ" },
  "Annie": { ja: "アニー", ruby: "あに" },
  "Aphelios": { ja: "アフェリオス", ruby: "あふぇりおす" },
  "Ashe": { ja: "アッシュ", ruby: "あっしゅ" },
  "AurelionSol": { ja: "オレリオン・ソル", ruby: "おれりおんそる" },
  "Aurora": { ja: "オーロラ", ruby: "おろら" },
  "Azir": { ja: "アジール", ruby: "あじる" },
  "Bard": { ja: "バード", ruby: "ばど" },
  "Belveth": { ja: "ベル＝ヴェス", ruby: "べるゔぇす" },
  "Blitzcrank": { ja: "ブリッツクランク", ruby: "ぶりっつくらんく" },
  "Brand": { ja: "ブランド", ruby: "ぶらんど" },
  "Braum": { ja: "ブラウム", ruby: "ぶらうむ" },
  "Briar": { ja: "ブライアー", ruby: "ぶらいあ" },
  "Caitlyn": { ja: "ケイトリン", ruby: "けいとりん" },
  "Camille": { ja: "カミール", ruby: "かみる" },
  "Cassiopeia": { ja: "カシオペア", ruby: "かしおぺあ" },
  "Chogath": { ja: "チョ＝ガス", ruby: "ちょがす" },
  "Corki": { ja: "コーキ", ruby: "こき" },
  "Darius": { ja: "ダリウス", ruby: "だりうす" },
  "Diana": { ja: "ダイアナ", ruby: "だいあな" },
  "DrMundo": { ja: "ドクター・ムンド", ruby: "どくたむんど" },
  "Draven": { ja: "ドレイヴン", ruby: "どれいゔん" },
  "Ekko": { ja: "エコー", ruby: "えこ" },
  "Elise": { ja: "エリス", ruby: "えりす" },
  "Evelynn": { ja: "イブリン", ruby: "いぶりん" },
  "Ezreal": { ja: "エズリアル", ruby: "えずりある" },
  "Fiddlesticks": { ja: "フィドルスティックス", ruby: "ふぃどるすてぃっくす" },
  "Fiora": { ja: "フィオラ", ruby: "ふぃおら" },
  "Fizz": { ja: "フィズ", ruby: "ふぃず" },
  "Galio": { ja: "ガリオ", ruby: "がりお" },
  "Gangplank": { ja: "ガングプランク", ruby: "がんぐぷらんく" },
  "Garen": { ja: "ガレン", ruby: "がれん" },
  "Gnar": { ja: "ナー", ruby: "な" },
  "Gragas": { ja: "グラガス", ruby: "ぐらがす" },
  "Graves": { ja: "グレイブス", ruby: "ぐれいぶす" },
  "Gwen": { ja: "グウェン", ruby: "ぐうぇん" },
  "Hecarim": { ja: "ヘカリム", ruby: "へかりむ" },
  "Heimerdinger": { ja: "ハイマーディンガー", ruby: "はいまでぃんが" },
  "Hwei": { ja: "フェイ", ruby: "ふぇい" },
  "Illaoi": { ja: "イラオイ", ruby: "いらおい" },
  "Irelia": { ja: "イレリア", ruby: "いれりあ" },
  "Ivern": { ja: "アイバーン", ruby: "あいばん" },
  "Janna": { ja: "ジャンナ", ruby: "じゃんな" },
  "JarvanIV": { ja: "ジャーヴァンⅣ", ruby: "じゃゔぁん" },
  "Jax": { ja: "ジャックス", ruby: "じゃっくす" },
  "Jayce": { ja: "ジェイス", ruby: "じぇいす" },
  "Jhin": { ja: "ジン", ruby: "じん" },
  "Jinx": { ja: "ジンクス", ruby: "じんくす" },
  "KSante": { ja: "カ・サンテ", ruby: "かさんて" },
  "Kaisa": { ja: "カイ＝サ", ruby: "かいさ" },
  "Kalista": { ja: "カリスタ", ruby: "かりすた" },
  "Karma": { ja: "カルマ", ruby: "かるま" },
  "Karthus": { ja: "カーサス", ruby: "かさす" },
  "Kassadin": { ja: "カサディン", ruby: "かさでぃん" },
  "Katarina": { ja: "カタリナ", ruby: "かたりな" },
  "Kayle": { ja: "ケイル", ruby: "けいる" },
  "Kayn": { ja: "ケイン", ruby: "けいん" },
  "Kennen": { ja: "ケネン", ruby: "けねん" },
  "Khazix": { ja: "カ＝ジックス", ruby: "かじっくす" },
  "Kindred": { ja: "キンドレッド", ruby: "きんどれっど" },
  "Kled": { ja: "クレッド", ruby: "くれっど" },
  "KogMaw": { ja: "コグ＝マウ", ruby: "こぐまう" },
  "Leblanc": { ja: "ルブラン", ruby: "るぶらん" },
  "LeeSin": { ja: "リー・シン", ruby: "りしん" },
  "Leona": { ja: "レオナ", ruby: "れおな" },
  "Lillia": { ja: "リリア", ruby: "りりあ" },
  "Lissandra": { ja: "リサンドラ", ruby: "りさんどら" },
  "Locke": { ja: "ロック", ruby: "ろっく" },
  "Lucian": { ja: "ルシアン", ruby: "るしあん" },
  "Lulu": { ja: "ルル", ruby: "るる" },
  "Lux": { ja: "ラックス", ruby: "らっくす" },
  "Malphite": { ja: "マルファイト", ruby: "まるふぁいと" },
  "Malzahar": { ja: "マルザハール", ruby: "まるざはる" },
  "Maokai": { ja: "マオカイ", ruby: "まおかい" },
  "MasterYi": { ja: "マスター・イー", ruby: "ますたい" },
  "Mel": { ja: "メル", ruby: "める" },
  "Milio": { ja: "ミリオ", ruby: "みりお" },
  "MissFortune": { ja: "ミス・フォーチュン", ruby: "みすふぉちゅん" },
  "Mordekaiser": { ja: "モルデカイザー", ruby: "もるでかいざ" },
  "Morgana": { ja: "モルガナ", ruby: "もるがな" },
  "Naafiri": { ja: "ナフィーリ", ruby: "なふぃり" },
  "Nami": { ja: "ナミ", ruby: "なみ" },
  "Nasus": { ja: "ナサス", ruby: "なさす" },
  "Nautilus": { ja: "ノーチラス", ruby: "のちらす" },
  "Neeko": { ja: "ニーコ", ruby: "にこ" },
  "Nidalee": { ja: "ニダリー", ruby: "にだり" },
  "Nilah": { ja: "ニーラ", ruby: "にら" },
  "Nocturne": { ja: "ノクターン", ruby: "のくたん" },
  "Nunu": { ja: "ヌヌ＆ウィルンプ", ruby: "ぬぬうぃるんぷ" },
  "Olaf": { ja: "オラフ", ruby: "おらふ" },
  "Orianna": { ja: "オリアナ", ruby: "おりあな" },
  "Ornn": { ja: "オーン", ruby: "おん" },
  "Pantheon": { ja: "パンテオン", ruby: "ぱんておん" },
  "Poppy": { ja: "ポッピー", ruby: "ぽっぴ" },
  "Pyke": { ja: "パイク", ruby: "ぱいく" },
  "Qiyana": { ja: "キヤナ", ruby: "きやな" },
  "Quinn": { ja: "クイン", ruby: "くいん" },
  "Rakan": { ja: "ラカン", ruby: "らかん" },
  "Rammus": { ja: "ラムス", ruby: "らむす" },
  "RekSai": { ja: "レク＝サイ", ruby: "れくさい" },
  "Rell": { ja: "レル", ruby: "れる" },
  "Renata": { ja: "レナータ・グラスク", ruby: "れなたぐらすく" },
  "Renekton": { ja: "レネクトン", ruby: "れねくとん" },
  "Rengar": { ja: "レンガー", ruby: "れんが" },
  "Riven": { ja: "リヴェン", ruby: "りゔぇん" },
  "Rumble": { ja: "ランブル", ruby: "らんぶる" },
  "Ryze": { ja: "ライズ", ruby: "らいず" },
  "Samira": { ja: "サミーラ", ruby: "さみら" },
  "Sejuani": { ja: "セジュアニ", ruby: "せじゅあに" },
  "Senna": { ja: "セナ", ruby: "せな" },
  "Seraphine": { ja: "セラフィーン", ruby: "せらふぃん" },
  "Sett": { ja: "セト", ruby: "せと" },
  "Shaco": { ja: "シャコ", ruby: "しゃこ" },
  "Shen": { ja: "シェン", ruby: "しぇん" },
  "Shyvana": { ja: "シヴァーナ", ruby: "しゔぁな" },
  "Singed": { ja: "シンジド", ruby: "しんじど" },
  "Sion": { ja: "サイオン", ruby: "さいおん" },
  "Sivir": { ja: "シヴィア", ruby: "しゔぃあ" },
  "Skarner": { ja: "スカーナー", ruby: "すかな" },
  "Smolder": { ja: "スモルダー", ruby: "すもるだ" },
  "Sona": { ja: "ソナ", ruby: "そな" },
  "Soraka": { ja: "ソラカ", ruby: "そらか" },
  "Swain": { ja: "スウェイン", ruby: "すうぇいん" },
  "Sylas": { ja: "サイラス", ruby: "さいらす" },
  "Syndra": { ja: "シンドラ", ruby: "しんどら" },
  "TahmKench": { ja: "タム・ケンチ", ruby: "たむけんち" },
  "Taliyah": { ja: "タリヤ", ruby: "たりや" },
  "Talon": { ja: "タロン", ruby: "たろん" },
  "Taric": { ja: "タリック", ruby: "たりっく" },
  "Teemo": { ja: "ティーモ", ruby: "てぃも" },
  "Thresh": { ja: "スレッシュ", ruby: "すれっしゅ" },
  "Tristana": { ja: "トリスターナ", ruby: "とりすたな" },
  "Trundle": { ja: "トランドル", ruby: "とらんどる" },
  "Tryndamere": { ja: "トリンダメア", ruby: "とりんだめあ" },
  "TwistedFate": { ja: "ツイステッド・フェイト", ruby: "ついすてっどふぇいと" },
  "Twitch": { ja: "トゥイッチ", ruby: "とぅいっち" },
  "Udyr": { ja: "ウディア", ruby: "うでぃあ" },
  "Urgot": { ja: "アーゴット", ruby: "あごっと" },
  "Varus": { ja: "ヴァルス", ruby: "ゔぁるす" },
  "Vayne": { ja: "ヴェイン", ruby: "ゔぇいん" },
  "Veigar": { ja: "ベイガー", ruby: "べいが" },
  "Velkoz": { ja: "ヴェル＝コズ", ruby: "ゔぇるこず" },
  "Vex": { ja: "ヴェックス", ruby: "ゔぇっくす" },
  "Vi": { ja: "ヴァイ", ruby: "ゔぁい" },
  "Viego": { ja: "ヴィエゴ", ruby: "ゔぃえご" },
  "Viktor": { ja: "ビクター", ruby: "びくた" },
  "Vladimir": { ja: "ブラッドミア", ruby: "ぶらっどみあ" },
  "Volibear": { ja: "ボリベア", ruby: "ぼりべあ" },
  "Warwick": { ja: "ワーウィック", ruby: "わうぃっく" },
  "Wukong": { ja: "ウーコン", ruby: "うこん" },
  "Xayah": { ja: "ザヤ", ruby: "ざや" },
  "Xerath": { ja: "ゼラス", ruby: "ぜらす" },
  "XinZhao": { ja: "シン・ジャオ", ruby: "しんじゃお" },
  "Yasuo": { ja: "ヤスオ", ruby: "やすお" },
  "Yone": { ja: "ヨネ", ruby: "よね" },
  "Yorick": { ja: "ヨリック", ruby: "よりっく" },
  "Yunara": { ja: "ユナラ", ruby: "ゆなら" },
  "Yuumi": { ja: "ユーミ", ruby: "ゆみ" },
  "Zaahen": { ja: "ザーヘン", ruby: "ざへん" },
  "Zac": { ja: "ザック", ruby: "ざっく" },
  "Zed": { ja: "ゼド", ruby: "ぜど" },
  "Zeri": { ja: "ゼリ", ruby: "ぜり" },
  "Ziggs": { ja: "ジグス", ruby: "じぐす" },
  "Zilean": { ja: "ジリアン", ruby: "じりあん" },
  "Zoe": { ja: "ゾーイ", ruby: "ぞい" },
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
      onSelect(champ);
      setSearchTerm('');
      onChange('');
    } else {
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
                className="w-8 h-8 rounded-full border border-white/10 shadow-sm"
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