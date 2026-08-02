'use client';

import React, { useState } from 'react';

interface Recommendation {
  champion: string;
  role: string;
  reason: string;
  synergyScore: number;
  counterScore: number;
}

export default function PickRecommendationTab() {
  const [role, setRole] = useState('MID');
  const [enemyPickInput, setEnemyPickInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommends, setRecommends] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState('');

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const enemies = enemyPickInput.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/soloq/pick-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, enemyTeam: enemies }),
      });
      const data = await res.json();
      setRecommends(data.recommendations || []);
      setSummary(data.analysisSummary || '');
    } catch {
      setRecommends([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-foreground/50">
        BAN/PICK中、指定したレーンで「味方との相性」と「相手へのカウンター度」が最も高い推奨ピック Top3 をデータ表示します。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/5 p-3.5 rounded-xl border border-black/10">
        <div>
          <label className="block text-[11px] font-bold text-foreground/60 mb-1">担当レーン</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="TOP">TOP (トップ)</option>
            <option value="JUNGLE">JUNGLE (ジャングル)</option>
            <option value="MID">MID (ミッド)</option>
            <option value="ADC">ADC (ボットキャリー)</option>
            <option value="SUPPORT">SUPPORT (サポート)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-foreground/60 mb-1">相手の確定ピック (カンマ区切り・任意)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="例: Malphite, Yasuo"
              value={enemyPickInput}
              onChange={(e) => setEnemyPickInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-stone-300 rounded-lg bg-white text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={fetchRecommendations}
              disabled={loading}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow transition-colors shrink-0 disabled:opacity-50"
            >
              {loading ? '計算中...' : '推奨ピック表示'}
            </button>
          </div>
        </div>
      </div>

      {summary && <p className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">{summary}</p>}

      {recommends.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recommends.map((rec, idx) => (
            <div key={rec.champion} className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  第 {idx + 1} 推奨
                </span>
                <span className="text-[11px] font-bold text-emerald-700">
                  カウンター度: {rec.counterScore}%
                </span>
              </div>
              <h4 className="text-base font-extrabold text-stone-900">{rec.champion}</h4>
              <p className="text-xs text-stone-600 leading-relaxed">{rec.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
