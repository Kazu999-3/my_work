// チャンピオン自動推定エンジン（2026-10-26 新設）
// タイトルや要約から主役チャンピオンおよび対面相手（vs ...）を高精度に検出する。

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

export const CHAMP_EXTRA_ALIASES: Record<string, string[]> = {
  Chogath: ['チョガス', 'ちょがす', 'chogath', "cho'gath", 'チョ＝ガス'],
  MasterYi: ['マスターイー', 'マスター・イー', 'ますたーいー', 'master yi', 'yi'],
  Khazix: ['カジックス', 'カ＝ジックス', 'かじっくす', "kha'zix", 'khazix'],
  Kaisa: ['カイサ', 'カイ＝サ', 'かいさ', "kai'sa", 'kaisa'],
  Velkoz: ['ヴェルコズ', 'ヴェル＝コズ', 'ゔぇるこず', "vel'koz", 'velkoz'],
  RekSai: ['レクサイ', 'レク＝サイ', 'れくさい', "rek'sai", 'reksai'],
  Belveth: ['ベルヴェス', 'ベル＝ヴェス', 'べるゔぇす', "bel'veth", 'belveth'],
  KogMaw: ['コグマウ', 'コグ＝マウ', 'こぐまう', "kog'maw", 'kogmaw'],
  XinZhao: ['シンジャオ', 'シン・ジャオ', 'しんじゃお', 'xin zhao', 'xinzhao'],
  LeeSin: ['リーシン', 'リー・シン', 'りーしん', 'lee sin', 'leesin'],
  JarvanIV: ['ジャーヴァン', 'ジャーヴァン4', 'ジャーヴァンⅣ', 'j4', 'jarvan'],
  DrMundo: ['ムンド', 'ドクタームンド', 'ドクター・ムンド', 'mundo'],
  AurelionSol: ['オレソル', 'エーソル', 'オレリオンソル', 'オレリオン・ソル', 'asol'],
  TahmKench: ['タムケンチ', 'タム・ケンチ', 'たむけんち', 'tahm'],
  TwistedFate: ['ツイフェイ', 'ツイステッドフェイト', 'ツイステッド・フェイト', 'tf'],
  MissFortune: ['ミスフォ', 'ミスフォーチュン', 'ミス・フォーチュン', 'mf'],
  MonkeyKing: ['ウーコン', 'うーこん', 'wukong', 'monkeyking'],
  Mordekaiser: ['モルデ', 'モルデカイザー', 'morde'],
  Tryndamere: ['トリン', 'トリンダメア', 'trynd', 'tryndamere'],
  Blitzcrank: ['ブリッツ', 'ブリッツクランク', 'blitz'],
  Nautilus: ['ノーチ', 'ノーチラス', 'naut'],
  Qiyana: ['キアナ', 'キヤナ', 'qiyana'],
  Corki: ['コーキ', 'corki'],
};

export interface DetectedChampion {
  id: string;
  nameJa: string;
}

export interface DetectionResult {
  main?: DetectedChampion;
  enemy?: DetectedChampion;
}

interface MatchCandidate {
  id: string;
  nameJa: string;
  index: number;
  length: number;
  isVsContext: boolean;
}

/** テキストからチャンピオンの出現位置をすべて走査する */
function scanChampions(text: string): MatchCandidate[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const results: MatchCandidate[] = [];

  for (const [id, info] of Object.entries(CHAMPION_JA)) {
    const terms = new Set<string>();
    terms.add(id.toLowerCase());
    terms.add(info.ja.toLowerCase());
    terms.add(info.ja.replace(/[・＝＝\-]/g, '').toLowerCase());

    const aliases = CHAMP_EXTRA_ALIASES[id];
    if (aliases) {
      for (const a of aliases) {
        terms.add(a.toLowerCase());
      }
    }

    for (const term of terms) {
      if (term.length < 2) continue;
      let pos = 0;
      while ((pos = lower.indexOf(term, pos)) !== -1) {
        // ★ 誤爆防止ガード 1: 英字のみの用語（例: 'vi'）は、前後に英字が連続している場合は単語の一部なので除外（例: 'Evi' や 'advice'）
        if (/^[a-z0-9]+$/i.test(term)) {
          const charBefore = pos > 0 ? lower[pos - 1] : '';
          const charAfter = pos + term.length < lower.length ? lower[pos + term.length] : '';
          if (/[a-z0-9]/i.test(charBefore) || /[a-z0-9]/i.test(charAfter)) {
            pos += term.length;
            continue;
          }
        }

        // ★ 誤爆防止ガード 2: カタカナ用語（例: 'ルル', 'セト', 'ザヤ', 'シェン'）は、前後にカタカナが続く場合は単語の一部なので除外（例: 'リセット' の 'セト' や 'スルー'）
        if (/^[\u30A0-\u30FFー]+$/.test(term)) {
          const charBefore = pos > 0 ? text[pos - 1] : '';
          const charAfter = pos + term.length < text.length ? text[pos + term.length] : '';
          if (/[\u30A0-\u30FFー]/.test(charBefore) || /[\u30A0-\u30FFー]/.test(charAfter)) {
            pos += term.length;
            continue;
          }
        }

        const windowStart = Math.max(0, pos - 15);
        const windowEnd = Math.min(lower.length, pos + term.length + 15);
        const surrounding = lower.slice(windowStart, windowEnd);
        const isVs = /vs|対面|相手|vs\.|対\s/.test(surrounding) && windowStart < pos;

        results.push({
          id,
          nameJa: info.ja,
          index: pos,
          length: term.length,
          isVsContext: isVs,
        });
        pos += term.length;
      }
    }
  }

  // 重複除去 ＆ より長い単語の一致を優先
  // （例: 'corki' と短い何かが重なった場合、長い方を採用）
  results.sort((a, b) => b.length - a.length);
  const filtered: MatchCandidate[] = [];
  for (const cand of results) {
    const overlaps = filtered.some(
      (f) => Math.max(f.index, cand.index) < Math.min(f.index + f.length, cand.index + cand.length)
    );
    if (!overlaps) {
      filtered.push(cand);
    }
  }

  return filtered.sort((a, b) => a.index - b.index);
}

/** タイトルおよび要約テキストから主役チャンプと対面チャンプを推定する */
export function detectChampionsFromText(title: string, summary?: string): DetectionResult {
  const titleMatches = scanChampions(title || '');

  // 1. タイトル内に明確な「A vs B」があるか検査
  // 例: 「コーキ vs トリンダメア」
  const vsPattern = /([^s]+)s*(?:vs.?|対面|対)s*([^s]+)/i;
  const vsMatch = (title || '').match(vsPattern);
  if (vsMatch) {
    const leftText = vsMatch[1];
    const rightText = vsMatch[2];
    const leftCand = scanChampions(leftText)[0];
    const rightCand = scanChampions(rightText)[0];

    if (leftCand && rightCand && leftCand.id !== rightCand.id) {
      return {
        main: { id: leftCand.id, nameJa: leftCand.nameJa },
        enemy: { id: rightCand.id, nameJa: rightCand.nameJa },
      };
    }
  }

  // 2. タイトル内の通常マッチから主役と対面を判定
  if (titleMatches.length > 0) {
    const mainCand = titleMatches.find((m) => !m.isVsContext) || titleMatches[0];
    const enemyCand = titleMatches.find((m) => m.id !== mainCand.id && (m.isVsContext || m.index > mainCand.index));

    return {
      main: { id: mainCand.id, nameJa: mainCand.nameJa },
      enemy: enemyCand ? { id: enemyCand.id, nameJa: enemyCand.nameJa } : undefined,
    };
  }

  // 3. タイトルで見つからなかった場合、要約テキストから探す
  if (summary) {
    const summaryMatches = scanChampions(summary);
    if (summaryMatches.length > 0) {
      const mainCand = summaryMatches[0];
      const enemyCand = summaryMatches.find((m) => m.id !== mainCand.id && m.isVsContext);
      return {
        main: { id: mainCand.id, nameJa: mainCand.nameJa },
        enemy: enemyCand ? { id: enemyCand.id, nameJa: enemyCand.nameJa } : undefined,
      };
    }
  }

  return {};
}
