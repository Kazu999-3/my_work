'use client';

import { useCallback, useEffect, useState } from 'react';
import { Target, RefreshCw, Shuffle, CheckCircle2, XCircle } from 'lucide-react';
import { MISSION_METRIC_BY_KEY, describeTarget, MASTERY_STREAK, type MissionMetricKey } from '@/lib/missionLoop';

// 🎯 今日の1課題（1試合1課題ループ、2026-10-19）。試合前タブと試合後タブに出す。
// 課題は次のランク戦（同じロール）の実測で自動判定され、結果から次の課題が決まる（/api/coach/mission）。
// 課題の数値は目標ランク平均と自分の直近平均の実測から作る。AI は使わない。

interface Mission {
  id: number;
  role: string;
  metric: MissionMetricKey;
  target: number;
  baseline: number | null;
  benchmark: number | null;
  target_tier: string | null;
  reason: string | null;
  status: string;
  actual: number | null;
  champion: string | null;
  match_id: string | null;
  created_at: string;
}

interface Payload {
  mission: Mission | null;
  evaluated: Mission | null;
  history: Mission[];
  stats: { total: number; achieved: number; rate: number | null };
  notice: string | null;
}

const ROLE_LABEL: Record<string, string> = { TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

function ResultLine({ m }: { m: Mission }) {
  const ok = m.status === 'achieved';
  return (
    <div className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
      ok ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300' : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
    }`}>
      {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      <span>
        前回の課題「{describeTarget(m.metric, Number(m.target))}」は
        <b>{ok ? '達成' : '未達'}</b>（{m.champion ? `${m.champion}の試合で ` : ''}実測 {m.actual}）
      </span>
    </div>
  );
}

export default function MissionCard({ riotId }: { riotId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coach/mission?riotId=${encodeURIComponent(riotId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '課題の取得に失敗しました');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [riotId]);

  useEffect(() => { load(); }, [load]);

  const skip = async () => {
    if (!confirm('この課題を外して、別の指標の課題にしますか？')) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/coach/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip', riotId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '課題の変更に失敗しました');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const m = data?.mission;
  const def = m ? MISSION_METRIC_BY_KEY[m.metric] : null;
  // 直近の結果（今回判定した試合があればそれ、なければ履歴の最新）
  const lastResult = data?.evaluated || data?.history?.[0] || null;
  const recent = (data?.history || []).slice(0, 10).reverse();

  return (
    <section className="p-4 rounded-2xl bg-stone-900/70 border border-amber-800/40 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-stone-100 flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" /> 今日の1課題
        </h3>
        <button type="button" onClick={load} disabled={loading} className="text-stone-400 hover:text-stone-100 cursor-pointer disabled:opacity-50" aria-label="再読み込み">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {loading && !data && <p className="text-xs text-stone-500">直近のランク戦を確認しています...</p>}

      {lastResult && (lastResult.status === 'achieved' || lastResult.status === 'missed') && <ResultLine m={lastResult} />}

      {m && def ? (
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-700/60">
            <p className="text-[11px] text-stone-400">次のランク戦（{ROLE_LABEL[m.role] || m.role}）でこれだけを狙う</p>
            <p className="text-lg font-black text-amber-300 mt-0.5">{describeTarget(m.metric, Number(m.target))}</p>
            <p className="text-[11px] text-stone-400 mt-1">
              直近平均 {m.baseline ?? '-'}
              {m.benchmark != null && <> ／ 目標ランク{m.target_tier ? `（${m.target_tier}）` : ''}平均 {Number(m.benchmark)}</>}
            </p>
          </div>
          <p className="text-xs text-stone-300"><span className="text-stone-500">意識すること: </span>{def.focus}</p>
          {m.reason && <p className="text-[11px] text-stone-500">{m.reason}</p>}
        </div>
      ) : (
        !loading && data?.notice && <p className="text-xs text-stone-400">{data.notice}</p>
      )}
      {m && data?.notice && <p className="text-[11px] text-stone-500">{data.notice}</p>}

      {(data?.stats?.total ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
          <span>これまで {data!.stats.achieved}/{data!.stats.total} 達成</span>
          <span className="flex gap-1" aria-label="直近の結果（古い順）">
            {recent.map((h) => (
              <span
                key={h.id}
                title={`${describeTarget(h.metric, Number(h.target))} → ${h.actual}`}
                className={`w-2.5 h-2.5 rounded-full ${h.status === 'achieved' ? 'bg-emerald-500' : 'bg-rose-500/70'}`}
              />
            ))}
          </span>
        </div>
      )}

      {m && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-stone-500">
            同じ課題を{MASTERY_STREAK}回続けて達成すると次の課題に進みます。試合後にこのカードを開くと自動で判定します
          </p>
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="px-2.5 py-1 rounded-lg border border-stone-700 text-stone-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 hover:text-stone-100"
          >
            <Shuffle className="w-3.5 h-3.5" /> 別の課題にする
          </button>
        </div>
      )}
    </section>
  );
}
