'use client';

import { useState } from 'react';
import { ExternalLink, Check, X, Ban, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import FactCheckSourceBlock, { EditableSourceBlock } from './FactCheckSourceBlock';

export interface QueueItem {
  id: number;
  champion: string;
  issue_type: 'contradiction' | 'unconfirmed_source' | 'possible_fact_error' | 'invalid_champion_tag';
  summary: string;
  source_refs: any;
  status: string;
  created_at: string;
  sourcePreview?: { title: string; body: string; url?: string };
  championBlocks?: { editable: EditableSourceBlock[]; linked: { key: string; label: string; value: string; url: string }[] };
}

const ISSUE_LABEL: Record<string, { label: string; cls: string }> = {
  contradiction: { label: '⚠️ 矛盾', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  unconfirmed_source: { label: '❓ 単一ソースのみ(未確証)', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  possible_fact_error: { label: '🚫 事実誤りの疑い', cls: 'bg-red-100 text-red-700 border-red-200' },
  invalid_champion_tag: { label: '🏷️ 不正チャンピオンタグ', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
};

// 一斉ファクトチェックのキュー1件分のカード。/admin/knowledge のレビュー画面と
// チャンピオン辞典ページ内の単体パネル(このチャンピオンだけ)の両方で使い回す。
export default function FactCheckQueueCard({ item, onActed }: { item: QueueItem; onActed: (id: number) => void }) {
  const it = item;
  const [fixInput, setFixInput] = useState('');
  const [enemyInput, setEnemyInput] = useState('');
  const [acting, setActing] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [error, setError] = useState('');

  const act = async (action: 'dismiss' | 'acknowledge' | 'fix_champion_tag' | 'record_correction' | 'mark_no_champion' | 'delete_article') => {
    if (action === 'delete_article' && !confirm('元の記事データ自体を完全に削除します。この操作は取り消せません。よろしいですか？')) return;
    setActing(true); setError('');
    try {
      const body: any = { id: it.id, action };
      if (action === 'fix_champion_tag') {
        body.fixedChampion = fixInput.trim();
        if (enemyInput.trim()) body.fixedEnemy = enemyInput.trim();
      }
      if (action === 'record_correction') body.correctInfo = fixInput.trim();
      const res = await fetch('/api/admin/dict-fact-check/queue', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '反映に失敗しました');
      onActed(it.id);
    } catch (e: any) { setError(e.message); } finally { setActing(false); }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-stone-900 text-sm">{it.champion}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ISSUE_LABEL[it.issue_type]?.cls}`}>
            {ISSUE_LABEL[it.issue_type]?.label || it.issue_type}
          </span>
          {Array.isArray(it.source_refs) && it.issue_type !== 'invalid_champion_tag' && (
            <span className="text-[10px] text-stone-400">出典: {it.source_refs.map((s: any) => (typeof s === 'string' ? s : s.table)).join(', ')}</span>
          )}
        </div>
        {it.issue_type !== 'invalid_champion_tag' && (
          <a href={`/champions?select=${encodeURIComponent(it.champion)}`} target="_blank" rel="noreferrer"
            className="text-[10px] text-sky-700 hover:underline flex items-center gap-0.5 shrink-0">
            辞典で確認 <ExternalLink size={10} />
          </a>
        )}
      </div>
      <p className="text-xs text-stone-700 mt-1.5">{it.summary}</p>

      {/* invalid_champion_tagはchampion列自体がゴミ値のことが多く、辞典リンクが
          意味を持たないため、参照元レコードの中身をここに直接プレビュー表示する */}
      {it.issue_type === 'invalid_champion_tag' && it.sourcePreview && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs">
          <div className="font-bold text-amber-900">📄 {it.sourcePreview.title || '(タイトルなし)'}</div>
          {it.sourcePreview.body && (
            <p className="text-stone-600 mt-1 whitespace-pre-wrap leading-relaxed">{it.sourcePreview.body}{it.sourcePreview.body.length >= 300 ? '…' : ''}</p>
          )}
          {it.sourcePreview.url && (
            <a href={it.sourcePreview.url} target="_blank" rel="noreferrer"
              className="text-sky-700 hover:underline flex items-center gap-0.5 mt-1 w-fit">
              元記事を開く <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {/* contradiction/unconfirmed_source/possible_fact_errorはチャンピオン単位で
          複数ソースを横断した判定のため、summary(40字程度)だけでは根拠を検証できない。
          AIが実際に読んだブロックをその場で直接編集・削除できるようにする */}
      {it.issue_type !== 'invalid_champion_tag' && it.championBlocks && (it.championBlocks.editable.length > 0 || it.championBlocks.linked.length > 0) && (
        <div className="mt-2">
          <button onClick={() => setShowBlocks(!showBlocks)} className="flex items-center gap-1 text-[11px] text-sky-700 hover:underline">
            <FileText size={11} />
            {showBlocks ? '元データを閉じる' : '元データを確認・編集する'}
            {showBlocks ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showBlocks && (
            <div className="mt-1.5 space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {it.championBlocks.editable.map((b) => (
                <FactCheckSourceBlock key={b.key} block={b} />
              ))}
              {it.championBlocks.linked.map((b) => (
                <div key={b.key} className="rounded-lg border border-violet-200 bg-violet-50/60 p-2.5 text-[11px]">
                  <div className="font-bold text-violet-900 mb-1">{b.label}</div>
                  <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{b.value.slice(0, 300)}{b.value.length >= 300 ? '…' : ''}</p>
                  <a href={b.url} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline flex items-center gap-0.5 mt-1 w-fit">
                    ナレッジ記事を編集する <ExternalLink size={10} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-700 mt-2">{error}</p>}

      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {it.issue_type === 'invalid_champion_tag' ? (
          <>
            <input
              value={fixInput}
              onChange={(e) => setFixInput(e.target.value)}
              placeholder="正しいチャンピオン名を英語表記で（例: Graves）"
              className="text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-900 w-56"
            />
            {['matchup_sentinel', 'champion_notes'].includes(it.source_refs?.[0]?.table) && (
              <input
                value={enemyInput}
                onChange={(e) => setEnemyInput(e.target.value)}
                placeholder="対面がいれば入力（任意・例: Fizz）"
                title="元の値に2チャンピオン分(例: 「Rek'Sai & Fizz」)が紛れていた場合、2体目をここに"
                className="text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-900 w-48"
              />
            )}
            <button onClick={() => act('fix_champion_tag')} disabled={acting || !fixInput.trim()}
              className="flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-200 disabled:opacity-50">
              <Check size={12} /> この名前に修正
            </button>
            <button onClick={() => act('mark_no_champion')} disabled={acting}
              title="特定のチャンピオンに関する記事ではない場合（メタ記事・マクロ解説など）"
              className="flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-50">
              <Ban size={12} /> チャンピオンなし（対象外にする）
            </button>
            <button onClick={() => act('delete_article')} disabled={acting}
              title="ゴミ記事・不要な英語記事などを元データごと完全に削除します（取り消せません）"
              className="flex items-center gap-1 text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-200 disabled:opacity-50">
              <Trash2 size={12} /> 記事を削除
            </button>
          </>
        ) : (
          <>
            <input
              value={fixInput}
              onChange={(e) => setFixInput(e.target.value)}
              placeholder="正しい内容を記録（任意・入力すると再発防止に使われます）"
              className="text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-900 w-72"
            />
            <button onClick={() => act('record_correction')} disabled={acting || !fixInput.trim()}
              title="今後のAI生成すべてに『これが正しい』として反映されます"
              className="flex items-center gap-1 text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-200 disabled:opacity-50">
              <Check size={12} /> 訂正を記録（再発防止）
            </button>
            <button onClick={() => act('acknowledge')} disabled={acting}
              className="flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-200 disabled:opacity-50">
              <Check size={12} /> 把握した（記録なし）
            </button>
          </>
        )}
        <button onClick={() => act('dismiss')} disabled={acting}
          className="flex items-center gap-1 text-xs font-bold bg-stone-200 text-stone-600 border border-stone-300 px-3 py-1.5 rounded-lg hover:bg-stone-300 disabled:opacity-50">
          <X size={12} /> 誤検知（却下）
        </button>
      </div>
    </div>
  );
}
