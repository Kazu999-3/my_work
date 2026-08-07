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

  if (deleted) return null;

  return (
    <div className="rounded-lg border border-sky-200 bg-white p-2.5 text-[11px]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-bold text-sky-900">{block.label}</span>
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            {onPickAsCorrect && (
              <button onClick={() => onPickAsCorrect(block.label, value)} className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-0.5">
                <CheckCircle2 size={11} /> これが正しい
              </button>
            )}
            <button onClick={() => { setDraft(value); setEditing(true); }} className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 font-bold hover:bg-sky-200 flex items-center gap-1 transition">
              <Edit2 size={11} /> ✏️ 文章を直接修正・保存
            </button>
            {block.deletable && (
              <button onClick={remove} disabled={saving} className="text-stone-500 hover:text-rose-700 flex items-center gap-0.5 disabled:opacity-50">
                <Trash2 size={11} /> 削除
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
            className="w-full min-h-[90px] p-2 border border-sky-300 rounded-lg text-[11px] text-stone-900 outline-none focus:border-sky-500"
          />
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-200 disabled:opacity-50">
              <Save size={11} /> {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800">
              <X size={11} /> キャンセル
            </button>
          </div>
        </div>
      ) : (
        <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{value}</p>
      )}
      {error && <p className="text-rose-700 mt-1">{error}</p>}
    </div>
  );
}
