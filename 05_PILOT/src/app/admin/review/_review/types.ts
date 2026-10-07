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
}

export interface RosterChampion { id: string; name: string }

export interface ItemEditState {
  champion: string;
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
    title: item.title,
    content: item.content,
    lane: item.detectedLane,
    includeLaneGuide: item.isLaneMacro,
    includeFactMerge: true,
  };
}
