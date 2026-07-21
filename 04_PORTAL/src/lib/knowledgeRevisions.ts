import { supabaseAdmin } from './supabaseAdmin';

// チャンピオン辞典・レーン別ガイドの更新履歴。
// 統合はAIが本文ごと書き直すので、直前の本文を残しておかないと差分が復元できない。

export type RevisionTarget = 'lane_guide' | 'champion_fact';

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

export type DiffOp = 'added' | 'removed' | 'same';
export interface DiffLine { op: DiffOp; text: string; }

/**
 * 行単位の差分。
 * AIは既存文を言い換えることがあるため、行の完全一致で追えるところだけを拾う
 * LCS（最長共通部分列）ベースの素直な実装にしている。
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = String(before || '').split('\n');
  const b = String(after || '').split('\n');

  // LCS長のテーブル。ガイド本文は数千字程度なので O(n*m) で問題ない。
  const n = a.length, m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: 'same', text: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ op: 'removed', text: a[i] }); i++; }
    else { out.push({ op: 'added', text: b[j] }); j++; }
  }
  while (i < n) { out.push({ op: 'removed', text: a[i] }); i++; }
  while (j < m) { out.push({ op: 'added', text: b[j] }); j++; }

  return out;
}

/** 差分の要約（追加/削除された行数）。一覧で「+12 / -3」のように出す用。 */
export function diffSummary(before: string, after: string): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const line of diffLines(before, after)) {
    if (!line.text.trim()) continue; // 空行はノイズなので数えない
    if (line.op === 'added') added++;
    else if (line.op === 'removed') removed++;
  }
  return { added, removed };
}
