'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, BookOpen, Award, CheckCircle2 } from 'lucide-react';
import type { TacticVerificationReport } from '@/lib/tacticVerifier';

export default function TacticScoreCard({ riotId, matchId }: { riotId: string; matchId?: string }) {
  const [report, setReport] = useState<TacticVerificationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!riotId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ riotId });
        if (matchId) query.set('matchId', matchId);

        const res = await fetch(`/api/lol/tactic-verify?${query.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled && data.report) {
          setReport(data.report);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || '戦術スコアの取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [riotId, matchId]);

  if (!riotId) return null;

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span>バイブル攻略知識の実戦遵守度を照合中…</span>
      </div>
    );
  }

  if (error || !report) {
    return null; // データがない時は静かに隠す
  }

  const getRatingBadge = (rating: TacticVerificationReport['rating']) => {
    switch (rating) {
      case 'PERFECT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-950/60 text-emerald-400 border border-emerald-700">PERFECT 100点</span>;
      case 'GOOD':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-950/60 text-amber-400 border border-amber-700">GOOD {report.totalScore}点</span>;
      case 'NEEDS_WORK':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-950/60 text-orange-400 border border-orange-700">要改善 {report.totalScore}点</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-950/60 text-rose-400 border border-rose-700">POOR {report.totalScore}点</span>;
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-black text-zinc-100 flex items-center gap-1.5">
            <span>📘 攻略バイブル遵守スコア</span>
            <span className="text-[10px] text-zinc-400 font-normal">（{report.championName}）</span>
          </h3>
        </div>
        <div>{getRatingBadge(report.rating)}</div>
      </div>

      <p className="text-xs text-zinc-300 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80 leading-relaxed">
        {report.summaryMessage}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {report.rules.map((rule) => (
          <div
            key={rule.id}
            className={`p-2.5 rounded-xl border flex flex-col justify-between text-xs transition ${
              rule.complied
                ? 'bg-zinc-950/40 border-emerald-900/40 text-zinc-300'
                : 'bg-zinc-950/40 border-amber-900/40 text-zinc-300'
            }`}
          >
            <div className="flex items-start justify-between gap-1 mb-1">
              <span className="font-bold text-[11px] text-zinc-200">{rule.title}</span>
              {rule.complied ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
            </div>
            <div className="text-[10px] text-zinc-400">{rule.evidence}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
