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

export default function MySoloQDashboard({ refreshSignal }: { refreshSignal?: number } = {}) {
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
    // refreshSignalは振り返り保存完了時にインクリメントされる。このダッシュボードは
    // 常時マウントのため、保存後も再fetchせず「保存したのに一覧が更新されない」状態に
    // なっていた(2026-08-05発覚)。
  }, [refreshSignal]);

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

  // 直近の連敗数を算出 (最新の試合から連続で敗北している数)
  const consecutiveLosses = (() => {
    let count = 0;
    for (const r of reflections) {
      if (!r.win) count++;
      else break;
    }
    return count;
  })();

  return (
    <div className="space-y-4">
      {/* ⚠️ 連敗検知時のAIメンタルクールダウン安全装置 */}
      {consecutiveLosses >= 3 && (
        <div className="bg-rose-500/10 border-2 border-rose-400 rounded-2xl p-4 text-stone-900 shadow-md flex items-center justify-between flex-wrap gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-extrabold text-rose-900 text-sm">
                現在 {consecutiveLosses} 連敗中！ AIメンタルクールダウン推奨
              </div>
              <p className="text-xs text-rose-800/80 mt-0.5">
                熱くなった状態での連戦は勝率が平均35%低下します。15分間の離脱・休憩をおすすめします。
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* 🧠 メンタル評価と勝率の相関サマリー */}
      {!loading && reflections.length > 0 && (() => {
        const highMental = reflections.filter((r) => r.mental_rating >= 4);
        const lowMental = reflections.filter((r) => r.mental_rating <= 2);
        const highWinRate = highMental.length ? Math.round((highMental.filter((r) => r.win).length / highMental.length) * 100) : 0;
        const lowWinRate = lowMental.length ? Math.round((lowMental.filter((r) => r.win).length / lowMental.length) * 100) : 0;

        return (
          <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-300/40 rounded-2xl p-4 mb-4 shadow-sm">
            <div className="text-xs font-black text-amber-900 mb-2 flex items-center justify-between">
              <span>🧠 メンタル状態 × 勝率の可視化分析</span>
              <span className="text-[10px] text-amber-700 font-normal">過去{reflections.length}戦のデータ</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm">
                <div className="text-emerald-800 font-bold text-[11px] mb-0.5">🟢 冷静・安定時 (メンタル4〜5)</div>
                <div className="text-xl font-black text-emerald-700">{highWinRate}% <span className="text-xs font-normal text-stone-500">({highMental.length}試合)</span></div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-sm">
                <div className="text-rose-800 font-bold text-[11px] mb-0.5">🔴 焦り・イライラ時 (メンタル1〜2)</div>
                <div className="text-xl font-black text-rose-700">{lowWinRate}% <span className="text-xs font-normal text-stone-500">({lowMental.length}試合)</span></div>
              </div>
            </div>

            {/* 直近10試合のメンタルスコア×勝敗の視覚的トレンドミニグラフ */}
            <div className="mt-3 bg-white p-3 rounded-xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-bold text-stone-500 block mb-2 uppercase">📈 直近10試合のメンタル ⇄ 勝敗トレンド</span>
              <div className="flex items-end justify-between gap-1.5 h-16 pt-2 px-1">
                {reflections.slice(0, 10).reverse().map((r, idx) => {
                  const rating = r.mental_rating || 3;
                  const heightPct = (rating / 5) * 100;
                  return (
                    <div key={r.id || idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* ホバーツールチップ */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-stone-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none transition whitespace-nowrap z-20">
                        {r.champion || 'Champ'} ({r.win ? 'WIN' : 'LOSE'}) / メンタル{rating}
                      </div>
                      <div className="w-full bg-stone-100 rounded-t h-full flex items-end overflow-hidden">
                        <div
                          className={`w-full transition-all duration-300 ${
                            r.win
                              ? 'bg-gradient-to-t from-emerald-500 to-emerald-400'
                              : 'bg-gradient-to-t from-rose-500 to-rose-400'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-black ${r.win ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {r.win ? 'W' : 'L'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

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
