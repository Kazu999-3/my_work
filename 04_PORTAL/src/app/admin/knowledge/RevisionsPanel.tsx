'use client';

import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';

// チャンピオン辞典・レーン別ガイドの更新履歴と差分表示。
// 「AIが統合したときに何が増えたのか」を行単位で確認し、必要なら戻せるようにする。

const FIELD_LABELS: Record<string, string> = {
  body: '本文',
  strengths: '強み',
  weaknesses: '弱み',
  power_spikes: 'パワースパイク',
  build_runes: 'ビルド/ルーン',
};

const TYPE_LABELS: Record<string, string> = {
  lane_guide: 'レーン別ガイド',
  champion_fact: 'チャンピオン辞典',
};

export default function RevisionsPanel() {
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');

  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reverting, setReverting] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const q = filterType === 'all' ? '' : `?type=${filterType}`;
      const res = await fetch(`/api/admin/knowledge/revisions${q}`, { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '履歴の取得に失敗しました');
      setRevisions(d.revisions || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterType]);

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-black text-white flex items-center gap-2">
          <History size={16} className="text-indigo-400" /> 更新履歴・差分
        </h3>
        <div className="flex gap-2 items-center">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-indigo-500">
            <option value="all">すべて</option>
            <option value="champion_fact">チャンピオン辞典</option>
            <option value="lane_guide">レーン別ガイド</option>
          </select>
          <button onClick={load} disabled={loading}
            className="text-xs font-bold bg-white/5 text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50">
            更新
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-500">
        AIが記事を統合したときの<strong className="text-indigo-300">増えた行（緑）・減った行（赤）</strong>を確認できます。
        意図しない書き換えがあれば、その場で元に戻せます。
      </p>

      {error && <p className="text-xs text-rose-400 font-bold">❌ {error}</p>}

      {loading ? (
        <p className="text-xs text-gray-500 py-6 text-center">読み込み中...</p>
      ) : revisions.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">
          まだ履歴がありません。次に統合を実行したときから記録されます。
        </p>
      ) : (
        <div className="space-y-1.5">
          {revisions.map((r) => (
            <div key={r.id} className="border border-gray-800 rounded-xl overflow-hidden">
              <button onClick={() => openDetail(r.id)}
                className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {TYPE_LABELS[r.target_type] || r.target_type}
                </span>
                <span className="text-sm font-bold text-white">{r.target_key}</span>
                {r.field !== 'body' && (
                  <span className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                    {FIELD_LABELS[r.field] || r.field}
                  </span>
                )}
                {r.isNew ? (
                  <span className="text-[10px] font-black text-cyan-400">新規作成</span>
                ) : (
                  <span className="text-[10px] font-mono">
                    <span className="text-emerald-400">+{r.added}</span>{' '}
                    <span className="text-rose-400">-{r.removed}</span>
                  </span>
                )}
                <span className="text-[10px] text-gray-500 ml-auto shrink-0">
                  {new Date(r.created_at).toLocaleString('ja-JP')}
                </span>
              </button>

              {r.source_title && (
                <p className="px-3 pb-2 text-[10px] text-gray-500 truncate" title={r.source_title}>
                  出典: {r.source_title}
                </p>
              )}

              {openId === r.id && (
                <div className="border-t border-gray-800 bg-gray-950/60 p-3">
                  {detailLoading ? (
                    <p className="text-xs text-gray-500">差分を読み込み中...</p>
                  ) : detail ? (
                    <>
                      <div className="max-h-80 overflow-auto font-mono text-[11px] leading-relaxed rounded-lg border border-gray-800">
                        {(detail.diff || []).map((line: any, i: number) => (
                          <div key={i} className={
                            line.op === 'added' ? 'bg-emerald-500/10 text-emerald-300 px-2'
                            : line.op === 'removed' ? 'bg-rose-500/10 text-rose-300/80 px-2 line-through decoration-rose-500/40'
                            : 'text-gray-500 px-2'
                          }>
                            <span className="select-none opacity-40 mr-2">
                              {line.op === 'added' ? '+' : line.op === 'removed' ? '-' : ' '}
                            </span>
                            {line.text || ' '}
                          </div>
                        ))}
                      </div>
                      {!r.isNew && (
                        <button onClick={() => revert(r.id)} disabled={reverting}
                          className="mt-3 text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg hover:bg-rose-500/25 disabled:opacity-50 flex items-center gap-1.5">
                          <RotateCcw size={13} /> {reverting ? '戻しています...' : 'この更新を取り消す'}
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
