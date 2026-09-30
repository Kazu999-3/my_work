'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// 「次の試合に行くべきか」の判定カード（2026-09-30新設）
//
// この判定自体は前からサーバー側で計算されていたが、レスポンスに入るだけで
// どのUIからも参照されていなかった（ティルト・連敗ストッパー・時間帯勝率を
// 統合した判定が、誰にも見られないまま毎回計算されていた）。
// 試合前タブに出すため、LLMを使わない専用API(/api/coach/play-recommendation)を
// 新設してここで表示する。
// ============================================================

type Level = 'green' | 'yellow' | 'red';

interface Data {
  available: boolean;
  reason?: string;
  matchesUsed: number;
  tilt?: { level: Level; label: string; score: number; reasons: string[] };
  streak?: {
    currentStreak: number;
    streakType: 'win' | 'loss' | null;
    overallWinRate: number;
    afterLossWinRate: number | null;
  };
  timing?: { dayLabel: string; hour: number; winRate: number | null; games: number; wins: number; scope: string };
  recommendation?: {
    level: Level;
    label: string;
    reasons: string[];
    cooldownMinutes?: number;
    expectedWinRate?: number | null;
    stopStreakTriggered?: boolean;
  };
  latestMatchAt?: string;
  daysSinceNewest?: number | null;
}

const LEVEL_STYLE: Record<Level, string> = {
  green: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60',
  yellow: 'bg-amber-950/30 text-amber-400 border-amber-800/60',
  red: 'bg-rose-950/30 text-rose-400 border-rose-800/60',
};

export default function PlayRecommendationCard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/coach/play-recommendation', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="py-6 text-center text-xs text-stone-400">判定を読み込み中…</div>;
  }
  if (error) {
    return <p className="text-sm text-rose-600 dark:text-rose-400">❌ {error}</p>;
  }
  if (!data?.available || !data.recommendation) {
    return (
      <p className="text-sm text-stone-500 py-4">
        {data?.reason || '判定に使えるデータがありません。'}
        <span className="block mt-1 text-xs text-stone-400">
          「🗓️ 今の時間帯は勝てているか」の同期ボタンでソロQ履歴を取り込むと判定できるようになります。
        </span>
      </p>
    );
  }

  const rec = data.recommendation;
  const stale = (data.daysSinceNewest ?? 0) >= 14;

  return (
    <div className="space-y-3">
      {/* 総合判定 */}
      <div className={`rounded-xl border px-4 py-3 ${LEVEL_STYLE[rec.level]}`}>
        <div className="text-sm font-black">{rec.label}</div>
        {rec.cooldownMinutes ? (
          <div className="text-xs mt-1 opacity-90">推奨クールダウン: 約{rec.cooldownMinutes}分</div>
        ) : null}
        {rec.reasons.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs opacity-90">
            {rec.reasons.map((r, i) => (
              <li key={i}>・{r}</li>
            ))}
          </ul>
        )}
        {rec.reasons.length === 0 && (
          <div className="text-xs mt-1 opacity-90">気になる兆候はありません。</div>
        )}
      </div>

      {/* 判定の内訳。数値は必ず実測値のみを出す（推定値は出さない）。 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-border dark:border-stone-700/60 bg-white dark:bg-stone-900/60 px-3 py-2">
          <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400">メンタル負荷</div>
          <div className="font-bold text-stone-900 dark:text-stone-100 mt-0.5">{data.tilt?.label}</div>
        </div>
        <div className="rounded-xl border border-border dark:border-stone-700/60 bg-white dark:bg-stone-900/60 px-3 py-2">
          <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400">直近の流れ</div>
          <div className="font-bold text-stone-900 dark:text-stone-100 mt-0.5">
            {data.streak?.streakType === 'loss'
              ? `${data.streak.currentStreak}連敗中`
              : data.streak?.streakType === 'win'
                ? `${data.streak.currentStreak}連勝中`
                : '—'}
            <span className="ml-1.5 font-normal text-stone-500 dark:text-stone-400">
              （直近{data.matchesUsed}試合の勝率 {data.streak?.overallWinRate}%）
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-border dark:border-stone-700/60 bg-white dark:bg-stone-900/60 px-3 py-2">
          <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400">今の時間帯</div>
          <div className="font-bold text-stone-900 dark:text-stone-100 mt-0.5">
            {data.timing?.winRate !== null && data.timing
              ? `${data.timing.winRate}% (${data.timing.wins}/${data.timing.games}勝)`
              : 'データ不足'}
            {data.timing && (
              <span className="ml-1.5 font-normal text-stone-500 dark:text-stone-400">
                （{data.timing.dayLabel}曜{data.timing.scope === 'hour' ? `${data.timing.hour}時台` : '全体'}）
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 判定の根拠データの新しさ。古いまま気づかない状態を作らない。 */}
      <div className={`text-[11px] ${stale ? 'text-rose-500 dark:text-rose-400 font-bold' : 'text-stone-400'}`}>
        {data.daysSinceNewest === null
          ? '※ 判定は同期済みのソロQ履歴に基づきます。'
          : stale
            ? `⚠️ 判定の根拠データが${data.daysSinceNewest}日前で止まっています。現在の状態を反映していない可能性があります。`
            : `※ 判定の根拠は同期済みのソロQ履歴（最新 ${data.daysSinceNewest}日前まで）です。`}
        <button onClick={load} className="ml-2 underline hover:no-underline cursor-pointer">再判定</button>
      </div>
    </div>
  );
}
