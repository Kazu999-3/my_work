// 知識レビュー画面（/admin/review）の型と定数。
// 2026-10-07: page.tsx（1,691行）から分割。

export type LaneKey = 'JG' | 'TOP' | 'MID' | 'ADC' | 'SUP' | 'COMMON';

export interface ReviewItem {
  id: number;
  title: string;
  content: string;
  champion: string | null;
  currentChampNamesJa?: string;
  is_atomic: boolean;
  source_url: string | null;
  channel: string;
  char_count: number;
  created_at: string;
  parentTitle: string | null;
  isLaneGeneral: boolean;
  tags?: string[];
  detectedLane: LaneKey;
  laneLabel: string;
  isLaneMacro: boolean;
  macroReason: string;
  detectedChampions: string[];
  detectedChampionsJa: string;
  isMatchup?: boolean;
  enemyChampion?: string | null;
  enemyChampionJa?: string | null;
  matchupLabel?: string | null;
  /** 再解析で作った版なら元の記事の ID（2026-10-19） */
  reanalysis_of?: number | null;
  analysis_meta?: AnalysisMeta | null;
  /** 中身の濃さの目印（lib/articleDensity.ts） */
  density?: DensityInfo;
  /** 進行中・失敗した再解析の依頼 */
  reanalysisTask?: { status: string; error: string | null; createdAt: string } | null;
  /** 再解析版の元の記事（新旧比較用） */
  reanalysisOriginal?: { id: number; title: string; content: string; density: DensityInfo } | null;
}

export interface DensityInfo {
  level: 'thin' | 'ok';
  specificPer1k: number;
  genericPer1k: number;
  bodyChars: number;
  reasons: string[];
  legacyTemplate: boolean;
  factCount: number | null;
  truncated?: boolean;
  /** 承認の目安（lib/articleDensity.ts）。approve=承認候補 / check=要確認 / skip=見送り候補 */
  triage?: 'approve' | 'check' | 'skip';
  triageReasons?: string[];
}

export interface AnalysisMeta {
  prompt_version?: string;
  model?: string;
  video_type?: string;
  fact_count?: number;
  facts_with_reason?: number;
  facts_with_numbers?: number;
  facts_with_ts?: number;
  uncertain_count?: number;
  categories?: Record<string, number>;
  not_covered?: string[];
  /** 字幕から抽出した事実（2026-10-20 以降に作った記事のみ） */
  facts?: { category: string | null; claim: string | null; condition: string | null; reason: string | null; numbers: string | null; ts: string | null; uncertain: boolean }[];
  reanalysis?: { reason?: string; focus?: string[]; note?: string; source?: string; requested_model?: string };
}

/** 再解析の理由（scripts/article_pipeline.py の REASONS と同じキー） */
export const REANALYZE_REASONS: { key: string; label: string }[] = [
  { key: 'thin', label: '全体的に薄い（一般論ばかり）' },
  { key: 'focus', label: '特定の観点をもっと深く' },
  { key: 'generic', label: '動画と関係ない内容が混じっている' },
  { key: 'wrong', label: '誤り・聞き間違いがある' },
  { key: 'other', label: 'その他（メモに書く）' },
];

/** 深掘りしたい観点（scripts/article_pipeline.py の CATEGORIES と同じキー） */
export const REANALYZE_FOCUS: { key: string; label: string }[] = [
  { key: 'build', label: 'ビルド・ルーン' },
  { key: 'skill', label: 'スキル・コンボ' },
  { key: 'laning', label: 'レーン戦' },
  { key: 'jungle', label: 'JGの周回・ガンク' },
  { key: 'objective', label: 'オブジェクト・視界' },
  { key: 'macro', label: '試合運び' },
  { key: 'teamfight', label: '集団戦' },
  { key: 'matchup', label: '対面・相性' },
  { key: 'mindset', label: '考え方・ミス' },
];

export interface ReanalyzeRequest {
  reason: string;
  focus: string[];
  note: string;
  model: 'standard' | 'high';
}

export interface RosterChampion { id: string; name: string }

export interface ItemEditState {
  champion: string;
  enemyChampion: string;
  title: string;
  content: string;
  lane: LaneKey;
  includeLaneGuide: boolean;
  includeFactMerge: boolean;
}

export interface FactFieldDiff {
  key: string;
  label: string;
  before: string;
  after: string;
  isChanged: boolean;
}

export interface ChampionFactPreview {
  champion: string;
  championNameJa: string;
  diffs: FactFieldDiff[];
  addedHighlights: string[];
  error?: string;
}

export interface PreviewResult {
  championPreviews: {
    id: string;
    name: string;
    matchupId: string;
    sectionText: string;
  }[];
  matchupPreviews?: {
    matchupId: string;
    champion: string;
    championJa: string;
    enemy: string;
    enemyJa: string;
    lane: LaneKey;
    sectionText: string;
  }[];
  factPreviews?: ChampionFactPreview[];
  laneGuidePreview: {
    lane: LaneKey;
    laneLabel: string;
    sectionText: string;
    existingBody?: string;
    mergedBody?: string;
    sourceCount?: number;
    /** AI抽出の失敗理由（2026-10-06）。全文の流用はせず、空欄のまま承認すると承認時に再抽出を試みる */
    error?: string | null;
  } | null;
}

/** 項目マージの新規追記行の宛先（辞典 / レーンガイド / 除外） */
export type LineDestination = 'champion' | 'lane' | 'skip';

export const LANE_OPTIONS: { key: LaneKey; label: string; icon: string }[] = [
  { key: 'COMMON', label: '🌐 共通マクロ', icon: '🌐' },
  { key: 'TOP', label: '⚔️ TOP', icon: '⚔️' },
  { key: 'JG', label: '🌲 JG', icon: '🌲' },
  { key: 'MID', label: '⚡ MID', icon: '⚡' },
  { key: 'ADC', label: '🏹 ADC/BOT', icon: '🏹' },
  { key: 'SUP', label: '🛡️ SUP', icon: '🛡️' },
];

/** 編集ステートが未作成の記事に使う既定値（自動判定の結果から作る） */
export function defaultEdit(item: ReviewItem): ItemEditState {
  return {
    champion: item.currentChampNamesJa || '',
    enemyChampion: item.enemyChampionJa || item.enemyChampion || '',
    title: item.title,
    content: item.content,
    lane: item.detectedLane,
    includeLaneGuide: item.isLaneMacro,
    includeFactMerge: true,
  };
}
