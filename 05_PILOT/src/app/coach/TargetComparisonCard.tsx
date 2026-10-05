'use client';

import { useEffect, useState } from 'react';
import { Target, Pencil, X } from 'lucide-react';
import { TARGET_METRICS, type RoleTargets, type TargetMetricKey, type CoachTargets } from '@/lib/coachTargetMetrics';

// 目標との比較（2026-10-06）。目標値はランク帯の実在の平均ではなく、プレイヤー自身が決めた値。
// 実測の「この試合」「直近の同じロールの平均」と並べて、足りていない指標を出す。

const ROLE_LABEL: Record<string, string> = { TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

interface Props {
  role: string;
  thisMatch: Partial<Record<TargetMetricKey, number | null>>;
  recentAvg: Partial<Record<TargetMetricKey, number | null>>;
  recentCount: number;
}

const fmt = (v: number | null | undefined) =>
  v == null ? '-' : Number.isInteger(v) ? v.toLocaleString() : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, '');

export default function TargetComparisonCard({ role, thisMatch, recentAvg, recentCount }: Props) {
  const [targets, setTargets] = useState<RoleTargets>({});
  const [targetTier, setTargetTier] = useState('');
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/coach/targets', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '目標値の取得に失敗しました');
        setTargets(((json.targets || {}) as CoachTargets)[role as keyof CoachTargets] || {});
        setTargetTier(json.targetTier || '');
      } catch (e: any) {
        setLoadError(e.message);
      }
    })();
  }, [role]);

  const startEdit = () => {
    setDraft(Object.fromEntries(TARGET_METRICS.map((m) => [m.key, targets[m.key] != null ? String(targets[m.key]) : ''])));
    setSaveError('');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/coach/targets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, values: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存に失敗しました');
      setTargets((json.targets || {})[role] || {});
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const configured = TARGET_METRICS.filter((m) => targets[m.key] != null);
  const shortOf = (key: TargetMetricKey, v: number | null | undefined) => {
    const m = TARGET_METRICS.find((x) => x.key === key)!;
    const t = targets[key];
    if (t == null || v == null) return null;
    return m.lowerIsBetter ? v > t : v < t;
  };
  const missing = configured.filter((m) => shortOf(m.key, thisMatch[m.key]) === true);
  const roleLabel = ROLE_LABEL[role] || role;

  return (
    <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-black text-stone-100 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-amber-400" />
          目標との比較（{roleLabel}）
          {targetTier && <span className="text-[10px] font-bold text-stone-500">目標ランク: {targetTier}</span>}
        </span>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-[11px] font-bold text-stone-300 hover:text-stone-100 bg-stone-900 hover:bg-stone-800 border border-stone-800 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Pencil className="w-3 h-3" /> 目標値を{configured.length ? '編集' : '設定'}
          </button>
        )}
      </div>

      {loadError && <p className="text-[11px] text-rose-400">{loadError}</p>}

      {editing ? (
        <div className="space-y-3">
          <p className="text-[11px] text-stone-400">
            {roleLabel}で目指す値を入力してください。空欄の指標は比較しません。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TARGET_METRICS.map((m) => (
              <label key={m.key} className="flex items-center justify-between gap-2 bg-stone-900/60 border border-stone-800 rounded-lg px-2.5 py-1.5">
                <span className="text-[11px] text-stone-300 font-bold">
                  {m.label}
                  <span className="text-[10px] text-stone-500 font-normal ml-1">{m.lowerIsBetter ? '以下' : '以上'}</span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={m.step}
                  value={draft[m.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [m.key]: e.target.value }))}
                  className="w-20 px-2 py-1 bg-stone-950 border border-stone-700 rounded text-right text-xs font-mono text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </label>
            ))}
          </div>
          {saveError && <p className="text-[11px] text-rose-400">{saveError}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-stone-300 bg-stone-900 hover:bg-stone-800 flex items-center gap-1 cursor-pointer">
              <X className="w-3 h-3" /> キャンセル
            </button>
            <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-amber-700 hover:bg-amber-600 disabled:opacity-50 cursor-pointer">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : configured.length === 0 ? (
        <p className="text-[11px] text-stone-400">
          {roleLabel}の目標値がまだありません。「目標値を設定」から、目標ランクに上がるために目指すCS/分・デス数などを入力すると、この試合で足りなかった指標が表示されます。
        </p>
      ) : (
        <>
          {missing.length > 0 ? (
            <div className="bg-rose-950/30 border border-rose-800/60 rounded-lg p-2.5 text-[11px]">
              <span className="font-black text-rose-400">この試合で目標に届かなかった指標: </span>
              <span className="text-stone-200">{missing.map((m) => m.label).join('・')}</span>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-2.5 text-[11px] text-emerald-400 font-bold">
              この試合は、設定した目標をすべて満たしています。
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-stone-500 text-[10px]">
                  <th className="text-left font-bold py-1"></th>
                  <th className="text-right font-bold py-1">目標</th>
                  <th className="text-right font-bold py-1">この試合</th>
                  <th className="text-right font-bold py-1">直近{recentCount}戦平均</th>
                </tr>
              </thead>
              <tbody>
                {configured.map((m) => {
                  const cell = (v: number | null | undefined) => {
                    const s = shortOf(m.key, v);
                    return <span className={s == null ? 'text-stone-400' : s ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{fmt(v)}</span>;
                  };
                  return (
                    <tr key={m.key} className="border-t border-stone-800/60">
                      <td className="py-1.5 text-stone-400 font-sans font-bold">{m.label}</td>
                      <td className="py-1.5 text-right text-stone-200">
                        {fmt(targets[m.key])}<span className="text-[9px] text-stone-500 ml-0.5">{m.lowerIsBetter ? '以下' : '以上'}</span>
                      </td>
                      <td className="py-1.5 text-right">{cell(thisMatch[m.key])}</td>
                      <td className="py-1.5 text-right">{cell(recentAvg[m.key])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-[10px] text-stone-500">
        目標値はランク帯の実際の平均ではなく、自分で決めた値です。直近平均は直近のソロQのうち{roleLabel}で出た{recentCount}試合（15分CSは試合ごとのタイムラインが必要なため、この試合のみ）。
      </p>
    </div>
  );
}
