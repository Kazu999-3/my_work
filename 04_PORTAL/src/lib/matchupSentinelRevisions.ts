import { recordRevision } from './knowledgeRevisions';

// 辞典本体（matchup_sentinel）は書き込み経路が10箇所以上に分散しているため、
// 各経路がそれぞれ差分ロジックを持たずに済むよう、この1関数に集約する。
// target_key には matchup_id（例: champ_Graves_global）を使う。全経路が
// upsert 時に on_conflict=matchup_id を使っており、この値だけは共通のため。

const TOP_LEVEL_FIELDS = ['title', 'strategy'] as const;

// raw_data(JSONB)内で「辞典の記載内容」として意味のあるフィールドのみ追跡する。
// source/role/is_favorited等のメタ情報は履歴として意味が薄いため対象外。
const RAW_DATA_FIELDS = [
  'strengths', 'weaknesses', 'powerSpikes', 'buildRunes', 'fullClearTime',
  'counterChampions', 'mustBanChampions', 'pickRecommendation',
  'note_draft', 'jg_style', 'patch_meta', 'pro_builds', 'customFields',
  // 個別対面メモ（enemy≠GLOBAL）専用フィールド
  'winCondition', 'earlyGame', 'firstClear', 'counterJg',
] as const;

function toText(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

export interface MatchupSentinelRow {
  title?: string | null;
  strategy?: string | null;
  raw_data?: Record<string, any> | null;
}

/**
 * matchup_sentinel の更新前後を比較し、変化のあったフィールドだけ履歴を残す。
 * before が null（新規作成）の場合は全フィールドが「新規作成」扱いになる。
 */
export async function recordMatchupSentinelRevision(
  matchupId: string,
  before: MatchupSentinelRow | null | undefined,
  after: MatchupSentinelRow,
  sourceTitle?: string | null,
  sourceId?: string | number | null,
): Promise<void> {
  const beforeRaw = before?.raw_data || {};
  const afterRaw = after.raw_data || {};

  for (const field of TOP_LEVEL_FIELDS) {
    if (after[field] === undefined) continue;
    await recordRevision({
      targetType: 'matchup_sentinel',
      targetKey: matchupId,
      field,
      before: before ? toText(before[field]) : null,
      after: toText(after[field]),
      sourceTitle,
      sourceId,
    });
  }

  for (const field of RAW_DATA_FIELDS) {
    if (afterRaw[field] === undefined) continue;
    await recordRevision({
      targetType: 'matchup_sentinel',
      targetKey: matchupId,
      field,
      before: before ? toText(beforeRaw[field]) : null,
      after: toText(afterRaw[field]),
      sourceTitle,
      sourceId,
    });
  }
}
