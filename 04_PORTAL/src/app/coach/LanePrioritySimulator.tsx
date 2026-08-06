'use client';

import React, { useState } from 'react';

interface LanePriority {
  lane: string;
  myChampion: string;
  enemyChampion: string;
  priorityScore: number; // 1~5
  advantageLabel: '有利' | '微有利' | '互角' | '微不利' | '不利';
  advice: string;
}

export default function LanePrioritySimulator() {
  const [loading, setLoading] = useState(false);
  const [priorities, setPriorities] = useState<LanePriority[]>([]);
  const [prediction, setPrediction] = useState<any>(null);

  const simulate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/soloq/lane-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setPriorities(data.lanePriorities || []);
      setPrediction(data.gamePrediction || null);
    } catch {
      setPriorities([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[10px] font-black text-amber-700 shrink-0">準備中</span>
          <p className="text-xs text-foreground/50">
            5v5のチーム構成から各レーンの序盤ウェーブ主導権（プッシュ優先権）と中盤の展開を予測する機能です。現在はサンプル表示のみで、実際のチーム構成には未連動です。実データ分析は今後対応予定です。
          </p>
        </div>
        <button
          type="button"
          onClick={simulate}
          disabled={loading}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow transition-colors shrink-0 disabled:opacity-50"
        >
          {loading ? 'シミュレート中...' : '📊 5レーン主導権シミュレート'}
        </button>
      </div>

      {priorities.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {priorities.map((lp) => {
              const scoreColor =
                lp.priorityScore >= 4 ? 'bg-emerald-600 text-white' : lp.priorityScore === 3 ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white';

              // Lv1-6 の主導権推移タイムラインデータ（スコアに応じた目安）
              const timelineLevels = [
                { lv: 'Lv1', label: lp.priorityScore >= 4 ? 'Push' : lp.priorityScore === 3 ? 'Even' : 'Pull', color: lp.priorityScore >= 4 ? 'bg-blue-500' : lp.priorityScore === 3 ? 'bg-amber-400' : 'bg-rose-500' },
                { lv: 'Lv2', label: lp.priorityScore >= 4 ? 'Push' : lp.priorityScore >= 3 ? 'Push' : 'Pull', color: lp.priorityScore >= 3 ? 'bg-blue-500' : 'bg-rose-500' },
                { lv: 'Lv3', label: lp.priorityScore >= 3 ? 'Gankok' : 'Pull', color: lp.priorityScore >= 3 ? 'bg-emerald-500' : 'bg-rose-500' },
                { lv: 'Lv6', label: lp.priorityScore >= 4 ? 'Power' : lp.priorityScore === 3 ? 'UltPower' : 'Safe', color: lp.priorityScore >= 3 ? 'bg-indigo-500' : 'bg-amber-500' },
              ];

              return (
                <div key={lp.lane} className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-2 shadow-sm flex flex-col justify-between">
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block tracking-wider">{lp.lane}</span>
                    <div className="text-xs font-extrabold text-stone-900 truncate">
                      {lp.myChampion} <span className="text-stone-400 font-normal">vs</span> {lp.enemyChampion}
                    </div>
                    <div className={`mt-1 py-0.5 px-2 text-[11px] font-bold rounded-full inline-block ${scoreColor}`}>
                      主導権: {lp.advantageLabel} ({lp.priorityScore}/5)
                    </div>
                  </div>

                  {/* 📈 Lv1-6 主導権グラフィックタイムライン */}
                  <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/80 space-y-1">
                    <span className="text-[9px] font-bold text-stone-400 block text-center">📈 レベル別主導権 (Priority Timeline)</span>
                    <div className="grid grid-cols-4 gap-1 text-[9px] font-black text-center text-white">
                      {timelineLevels.map((tl) => (
                        <div key={tl.lv} className={`${tl.color} py-1 rounded shadow-xs flex flex-col items-center justify-center`} title={`${tl.lv}: ${tl.label}`}>
                          <span className="opacity-80 text-[8px]">{tl.lv}</span>
                          <span className="leading-tight">{tl.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-600 leading-tight pt-1.5 border-t border-stone-100">{lp.advice}</p>
                </div>
              );
            })}
          </div>

          {prediction && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-stone-800">
              <h5 className="font-bold text-amber-900 flex items-center gap-1">
                <span>🔮</span> 試合展開予測 ＆ オブジェクト優先権
              </h5>
              <p>・<strong>序盤展開:</strong> {prediction.earlyGameFocus}</p>
              <p>・<strong>ドラゴン優先度:</strong> {prediction.dragonPriority}</p>
              <p>・<strong>集団戦スタイル:</strong> {prediction.teamfightStyle}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
