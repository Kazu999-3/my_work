import { resolveRosterChampion, getRoster } from './championRoster';

export type LaneKey = 'JG' | 'TOP' | 'MID' | 'ADC' | 'SUP' | 'COMMON';

export interface LaneDetectionResult {
  lane: LaneKey;
  laneLabel: string;
  isLaneMacro: boolean;
  macroReason: string;
  detectedChampions: string[];
}

export const LANE_CONFIG: Record<LaneKey, { label: string; icon: string; name: string }> = {
  COMMON: { label: '🌐 全レーン共通マクロ', icon: '🌐', name: '共通マクロ' },
  TOP: { label: '⚔️ TOP レーン攻略', icon: '⚔️', name: 'TOP' },
  JG: { label: '🌲 JG ジャングル攻略', icon: '🌲', name: 'JG' },
  MID: { label: '⚡ MID レーン攻略', icon: '⚡', name: 'MID' },
  ADC: { label: '🏹 BOT/ADC レーン攻略', icon: '🏹', name: 'ADC' },
  SUP: { label: '🛡️ SUP サポート攻略', icon: '🛡️', name: 'SUP' },
};

// チャンピオンのデフォルトレーン簡易マップ（主要代表チャンプ）
const CHAMP_DEFAULT_LANE: Record<string, LaneKey> = {
  // JG
  Nocturne: 'JG', JarvanIV: 'JG', LeeSin: 'JG', Viego: 'JG', Graves: 'JG',
  Lillia: 'JG', Amumu: 'JG', Shyvana: 'JG', Khazix: 'JG', Kindred: 'JG',
  XinZhao: 'JG', MonkeyKing: 'JG', Elise: 'JG', Evelynn: 'JG', Hecarim: 'JG',
  Nidalee: 'JG', RekSai: 'JG', Sejuani: 'JG', Vi: 'JG', Warwick: 'JG', Zac: 'JG',
  // TOP
  Darius: 'TOP', Jax: 'TOP', Fiora: 'TOP', Aatrox: 'TOP', Renekton: 'TOP',
  Camille: 'TOP', Garen: 'TOP', Sett: 'TOP', Mordekaiser: 'TOP', Jayce: 'TOP',
  Kennen: 'TOP', Ornn: 'TOP', Malphite: 'TOP', Riven: 'TOP', Sion: 'TOP',
  // MID
  Ahri: 'MID', Zed: 'MID', Yasuo: 'MID', Yone: 'MID', Syndra: 'MID',
  Orianna: 'MID', Viktor: 'MID', LeBlanc: 'MID', Akali: 'MID', Katarina: 'MID',
  Sylas: 'MID', TwistedFate: 'MID', Veigar: 'MID', Azir: 'MID', Hwei: 'MID',
  // ADC
  Jinx: 'ADC', Kaisa: 'ADC', Ezreal: 'ADC', Vayne: 'ADC', Caitlyn: 'ADC',
  Aphelios: 'ADC', Jhin: 'ADC', Ashe: 'ADC', Lucian: 'ADC', Xayah: 'ADC',
  // SUP
  Thresh: 'SUP', Blitzcrank: 'SUP', Nautilus: 'SUP', Leona: 'SUP', Lulu: 'SUP',
  Nami: 'SUP', Yuumi: 'SUP', Pyke: 'SUP', Rakan: 'SUP', Janna: 'SUP',
};

// レーン判定キーワード
const LANE_KEYWORDS: Record<LaneKey, RegExp[]> = {
  JG: [
    /\b(jg|jungle|jungler)\b/i,
    /ジャングル|ジャングラー|カジャン|カウンタージャングル|フルクリア|初動ルート|ガンク|スカトル|赤バフ|青バフ|スマイト|オブジェクト管理|バロン判断/i,
  ],
  TOP: [
    /\b(top|toplane|toplaner)\b/i,
    /トップレーン|トップレーナー|スプリットプッシュ|ウェーブフリーズ|テレポート|tp判断|1v1|タワーダイブ/i,
  ],
  MID: [
    /\b(mid|midlane|midlaner)\b/i,
    /ミッドレーン|ミッドレーナー|ローム|サイド介入|プッシュ主導権|視界確保/i,
  ],
  ADC: [
    /\b(adc|bot|botlane|marksman)\b/i,
    /ボットレーン|マークスマン|adc|ラストヒット|集団戦ポジショニング|カイト|2v2/i,
  ],
  SUP: [
    /\b(sup|support)\b/i,
    /サポート|sup|ロームタイミング|視界支配|ワード|デワード|エンゲージ|ピール/i,
  ],
  COMMON: [
    /キャリー理論|メンタル|上達の原則|マクロの極意|勝率up|ランク(登頂|1位|を上げる)|共通マクロ|集団戦マクロ/i,
  ],
};

// レーンマクロ・普遍的知見の判定キーワード
const MACRO_KEYWORDS = [
  /マクロ|ルート|立ち回り|判断|思考プロセス|セオリー|勝ち方|キャリー理論|ウェーブ|視界|ガンク|ローム|ダイブ|リコール|オブジェクト|メンタル|極意|真髄|完全攻略/i,
];

/**
 * 記事のタイトル・本文・タグ・チャンピオンから、
 * 該当レーン、普遍的マクロを含むか、関与する複数チャンピオンを自動判定する
 */
export async function detectArticleLane(article: {
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
  champion?: string | null;
}): Promise<LaneDetectionResult> {
  const title = String(article.title || '');
  const content = String(article.content || '').slice(0, 1500); // 冒頭部分で十分
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const tagStr = tags.join(' ');
  const fullText = `${title} ${tagStr} ${content}`;

  // 1. 関与チャンピオンの検出
  const detectedChampions: string[] = [];
  // 既存の champion カラムを解決
  if (article.champion && article.champion !== 'Unknown') {
    for (const part of article.champion.split(/[,、/|]\s*|\s+/)) {
      const id = await resolveRosterChampion(part);
      if (id && !detectedChampions.includes(id)) detectedChampions.push(id);
    }
  }

  // タグやタイトルから追加チャンピオンを検出
  const roster = await getRoster().catch(() => []);
  for (const tag of tags) {
    const id = await resolveRosterChampion(tag);
    if (id && !detectedChampions.includes(id)) detectedChampions.push(id);
  }

  // 2. レーンのスコアリング判定
  const scores: Record<LaneKey, number> = {
    COMMON: 0,
    TOP: 0,
    JG: 0,
    MID: 0,
    ADC: 0,
    SUP: 0,
  };

  // タグによるスコア（高配点）
  for (const tag of tags) {
    const t = tag.toUpperCase();
    if (t === 'JG' || t === 'JUNGLE' || t === 'ジャングル') scores.JG += 5;
    if (t === 'TOP' || t === 'TOPLANE' || t === 'トップ') scores.TOP += 5;
    if (t === 'MID' || t === 'MIDLANE' || t === 'ミッド') scores.MID += 5;
    if (t === 'ADC' || t === 'BOT' || t === 'BOTLANE' || t === 'MARKSMAN') scores.ADC += 5;
    if (t === 'SUP' || t === 'SUPPORT' || t === 'サポート') scores.SUP += 5;
    if (t === 'MACRO' || t === 'マクロ' || t === 'キャリー理論') scores.COMMON += 3;
  }

  // タイトルによるスコア（中配点）
  for (const [lane, regexes] of Object.entries(LANE_KEYWORDS) as [LaneKey, RegExp[]][]) {
    for (const rx of regexes) {
      if (rx.test(title)) scores[lane] += 3;
      if (rx.test(content)) scores[lane] += 1;
    }
  }

  // 検出されたチャンピオンの主レーン（補助点）
  for (const champ of detectedChampions) {
    const defaultLane = CHAMP_DEFAULT_LANE[champ];
    if (defaultLane) scores[defaultLane] += 2;
  }

  // 最もスコアの高いレーンを選定
  let bestLane: LaneKey = 'COMMON';
  let maxScore = 0;
  for (const [lane, score] of Object.entries(scores) as [LaneKey, number][]) {
    if (score > maxScore) {
      maxScore = score;
      bestLane = lane;
    }
  }

  // スコアが0で、チャンピオンのデフォルトレーンがあればそれを採用
  if (maxScore === 0 && detectedChampions.length > 0) {
    const fallback = CHAMP_DEFAULT_LANE[detectedChampions[0]];
    if (fallback) bestLane = fallback;
  }

  // 3. レーンマクロ・普遍的知見の判定
  let isLaneMacro = false;
  let macroReason = '';

  const hasMacroWord = MACRO_KEYWORDS.some((rx) => rx.test(title) || rx.test(tagStr));
  if (hasMacroWord) {
    isLaneMacro = true;
    macroReason = 'タイトルまたはタグにマクロ・立ち回り等の普遍的知見キーワードが含まれています';
  } else if (detectedChampions.length === 0) {
    // チャンピオンが未指定なら無条件でレーン一般論
    isLaneMacro = true;
    macroReason = '特定チャンピオンが指定されていないため、レーン一般論として扱われます';
  } else if (maxScore >= 4) {
    // 特定レーンへの言及スコアが高い場合
    isLaneMacro = true;
    macroReason = `${LANE_CONFIG[bestLane].name}のセオリー・マクロ解説が含まれています`;
  }

  return {
    lane: bestLane,
    laneLabel: LANE_CONFIG[bestLane].label,
    isLaneMacro,
    macroReason,
    detectedChampions,
  };
}
