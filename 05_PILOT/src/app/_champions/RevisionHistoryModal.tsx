'use client';

import React, { useState, useEffect } from 'react';
import { History, RefreshCw, X, ArrowRight, BookOpen, Clock, FileText, Filter } from 'lucide-react';

interface Revision {
  id: number;
  target_type: string;
  target_key: string;
  field: string;
  fieldLabel: string;
  before_text: string | null;
  after_text: string;
  source_title: string;
  source_id: string | null;
  created_at: string;
}

interface RevisionHistoryModalProps {
  championId: string;
  championName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function RevisionHistoryModal({
  championId,
  championName,
  isOpen,
  onClose,
}: RevisionHistoryModalProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen || !championId) return;
    setLoading(true);
    fetch(`/api/admin/revisions?champion=${encodeURIComponent(championId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRevisions(data.revisions || []);
        }
      })
      .catch((e) => console.error('履歴取得エラー:', e))
      .finally(() => setLoading(false));
  }, [isOpen, championId]);

  if (!isOpen) return null;

  const fields = Array.from(new Set(revisions.map((r) => r.field)));
  const filtered = activeFilter === 'ALL'
    ? revisions
    : revisions.filter((r) => r.field === activeFilter);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[#141418] border border-zinc-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        {/* モーダルヘッダー */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>{championName}</span>
                <span className="text-xs text-zinc-400 font-mono">（{championId}）</span>
                <span className="text-xs text-amber-400 font-bold">各項目の編集・更新履歴</span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                記事統合やAI更新で各項目（強み・弱み・スパイク・教本）に加わった変更の全記録です。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* フィルターバー */}
        {fields.length > 0 && (
          <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[10px] text-zinc-500 font-bold shrink-0 flex items-center gap-1">
              <Filter size={11} /> 項目:
            </span>
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              すべて ({revisions.length})
            </button>
            {fields.map((f) => {
              const label = revisions.find((r) => r.field === f)?.fieldLabel || f;
              const count = revisions.filter((r) => r.field === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                    activeFilter === f
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* タイムラインコンテンツ */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-20 text-center text-amber-400 flex items-center justify-center gap-2">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-xs font-bold">更新履歴を取得中...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 space-y-1">
              <History size={28} className="mx-auto opacity-30 text-zinc-400 mb-2" />
              <p className="text-xs font-bold text-zinc-400">記録された更新履歴はありません</p>
              <p className="text-[10px] text-zinc-600">
                記事を承認・統合した際の変更ログがここに時系列で蓄積されます
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
              {filtered.map((r) => {
                const isStrategy = r.field === 'strategy';
                return (
                  <div key={r.id} className="relative group space-y-2">
                    {/* タイムライン丸ピン */}
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-amber-500/80 border-2 border-[#141418] shadow-sm ring-2 ring-amber-500/20" />

                    {/* 更新ヘッダーカード */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black">
                          {r.fieldLabel}
                        </span>
                        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1">
                          <FileText size={12} className="text-zinc-400" />
                          <span>{r.source_title || '記事統合'}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                        <Clock size={11} />
                        {new Date(r.created_at).toLocaleString('ja-JP')}
                      </span>
                    </div>

                    {/* 差分カード */}
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2 text-xs">
                      {/* 変更前（存在する場合） */}
                      {r.before_text && !isStrategy && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-rose-400/80 font-bold block">
                            変更前:
                          </span>
                          <p className="text-[11px] text-zinc-400 line-through opacity-70 whitespace-pre-wrap leading-relaxed pl-2 border-l border-rose-500/40">
                            {r.before_text}
                          </p>
                        </div>
                      )}

                      {/* 変更後（追記内容） */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400/90 font-bold block flex items-center gap-1">
                          {r.before_text ? <ArrowRight size={10} /> : null}
                          {isStrategy ? '追記されたセクション:' : '更新後の内容:'}
                        </span>
                        <div className="text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed pl-2 border-l border-emerald-500/40 font-sans max-h-48 overflow-y-auto">
                          {r.after_text}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span>全 {revisions.length} 件の更新レコード</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
