'use client';

import { useState } from 'react';
import { X, Eye, Undo2, RotateCcw } from 'lucide-react';
import LiteMarkdown from '@/components/LiteMarkdown';
import { REANALYZE_FOCUS, REANALYZE_REASONS, type DensityInfo, type ReviewItem } from './types';

// 再解析版と元の記事を見比べる（2026-10-19）。
// 「新しい版で承認へ」はいつもの統合プレビューへ進む（承認すると元の記事は履歴として隠れる）。
// 「元の記事に戻す」は再解析版を使わない（行は消さず履歴として残す）。
function DensityLine({ d }: { d?: DensityInfo }) {
  if (!d) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-400">
      <span>{d.bodyChars.toLocaleString()}字</span>
      {d.factCount !== null && <span>事実 {d.factCount}件</span>}
      <span>具体的な記述 {d.specificPer1k}件/千字</span>
      <span>一般論 {d.genericPer1k}件/千字</span>
      {d.level === 'thin' && <span className="text-amber-300 font-bold">⚠️ 薄い可能性</span>}
    </div>
  );
}

export default function CompareModal({ item, busy, onClose, onAdopt, onDiscard, onReanalyzeAgain }: {
  item: ReviewItem;
  busy: boolean;
  onClose: () => void;
  onAdopt: () => void;
  onDiscard: () => void;
  onReanalyzeAgain: () => void;
}) {
  const original = item.reanalysisOriginal;
  const [view, setView] = useState<'new' | 'old'>('new');
  const meta = item.analysis_meta;
  const req = meta?.reanalysis;
  const reasonLabel = REANALYZE_REASONS.find((r) => r.key === req?.reason)?.label;
  const focusLabels = (req?.focus || []).map((f) => REANALYZE_FOCUS.find((x) => x.key === f)?.label || f);

  const pane = (title: string, content: string, d: DensityInfo | undefined, accent: string) => (
    <div className={`flex-1 min-w-0 rounded-xl border ${accent} bg-stone-950/60 flex flex-col`}>
      <div className="p-2.5 border-b border-stone-800 space-y-1">
        <p className="text-xs font-bold text-stone-100 break-words">{title}</p>
        <DensityLine d={d} />
      </div>
      <div className="p-3 overflow-y-auto max-h-[55vh] text-xs text-stone-200">
        <LiteMarkdown text={content || ''} />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
      <div className="bg-stone-900 border border-stone-700/80 rounded-2xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-3.5 border-b border-stone-800 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-black text-stone-100">🆚 再解析版と元の記事を比べる</h2>
            <p className="text-[11px] text-stone-400">
              {reasonLabel && <>理由: {reasonLabel}</>}
              {focusLabels.length > 0 && <> ／ 観点: {focusLabels.join('、')}</>}
              {req?.source && <> ／ 材料: {req.source}</>}
              {meta?.model && <> ／ モデル: {meta.model}</>}
            </p>
            {req?.note && <p className="text-[11px] text-stone-500 break-words">メモ: {req.note}</p>}
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100 cursor-pointer shrink-0" aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* スマホは切り替え、広い画面は左右に並べる */}
        <div className="flex sm:hidden gap-1.5 px-3 pt-3">
          {(['new', 'old'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                view === v ? 'bg-amber-500/15 border-amber-500/60 text-amber-200' : 'bg-stone-950 border-stone-700 text-stone-400'
              }`}
            >
              {v === 'new' ? '🆕 再解析版' : '📄 元の記事'}
            </button>
          ))}
        </div>
        <div className="p-3 flex gap-3 overflow-hidden">
          <div className={`${view === 'new' ? 'flex' : 'hidden'} sm:flex flex-1 min-w-0`}>
            {pane(`🆕 再解析版: ${item.title}`, item.content, item.density, 'border-emerald-800/60')}
          </div>
          <div className={`${view === 'old' ? 'flex' : 'hidden'} sm:flex flex-1 min-w-0`}>
            {original
              ? pane(`📄 元の記事: ${original.title}`, original.content, original.density, 'border-stone-700')
              : <p className="text-xs text-stone-500 p-4">元の記事が見つかりません（削除済みの可能性）</p>}
          </div>
        </div>

        <div className="p-3 border-t border-stone-800 flex flex-wrap justify-end gap-2">
          <button
            onClick={onReanalyzeAgain}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-amber-700/60 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> もう一度再解析
          </button>
          <button
            onClick={onDiscard}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-stone-600 text-stone-200 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Undo2 className="w-3.5 h-3.5" /> 元の記事に戻す
          </button>
          <button
            onClick={onAdopt}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" /> 新しい版で承認へ進む
          </button>
        </div>
      </div>
    </div>
  );
}
