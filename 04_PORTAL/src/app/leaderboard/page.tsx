'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '../../components/Feedback';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';
import WinrateMatrixPanel from './WinrateMatrixPanel';
import CoinsRankingPanel from './CoinsRankingPanel';
import RosterPanel from './RosterPanel';
import SynergyPanel from './SynergyPanel';
import { Trophy, Activity, Info, Coins, Users, HeartHandshake, Sparkles, Sliders } from 'lucide-react';

type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

interface PlayerStats {
  name: string;
  discordId: string;
  mmr: number;
  games: number;
  winRate: string;
  rankBadge: { name: string; color: string; bg: string };
}

interface LeaderboardData {
  TOP: PlayerStats[];
  JG: PlayerStats[];
  MID: PlayerStats[];
  ADC: PlayerStats[];
  SUP: PlayerStats[];
}

function LeaderboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'ranking';

  const [data, setData] = useState<LeaderboardData>({
    TOP: [], JG: [], MID: [], ADC: [], SUP: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ranking' | 'coins' | 'roster' | 'synergy' | 'meta'>(
    ['ranking', 'coins', 'roster', 'synergy', 'meta'].includes(initialTab) ? initialTab : 'ranking'
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['ranking', 'coins', 'roster', 'synergy', 'meta'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'ranking' | 'coins' | 'roster' | 'synergy' | 'meta') => {
    setActiveTab(tab);
    router.replace(`/leaderboard?tab=${tab}`, { scroll: false });
  };

  // メタ統計
  const [metaData, setMetaData] = useState<any[] | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaMinGames, setMetaMinGames] = useState(2);
  const [metaSortKey, setMetaSortKey] = useState<'games' | 'winRate' | 'avgKda'>('games');
  const [metaSortDir, setMetaSortDir] = useState<'asc' | 'desc'>('desc');
  const [showMetaPlayers, setShowMetaPlayers] = useState(true);

  const toggleMetaSort = (key: 'games' | 'winRate' | 'avgKda') => {
    if (metaSortKey === key) {
      setMetaSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setMetaSortKey(key);
      setMetaSortDir('desc');
    }
  };

  const sortedMetaData = (rows: any[]) => {
    const sorted = [...rows].sort((a, b) => (a[metaSortKey] - b[metaSortKey]));
    return metaSortDir === 'desc' ? sorted.reverse() : sorted;
  };

  useEffect(() => {
    if (activeTab !== 'meta' || metaData !== null || metaLoading) return;
    (async () => {
      setMetaLoading(true);
      try {
        const res = await fetch('/api/leaderboard/meta');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '取得に失敗しました');
        setMetaData(data.rows || []);
      } catch (e) {
        console.error('meta stats fetch failed', e);
        setMetaData([]);
      } finally {
        setMetaLoading(false);
      }
    })();
  }, [activeTab, metaData, metaLoading]);

  const [minGames, setMinGames] = useState<number>(1);
  const [search, setSearch] = useState('');
  const [sortMetric, setSortMetric] = useState<'mmr' | 'winRate' | 'games'>('mmr');
  const [mobileRole, setMobileRole] = useState<Role | 'ALL'>('ALL');

  const getSortedRows = (rows: PlayerStats[]) => {
    let filtered = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = rows.filter(p => p.name.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      if (sortMetric === 'winRate') return parseFloat(b.winRate) - parseFloat(a.winRate);
      if (sortMetric === 'games') return b.games - a.games;
      return b.mmr - a.mmr;
    });
  };

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard?minGames=${minGames}`);
        const newLeaderboard = await res.json();
        if (!res.ok) throw new Error(newLeaderboard.error || '取得に失敗しました');
        setData(newLeaderboard);
      } catch (e) {
        console.error("fetchLeaderboard Error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [minGames]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner label="リーダーボードを読み込み中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 md:py-10 px-4 sm:px-6 lg:px-10 text-stone-800">
      <div className="max-w-[1680px] w-full mx-auto space-y-5">

        {/* ヘッダー */}
        <div className="bg-white/80 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-5 shadow-xs text-center">
          <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight flex items-center justify-center gap-2">
            <span className="text-amber-500">🏆</span> KTM 順位表 ＆ コミュニティ名簿
          </h1>
          <p className="text-xs text-stone-500 font-bold mt-1">
            ロール別ランキング・🪙 コイン長者番付・名簿一覧・相性シミュレーター統合ハブ
          </p>
        </div>

        {/* タブナビゲーション */}
        <div className="flex justify-center mb-4 px-2">
          <div className="inline-flex flex-wrap justify-center gap-1.5 bg-white/90 rounded-2xl p-1.5 border border-stone-200/90 shadow-2xs max-w-full">
            <button
              onClick={() => handleTabChange('ranking')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'ranking'
                  ? 'bg-amber-600 text-white shadow-xs scale-102'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>ロール別順位</span>
            </button>
            <button
              onClick={() => handleTabChange('coins')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'coins'
                  ? 'bg-amber-600 text-white shadow-xs scale-102'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Coins className="w-4 h-4 text-amber-500" />
              <span>🪙 コイン番付</span>
            </button>
            <button
              onClick={() => handleTabChange('roster')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-amber-600 text-white shadow-xs scale-102'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>👥 名簿一覧</span>
            </button>
            <button
              onClick={() => handleTabChange('synergy')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'synergy'
                  ? 'bg-amber-600 text-white shadow-xs scale-102'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              <span>🤝 相性分析</span>
            </button>
            <button
              onClick={() => handleTabChange('meta')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'meta'
                  ? 'bg-amber-600 text-white shadow-xs scale-102'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>📊 メタ統計</span>
            </button>
          </div>
        </div>

        {/* コイン長者番付タブ */}
        {activeTab === 'coins' && <CoinsRankingPanel />}

        {/* プレイヤー名簿タブ */}
        {activeTab === 'roster' && <RosterPanel />}

        {/* チーム相性タブ */}
        {activeTab === 'synergy' && <SynergyPanel />}

        {/* メタ統計タブ */}
        {activeTab === 'meta' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 p-4 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-600">最低ピック数:</span>
                  {[1, 2, 3, 5].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => setMetaMinGames(cnt)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                        metaMinGames === cnt
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      }`}
                    >
                      {cnt}回以上
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-stone-300 hidden sm:block"></div>

                {/* 使用プレイヤー情報の切り替えトグル */}
                <button
                  type="button"
                  onClick={() => setShowMetaPlayers(!showMetaPlayers)}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                    showMetaPlayers
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                  title="各チャンピオンを誰が使用したかを表示/非表示に切り替えます"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{showMetaPlayers ? '👤 使用者を表示中' : '👤 使用者を非表示'}</span>
                </button>
              </div>

              <span className="text-xs text-stone-500 font-bold">
                ※ KTMカスタム内での実戦集計データ
              </span>
            </div>

            {metaLoading ? (
              <div className="py-12 text-center text-xs font-bold text-stone-500 animate-pulse">
                メタ統計を集計中...
              </div>
            ) : !metaData || metaData.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-stone-400 bg-white rounded-2xl border border-stone-200">
                集計対象の試合データがありません
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-100/80 text-stone-700 border-b border-stone-200 font-black">
                        <th className="p-3">チャンピオン</th>
                        <th className="p-3 cursor-pointer hover:text-amber-700 whitespace-nowrap" onClick={() => toggleMetaSort('games')}>
                          ピック数 {metaSortKey === 'games' && (metaSortDir === 'desc' ? '▼' : '▲')}
                        </th>
                        <th className="p-3 cursor-pointer hover:text-amber-700 whitespace-nowrap" onClick={() => toggleMetaSort('winRate')}>
                          勝率 {metaSortKey === 'winRate' && (metaSortDir === 'desc' ? '▼' : '▲')}
                        </th>
                        <th className="p-3 cursor-pointer hover:text-amber-700 whitespace-nowrap" onClick={() => toggleMetaSort('avgKda')}>
                          平均KDA {metaSortKey === 'avgKda' && (metaSortDir === 'desc' ? '▼' : '▲')}
                        </th>
                        {showMetaPlayers && (
                          <th className="p-3 min-w-[200px]">主な使用者 (試合数・勝率)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-700">
                      {sortedMetaData(metaData.filter(r => r.games >= metaMinGames)).map((row) => (
                        <tr key={row.champion} className="hover:bg-stone-50 transition">
                          <td className="p-3 font-black text-stone-900 flex items-center gap-2 whitespace-nowrap">
                            <img
                              src={getChampIcon(row.champion)}
                              alt={row.champion}
                              className="w-7 h-7 rounded-lg border border-stone-200 shrink-0"
                            />
                            <span>{row.champion}</span>
                          </td>
                          <td className="p-3 font-bold whitespace-nowrap">{row.games}試合</td>
                          <td className="p-3 font-black whitespace-nowrap">
                            <span className={row.winRate >= 60 ? 'text-emerald-600' : row.winRate <= 40 ? 'text-rose-600' : 'text-stone-800'}>
                              {row.winRate}%
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold whitespace-nowrap">{row.avgKda}</td>
                          {showMetaPlayers && (
                            <td className="p-3">
                              {row.players && row.players.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {row.players.map((p: any) => (
                                    <Link
                                      key={p.name}
                                      href={`/player/${encodeURIComponent(p.name)}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-amber-100 hover:border-amber-300 border border-stone-200 text-stone-800 text-[11px] transition-colors"
                                      title={`${p.name} のカルテを見る`}
                                    >
                                      <span className="font-bold">{p.name}</span>
                                      <span className="text-[10px] text-stone-500 font-mono">
                                        ({p.wins}W{p.games - p.wins}L / {p.winRate}%)
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-stone-400 text-[10px]">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ロール別ランキングタブ */}
        {activeTab === 'ranking' && (
          <div className="space-y-4">
            {/* コントロールバー */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 p-4 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-600">最低試合数:</span>
                {[1, 3, 5, 10].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setMinGames(cnt)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                      minGames === cnt
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                    }`}
                  >
                    {cnt}戦以上
                  </button>
                ))}
              </div>

              {/* プレイヤー名検索 */}
              <div className="flex items-center gap-2 min-w-[200px] max-w-xs flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="プレイヤー名で絞り込み..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1 rounded-lg bg-stone-100 cursor-pointer"
                  >
                    クリア
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-600">ソート:</span>
                {(['mmr', 'winRate', 'games'] as const).map((metric) => (
                  <button
                    key={metric}
                    onClick={() => setSortMetric(metric)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                      sortMetric === metric
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                    }`}
                  >
                    {metric === 'mmr' ? 'MMR順' : metric === 'winRate' ? '勝率順' : '試合数順'}
                  </button>
                ))}
              </div>
            </div>

            {/* スマホ用ロール切り替えピル（md以上では非表示） */}
            <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setMobileRole('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition ${
                  mobileRole === 'ALL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white border border-stone-200 text-stone-600'
                }`}
              >
                🌐 全レーン並列
              </button>
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setMobileRole(role)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition ${
                    mobileRole === role
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-stone-200 text-stone-600'
                  }`}
                >
                  {role} ({getSortedRows(data[role] || []).length})
                </button>
              ))}
            </div>

            {/* 5レーングリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {ROLES.filter((role) => mobileRole === 'ALL' || mobileRole === role).map((role) => {
                const rows = getSortedRows(data[role] || []);
                return (
                  <div
                    key={role}
                    className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs flex flex-col"
                  >
                    <div className="bg-gradient-to-r from-stone-50 to-stone-100/60 border-b border-stone-200 p-3.5 flex items-center justify-between">
                      <span className="font-black text-sm text-stone-900 tracking-wider uppercase flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        {role}
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-600">
                        {rows.length}名
                      </span>
                    </div>

                    <div className="divide-y divide-stone-100 flex-1 overflow-y-auto max-h-[650px]">
                      {rows.map((player, idx) => {
                        const winRateNum = parseFloat(player.winRate);
                        return (
                          <Link
                            key={player.name + idx}
                            href={`/player/${encodeURIComponent(player.name)}`}
                            className={`p-3 flex items-center justify-between gap-2 hover:bg-amber-50/40 transition group ${
                              idx === 0 ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                idx === 0 ? 'bg-amber-500 text-white shadow-xs' :
                                idx === 1 ? 'bg-stone-400 text-white' :
                                idx === 2 ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 border border-stone-200'
                              }`}>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-black text-stone-900 truncate group-hover:text-amber-700 transition">
                                  {player.name}
                                </div>
                                <div className="text-[10px] text-stone-500 font-medium flex items-center gap-1.5">
                                  <span>{player.games}戦</span>
                                  <span className={`font-bold ${
                                    winRateNum >= 60 ? 'text-emerald-600' : winRateNum <= 40 ? 'text-rose-600' : 'text-stone-600'
                                  }`}>
                                    {player.winRate}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs sm:text-sm font-black font-mono text-amber-800">
                                {player.mmr}
                              </div>
                              <div className="text-[9px] font-bold text-stone-400">
                                {player.rankBadge?.name || 'UNRANKED'}
                              </div>
                            </div>
                          </Link>
                        );
                      })}

                      {rows.length === 0 && (
                        <div className="p-8 text-center text-stone-400 text-xs font-bold">
                          {search ? '一致するプレイヤーはいません' : '対象データなし'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner label="リーダーボードを読み込み中..." />
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
