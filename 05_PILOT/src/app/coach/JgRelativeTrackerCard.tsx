'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { getChampIcon } from '@/lib/ddragonClient';
import { Swords, Trophy, AlertTriangle, ShieldCheck, Flame, ChevronRight, Activity } from 'lucide-react';
import type { PostgameJgAnalysisReport } from '@/lib/postgameJgMetrics';

interface JgRelativeTrackerCardProps {
  report: PostgameJgAnalysisReport;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const diffColor = (n: number, reverse = false) => {
  if (n === 0) return 'text-stone-400';
  const isPositive = reverse ? n < 0 : n > 0;
  return isPositive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
};

export default function JgRelativeTrackerCard({ report }: JgRelativeTrackerCardProps) {
  const [selectedMinute, setSelectedMinute] = useState<10 | 15>(15);

  const snapshot = selectedMinute === 15 ? report.fifteenMinSnapshot : report.tenMinSnapshot;
  if (!snapshot) return null;

  const { me, enemy, diff, foresterBorder } = snapshot;

  return (
    <section className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-4">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800/80 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black text-stone-100 uppercase tracking-wider">
              対面JG相対トラッカー（FORESTER 10,000試合モデル）
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              実測検証済み
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            味方JG vs 敵JGの直接比較。15分時点で敵JGより「KP多く＋Death少ない」側の勝率は <strong className="text-amber-300 font-bold">74.39%</strong> です。
          </p>
        </div>

        {/* 10分 / 15分 切替タブ */}
        <div className="flex items-center rounded-lg bg-stone-950 p-1 border border-stone-800">
          <button
            type="button"
            onClick={() => setSelectedMinute(10)}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              selectedMinute === 10
                ? 'bg-stone-800 text-stone-100 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            10分時点 (勝率68.4%)
          </button>
          <button
            type="button"
            onClick={() => setSelectedMinute(15)}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              selectedMinute === 15
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            15分時点 (勝率74.4%)
          </button>
        </div>
      </div>

      {/* 勝利ボーダー判定バナー */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          foresterBorder.status === 'success'
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
            : foresterBorder.status === 'danger'
            ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
            : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              foresterBorder.status === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : foresterBorder.status === 'danger'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {foresterBorder.status === 'success' ? (
              <Trophy className="w-5 h-5" />
            ) : foresterBorder.status === 'danger' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider">{foresterBorder.badge}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-stone-900/80 border border-stone-700">
                期待勝率: {foresterBorder.borderRate}
              </span>
            </div>
            <p className="text-xs text-stone-300 mt-0.5">{foresterBorder.description}</p>
          </div>
        </div>
      </div>

      {/* 対比テーブル */}
      <div className="overflow-x-auto rounded-xl border border-stone-800 bg-stone-950/60">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-stone-800/80 text-[11px] text-stone-400 bg-stone-900/40">
              <th className="py-2.5 px-3">指標</th>
              <th className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <Image
                    src={getChampIcon(me.championName)}
                    alt={me.championName}
                    width={20}
                    height={20}
                    className="rounded-full border border-stone-700"
                  />
                  <span>あなた ({me.championName})</span>
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">対面差分</th>
              <th className="py-2.5 px-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>敵JG ({enemy.championName})</span>
                  <Image
                    src={getChampIcon(enemy.championName)}
                    alt={enemy.championName}
                    width={20}
                    height={20}
                    className="rounded-full border border-stone-700"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/50">
            {/* KP */}
            <tr className="hover:bg-stone-900/30">
              <td className="py-2.5 px-3 font-medium text-stone-300">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>KP (Kill+Assist絶対数)</span>
                </div>
              </td>
              <td className="py-2.5 px-3 font-mono font-bold text-stone-100">{me.kp}</td>
              <td className={`py-2.5 px-3 font-mono text-center ${diffColor(diff.kpDiff)}`}>
                {signed(diff.kpDiff)}
              </td>
              <td className="py-2.5 px-3 font-mono text-right text-stone-400">{enemy.kp}</td>
            </tr>

            {/* Death */}
            <tr className="hover:bg-stone-900/30">
              <td className="py-2.5 px-3 font-medium text-stone-300">
                <span>デス数</span>
              </td>
              <td className="py-2.5 px-3 font-mono font-bold text-stone-100">{me.deaths}</td>
              <td className={`py-2.5 px-3 font-mono text-center ${diffColor(diff.deathDiff, true)}`}>
                {signed(diff.deathDiff)}
              </td>
              <td className="py-2.5 px-3 font-mono text-right text-stone-400">{enemy.deaths}</td>
            </tr>

            {/* Gold */}
            <tr className="hover:bg-stone-900/30">
              <td className="py-2.5 px-3 font-medium text-stone-300">
                <span>獲得ゴールド</span>
              </td>
              <td className="py-2.5 px-3 font-mono text-stone-100">{me.gold.toLocaleString()} G</td>
              <td className={`py-2.5 px-3 font-mono text-center ${diffColor(diff.goldDiff)}`}>
                {signed(diff.goldDiff)} G
              </td>
              <td className="py-2.5 px-3 font-mono text-right text-stone-400">{enemy.gold.toLocaleString()} G</td>
            </tr>

            {/* CS */}
            <tr className="hover:bg-stone-900/30">
              <td className="py-2.5 px-3 font-medium text-stone-300">
                <span>CS（通常+中立）</span>
              </td>
              <td className="py-2.5 px-3 font-mono text-stone-100">{me.cs}</td>
              <td className={`py-2.5 px-3 font-mono text-center ${diffColor(diff.csDiff)}`}>
                {signed(diff.csDiff)}
              </td>
              <td className="py-2.5 px-3 font-mono text-right text-stone-400">{enemy.cs}</td>
            </tr>

            {/* Dragon */}
            <tr className="hover:bg-stone-900/30">
              <td className="py-2.5 px-3 font-medium text-stone-300">
                <span>チームドラゴン獲得数</span>
              </td>
              <td className="py-2.5 px-3 font-mono text-stone-100">{me.dragons} 体</td>
              <td className={`py-2.5 px-3 font-mono text-center ${diffColor(diff.dragonDiff)}`}>
                {signed(diff.dragonDiff)}
              </td>
              <td className="py-2.5 px-3 font-mono text-right text-stone-400">{enemy.dragons} 体</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 毎分KP/Death推移ミニタイムライン */}
      {report.history15m.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span className="font-bold flex items-center gap-1.5 text-stone-300">
              <Activity className="w-3.5 h-3.5 text-amber-400" /> 0分〜15分のKP・Death推移
            </span>
            <span className="text-[10px] text-stone-500">（各分時点の累計）</span>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1 p-2 rounded-xl bg-stone-950 border border-stone-800/80">
            {report.history15m.map((h) => {
              const kpLead = h.myKp - h.enemyKp;
              const deathLead = h.enemyDeaths - h.myDeaths; // 敵の方が多い＝自分リード
              const isDominant = kpLead > 0 && deathLead > 0;
              const isLosing = kpLead < 0 || deathLead < 0;

              return (
                <div
                  key={h.minute}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-[10px] font-mono transition-all ${
                    h.minute === selectedMinute
                      ? 'ring-2 ring-amber-400 border-amber-500 bg-stone-800'
                      : isDominant
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                      : isLosing
                      ? 'bg-rose-950/30 border-rose-900/40 text-rose-300'
                      : 'bg-stone-900/60 border-stone-800 text-stone-400'
                  }`}
                  title={`${h.minute}分: 自分(KP:${h.myKp}, D:${h.myDeaths}) vs 敵(KP:${h.enemyKp}, D:${h.enemyDeaths}) / G差: ${signed(h.goldDiff)}G`}
                >
                  <span className="text-[9px] text-stone-500">{h.minute}分</span>
                  <span className="font-bold">{h.myKp}:{h.enemyKp}</span>
                  <span className="text-[8px] text-stone-500">D:{h.myDeaths}:{h.enemyDeaths}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
