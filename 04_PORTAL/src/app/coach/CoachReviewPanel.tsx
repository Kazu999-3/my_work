'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// 自動振り返りの履歴 ＆ 傾向分析（2026-09-30新設）
//
// 15分おきのcron(/api/cron/soloq-coach)が新しいランク戦を検知するたびに
// AI振り返りを生成して coach_analyses へ保存している（調査時点で86件、直近30日で14件）。
// サーバー側には一覧用の mode=history と傾向集計用の mode=trends が前からあったが、
// **どの画面からも呼ばれていなかった**ため、貯まった振り返りは通知本文
// （500字で切り詰められる）以外から読めない状態だった。ここで配線する。
//
// コスト: 履歴一覧(mode=history)はDB読みだけでLLMを使わないので自動で取得する。
//         傾向分析(mode=trends)はGeminiを1回呼ぶので、ボタンで明示的に実行させる
//         （Geminiの日次クォータは実際に枯渇するため、開くだけで消費させない）。
// ============================================================

interface Analysis {
  matchId: string;
  win: boolean;
  champion: string;
  enemyChampion: string | null;
  role: string;
  kda: string;
  kdaRatio: string;
  csPerMin: string;
  visionPerMin: string;
  weaknesses: string[];
  advice: string;
  focus: string | null;
  focusAchieved: boolean | null;
  createdAt: string;
}

export default function CoachReviewPanel() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [trendSummary, setTrendSummary] = useState<string>('');
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/coach/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'history', limit: 20 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');
      setAnalyses(data.analyses || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runTrends = async () => {
    setTrendLoading(true); setTrendError('');
    try {
      const res = await fetch('/api/coach/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'trends' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '傾向分析に失敗しました');
      if (!data.summary) throw new Error(data.message || '集計できるデータが足りません');
      setTrendSummary(data.summary);
    } catch (e: any) {
      setTrendError(e.message);
    } finally {
      setTrendLoading(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        試合終了が検知されるたびに自動生成された振り返りです。通知では要点だけが届くので、全文はここで読めます。
      </p>

      {/* 傾向分析（Geminiを使うのでボタン実行） */}
      <div className="rounded-xl border border-border dark:border-stone-700/60 bg-surface dark:bg-stone-900/60 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-black text-stone-900 dark:text-stone-100">📈 蓄積した振り返りの傾向分析</div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              繰り返し出ている弱点と次のフォーカスをまとめます。AIを1回呼ぶので、押した時だけ実行します。
            </p>
          </div>
          <button
            onClick={runTrends}
            disabled={trendLoading}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-colors disabled:opacity-50 cursor-pointer"
          >
            {trendLoading ? '分析中…' : '傾向を分析する'}
          </button>
        </div>
        {trendError && <p className="text-xs text-rose-600 dark:text-rose-400">❌ {trendError}</p>}
        {trendSummary && (
          <div className="rounded-lg bg-surface-subtle dark:bg-stone-800/60 px-3 py-2 text-xs text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
            {trendSummary}
          </div>
        )}
      </div>

      {/* 自動振り返りの一覧 */}
      {loading ? (
        <div className="py-6 text-center text-xs text-stone-400">読み込み中…</div>
      ) : error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">❌ {error}</p>
      ) : analyses.length === 0 ? (
        <p className="text-sm text-stone-500 py-4">
          まだ自動振り返りがありません。ランク戦が終わると自動で生成されます。
        </p>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] text-stone-400">直近{analyses.length}件</div>
          {analyses.map((a) => {
            const open = expanded === a.matchId;
            return (
              <div
                key={a.matchId}
                className="rounded-xl border border-border dark:border-stone-700/60 bg-surface dark:bg-stone-900/60 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : a.matchId)}
                  className="w-full flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-left hover:bg-background dark:hover:bg-stone-800/40 transition-colors cursor-pointer"
                >
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                      a.win
                        ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60'
                        : 'bg-rose-950/30 text-rose-400 border-rose-800/60'
                    }`}
                  >
                    {a.win ? '勝' : '負'}
                  </span>
                  <span className="text-xs font-black text-stone-900 dark:text-stone-100 truncate">
                    {a.champion}
                    {a.enemyChampion ? ` vs ${a.enemyChampion}` : ''}
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                    {a.kda} ({a.kdaRatio})
                  </span>
                  <span className="text-[10px] text-stone-400 ml-auto shrink-0">{fmtDate(a.createdAt)}</span>
                </button>

                {open && (
                  <div className="px-3.5 pb-3 space-y-2 border-t border-border dark:border-stone-800 pt-2.5">
                    <div className="flex flex-wrap gap-3 text-[11px] text-stone-600 dark:text-stone-300">
                      <span>ロール: {a.role || '—'}</span>
                      <span>CS/分: {a.csPerMin}</span>
                      <span>視界/分: {a.visionPerMin}</span>
                    </div>
                    {a.weaknesses.length > 0 && (
                      <div className="text-xs">
                        <span className="font-bold text-stone-700 dark:text-stone-200">弱点: </span>
                        <span className="text-stone-600 dark:text-stone-300">{a.weaknesses.join(' / ')}</span>
                      </div>
                    )}
                    {a.focus && (
                      <div className="text-xs">
                        <span className="font-bold text-stone-700 dark:text-stone-200">次のフォーカス: </span>
                        <span className="text-stone-600 dark:text-stone-300">{a.focus}</span>
                        {a.focusAchieved !== null && (
                          <span className={`ml-1.5 text-[10px] font-bold ${a.focusAchieved ? 'text-emerald-500' : 'text-stone-400'}`}>
                            {a.focusAchieved ? '（達成）' : '（未達）'}
                          </span>
                        )}
                      </div>
                    )}
                    {a.advice && (
                      <div className="rounded-lg bg-surface-subtle dark:bg-stone-800/60 px-3 py-2 text-xs text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
                        {a.advice}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
