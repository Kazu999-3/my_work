"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import ScoutingReport from "../../../components/ScoutingReport";
import { Activity, Shield, Swords, Star, Zap, Crosshair, RefreshCw, CheckCircle2, TrendingUp } from "lucide-react";
import { getChampIcon, getChampNameById } from "../../../lib/ddragonClient";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area, AreaChart, CartesianGrid } from "recharts";

const roleIcons: Record<string, any> = {
  TOP: <Shield className="w-4 h-4 text-purple-400" />,
  JG: <Zap className="w-4 h-4 text-green-400" />,
  MID: <Star className="w-4 h-4 text-red-400" />,
  ADC: <Crosshair className="w-4 h-4 text-blue-400" />,
  SUP: <Star className="w-4 h-4 text-yellow-400" />
};

export default function PlayerMyPage() {
  const { id } = useParams(); // Discord ID
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [matchups, setMatchups] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [riotMasteries, setRiotMasteries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeLane, setActiveLane] = useState<'TOTAL' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'>('TOTAL');

  // MMR推移グラフ用のデータを計算（useMemoで最適化）
  const mmrChartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    // 最新の試合が先頭にあるので、古い順に並び替え
    const sortedHistory = [...history].reverse();

    return sortedHistory.map((match, idx) => {
      const historyObj = match.mmrHistory || { TOTAL: match.mmr || 1200 };
      const val = historyObj[activeLane] !== undefined ? historyObj[activeLane] : (historyObj.TOTAL || 1200);
      return {
        game: idx + 1,
        mmr: val,
        isWin: match.isWin,
        champion: match.champion || "Unknown",
        date: match.date
          ? new Date(match.date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
          : "-",
        mmrDelta: match.mmrDelta || 0,
        role: match.role,
        allMmr: historyObj
      };
    });
  }, [history, activeLane]);

  const currentLaneMmr = useMemo(() => {
    if (!player) return 1000;
    if (activeLane === 'TOTAL') return player.mmr || 1000;
    const key = `mmr_${activeLane.toLowerCase()}`;
    return player[key] || 1000;
  }, [player, activeLane]);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        // 1. 基本情報の取得
        const { data: pData, error } = await supabase
          .from("ktm_players")
          .select("*")
          .eq("discord_id", id)
          .single();

        if (error || !pData) {
          console.error("Player not found");
          setLoading(false);
          return;
        }
        setPlayer(pData);

        // 2. KTM戦績の取得
        const res = await fetch(`/api/player/profile?name=${encodeURIComponent(pData.name)}`);
        const sData = await res.json();
        if (sData.stats) setStats(sData.stats);
        if (sData.matchups) setMatchups(sData.matchups);
        if (sData.history) setHistory(sData.history);

        // 3. マスタリーの解決
        let mainChamps = pData.main_champions;
        if (typeof mainChamps === 'string') {
          try { mainChamps = JSON.parse(mainChamps); } catch (e) {}
        }
        
        if (mainChamps && Array.isArray(mainChamps)) {
          const resolved = await Promise.all(
            mainChamps.map(async (m: any) => {
              const name = await getChampNameById(m.championId);
              return { ...m, name, iconUrl: getChampIcon(name) };
            })
          );
          setRiotMasteries(resolved);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);



  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
    </div>;
  }

  if (!player) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center text-xl font-bold">
      プレイヤーが見つかりませんでした。(Discord ID: {id})
    </div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header / Control Panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center text-3xl font-black border-4 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                {player.ign ? player.ign.charAt(0).toUpperCase() : player.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight">{player.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-400 font-medium">{player.ign || "IGN未登録"}</span>
                  <span className="bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-xs font-bold text-gray-300">
                    Highest: <span className="text-white">{player.highest_rank || "UNRANKED"}</span>
                  </span>
                  <span className="bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold text-blue-300">
                    MMR: <span className="text-white">{player.mmr || 1000}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Participation Status */}
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 w-full md:w-auto shadow-inner">
              <div className="flex items-center justify-between gap-6 mb-4">
                <div className="font-bold text-gray-300">本日の内戦参加</div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${player.is_active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                  {player.is_active ? '参加中' : '未参加'}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-bold mb-1">MAIN ROLE</span>
                  <span className="text-white font-bold">{player.role_preferences?.primary || "ALL"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-bold mb-1">SUB ROLE</span>
                  <span className="text-gray-400 font-bold">{player.role_preferences?.secondary || "ALL"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Radar Chart & Masteries */}
          <div className="space-y-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-400" />
                プレイスタイル分析
              </h3>
              <ScoutingReport stats={stats} mmr={player.mmr || 1000} />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-yellow-500" />
                魂のチャンピオン
              </h3>
              <div className="space-y-3">
                {riotMasteries.length > 0 ? riotMasteries.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                    <img 
                      src={m.iconUrl} 
                      className="w-12 h-12 rounded-full border border-gray-600"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div>
                      <div className="font-bold text-lg leading-tight">{m.name === 'Unknown' ? `ID:${m.championId}` : m.name}</div>
                      <div className="text-xs text-gray-400">マスタリーLv {m.championLevel} ({m.championPoints.toLocaleString()} pt)</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-gray-500 text-sm">データがありません</div>
                )}
              </div>
            </div>

            {/* Matchup Stats */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Crosshair className="w-5 h-5 text-red-500" />
                ⚔️ 対面マッチアップ勝率
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {matchups.length > 0 ? matchups.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-800/40 p-2.5 rounded-lg border border-gray-700/30">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getChampIcon(m.opponentChampion)} 
                        className="w-8 h-8 rounded-full shadow-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div className="font-bold text-gray-300 text-sm w-24 truncate">vs {m.opponentChampion}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-sm ${m.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.winRate}%
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium">
                        {m.wins}W - {m.games - m.wins}L
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-gray-500 text-sm text-center py-4">まだ対面データがありません</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Lane Stats */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-2xl font-black flex items-center gap-2 mb-6">
              <Swords className="w-6 h-6 text-emerald-500" />
              KTM レーン別戦績
            </h3>

            {stats && Object.keys(stats).some(k => stats[k] !== null) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => {
                  const s = stats[role];
                  if (!s) return null;
                  
                  return (
                    <div key={role} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          {roleIcons[role]}
                          <span className="font-black text-xl tracking-wider text-gray-200">{role}</span>
                        </div>
                        <span className="text-xs text-blue-300 font-bold bg-blue-900/30 border border-blue-800/50 px-2 py-1 rounded">
                          MMR {player[`mmr_${role.toLowerCase()}`] || 1000}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-400 font-medium">{s.totalGames}戦 {s.totalWins}勝</span>
                          <span className={`font-black ${s.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {s.winRate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-950 rounded-full h-2.5 shadow-inner overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${s.winRate >= 50 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`} 
                            style={{ width: `${s.winRate}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2 mt-4 pt-4 border-t border-gray-800/50">
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Top Picks</div>
                        {s.topChampions.map((champ: any, cIdx: number) => {
                          if (champ.name === 'Unknown') {
                            return (
                              <div key={cIdx} className="flex items-center gap-3 bg-gray-950 p-2 rounded border border-gray-800">
                                <div className="w-8 h-8 rounded-full shadow-sm bg-gray-800 flex items-center justify-center text-gray-600 text-xs">?</div>
                                <div className="flex-1 font-bold text-gray-500 italic truncate">記録なし</div>
                                <div className="text-sm font-medium text-gray-600">
                                  <span>{champ.wins}W</span>
                                  {" - "}
                                  <span>{champ.games - champ.wins}L</span>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={cIdx} className="flex items-center gap-3 bg-gray-950 p-2 rounded border border-gray-800">
                              <img 
                                src={getChampIcon(champ.name)} 
                                className="w-8 h-8 rounded-full shadow-sm"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                              <div className="flex-1 font-bold text-gray-300 truncate">{champ.name}</div>
                              <div className="text-sm font-medium text-gray-500">
                                <span className={champ.winRate >= 50 ? 'text-emerald-500' : 'text-gray-400'}>{champ.wins}W</span>
                                {" - "}
                                <span className="text-gray-500">{champ.games - champ.wins}L</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                まだKTMでの試合記録がありません。内戦に参加してデータを集めましょう！
              </div>
            )}
          </div>

        </div>

        {/* MMR推移グラフ */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-2xl font-black flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              📈 MMR推移
            </h3>
            
            {/* レーン切り替えトグル */}
            <div className="flex flex-wrap gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
              {(['TOTAL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).map(lane => (
                <button
                  key={lane}
                  onClick={() => setActiveLane(lane)}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    activeLane === lane 
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-900'
                  }`}
                >
                  {lane === 'TOTAL' ? '総合' : lane}
                </button>
              ))}
            </div>
          </div>

          {mmrChartData.length > 0 ? (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mmrChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mmrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00cfef" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00cfef" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="game"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                    label={{ value: '試合', position: 'insideBottomRight', offset: -5, fill: '#6b7280', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                    domain={['dataMin - 30', 'dataMax + 30']}
                    label={{ value: 'MMR', angle: -90, position: 'insideLeft', offset: 20, fill: '#6b7280', fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const d = payload[0].payload;
                      const laneLabels: Record<string, string> = { TOTAL: '総合', TOP: 'TOP', JG: 'JG', MID: 'MID', ADC: 'ADC', SUP: 'SUP' };
                      return (
                        <div className="bg-gray-950 border border-gray-700 rounded-lg p-3 shadow-2xl text-sm min-w-[170px]">
                          <div className="flex items-center gap-2 mb-1">
                            <img
                              src={getChampIcon(d.champion)}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            <span className="font-bold text-white">{d.champion}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`font-black text-xs ${d.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                              {d.isWin ? 'WIN' : 'LOSE'} ({d.role})
                            </span>
                            <span className={`text-[10px] px-1 rounded font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20`}>
                              {laneLabels[activeLane]}
                            </span>
                          </div>
                          <div className="text-gray-300 mt-2 pt-2 border-t border-gray-800 space-y-1">
                            <div>
                              MMR: <span className="font-bold text-white">{d.mmr}</span>
                              <span className={`ml-2 font-bold ${d.mmrDelta > 0 && d.role === activeLane ? 'text-emerald-400' : d.mmrDelta < 0 && d.role === activeLane ? 'text-red-400' : 'text-gray-400'}`}>
                                ({d.mmrDelta > 0 ? '+' : ''}{d.mmrDelta})
                              </span>
                            </div>
                            {d.allMmr && (
                              <div className="text-[10px] text-gray-500 grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-gray-900/50 mt-1">
                                <div>総合: {d.allMmr.TOTAL}</div>
                                <div>TOP: {d.allMmr.TOP}</div>
                                <div>JG: {d.allMmr.JG}</div>
                                <div>MID: {d.allMmr.MID}</div>
                                <div>ADC: {d.allMmr.ADC}</div>
                                <div>SUP: {d.allMmr.SUP}</div>
                              </div>
                            )}
                          </div>
                          <div className="text-gray-500 text-[10px] mt-2 text-right">{d.date}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={currentLaneMmr}
                    stroke="#00cfef"
                    strokeDasharray="6 4"
                    strokeOpacity={0.5}
                    label={{ value: `現在 ${currentLaneMmr}`, position: 'right', fill: '#00cfef', fontSize: 11 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="mmr"
                    stroke="#00cfef"
                    strokeWidth={2.5}
                    fill="url(#mmrGradient)"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={`dot-${payload.game}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={payload.isWin ? '#22c55e' : '#ef4444'}
                          stroke={payload.isWin ? '#166534' : '#7f1d1d'}
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 7, stroke: '#00cfef', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {/* 凡例 */}
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span>勝利</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>敗北</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 border-t-2 border-dashed border-cyan-400/50"></div>
                  <span>現在のMMR</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 border border-dashed border-gray-800 rounded-xl">
              まだ試合データがありません
            </div>
          )}
        </div>

        {/* Match History Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-2xl font-black flex items-center gap-2 mb-6">
            <Activity className="w-6 h-6 text-blue-500" />
            直近の戦績 (KTMカスタム)
          </h3>
          <div className="space-y-3">
            {history && history.length > 0 ? history.map((match, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border ${match.isWin ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-red-900/10 border-red-500/20'}`}
              >
                <div className="flex items-center gap-6 w-full sm:w-auto">
                  <div className={`w-1.5 h-12 rounded-full ${match.isWin ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={getChampIcon(match.champion)} 
                        className="w-12 h-12 rounded-full shadow-sm border border-gray-700"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-gray-900 p-0.5 rounded-full border border-gray-700">
                        {roleIcons[match.role] || <div className="w-3 h-3 bg-gray-500 rounded-full"></div>}
                      </div>
                    </div>
                    <div>
                      <div className={`font-bold text-lg leading-none ${match.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                        {match.isWin ? 'Victory' : 'Defeat'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(match.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 mt-4 sm:mt-0 w-full sm:w-auto justify-end">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 font-bold mb-1">K / D / A</div>
                    <div className="font-bold text-gray-200">
                      <span>{match.kills}</span>
                      <span className="text-gray-600 mx-1">/</span>
                      <span className="text-red-400">{match.deaths}</span>
                      <span className="text-gray-600 mx-1">/</span>
                      <span>{match.assists}</span>
                    </div>
                  </div>
                  
                  <div className="text-right min-w-[80px]">
                    <div className="text-xs text-gray-500 font-bold mb-1">MMR CHANGE</div>
                    <div className={`font-black ${match.mmrDelta > 0 ? 'text-emerald-400' : match.mmrDelta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {match.mmrDelta > 0 ? '+' : ''}{match.mmrDelta}
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center text-gray-500 py-8 border border-dashed border-gray-800 rounded-xl">
                直近の試合データがありません
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
