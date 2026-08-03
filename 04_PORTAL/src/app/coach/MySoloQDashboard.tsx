'use client';

import React, { useState, useEffect } from 'react';

interface SoloQReflection {
  id: string;
  created_at: string;
  match_id: string;
  champion: string;
  enemy_champion: string;
  win: boolean;
  kda: string;
  cs: number;
  mental_rating: number;
  win_lose_reason_tags: string[];
  reflection_note: string;
  matchup_memo: string;
  next_focus_point: string;
}

export default function MySoloQDashboard() {
  const [reflections, setReflections] = useState<SoloQReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAllReflections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/soloq/reflections?limit=200');
      const data = await res.json();
      setReflections(data.reflections || (data.reflection ? [data.reflection] : []));
    } catch {
      setReflections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReflections();
  }, []);

  const filtered = reflections.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.champion?.toLowerCase().includes(q) ||
      r.enemy_champion?.toLowerCase().includes(q) ||
      r.reflection_note?.toLowerCase().includes(q) ||
      r.matchup_memo?.toLowerCase().includes(q) ||
      r.next_focus_point?.toLowerCase().includes(q)
    );
  });

  const totalMatches = reflections.length;
  const wins = reflections.filter((r) => r.win).length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const avgMental =
    totalMatches > 0
      ? (reflections.reduce((acc, r) => acc + (r.mental_rating || 3), 0) / totalMatches).toFixed(1)
      : '3.0';

  return (
    <div className="space-y-4">
      {/* スタッツハイライト */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-center shadow-sm">
          <span className="text-[11px] text-stone-500 font-medium block">総振り返り数</span>
          <span className="text-xl font-extrabold text-stone-900">{totalMatches} <span className="text-xs font-normal text-stone-500">試合</span></span>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-center shadow-sm">
          <span className="text-[11px] text-stone-500 font-medium block">振り返り試合の勝率</span>
          <span className={`text-xl font-extrabold ${winRate >= 50 ? 'text-emerald-700' : 'text-rose-700'}`}>{winRate}%</span>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-center shadow-sm">
          <span className="text-[11px] text-stone-500 font-medium block">平均集中・メンタル度</span>
          <span className="text-xl font-extrabold text-amber-800">{avgMental} <span className="text-xs font-normal text-stone-500">/ 5</span></span>
        </div>
      </div>

      {/* 検索バー */}
      <div className="flex justify-between items-center bg-black/5 p-3 rounded-xl border border-black/10">
        <h4 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
          <span>📊</span> 過去ログ ＆ 対面メモ検索
        </h4>
        <input
          type="text"
          placeholder="チャンプ名、メモキーワード検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 border border-stone-300 rounded-lg text-xs bg-white text-stone-900 w-64 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {loading && <div className="text-center py-8 text-xs text-stone-500">ダッシュボードデータをロード中...</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-8 text-xs text-stone-500 italic">該当する振り返りログが見つかりません。</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((ref) => (
            <div key={ref.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 font-bold text-[10px] rounded text-white ${ref.win ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                    {ref.win ? 'WIN' : 'LOSE'}
                  </span>
                  <span className="font-bold text-stone-900 text-sm">{ref.champion}</span>
                  <span className="text-xs text-stone-400">vs</span>
                  <span className="font-bold text-stone-700 text-sm">{ref.enemy_champion || 'Unknown'}</span>
                </div>
                <div className="text-[11px] text-stone-500">
                  {new Date(ref.created_at).toLocaleString('ja-JP')}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-700">
                <span>KDA: <strong>{ref.kda || '-'}</strong></span>
                <span>CS: <strong>{ref.cs ?? '-'}</strong></span>
                <span>メンタル: <strong className="text-amber-800">{ref.mental_rating}/5</strong></span>
                {ref.next_focus_point && (
                  <span className="text-emerald-800">次回テーマ: <strong>{ref.next_focus_point}</strong></span>
                )}
              </div>

              {ref.reflection_note && (
                <div className="text-xs bg-stone-50 p-2 rounded border border-stone-100 text-stone-800">
                  <strong className="text-stone-900">反省メモ:</strong> {ref.reflection_note}
                </div>
              )}
              {ref.matchup_memo && (
                <div className="text-xs bg-amber-50/90 p-2 rounded border border-amber-200/80 text-amber-950 font-medium">
                  <strong className="text-amber-900">対面メモ:</strong> {ref.matchup_memo}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
