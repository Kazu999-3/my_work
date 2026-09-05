'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Users, HeartHandshake, Crown, Skull, Sparkles, Filter, Search, UserCheck, ArrowRight, Trophy } from 'lucide-react';
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
  const [allPlayersList, setAllPlayersList] = useState<string[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [minGames, setMinGames] = useState(1);
  const [groupStats, setGroupStats] = useState<Record<number, GroupStat[]>>({ 3: [], 4: [], 5: [] });
  const [groupSize, setGroupSize] = useState<2 | 3 | 4 | 5>(2);
  const [filterPlayer, setFilterPlayer] = useState<string>('ALL');
  
  // シミュレーター用ステート
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
        setAllPlayersList(data.allPlayers || []);
        setTotalMatches(data.totalMatches || 0);
      } catch (err) {
        console.error("Synergy fetchData Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 全プレイヤー一覧の統合
  const allPlayerNames = useMemo(() => {
    return Array.from(
      new Set([...allPlayersList, ...allyStats.flatMap(a => [a.p1, a.p2])])
    ).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [allPlayersList, allyStats]);

  // プレイヤー1が選択された時の、相性Top3 & 最悪Top3のサジェスト
  const player1Suggestions = useMemo(() => {
    if (!simPlayer1) return { best: [], worst: [] };
    const myStats = allyStats.filter(a => a.p1 === simPlayer1 || a.p2 === simPlayer1);
    const mapped = myStats.map(s => {
      const partner = s.p1 === simPlayer1 ? s.p2 : s.p1;
      return { partner, games: s.games, wins: s.wins, winRate: s.winRate };
    });
    
    // ベスト相棒 (勝率降順、同率なら試合数)
    const best = [...mapped]
      .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate)
      .slice(0, 3);

    // 要注意相棒 (勝率昇順、同率なら試合数)
    const worst = [...mapped]
      .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate)
      .slice(0, 3);

    return { best, worst };
  }, [simPlayer1, allyStats]);

  // 2人コンビのフィルタリング
  const filteredBestAlly = useMemo(() => {
    return allyStats
      .filter(a => {
        if (a.games < minGames) return false;
        if (filterPlayer !== 'ALL' && a.p1 !== filterPlayer && a.p2 !== filterPlayer) return false;
        return true;
      })
      .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate);
  }, [allyStats, minGames, filterPlayer]);

  const filteredWorstAlly = useMemo(() => {
    return allyStats
      .filter(a => {
        if (a.games < minGames) return false;
        if (filterPlayer !== 'ALL' && a.p1 !== filterPlayer && a.p2 !== filterPlayer) return false;
        return true;
      })
      .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate);
  }, [allyStats, minGames, filterPlayer]);

  // 3〜5人チームのフィルタリング
  const filteredGroupsBest = useMemo(() => {
    const list = groupStats[groupSize] || [];
    return list
      .filter(g => {
        if (g.games < minGames) return false;
        if (filterPlayer !== 'ALL' && !g.members.includes(filterPlayer)) return false;
        return true;
      })
      .sort((a, b) => b.winRate === a.winRate ? b.games - a.games : b.winRate - a.winRate);
  }, [groupStats, groupSize, minGames, filterPlayer]);

  const filteredGroupsWorst = useMemo(() => {
    const list = groupStats[groupSize] || [];
    return list
      .filter(g => {
        if (g.games < minGames) return false;
        if (filterPlayer !== 'ALL' && !g.members.includes(filterPlayer)) return false;
        return true;
      })
      .sort((a, b) => a.winRate === b.winRate ? b.games - a.games : a.winRate - b.winRate);
  }, [groupStats, groupSize, minGames, filterPlayer]);

  // 選択された2人の共闘スタッツ
  const selectedDuoStat = useMemo(() => {
    if (!simPlayer1 || !simPlayer2 || simPlayer1 === simPlayer2) return null;
    return allyStats.find(
      a => (a.p1 === simPlayer1 && a.p2 === simPlayer2) || (a.p1 === simPlayer2 && a.p2 === simPlayer1)
    ) || null;
  }, [simPlayer1, simPlayer2, allyStats]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-stone-900">
        <Spinner label="チームシナジー＆全対戦相性を分析中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/80 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-5 shadow-xs gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 flex items-center gap-2.5">
              <HeartHandshake className="h-7 w-7 text-fuchsia-700" />
              チームシナジー ＆ 相性診断
            </h1>
            <p className="text-stone-500 mt-1 text-xs font-bold flex items-center gap-2 flex-wrap">
              <span>誰と組めば勝てるか一発診断🔥</span>
              <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-stone-200">
                集計対象: 全{totalMatches}試合
              </span>
            </p>
          </div>
          
          {/* グローバルフィルター群 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* プレイヤー絞り込み */}
            <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <UserCheck className="w-3.5 h-3.5 text-fuchsia-600" />
              <span className="text-xs font-black text-stone-600">プレイヤー:</span>
              <select 
                value={filterPlayer} 
                onChange={e => setFilterPlayer(e.target.value)}
                className="bg-white border border-stone-300 text-stone-900 rounded-lg px-2.5 py-1 outline-none focus:border-fuchsia-500 font-bold text-xs cursor-pointer shadow-2xs max-w-[140px]"
              >
                <option value="ALL">全員 (全ペア)</option>
                {allPlayerNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 最小試合数 */}
            <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-xs font-black text-stone-600">最小共闘数:</span>
              <select 
                value={minGames} 
                onChange={e => setMinGames(Number(e.target.value))}
                className="bg-white border border-stone-300 text-stone-900 rounded-lg px-2.5 py-1 outline-none focus:border-fuchsia-500 font-bold text-xs cursor-pointer shadow-2xs"
              >
                <option value={1}>1試合以上 (全件)</option>
                <option value={2}>2試合以上</option>
                <option value={3}>3試合以上</option>
                <option value={5}>5試合以上</option>
                <option value={10}>10試合以上</option>
              </select>
            </div>
          </div>
        </div>

        {/* ✨ デュオ相性シミュレータ */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="text-fuchsia-600 h-4 w-4" />
              <h2 className="text-sm font-black text-stone-900">デュオ相性シミュレーター</h2>
              <span className="text-[11px] text-stone-500 font-medium">（2人選んで即座に共闘勝率チェック）</span>
            </div>
            {simPlayer1 && (
              <button 
                onClick={() => { setSimPlayer1(''); setSimPlayer2(''); }}
                className="text-[11px] text-stone-400 hover:text-stone-700 underline cursor-pointer"
              >
                リセット
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5">プレイヤー 1</label>
              <select
                value={simPlayer1}
                onChange={e => setSimPlayer1(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 outline-none focus:border-fuchsia-500 cursor-pointer"
              >
                <option value="">-- プレイヤーを選択 --</option>
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
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 outline-none focus:border-fuchsia-500 cursor-pointer"
              >
                <option value="">-- プレイヤーを選択 --</option>
                {allPlayerNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* クイック相性サジェスト (Player1選択時) */}
          {simPlayer1 && !simPlayer2 && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs space-y-2">
              <div className="text-[11px] font-bold text-stone-500">
                💡 <span className="text-stone-900 font-extrabold">{simPlayer1}</span> の相性クイックピック（クリックでP2にセット）:
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {player1Suggestions.best.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      🤝 好相性
                    </span>
                    {player1Suggestions.best.map(s => (
                      <button
                        key={s.partner}
                        onClick={() => setSimPlayer2(s.partner)}
                        className="bg-white hover:bg-emerald-50 border border-stone-300 hover:border-emerald-300 text-stone-800 rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <span>{s.partner}</span>
                        <span className="text-emerald-600 font-black">{(s.winRate * 100).toFixed(0)}%</span>
                        <span className="text-[10px] text-stone-400">({s.games}戦)</span>
                      </button>
                    ))}
                  </div>
                )}
                {player1Suggestions.worst.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap ml-0 sm:ml-2">
                    <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      ⚡ 要注意
                    </span>
                    {player1Suggestions.worst.map(s => (
                      <button
                        key={s.partner}
                        onClick={() => setSimPlayer2(s.partner)}
                        className="bg-white hover:bg-rose-50 border border-stone-300 hover:border-rose-300 text-stone-800 rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <span>{s.partner}</span>
                        <span className="text-rose-600 font-black">{(s.winRate * 100).toFixed(0)}%</span>
                        <span className="text-[10px] text-stone-400">({s.games}戦)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* シミュレーション結果表示 */}
          {simPlayer1 && simPlayer2 && (
            <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-fuchsia-200">
              {simPlayer1 === simPlayer2 ? (
                <div className="text-xs text-amber-800 font-bold text-center py-2">
                  ⚠️ 異なる2人のプレイヤーを選択してください。
                </div>
              ) : selectedDuoStat ? (
                (() => {
                  const duoWinPct = (selectedDuoStat.winRate * 100).toFixed(1);
                  const winRateNum = selectedDuoStat.winRate * 100;
                  const losses = selectedDuoStat.games - selectedDuoStat.wins;
                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">
                          {winRateNum >= 65 ? '👑' : winRateNum >= 50 ? '⚡' : '💀'}
                        </span>
                        <div>
                          <div className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                            <Link href={`/player/${encodeURIComponent(simPlayer1)}`} className="hover:text-fuchsia-600 hover:underline">
                              {simPlayer1}
                            </Link>
                            <span className="text-fuchsia-500 font-black">×</span>
                            <Link href={`/player/${encodeURIComponent(simPlayer2)}`} className="hover:text-fuchsia-600 hover:underline">
                              {simPlayer2}
                            </Link>
                          </div>
                          <div className="text-xs text-stone-600 mt-0.5">
                            共闘数: <strong className="text-stone-900">{selectedDuoStat.games}試合</strong> 
                            （<span className="text-emerald-700 font-bold">{selectedDuoStat.wins}勝</span> / <span className="text-rose-700 font-bold">{losses}敗</span>）
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        {/* 勝率バー */}
                        <div className="w-28 hidden sm:block">
                          <div className="h-2.5 bg-rose-200 rounded-full overflow-hidden flex">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${winRateNum}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-stone-500 mt-1 font-bold">
                            <span>勝 {selectedDuoStat.wins}</span>
                            <span>敗 {losses}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider">共闘勝率</div>
                          <div className={`text-2xl font-black ${winRateNum >= 60 ? 'text-emerald-700' : winRateNum >= 45 ? 'text-amber-700' : 'text-rose-700'}`}>
                            {duoWinPct}%
                          </div>
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
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="text-fuchsia-700" size={20} />
              <span className="text-sm font-black text-stone-900">対象人数:</span>
            </div>
            <div className="flex gap-2">
              {([2, 3, 4, 5] as const).map(n => (
                <button 
                  key={n} 
                  onClick={() => setGroupSize(n)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${groupSize === n ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-500/20' : 'bg-background text-stone-500 hover:text-stone-900 border border-border'}`}
                >
                  {n === 2 ? '2人コンビ (デュオ)' : `${n}人チーム`}
                </button>
              ))}
            </div>
          </div>

          {filterPlayer !== 'ALL' && (
            <div className="flex items-center gap-2 bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-800 px-3 py-1 rounded-xl text-xs font-bold">
              <span>絞り込み中: <strong>{filterPlayer}</strong></span>
              <button 
                onClick={() => setFilterPlayer('ALL')}
                className="text-fuchsia-600 hover:text-fuchsia-900 ml-1 text-xs underline cursor-pointer"
              >
                解除
              </button>
            </div>
          )}
        </div>

        {/* メイン: 左右に「最強のコンビ」と「最弱のコンビ」を配置 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* 左カード: 最強のコンビ */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-500"></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-emerald-700 flex items-center gap-2">
                <Crown className="h-6 w-6" /> 
                {groupSize === 2 ? '最強のコンビ' : `最強の${groupSize}人チーム`}
                <span className="text-xs text-stone-500 font-normal">(勝率順)</span>
              </h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {groupSize > 2 ? filteredGroupsBest.length : filteredBestAlly.length}組
              </span>
            </div>
            
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-2 custom-scrollbar flex-1">
              {groupSize > 2 ? (
                filteredGroupsBest.length === 0 ? (
                  <div className="text-center text-stone-500 py-16 font-medium text-xs">
                    該当する組み合わせがありません（最小共闘数を下げるか絞り込みを変更してください）
                  </div>
                ) : (
                  filteredGroupsBest.map((g, i) => {
                    const winPct = (g.winRate * 100).toFixed(1);
                    return (
                      <div key={g.members.join('-')} className="flex items-center gap-3 bg-white/70 hover:bg-black/5 p-3.5 rounded-2xl border border-border transition">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 text-xs ${i < 3 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs' : 'bg-black/5 text-stone-500'}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {g.members.map((m, idx) => (
                              <Link 
                                key={m} 
                                href={`/player/${encodeURIComponent(m)}`}
                                className="font-bold text-stone-900 text-xs sm:text-sm hover:text-fuchsia-600 hover:underline"
                              >
                                {m}{idx < g.members.length - 1 && <span className="text-stone-400 mx-1">・</span>}
                              </Link>
                            ))}
                          </div>
                          <div className="text-right flex flex-col items-end shrink-0">
                            <div className="text-lg sm:text-xl font-black text-emerald-700">
                              {winPct}%
                            </div>
                            <div className="text-[11px] text-stone-500 font-bold">{g.games}戦 {g.wins}勝</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : filteredBestAlly.length === 0 ? (
                <div className="text-center text-stone-500 py-16 font-medium text-xs">
                  該当するコンビデータがありません（最小共闘数を下げてください）
                </div>
              ) : (
                filteredBestAlly.map((stat, i) => {
                  const winPct = (stat.winRate * 100).toFixed(1);
                  const losses = stat.games - stat.wins;
                  return (
                    <div key={`${stat.p1}-${stat.p2}`} className="flex items-center gap-3 bg-white/70 hover:bg-black/5 p-3.5 rounded-2xl border border-border transition">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${i < 3 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs' : 'bg-black/5 text-stone-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link 
                            href={`/player/${encodeURIComponent(stat.p1)}`} 
                            className="font-bold text-stone-900 text-sm hover:text-fuchsia-600 hover:underline truncate"
                          >
                            {stat.p1}
                          </Link>
                          <span className="text-emerald-600 text-xs font-black shrink-0">🤝</span>
                          <Link 
                            href={`/player/${encodeURIComponent(stat.p2)}`} 
                            className="font-bold text-stone-900 text-sm hover:text-fuchsia-600 hover:underline truncate"
                          >
                            {stat.p2}
                          </Link>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="text-lg sm:text-xl font-black text-emerald-700">
                            {winPct}%
                          </div>
                          <div className="text-[11px] text-stone-500 font-bold">
                            {stat.games}戦 {stat.wins}勝{losses > 0 && ` ${losses}敗`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右カード: 最弱のコンビ */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-pink-600"></div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-rose-700 flex items-center gap-2">
                <Skull className="h-6 w-6" /> 
                {groupSize === 2 ? '最弱のコンビ' : `最弱の${groupSize}人チーム`}
                <span className="text-xs text-stone-500 font-normal">(勝率昇順)</span>
              </h2>
              <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                {groupSize > 2 ? filteredGroupsWorst.length : filteredWorstAlly.length}組
              </span>
            </div>

            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-2 custom-scrollbar flex-1">
              {groupSize > 2 ? (
                filteredGroupsWorst.length === 0 ? (
                  <div className="text-center text-stone-500 py-16 font-medium text-xs">
                    該当する組み合わせがありません
                  </div>
                ) : (
                  filteredGroupsWorst.map((g, i) => {
                    const winPct = (g.winRate * 100).toFixed(1);
                    return (
                      <div key={g.members.join('-')} className="flex items-center gap-3 bg-white/70 hover:bg-black/5 p-3.5 rounded-2xl border border-border transition">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 text-xs bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs">
                          {i + 1}
                        </div>
                        <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {g.members.map((m, idx) => (
                              <Link 
                                key={m} 
                                href={`/player/${encodeURIComponent(m)}`}
                                className="font-bold text-stone-900 text-xs sm:text-sm hover:text-fuchsia-600 hover:underline"
                              >
                                {m}{idx < g.members.length - 1 && <span className="text-stone-400 mx-1">・</span>}
                              </Link>
                            ))}
                          </div>
                          <div className="text-right flex flex-col items-end shrink-0">
                            <div className="text-lg sm:text-xl font-black text-rose-700">
                              {winPct}%
                            </div>
                            <div className="text-[11px] text-stone-500 font-bold">{g.games}戦 {g.wins}勝</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : filteredWorstAlly.length === 0 ? (
                <div className="text-center text-stone-500 py-16 font-medium text-xs">
                  該当するコンビデータがありません
                </div>
              ) : (
                filteredWorstAlly.map((stat, i) => {
                  const winPct = (stat.winRate * 100).toFixed(1);
                  const losses = stat.games - stat.wins;
                  return (
                    <div key={`${stat.p1}-${stat.p2}`} className="flex items-center gap-3 bg-white/70 hover:bg-black/5 p-3.5 rounded-2xl border border-border transition">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs">
                        {i + 1}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link 
                            href={`/player/${encodeURIComponent(stat.p1)}`} 
                            className="font-bold text-stone-900 text-sm hover:text-fuchsia-600 hover:underline truncate"
                          >
                            {stat.p1}
                          </Link>
                          <span className="text-rose-700 text-xs font-black shrink-0">⚡</span>
                          <Link 
                            href={`/player/${encodeURIComponent(stat.p2)}`} 
                            className="font-bold text-stone-900 text-sm hover:text-fuchsia-600 hover:underline truncate"
                          >
                            {stat.p2}
                          </Link>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <div className="text-lg sm:text-xl font-black text-rose-700">
                            {winPct}%
                          </div>
                          <div className="text-[11px] text-stone-500 font-bold">
                            {stat.games}戦 {stat.wins}勝{losses > 0 && ` ${losses}敗`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

