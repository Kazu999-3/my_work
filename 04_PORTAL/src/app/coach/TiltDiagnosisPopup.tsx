'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '../../lib/apiClient';

type Level = 'green' | 'yellow' | 'red';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProceedToReflection: () => void;
}

// 試合終了を検知した直後に自動でティルト診断を実行し、結果をポップアップ表示する。
// 「今すぐ振り返りへ進む」導線を用意し、診断→振り返りの流れを1本化する(#①)。
export default function TiltDiagnosisPopup({ isOpen, onClose, onProceedToReflection }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true); setError(''); setResult(null);
    apiJson('/api/coach/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'tilt' }),
      timeout: 60000,
      redirectOn401: false,
    })
      .then(setResult)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const tilt = result?.tilt;
  const timing = result?.timing;
  const rec = result?.playRecommendation;

  const tiltColors: Record<Level, string> = {
    green: 'border-emerald-300 bg-emerald-50',
    yellow: 'border-yellow-300 bg-yellow-50',
    red: 'border-red-300 bg-red-50',
  };
  const meterColors: Record<Level, string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };
  const recColors: Record<Level, string> = {
    green: 'bg-emerald-700',
    yellow: 'bg-amber-600',
    red: 'bg-rose-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-50 border border-stone-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden my-6">
        <div className="bg-amber-900 text-amber-50 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <h2 className="text-base font-bold">試合終了：ティルト診断</h2>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white text-xl font-bold px-2 py-0.5 rounded hover:bg-amber-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-stone-800 max-h-[75vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-foreground/50">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-amber-600" />
              <span className="text-sm">直近の試合を分析中...</span>
            </div>
          )}
          {error && <p className="text-sm text-rose-600">❌ {error}</p>}

          {tilt && (
            <div className={`rounded-xl border p-4 ${tiltColors[tilt.level as Level]}`}>
              <div className="font-bold text-stone-900 mb-2">{tilt.label}</div>
              <div className="mb-2.5">
                <div className="flex justify-between text-xs text-stone-500 mb-1">
                  <span>ティルトスコア</span><span>{tilt.score} / 100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/5">
                  <div
                    className={`h-2 rounded-full transition-all ${meterColors[tilt.level as Level]}`}
                    style={{ width: `${Math.min(tilt.score, 100)}%` }}
                  />
                </div>
              </div>
              {tilt.reasons?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tilt.reasons.map((r: string, i: number) => (
                    <span key={i} className="text-[11px] rounded-full border border-yellow-300 bg-yellow-100 text-yellow-800 px-2 py-0.5">{r}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {timing && (
            <div className="rounded-xl border border-stone-200 bg-white p-3.5">
              <div className="text-xs font-bold text-stone-700 mb-1">🗓️ この時間帯の過去成績</div>
              {timing.winRate !== null ? (
                <p className="text-xs text-stone-600">
                  {timing.dayLabel}曜{timing.scope === 'hour' ? `${timing.hour}時台` : '全体'}の勝率:{' '}
                  <strong className={timing.winRate < 45 ? 'text-rose-600' : 'text-emerald-700'}>{timing.winRate}%</strong>
                  {' '}({timing.wins}/{timing.games}勝)
                </p>
              ) : (
                <p className="text-xs text-stone-400">この時間帯のサンプルがまだ不足しています。</p>
              )}
            </div>
          )}

          {rec && (
            <div className={`rounded-xl px-4 py-3 text-white font-bold text-sm ${recColors[rec.level as Level]}`}>
              {rec.label}
              {rec.reasons?.length > 0 && (
                <ul className="mt-1.5 text-xs font-normal opacity-90 list-disc list-inside space-y-0.5">
                  {rec.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          )}

          {result?.advice && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3.5">
              <div className="text-xs font-bold text-orange-700 mb-1">🤖 AIコーチアドバイス</div>
              <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">{result.advice}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-md text-stone-600 hover:bg-stone-100 text-xs font-medium transition-colors"
            >
              閉じる
            </button>
            <button
              onClick={onProceedToReflection}
              className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-md text-xs font-bold shadow transition-colors"
            >
              📝 振り返りを記録する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
