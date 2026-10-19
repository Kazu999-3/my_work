'use client';

import { useState } from 'react';
import { RotateCcw, X, Loader2 } from 'lucide-react';
import { REANALYZE_FOCUS, REANALYZE_REASONS, type ReanalyzeRequest, type ReviewItem } from './types';

// 「🔁 再解析」の依頼フォーム（2026-10-19）。理由・深掘りしたい観点・メモ・モデルを選んで依頼する。
// 依頼は edge_tasks（article_reanalyze）に積まれ、クラウドワーカーか PC の常駐デーモンが処理する。
// 元の記事は残したまま新しい版が承認待ちに届き、カードの「🆚 比べる」で新旧を見比べて選ぶ。
export default function ReanalyzeModal({ item, busy, onClose, onSubmit }: {
  item: ReviewItem;
  busy: boolean;
  onClose: () => void;
  onSubmit: (req: ReanalyzeRequest) => void;
}) {
  const [reason, setReason] = useState(item.density?.level === 'thin' ? 'thin' : 'focus');
  const [focus, setFocus] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [model, setModel] = useState<'standard' | 'high'>('standard');

  const toggleFocus = (k: string) =>
    setFocus((prev) => (prev.includes(k) ? prev.filter((f) => f !== k) : [...prev, k]));

  const canSubmit = !busy && (reason !== 'focus' || focus.length > 0) && (reason !== 'other' || note.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-stone-900 border border-stone-700/80 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-stone-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" /> 再解析を依頼
            </h2>
            <p className="text-[11px] text-stone-400 mt-1 break-words">{item.title}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100 cursor-pointer shrink-0" aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          {item.density && item.density.reasons.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-200 space-y-1">
              <p className="font-bold">この記事の目印</p>
              {item.density.reasons.map((r) => <p key={r}>・{r}</p>)}
            </div>
          )}

          <fieldset className="space-y-1.5">
            <legend className="font-bold text-stone-300 mb-1">理由</legend>
            {REANALYZE_REASONS.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-stone-200 cursor-pointer">
                <input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} className="accent-amber-500" />
                {r.label}
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <p className="font-bold text-stone-300">
              深掘りしたい観点 {reason === 'focus' ? <span className="text-rose-400">（1つ以上）</span> : <span className="text-stone-500">（任意）</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REANALYZE_FOCUS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleFocus(f.key)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-pointer transition ${
                    focus.includes(f.key)
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                      : 'bg-stone-950/60 border-stone-700 text-stone-400 hover:text-stone-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="font-bold text-stone-300">
              メモ {reason === 'other' ? <span className="text-rose-400">（必須）</span> : <span className="text-stone-500">（任意・AIへの追加の指示）</span>}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="例: 3:00 までのルートと、その理由をもっと詳しく / 「シンジャオ」の聞き間違いを直して"
              className="w-full px-2.5 py-2 rounded-lg bg-stone-950 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </label>

          <fieldset className="space-y-1.5">
            <legend className="font-bold text-stone-300 mb-1">モデル</legend>
            <label className="flex items-start gap-2 text-stone-200 cursor-pointer">
              <input type="radio" name="model" checked={model === 'standard'} onChange={() => setModel('standard')} className="accent-amber-500 mt-0.5" />
              <span>標準（いつもの解析と同じ。無料枠を圧迫しにくい）</span>
            </label>
            <label className="flex items-start gap-2 text-stone-200 cursor-pointer">
              <input type="radio" name="model" checked={model === 'high'} onChange={() => setModel('high')} className="accent-amber-500 mt-0.5" />
              <span>高精度（より上位のモデル。利用上限に達していたら自動で標準に切り替え）</span>
            </label>
          </fieldset>

          <p className="text-[11px] text-stone-500 leading-relaxed">
            元の記事は残したまま、新しい版が承認待ちに届きます（数分。完了は通知ベルでお知らせ）。
            届いたらカードの「🆚 比べる」で新旧を見比べて、使う方を選べます。
          </p>
        </div>

        <div className="p-3 border-t border-stone-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 text-xs font-bold cursor-pointer">
            やめる
          </button>
          <button
            onClick={() => onSubmit({ reason, focus, note: note.trim(), model })}
            disabled={!canSubmit}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} 再解析を依頼
          </button>
        </div>
      </div>
    </div>
  );
}
