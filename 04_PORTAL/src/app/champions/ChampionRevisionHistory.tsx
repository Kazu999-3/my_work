'use client';

import { useEffect, useState } from 'react';
import { History, RotateCcw, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { DiffLine } from '../../lib/knowledgeRevisions';

interface RevisionListItem {
  id: number;
  target_type: string;
  target_key: string;
  field: string;
  added: number;
  removed: number;
  isNew: boolean;
  created_at: string;
}

interface RevisionDetailResponse {
  success: boolean;
  revision: Record<string, unknown>;
  diff: DiffLine[];
}

const TYPE_LABELS: Record<string, string> = {
  champion_fact: 'コーチAI知識層',
  matchup_sentinel: '辞典本体・対面メモ',
  champion_notes: 'コーチAIノート',
};

const FIELD_LABELS: Record<string, string> = {
  strengths: '強み (Strengths)',
  weaknesses: '弱み (Weaknesses)',
  powerSpikes: 'パワースパイク',
  buildRunes: 'コアビルド / ルーン',
  counterChampions: '対面の有利・不利',
  pickRecommendation: 'ピック推奨',
  strategy: '全体的な立ち回りメモ',
  jg_style: 'プレイスタイル分類',
  patch_meta: 'パッチトレンド',
  pro_builds: 'プロ最先端ビルド',
  customFields: 'カスタム項目',
  winCondition: '勝ち筋・コンセプト',
};

interface Props {
  champion?: string;
  field?: string;
  targetKey?: string;
  title?: string;
  onRevertSuccess?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

export default function ChampionRevisionHistory({
  champion,
  field,
  targetKey,
  title,
  onRevertSuccess,
  isModal = false,
  onClose,
}: Props) {
  const [revisions, setRevisions] = useState<RevisionListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RevisionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reverting, setReverting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (champion) params.set('champion', champion);
      if (field) params.set('field', field);
      if (targetKey) params.set('targetKey', targetKey);

      const res = await fetch(`/api/admin/knowledge/revisions?${params.toString()}`, { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '履歴の取得に失敗しました');
      setRevisions(d.revisions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [champion, field, targetKey]);

  const openDetail = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/knowledge/revisions?id=${id}`, { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '差分の取得に失敗しました');
      setDetail(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const revert = async (id: number) => {
    if (!confirm('この更新を取り消して、直前の状態に戻しますか？\n\n取り消した操作も履歴に残るので、やり直せます。')) return;
    setReverting(true);
    try {
      const res = await fetch('/api/admin/knowledge/revisions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '取り消しに失敗しました');
      setOpenId(null);
      setDetail(null);
      await load();
      if (onRevertSuccess) onRevertSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setReverting(false);
    }
  };

  const headerLabel = title || (field ? `${FIELD_LABELS[field] || field} の変更履歴` : champion ? `${champion} の変更履歴` : '変更履歴');

  const content = (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-black/10 pb-2">
        <p className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
          <History size={14} className="text-amber-600" />
          <span>{headerLabel}</span>
          {revisions && <span className="text-stone-400 font-normal">({revisions.length}件)</span>}
        </p>
        {isModal && onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 text-stone-500 hover:text-stone-900 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-stone-400 py-3">変更履歴を確認中...</p>}
      {error && <p className="text-xs text-rose-600 py-3">履歴の取得に失敗: {error}</p>}

      {!loading && (!revisions || revisions.length === 0) && (
        <p className="text-xs text-stone-400 py-3 flex items-center gap-1">
          <History size={12} /> この項目の変更履歴はまだありません。
        </p>
      )}

      {revisions && revisions.length > 0 && (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {revisions.map((r) => (
            <div key={r.id} className="border border-stone-200 rounded-lg overflow-hidden bg-white text-xs">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(r.id);
                }}
                className="w-full text-left px-2.5 py-2 hover:bg-black/5 transition-colors flex items-center gap-2 flex-wrap text-[11px]"
              >
                <span className="font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  {TYPE_LABELS[r.target_type] || r.target_type}
                </span>
                <span className="font-bold text-stone-900">{FIELD_LABELS[r.field] || r.field}</span>
                {r.isNew ? (
                  <span className="font-black text-cyan-700">新規作成</span>
                ) : (
                  <span className="font-mono">
                    <span className="text-emerald-700">+{r.added}</span> <span className="text-rose-700">-{r.removed}</span>
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
                      <div className="max-h-64 overflow-auto font-mono text-[10px] leading-relaxed rounded-lg border border-stone-200 bg-white">
                        {(detail.diff || []).map((line: DiffLine, i: number) => (
                          <div
                            key={i}
                            className={
                              line.op === 'added'
                                ? 'bg-emerald-100 text-emerald-700 px-2'
                                : line.op === 'removed'
                                ? 'bg-rose-100 text-rose-700/80 px-2 line-through decoration-rose-400'
                                : 'text-stone-500 px-2'
                            }
                          >
                            <span className="select-none opacity-40 mr-2">
                              {line.op === 'added' ? '+' : line.op === 'removed' ? '-' : ' '}
                            </span>
                            {line.text || ' '}
                          </div>
                        ))}
                      </div>
                      {!r.isNew && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            revert(r.id);
                          }}
                          disabled={reverting}
                          className="mt-2 text-[11px] font-black bg-rose-600 hover:bg-rose-700 active:scale-95 text-white border border-rose-500 px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5 shadow transition"
                          title="この修正時点のデータへワンタップで安全に巻き戻します"
                        >
                          <RotateCcw size={12} /> {reverting ? '復元中...' : '⏪ このバージョンにワンタップ復元'}
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

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-xl shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
