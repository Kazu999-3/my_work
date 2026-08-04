'use client';

import { useEffect, useState } from 'react';
import { History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

// この記事(personal_knowledge)がレーン別ガイド・チャンピオン辞典へ統合された際の
// 変化履歴だけを絞り込んで表示する。「レーン別ガイドへ統合すると大事なデータが
// 消えないか」という不安に応え、記事単位で「いつ・どこへ・何が」を追えるようにする。

const TYPE_LABELS: Record<string, string> = {
  lane_guide: 'レーン別ガイド',
  champion_fact: 'チャンピオン辞典（対面タブ）',
  matchup_sentinel: 'チャンピオン辞典',
};

interface Props {
  articleId: number | string;
}

export default function ArticleRevisionHistory({ articleId }: Props) {
  const [revisions, setRevisions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reverting, setReverting] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/knowledge/revisions?sourceId=${encodeURIComponent(String(articleId))}`, { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '履歴の取得に失敗しました');
      setRevisions(d.revisions || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [articleId]);

  const openDetail = async (id: number) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/knowledge/revisions?id=${id}`, { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '差分の取得に失敗しました');
      setDetail(d);
    } catch (e: any) { setError(e.message); } finally { setDetailLoading(false); }
  };

  const revert = async (id: number) => {
    if (!confirm('この更新を取り消して、直前の状態に戻しますか？\n\n取り消した操作も履歴に残るので、やり直せます。')) return;
    setReverting(true);
    try {
      const res = await fetch('/api/admin/knowledge/revisions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '取り消しに失敗しました');
      setOpenId(null); setDetail(null);
      await load();
    } catch (e: any) { setError(e.message); } finally { setReverting(false); }
  };

  if (loading) return <p className="text-[11px] text-stone-400 mt-3">この記事の変化履歴を確認中...</p>;
  if (error) return <p className="text-[11px] text-rose-600 mt-3">履歴の取得に失敗: {error}</p>;
  if (!revisions || revisions.length === 0) {
    return (
      <p className="text-[11px] text-stone-400 mt-3 flex items-center gap-1">
        <History size={12} /> この記事はまだレーン別ガイド・チャンピオン辞典へ統合されていません。
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-black/10 pt-3">
      <p className="text-[11px] font-bold text-stone-600 flex items-center gap-1 mb-2">
        <History size={12} /> この記事の変化履歴（{revisions.length}件）
      </p>
      <div className="space-y-1.5">
        {revisions.map((r) => (
          <div key={r.id} className="border border-stone-200 rounded-lg overflow-hidden bg-white">
            <button onClick={(e) => { e.stopPropagation(); openDetail(r.id); }}
              className="w-full text-left px-2.5 py-2 hover:bg-black/5 transition-colors flex items-center gap-2 flex-wrap text-[11px]">
              <span className="font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                {TYPE_LABELS[r.target_type] || r.target_type}
              </span>
              <span className="font-bold text-stone-900">{r.target_key}</span>
              {r.isNew ? (
                <span className="font-black text-cyan-700">新規作成</span>
              ) : (
                <span className="font-mono">
                  <span className="text-emerald-700">+{r.added}</span>{' '}
                  <span className="text-rose-700">-{r.removed}</span>
                </span>
              )}
              <span className="text-stone-400 ml-auto shrink-0">{new Date(r.created_at).toLocaleString('ja-JP')}</span>
              {openId === r.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {openId === r.id && (
              <div className="border-t border-stone-200 bg-stone-50 p-2.5">
                {detailLoading ? (
                  <p className="text-[11px] text-stone-500">差分を読み込み中...</p>
                ) : detail ? (
                  <>
                    <div className="max-h-64 overflow-auto font-mono text-[10px] leading-relaxed rounded-lg border border-stone-200">
                      {(detail.diff || []).map((line: any, i: number) => (
                        <div key={i} className={
                          line.op === 'added' ? 'bg-emerald-100 text-emerald-700 px-2'
                          : line.op === 'removed' ? 'bg-rose-100 text-rose-700/80 px-2 line-through decoration-rose-400'
                          : 'text-stone-500 px-2'
                        }>
                          <span className="select-none opacity-40 mr-2">
                            {line.op === 'added' ? '+' : line.op === 'removed' ? '-' : ' '}
                          </span>
                          {line.text || ' '}
                        </div>
                      ))}
                    </div>
                    {!r.isNew && (
                      <button onClick={(e) => { e.stopPropagation(); revert(r.id); }} disabled={reverting}
                        className="mt-2 text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg hover:bg-rose-200 disabled:opacity-50 flex items-center gap-1">
                        <RotateCcw size={11} /> {reverting ? '戻しています...' : 'この更新を取り消す'}
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
