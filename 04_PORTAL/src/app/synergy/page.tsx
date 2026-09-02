'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, HeartHandshake, Crown, Skull, Sparkles } from 'lucide-react';
import { Spinner } from '../../components/Feedback';

interface AllyStat {
  p1: string;
  p2: string;
  games: number;
  wins: number;
  winRate: number;
}

interface GroupStat {
  members: string[];
  games: number;
  wins: number;
  winRate: number;
}

export default function SynergyPage() {
  const [loading, setLoading] = useState(true);
  const [allyStats, setAllyStats] = useState<AllyStat[]>([]);
  const [minGames, setMinGames] = useState(3);
  const [groupStats, setGroupStats] = useState<Record<number, GroupStat[]>>({ 3: [], 4: [], 5: [] });
  const [groupSize, setGroupSize] = useState<2 | 3 | 4 | 5>(2);
  const [simPlayer1, setSimPlayer1] = useState('');
  const [simPlayer2, setSimPlayer2] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch('/api/synergy');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '取得に失敗しました');
        setAllyStats(data.allyStats || []);
        setGroupStats(data.groupStats || { 3: [], 4: [], 5: [] });
      } catch (err) {
        console.error("Synergy fetchData Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-stone-900">
        <Spinner label="チームシナジーデータを分析中..." />
      </div>
    );
  }

  // 1. 最強のコンビ (勝率降順)
  const bestAlly = allyStats
    .filter(a => a.games >= minGames)
    .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate);

  // 2. 最弱のコンビ (勝率昇順)
  const worstAlly = allyStats
    .filter(a => a.games >= minGames)
    .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate);

  const groupMin = groupSize >= 4 ? Math.min(minGames, 2) : minGames;
  const filteredGroupsBest = (groupStats[groupSize] || [])
    .filter(g => g.games >= groupMin)
    .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate)
    .slice(0, 50);

  const filteredGroupsWorst = (groupStats[groupSize] || [])
    .filter(g => g.games >= groupMin)
    .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate)
    .slice(0, 50);

  // 全プレイヤー一覧の抽出
  const allPlayerNames = Array.from(
    new Set(allyStats.flatMap(a => [a.p1, a.p2]))
  ).sort();

  // 選択された2人の共闘スタッツ
  const selectedDuoStat = simPlayer1 && simPlayer2 && simPlayer1 !== simPlayer2
    ? allyStats.find(a => (a.p1 === simPlayer1 && a.p2 === simPlayer2) || (a.p1 === simPlayer2 && a.p2 === simPlayer1))
    : null;

  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* 戻るリンク */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 hover:text-stone-900 font-bold text-xs shadow-2xs hover:bg-stone-50 transition"
          >
            <span>←</span>
            <span>ポータルトップへ戻る</span>
          </Link>
        </div>

        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-4 gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 flex items-center gap-2.5">
              <HeartHandshake className="h-7 w-7 text-fuchsia-700" />
              チームシナジー ＆ 相性診断
            </h1>
            <p className="text-stone-500 mt-1 text-xs font-bold">
              誰と組めば勝てるか一発診断🔥 KTM全試合データから勝率を自動算出！
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-1.5 shadow-xs">
            <span className="text-xs font-black text-stone-500">条件:</span>
            <select 
              value={minGames} 
              onChange={e => setMinGames(Number(e.target.value))}
              className="bg-stone-50 border border-stone-300 text-stone-900 rounded-lg px-2 py-1 outline-none focus:border-fuchsia-500 font-bold text-xs cursor-pointer"
            >
              <option value={2}>2試合以上</option>
              <option value={3}>3試合以上</option>
              <option value={5}>5試合以上</option>
              <option value={10}>10試合以上</option>
            </select>
          </div>
        </div>

        {/* ✨ デュオ相性シミュレータ */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-fuchsia-600 h-4 w-4" />
            <h2 className="text-sm font-black text-stone-900">デュオ相性シミュレーター</h2>
            <span className="text-[11px] text-stone-500 font-medium">（2人選んで即座に共闘勝率チェック）</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5">プレイヤー 1</label>
              <select
                value={simPlayer1}
                onChange={e => setSimPlayer1(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 outline-none focus:border-fuchsia-500"
              >
                <option value="">-- 選択してください --</option>
                {allPlayerNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5">プレイヤー 2</label>
              <select
                value={simPlayer2}
                onChange={e => setSimPlayer2(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 outline-none focus:border-fuchsia-500"
              >
                <option value="">-- 選択してください --</option>
                {allPlayerNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {simPlayer1 && simPlayer2 && simPlayer1 !== simPlayer2 && (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-fuchsia-200">
              {selectedDuoStat ? (
                (() => {
                  const duoWinPct = (selectedDuoStat.winRate * 100).toFixed(1);
                  const winRateNum = selectedDuoStat.winRate * 100;
                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {winRateNum >= 65 ? '👑' : winRateNum >= 50 ? '⚡' : '⚠️'}
                        </span>
                        <div>
                          <div className="text-sm font-extrabold text-stone-900">
                            {simPlayer1} & {simPlayer2}
                          </div>
                          <div className="text-xs text-stone-600">
                            共闘数: <strong className="text-stone-900">{selectedDuoStat.games}試合</strong> ({selectedDuoStat.wins}勝 {selectedDuoStat.games - selectedDuoStat.wins}敗)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-stone-500">デュオ勝率</div>
                        <div className={`text-2xl font-black ${winRateNum >= 60 ? 'text-emerald-700' : winRateNum >= 45 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {duoWinPct}%
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-xs text-stone-600 text-center py-2 font-medium">
                  まだこの2人の共闘記録がありません（KTMカスタムで同じチームで試合するとデータが蓄積されます）。
                </div>
              )}
            </div>
          )}
        </div>

        {/* 人数切替タブ (2〜5人選択) */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-surface border border-border p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            <Users className="text-fuchsia-700" size={20} />
            <span className="text-sm font-black text-stone-900">対象人数:</span>
          </div>
          <div className="flex gap-2">
            {([2, 3, 4, 5] as const).map(n => (
              <button key={n} onClick={() => setGroupSize(n)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${groupSize === n ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-500/20' : 'bg-background text-stone-500 hover:text-stone-900 border border-border'}`}>
                {n}人コンビ / チーム
              </button>
            ))}
          </div>
        </div>

        {/* メイン: 左右に「最強のコンビ」と「最弱のコンビ」を配置 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* 左カード: 最強のコンビ */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-500"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-emerald-700 flex items-center gap-2">
                <Crown className="h-6 w-6" /> 最強のコンビ <span className="text-xs text-stone-500 font-normal">(Best Combo)</span>
              </h2>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {groupSize > 2 ? (
                filteredGroupsBest.length === 0 ? (
                  <div className="text-center text-stone-500 py-12">この条件で一緒に戦った組み合わせがありません</div>
                ) : (
                  filteredGroupsBest.map((g, i) => (
                    <div key={g.members.join('-')} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 ${i < 3 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-black/5 text-stone-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {g.members.map((m, idx) => (
                            <span key={m} className="font-bold text-stone-900 text-sm">
                              {m}{idx < g.members.length - 1 && <span className="text-stone-500 mx-1">・</span>}
                            </span>
                          ))}
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="text-xl font-black text-emerald-700">
                            {(g.winRate * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-stone-500 font-bold">{g.games}戦 {g.wins}勝</div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : bestAlly.length === 0 ? (
                <div className="text-center text-stone-500 py-12">該当するデータがありません</div>
              ) : (
                bestAlly.map((stat, i) => (
                  <div key={`${stat.p1}-${stat.p2}`} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${i < 3 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-black/5 text-stone-500'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-stone-900 text-base">{stat.p1}</span>
                        <span className="text-emerald-700 text-xs font-black">🤝</span>
                        <span className="font-bold text-stone-900 text-base">{stat.p2}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="text-2xl font-black text-emerald-700">
                          {(stat.winRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-stone-500 font-bold">
                          {stat.games}戦 {stat.wins}勝
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 右カード: 最弱のコンビ */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-pink-600"></div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-rose-700 flex items-center gap-2">
                <Skull className="h-6 w-6" /> 最弱のコンビ <span className="text-xs text-stone-500 font-normal">(Worst Combo)</span>
              </h2>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {groupSize > 2 ? (
                filteredGroupsWorst.length === 0 ? (
                  <div className="text-center text-stone-500 py-12">この条件で一緒に戦った組み合わせがありません</div>
                ) : (
                  filteredGroupsWorst.map((g, i) => (
                    <div key={g.members.join('-')} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 bg-rose-100 text-rose-700 border border-rose-200">
                        {i + 1}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {g.members.map((m, idx) => (
                            <span key={m} className="font-bold text-stone-900 text-sm">
                              {m}{idx < g.members.length - 1 && <span className="text-stone-500 mx-1">・</span>}
                            </span>
                          ))}
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="text-xl font-black text-rose-700">
                            {(g.winRate * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-stone-500 font-bold">{g.games}戦 {g.wins}勝</div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : worstAlly.length === 0 ? (
                <div className="text-center text-stone-500 py-12">該当するデータがありません</div>
              ) : (
                worstAlly.map((stat, i) => (
                  <div key={`${stat.p1}-${stat.p2}`} className="flex items-center gap-4 bg-white/70 hover:bg-black/5 p-4 rounded-2xl border border-border transition">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black bg-rose-100 text-rose-700 border border-rose-200">
                      {i + 1}
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-stone-900 text-base">{stat.p1}</span>
                        <span className="text-rose-700 text-xs font-black">🤝</span>
                        <span className="font-bold text-stone-900 text-base">{stat.p2}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="text-2xl font-black text-rose-700">
                          {(stat.winRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-stone-500 font-bold">
                          {stat.games}戦 {stat.wins}勝
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
