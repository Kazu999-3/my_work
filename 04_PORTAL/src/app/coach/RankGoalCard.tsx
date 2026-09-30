'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// ランク目標と到達見込み（2026-09-30新設）
//
// サーバー側の /api/coach/analyze mode=goal は、現在ランクの取得・当日のLP
// スナップショット保存(soloq_lp_history)・LP/日の傾きからの到達見込み算出まで
// 実装済みだったが、**どの画面からも呼ばれていなかった**。
// そのため soloq_lp_history は4件・2026-08-04で更新が止まっていた。
// ここで配線する。開くと当日のスナップショットも記録されるので、
// 使っているうちにLP推移が貯まっていく。
//
// コスト: mode=goal はLLMを呼ばない（Riot APIのランク取得1回のみ）。
// 目標ランクは ktm_settings に保存され、ここから変更できる。
// ============================================================

interface GoalData {
  ranked: boolean;
  message?: string;
  current?: { abs: number; label: string };
  target?: { abs: number; label: string };
  gap?: number;
  lpPerDay?: number | null;
  daySpan?: number;
  snapshots?: number;
  projection?: {
    reached?: boolean;
    insufficientTrend?: boolean;
    days?: number;
    reachDate?: string;
    gamesNeeded?: number;
    note?: string;
  };
}

export default function RankGoalCard() {
  const [data, setData] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [targetTier, setTargetTier] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadGoal = useCallback(async (tier: string) => {
    if (!tier) return;
    setLoading(true); setError('');
    try {
      const parts = tier.split(/\s+/);
      const res = await fetch('/api/coach/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'goal', targetTier: parts[0], targetDivision: parts[1] || 'IV' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 目標ランクを読んでから goal を叩く
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/coach/target-tier', { credentials: 'include' });
        const json = await res.json();
        const t = json.targetTier || '';
        setTargetTier(t);
        setDraft(t);
        await loadGoal(t);
      } catch (e: any) {
        setError(e.message || '目標ランクの取得に失敗しました');
        setLoading(false);
      }
    })();
  }, [loadGoal]);

  const saveTarget = async () => {
    setSaving(true); setSaveError('');
    try {
      const res = await fetch('/api/coach/target-tier', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存に失敗しました');
      setTargetTier(json.targetTier);
      setDraft(json.targetTier);
      setEditing(false);
      await loadGoal(json.targetTier);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 目標ランクの表示・変更 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-stone-600 dark:text-stone-400">
          目標: <span className="font-black text-stone-900 dark:text-stone-100">{targetTier || '—'}</span>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-border dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            目標を変更
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="例: EMERALD IV / MASTER"
              className="px-2 py-1 text-xs rounded-lg border border-border dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 w-44"
            />
            <button
              onClick={saveTarget}
              disabled={saving}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50 cursor-pointer"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(targetTier); setSaveError(''); }}
              className="text-[11px] px-2 py-1 rounded-lg text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              取消
            </button>
          </div>
        )}
      </div>
      {saveError && <p className="text-xs text-rose-600 dark:text-rose-400">❌ {saveError}</p>}

      {loading ? (
        <div className="py-5 text-center text-xs text-stone-400">読み込み中…</div>
      ) : error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">❌ {error}</p>
      ) : !data?.ranked ? (
        <p className="text-sm text-stone-500">{data?.message || 'ランク情報を取得できませんでした。'}</p>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-border dark:border-stone-700/60 bg-white dark:bg-stone-900/60 px-3 py-2">
              <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400">現在</div>
              <div className="font-black text-stone-900 dark:text-stone-100 mt-0.5">{data.current?.label}</div>
            </div>
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 px-3 py-2">
              <div className="text-[10px] font-bold text-amber-400">目標</div>
              <div className="font-black text-stone-100 mt-0.5">{data.target?.label}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border dark:border-stone-700/60 bg-white dark:bg-stone-900/60 px-3.5 py-2.5 text-xs space-y-1">
            {typeof data.gap === 'number' && (
              <div>
                <span className="text-stone-500 dark:text-stone-400">目標までの差: </span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{data.gap} LP相当</span>
              </div>
            )}
            {data.projection?.reached ? (
              <div className="font-bold text-emerald-500">🎉 目標に到達しています。</div>
            ) : data.projection?.insufficientTrend ? (
              <div className="text-stone-500 dark:text-stone-400">
                到達見込みを出すにはLP推移の記録が足りません（記録 {data.snapshots ?? 0}日分）。
                このカードを開くたびに当日のスナップショットが貯まります。
              </div>
            ) : (
              <>
                {typeof data.lpPerDay === 'number' && (
                  <div>
                    <span className="text-stone-500 dark:text-stone-400">直近の伸び: </span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {data.lpPerDay > 0 ? '+' : ''}{data.lpPerDay} LP/日
                    </span>
                    {typeof data.daySpan === 'number' && (
                      <span className="text-stone-400 ml-1.5">（{data.daySpan}日間の記録から）</span>
                    )}
                  </div>
                )}
                {data.projection?.reachDate && (
                  <div>
                    <span className="text-stone-500 dark:text-stone-400">到達見込み: </span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {data.projection.reachDate}
                      {typeof data.projection.days === 'number' ? `（約${data.projection.days}日後）` : ''}
                    </span>
                  </div>
                )}
                {typeof data.projection?.gamesNeeded === 'number' && (
                  <div>
                    <span className="text-stone-500 dark:text-stone-400">必要な勝ち数の目安: </span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">約{data.projection.gamesNeeded}勝</span>
                  </div>
                )}
                {data.projection?.note && (
                  <div className="text-[10px] text-stone-400 pt-0.5">{data.projection.note}</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
