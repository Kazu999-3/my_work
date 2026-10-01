'use client';

import { useState } from 'react';
import { Edit2, Trash2, Save, X, CheckCircle2 } from 'lucide-react';

export interface EditableSourceBlock {
  key: string;
  table: 'matchup_sentinel' | 'champion_notes' | 'champion_facts';
  id?: number;
  champion?: string;
  field: string;
  label: string;
  value: string;
  deletable: boolean;
}

// 一斉ファクトチェックのレビューで「AIが見た内容」を確認するだけでなく、
// その場で該当の元データ(対面メモ/コーチAIノート/構造化ファクト)を直接
// 書き換え・削除できるようにする。「訂正を記録」だけでは既存の誤った
// 文章そのものは残り続けてしまうため。
export default function FactCheckSourceBlock({
  block,
  onChanged,
  onPickAsCorrect,
}: {
  block: EditableSourceBlock;
  onChanged?: () => void;
  /** 矛盾(contradiction)のレビューで「この情報源の内容が正しい」と選んだ時に呼ばれる。
   *  A/Bどちらが正しいかをその場でワンクリックで選べるようにする(2026-08-05発覚:
   *  従来は毎回自由入力欄に手打ちする必要があった)。 */
  onPickAsCorrect?: (label: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.value);
  const [value, setValue] = useState(block.value);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/dict-fact-check/source', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: block.table, id: block.id, champion: block.champion, field: block.field, value: draft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '保存に失敗しました');
      setValue(draft);
      setEditing(false);
      onChanged?.();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirm(`「${block.label}」を完全に削除します。この操作は取り消せません。よろしいですか？`)) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/dict-fact-check/source', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: block.table, id: block.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '削除に失敗しました');
      setDeleted(true);
      onChanged?.();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const clearContent = async () => {
    if (!confirm(`「${block.label}」の記載内容をクリア（空文字に）して削除します。よろしいですか？`)) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/dict-fact-check/source', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: block.table, id: block.id, champion: block.champion, field: block.field, value: '' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '記載のクリアに失敗しました');
      setValue('');
      setDraft('');
      setEditing(false);
      onChanged?.();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (deleted) return null;

  return (
    <div className="rounded-lg border border-secondary-edge-soft bg-surface p-2.5 text-[11px]">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <span className="font-bold text-secondary-900">{block.label}</span>
        {!editing && (
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {onPickAsCorrect && (
              <button onClick={() => onPickAsCorrect(block.label, value)} className="text-success-700 hover:text-success-900 font-bold flex items-center gap-0.5">
                <CheckCircle2 size={11} /> これが正しい
              </button>
            )}
            <button onClick={() => { setDraft(value); setEditing(true); }} className="px-2 py-0.5 rounded bg-secondary-100 text-secondary-800 border border-secondary-edge-soft font-bold hover:bg-secondary-200 flex items-center gap-1 transition">
              <Edit2 size={11} /> ✏️ 修正
            </button>
            {block.deletable ? (
              <button onClick={remove} disabled={saving} className="px-2 py-0.5 rounded bg-danger-50 text-danger-700 border border-danger-edge-soft hover:bg-danger-100 font-bold flex items-center gap-0.5 disabled:opacity-50 transition">
                <Trash2 size={11} /> 記事を削除
              </button>
            ) : (
              <button onClick={clearContent} disabled={saving || !value} className="px-2 py-0.5 rounded bg-danger-50 text-danger-700 border border-danger-edge-soft hover:bg-danger-100 font-bold flex items-center gap-0.5 disabled:opacity-50 transition" title="このフィールドの文章を空にして削除">
                <Trash2 size={11} /> 記載をクリア
              </button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full min-h-[90px] p-2 border border-secondary-edge rounded-lg text-[11px] text-foreground outline-none focus:border-secondary-edge-strong"
          />
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 text-[11px] font-bold bg-success-100 text-success-700 border border-success-edge-soft px-2.5 py-1 rounded-lg hover:bg-success-200 disabled:opacity-50">
              <Save size={11} /> {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1 text-[11px] text-muted-strong hover:text-foreground-soft">
              <X size={11} /> キャンセル
            </button>
          </div>
        </div>
      ) : (
        <p className="text-foreground-subtle whitespace-pre-wrap leading-relaxed">{value}</p>
      )}
      {error && <p className="text-danger-700 mt-1">{error}</p>}
    </div>
  );
}
