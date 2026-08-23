import { supabaseAdmin } from './supabaseAdmin';

// チャンピオン辞典・レーン別ガイドの更新履歴。
// 統合はAIが本文ごと書き直すので、直前の本文を残しておかないと差分が復元できない。

export type RevisionTarget = 'lane_guide' | 'champion_fact' | 'matchup_sentinel' | 'champion_notes';

export interface RevisionInput {
  targetType: RevisionTarget;
  targetKey: string;              // lane（TOP等） or champion名
  field?: string;                 // 辞典の項目名。ガイド本文は 'body'
  before: string | null | undefined;
  after: string;
  sourceTitle?: string | null;    // 取り込んだ記事のタイトル
  sourceId?: string | number | null;
}

/**
 * 履歴を1件残す。
 * 記録に失敗しても本来の統合処理は止めない（履歴はあくまで補助情報のため）。
 */
export async function recordRevision(input: RevisionInput): Promise<void> {
  try {
    const before = input.before == null ? null : String(input.before);
    const after = String(input.after ?? '');
    if (before === after) return; // 変化が無ければ履歴を作らない

    await supabaseAdmin.from('knowledge_revisions').insert({
      target_type: input.targetType,
      target_key: input.targetKey,
      field: input.field || 'body',
      before_text: before,
      after_text: after,
      source_title: input.sourceTitle || null,
      source_id: input.sourceId == null ? null : String(input.sourceId),
    });
  } catch (e) {
    console.warn('[knowledgeRevisions] 履歴の保存に失敗:', e);
  }
}

export { diffLines, diffSummary, type DiffLine, type DiffOp } from './diffUtils';
