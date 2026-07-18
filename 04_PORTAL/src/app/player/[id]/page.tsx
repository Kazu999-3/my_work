"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import ScoutingReport from "../../../components/ScoutingReport";
import { 
  Activity, 
  Shield, 
  Swords, 
  Star, 
  Zap, 
  Crosshair, 
  RefreshCw, 
  CheckCircle2, 
  TrendingUp, 
  Users, 
  Clock,
  Sparkles,
  Trophy,
  Flame,
  Award
} from "lucide-react";
import { getChampIcon, getChampNameById } from "../../../lib/ddragonClient";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Area, CartesianGrid, Line, ComposedChart } from "recharts";
import { KTM_TIERS } from "../../../lib/mmr";
import { motion, AnimatePresence } from "framer-motion";

const roleIcons: Record<string, any> = {
  TOP: <Shield className="w-4 h-4 text-purple-400" />,
  JG: <Zap className="w-4 h-4 text-emerald-400" />,
  MID: <Star className="w-4 h-4 text-rose-400" />,
  ADC: <Crosshair className="w-4 h-4 text-sky-400" />,
  SUP: <Award className="w-4 h-4 text-amber-400" />
};

const roleColors: Record<string, string> = {
  TOP: "from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-300",
  JG: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-300",
  MID: "from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-300",
  ADC: "from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-300",
  SUP: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-300"
};

// 全レーン同時表示の各レーン色（RoleIconの色味に合わせる）
const LANE_COLORS: Record<'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP', string> = {
  TOP: '#fb923c', JG: '#4ade80', MID: '#f87171', ADC: '#60a5fa', SUP: '#5eead4',
};

export default function PlayerMyPage() {
  const { id } = useParams(); // Discord ID
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [matchups, setMatchups] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [riotMasteries, setRiotMasteries] = useState<any[]>([]);
  const [activeLane, setActiveLane] = useState<'TOTAL' | 'ALL' | 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP'>('TOTAL');
  const [chemistry, setChemistry] = useState<any[]>([]);
  const [rivals, setRivals] = useState<any[]>([]);
  
  // プレイスタイル関連State
  const [playstyle, setPlaystyle] = useState<any>(null);
  const [playstyleSource, setPlaystyleSource] = useState<'custom' | 'soloq'>('custom');
  const [syncingSoloq, setSyncingSoloq] = useState(false);
  
  // タブ管理用のステートを追加
  const [activeTab, setActiveTab] = useState<'summary' | 'lanes' | 'chemistry' | 'champions' | 'history'>('summary');

  // グラフの表示期間フィルタ（#49）: 直近10 / 30 / 全部
  const [chartPeriod, setChartPeriod] = useState<10 | 30 | 0>(0);

  // MMR推移グラフ用のデータを計算（useMemoで最適化）。移動平均(5戦)も付与する。
  const mmrChartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    // 最新の試合が先頭にあるので、古い順に並び替え
    const sortedHistory = [...history].reverse();

    const base = sortedHistory.map((match, idx) => {
      const historyObj = match.mmrHistory || { TOTAL: match.mmr || 1200 };
      const val = historyObj[activeLane] !== undefined ? historyObj[activeLane] : (historyObj.TOTAL || 1200);
      return {
        game: idx + 1,
        mmr: val,
        // 全レーン同時表示用に各レーンの累積MMRも保持
        TOP: historyObj.TOP, JG: historyObj.JG, MID: historyObj.MID, ADC: historyObj.ADC, SUP: historyObj.SUP,
        isWin: match.isWin,
        champion: match.champion || "Unknown",
        date: match.date
          ? new Date(match.date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })
          : "-",
        mmrDelta: match.mmrDelta || 0,
        role: match.role,
        opponentChampion: match.opponentChampion || null,
        opponentName: match.opponentName || null,
        allMmr: historyObj,
        bigSwing: Math.abs(match.mmrDelta || 0) >= 30, // 大勝/大敗の注釈用
      };
    });

    // 5戦移動平均（全系列で計算してから期間で絞る）
    const W = 5;
    const withMa = base.map((d, i) => {
      const from = Math.max(0, i - W + 1);
      const slice = base.slice(from, i + 1);
      const ma = Math.round(slice.reduce((s, x) => s + x.mmr, 0) / slice.length);
      return { ...d, ma };
    });

    return chartPeriod > 0 ? withMa.slice(-chartPeriod) : withMa;
  }, [history, activeLane, chartPeriod]);

  // 「全レーン」表示用: 各レーンごとに、そのレーンで実際にプレイした試合だけを抜き出した推移データ。
  const perLaneChartData = useMemo(() => {
    const result: Record<'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP', any[]> = { TOP: [], JG: [], MID: [], ADC: [], SUP: [] };
    if (!history || history.length === 0) return result;
    const sortedHistory = [...history].reverse(); // 古い順
    (['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).forEach(lane => {
      const pts = sortedHistory
        .filter(m => (m.role || '').toUpperCase() === lane)
        .map((m, idx) => {
          const obj = m.mmrHistory || {};
          return {
            game: idx + 1,
            mmr: obj[lane] ?? 1200,
            isWin: m.isWin,
            champion: m.champion || 'Unknown',
            opponentChampion: m.opponentChampion || null,
            opponentName: m.opponentName || null,
            mmrDelta: m.mmrDelta || 0,
            date: m.date ? new Date(m.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '-',
          };
        });
      result[lane] = chartPeriod > 0 ? pts.slice(-chartPeriod) : pts;
    });
    return result;
  }, [history, chartPeriod]);

  // グラフに重ねるティア境界（表示中データのMMR範囲に入るティアのみ）
  const visibleTierBounds = useMemo(() => {
    if (mmrChartData.length === 0) return [] as { name: string; min: number }[];
    const vals = mmrChartData.map(d => d.mmr);
    const lo = Math.min(...vals) - 30, hi = Math.max(...vals) + 30;
    return KTM_TIERS.filter(t => t.min >= lo && t.min <= hi).slice(0, 6);
  }, [mmrChartData]);

  const currentLaneMmr = useMemo(() => {
    if (!player) return 1000;
    if (activeLane === 'TOTAL') return player.mmr || 1000;
    const key = `mmr_${activeLane.toLowerCase()}`;
    return player[key] || 1000;
  }, [player, activeLane]);

  // 直近の調子サマリー（history は新しい順）
  const recentForm = useMemo(() => {
    if (!history || history.length === 0) return null;
    const last10 = history.slice(0, 10);
    const wins10 = last10.filter((m: any) => m.isWin).length;
    const streakWin = history[0]?.isWin;
    let streak = 0;
    for (const m of history) { if (m.isWin === streakWin) streak++; else break; }
    return {
      last10Games: last10.length,
      last10Wins: wins10,
      last10Rate: Math.round((wins10 / last10.length) * 100),
      streak,
      streakWin,
      seq: last10.map((m: any) => !!m.isWin), // 新しい→古い
    };
  }, [history]);

  // 対面別の得意/苦手（2戦以上の相手のみ）
  const matchupExtremes = useMemo(() => {
    const qualified = (matchups || []).filter((m: any) => m.games >= 2);
    const best = [...qualified].sort((a, b) => b.winRate - a.winRate || b.games - a.games).slice(0, 3);
    const worst = [...qualified].sort((a, b) => a.winRate - b.winRate || b.games - a.games).slice(0, 3);
    return { best, worst };
  }, [matchups]);

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
        if (sData.playstyle) setPlaystyle(sData.playstyle);

        // 4. 相性・ライバルの取得
        const cRes = await fetch(`/api/player/chemistry?name=${encodeURIComponent(pData.name)}`);
        const cData = await cRes.json();
        if (cData.success) {
          setChemistry(cData.chemistry || []);
          setRivals(cData.rivals || []);
        }

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

  const handleSyncSoloq = async () => {
    if (!player) return;
    setSyncingSoloq(true);
    try {
      const res = await fetch('/api/player/sync-soloq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: player.name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同期エラー');
      
      alert(data.message);
      if (data.playstyle) {
        setPlaystyle((prev: any) => ({
          ...prev,
          soloq: data.playstyle
        }));
      }
    } catch (err: any) {
      alert(`❌ ソロキュー同期失敗: ${err.message}`);
    } finally {
      setSyncingSoloq(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-xl font-bold">
        プレイヤーが見つかりませんでした。(Discord ID: {id})
      </div>
    );
  }

  // タブアイテム定義
  const tabItems = [
    { id: "summary", name: "総合分析", icon: <Activity className="w-4 h-4" /> },
    { id: "lanes", name: "レーン別戦績", icon: <Swords className="w-4 h-4" /> },
    { id: "chemistry", name: "相性＆好敵手", icon: <Users className="w-4 h-4" /> },
    { id: "champions", name: "魂のキャラ", icon: <Star className="w-4 h-4" /> },
    { id: "history", name: "試合履歴", icon: <Clock className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      {/* 背景ネオンデコレーション */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header / Control Panel (グラスモルフィズム＆ネオンシャドウ) */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-indigo-500 rounded-full flex items-center justify-center text-3xl font-black border-2 border-white/20 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                {player.ign ? player.ign.charAt(0).toUpperCase() : player.name.charAt(0)}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                  {player.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-400 text-sm font-semibold">{player.ign || "IGN未登録"}</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-300">
                      最高: <span className="text-cyan-400">{player.highest_rank || "UNRANKED"}</span>
                    </span>
                    <span className="bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                      総合MMR: <span className="text-white font-black">{player.mmr || 1000}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Participation Status */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 w-full md:w-auto flex items-center justify-between md:justify-start gap-8 shadow-inner">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 font-black tracking-wider uppercase">内戦ステータス</div>
                <div className={`flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black border ${
                  player.is_active 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]' 
                    : 'bg-white/5 text-gray-400 border-white/5'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${player.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}></span>
                  {player.is_active ? '参加中' : '未参加'}
                </div>
              </div>
              <div className="h-8 w-[1px] bg-white/5 hidden md:block"></div>
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-black tracking-wider uppercase mb-1">第一希望</span>
                  <span className="text-white font-bold text-sm bg-white/5 px-2 py-0.5 rounded border border-white/5 text-center min-w-[36px]">
                    {player.role_preferences?.primary || "ALL"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-black tracking-wider uppercase mb-1">第二希望</span>
                  <span className="text-gray-400 font-bold text-sm bg-white/5 px-2 py-0.5 rounded border border-white/5 text-center min-w-[36px]">
                    {player.role_preferences?.secondary || "ALL"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Controls (横スライド対応、洗練されたグラスデザイン) */}
        <div className="flex gap-1 bg-white/[0.02] backdrop-blur-md p-1.5 rounded-2xl border border-white/5 overflow-x-auto scrollbar-none shadow-lg">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.name}
                className={`flex items-center justify-center gap-2 shrink-0 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-black font-black shadow-[0_4px_12px_rgba(6,182,212,0.25)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {/* スマホでは非アクティブはアイコンのみ（全タブが収まるように）、sm以上とアクティブはラベル表示 */}
                <span className={isActive ? 'inline' : 'hidden sm:inline'}>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents Area */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              
              {/* 1. 総合分析タブ */}
              {activeTab === 'summary' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 直近の調子 & 対面の得意/苦手 */}
                  <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 直近の調子 */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
                      <h3 className="text-base font-black flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <span>直近の調子</span>
                      </h3>
                      {recentForm ? (
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">現在の連続</p>
                            <p className={`text-2xl font-black ${recentForm.streakWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {recentForm.streak}{recentForm.streakWin ? '連勝' : '連敗'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">直近{recentForm.last10Games}戦</p>
                            <p className="text-2xl font-black text-white">
                              {recentForm.last10Wins}<span className="text-sm text-gray-500">勝{recentForm.last10Games - recentForm.last10Wins}敗</span>
                              <span className={`ml-2 text-base ${recentForm.last10Rate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{recentForm.last10Rate}%</span>
                            </p>
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">最近の流れ（左が最新）</p>
                            <div className="flex gap-1">
                              {recentForm.seq.map((w, i) => (
                                <div key={i} title={w ? '勝ち' : '負け'} className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black ${w ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                  {w ? 'W' : 'L'}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 py-4">まだ試合データがありません</p>
                      )}
                    </div>

                    {/* 対面の得意/苦手 */}
                    <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
                      <h3 className="text-base font-black flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                        <Swords className="w-5 h-5 text-amber-400" />
                        <span>対面の得意 / 苦手</span>
                        <span className="text-[9px] text-gray-500 font-medium">(2戦以上)</span>
                      </h3>
                      {(matchupExtremes.best.length > 0 || matchupExtremes.worst.length > 0) ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2">👍 得意</p>
                            <div className="space-y-1.5">
                              {matchupExtremes.best.map((m: any) => (
                                <div key={m.opponentChampion} className="flex items-center gap-2 text-xs">
                                  <img src={getChampIcon(m.opponentChampion)} className="w-6 h-6 rounded-full border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  <span className="text-gray-200 truncate flex-1">{m.opponentChampion}</span>
                                  <span className="text-emerald-400 font-bold">{m.winRate}%</span>
                                  <span className="text-[10px] text-gray-600">({m.games})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-rose-400 font-black uppercase tracking-widest mb-2">👎 苦手</p>
                            <div className="space-y-1.5">
                              {matchupExtremes.worst.map((m: any) => (
                                <div key={m.opponentChampion} className="flex items-center gap-2 text-xs">
                                  <img src={getChampIcon(m.opponentChampion)} className="w-6 h-6 rounded-full border border-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  <span className="text-gray-200 truncate flex-1">{m.opponentChampion}</span>
                                  <span className="text-rose-400 font-bold">{m.winRate}%</span>
                                  <span className="text-[10px] text-gray-600">({m.games})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 py-4">対面データがまだ足りません（各相手2戦以上で表示）</p>
                      )}
                    </div>
                  </div>

                  {/* レーダーチャート */}
                  <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl lg:col-span-1">
                    <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
                      <Activity className="w-5 h-5 text-cyan-400" />
                      <span>プレイスタイル分析</span>
                    </h3>
                    <ScoutingReport stats={stats} mmr={player.mmr || 1000} />
                  </div>

                  {/* MMRグラフ */}
                  <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl lg:col-span-2 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-3">
                      <h3 className="text-lg font-black flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        <span>MMR推移グラフ</span>
                      </h3>
                      
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* 期間フィルタ（#49） */}
                        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                          {([[10, '直近10'], [30, '直近30'], [0, '全期間']] as const).map(([v, label]) => (
                            <button
                              key={v}
                              onClick={() => setChartPeriod(v)}
                              type="button"
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                                chartPeriod === v ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {/* レーン切り替えトグル */}
                        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                          {(['TOTAL', 'ALL', 'TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).map(lane => (
                            <button
                              key={lane}
                              onClick={() => setActiveLane(lane)}
                              type="button"
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                                activeLane === lane
                                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {lane === 'TOTAL' ? '総合' : lane === 'ALL' ? '全レーン' : lane}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {activeLane === 'ALL' ? (
                      // 各レーンごとに別グラフを並べる（レーン別MMR推移）
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {(['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const).map(lane => {
                          const pts = perLaneChartData[lane];
                          const cur = player?.[`mmr_${lane.toLowerCase()}`];
                          return (
                            <div key={lane} className="bg-black/20 border border-white/5 rounded-2xl p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-black" style={{ color: LANE_COLORS[lane] }}>{lane}</span>
                                <span className="text-[10px] text-gray-500">{pts.length}戦{cur ? ` / 現在 ${cur}` : ''}</span>
                              </div>
                              {pts.length > 0 ? (
                                <div className="w-full h-36">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={pts} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                      <XAxis dataKey="game" tick={{ fill: '#6b7280', fontSize: 8 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                      <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} domain={['dataMin - 20', 'dataMax + 20']} width={40} />
                                      <Tooltip
                                        content={({ active, payload }) => {
                                          if (!active || !payload || payload.length === 0) return null;
                                          const d = payload[0].payload;
                                          return (
                                            <div className="bg-black/90 border border-white/10 rounded-lg p-2 text-[10px] shadow-xl">
                                              <div className="font-bold text-white">
                                                {d.champion}{d.opponentChampion ? <span className="text-rose-300"> vs {d.opponentChampion}</span> : ''}
                                              </div>
                                              {d.opponentName && <div className="text-gray-500">対面: {d.opponentName}</div>}
                                              <div className={d.isWin ? 'text-emerald-400' : 'text-rose-400'}>{d.isWin ? 'WIN' : 'LOSE'}</div>
                                              <div className="text-gray-300">MMR {d.mmr} <span className={d.mmrDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>({d.mmrDelta > 0 ? '+' : ''}{d.mmrDelta})</span></div>
                                              <div className="text-gray-500">{d.date}</div>
                                            </div>
                                          );
                                        }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="mmr"
                                        stroke={LANE_COLORS[lane]}
                                        strokeWidth={2}
                                        dot={(props: any) => {
                                          const { cx, cy, payload } = props;
                                          return <circle key={`d-${payload.game}`} cx={cx} cy={cy} r={3} fill={payload.isWin ? '#10b981' : '#f43f5e'} stroke={LANE_COLORS[lane]} strokeWidth={1} />;
                                        }}
                                        activeDot={{ r: 4 }}
                                        isAnimationActive={false}
                                      />
                                    </ComposedChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <div className="h-36 flex items-center justify-center text-[10px] text-gray-600">このレーンの試合なし</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : mmrChartData.length > 0 ? (
                      <div className="w-full h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={mmrChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="mmrGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                            <XAxis
                              dataKey="game"
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                              tickLine={false}
                              label={{ value: '試合', position: 'insideBottomRight', offset: -5, fill: '#6b7280', fontSize: 9 }}
                            />
                            <YAxis
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                              tickLine={false}
                              domain={['dataMin - 30', 'dataMax + 30']}
                              label={{ value: 'MMR', angle: -90, position: 'insideLeft', offset: 20, fill: '#6b7280', fontSize: 9 }}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload || payload.length === 0) return null;
                                const d = payload[0].payload;
                                const laneLabels: Record<string, string> = { TOTAL: '総合', ALL: '全レーン', TOP: 'TOP', JG: 'JG', MID: 'MID', ADC: 'ADC', SUP: 'SUP' };
                                return (
                                  <div className="bg-black/90 border border-white/10 backdrop-blur-xl rounded-xl p-3 shadow-2xl text-xs min-w-[170px]">
                                    <div className="flex items-center gap-2 mb-1">
                                      <img
                                        src={getChampIcon(d.champion)}
                                        className="w-6 h-6 rounded-full"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                      />
                                      <span className="font-bold text-white">{d.champion}</span>
                                      {d.opponentChampion && (
                                        <>
                                          <span className="text-[9px] font-black text-gray-500 italic">VS</span>
                                          <img
                                            src={getChampIcon(d.opponentChampion)}
                                            className="w-6 h-6 rounded-full border border-rose-500/40"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                          />
                                          <span className="font-bold text-rose-300">{d.opponentChampion}</span>
                                        </>
                                      )}
                                    </div>
                                    {d.opponentName && (
                                      <div className="text-[9px] text-gray-500 mb-1">対面: {d.opponentName}</div>
                                    )}
                                    <div className="flex justify-between items-center mt-1">
                                      <span className={`font-black text-[10px] ${d.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {d.isWin ? 'WIN' : 'LOSE'} ({d.role})
                                      </span>
                                      <span className={`text-[9px] px-1.5 rounded font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20`}>
                                        {laneLabels[activeLane]}
                                      </span>
                                    </div>
                                    <div className="text-gray-300 mt-2 pt-2 border-t border-white/5 space-y-1">
                                      <div>
                                        MMR: <span className="font-bold text-white">{d.mmr}</span>
                                        <span className={`ml-2 font-bold ${d.mmrDelta > 0 && d.role === activeLane ? 'text-emerald-400' : d.mmrDelta < 0 && d.role === activeLane ? 'text-rose-400' : 'text-gray-500'}`}>
                                          ({d.mmrDelta > 0 ? '+' : ''}{d.mmrDelta})
                                        </span>
                                      </div>
                                      {d.allMmr && (
                                        <div className="text-[9px] text-gray-500 grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1.5 border-t border-white/5 mt-1">
                                          <div>総合: {d.allMmr.TOTAL}</div>
                                          <div>TOP: {d.allMmr.TOP}</div>
                                          <div>JG: {d.allMmr.JG}</div>
                                          <div>MID: {d.allMmr.MID}</div>
                                          <div>ADC: {d.allMmr.ADC}</div>
                                          <div>SUP: {d.allMmr.SUP}</div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-gray-500 text-[9px] mt-2 text-right">{d.date}</div>
                                  </div>
                                );
                              }}
                            />
                            {/* ティア境界線（#49）: 表示範囲に入るKTMティアの下限を薄く引く */}
                            {visibleTierBounds.map((t) => (
                              <ReferenceLine
                                key={t.name}
                                y={t.min}
                                stroke="#a78bfa"
                                strokeDasharray="2 4"
                                strokeOpacity={0.25}
                                label={{ value: t.name, position: 'left', fill: '#a78bfa', fontSize: 8, opacity: 0.6 }}
                              />
                            ))}
                            <ReferenceLine
                              y={currentLaneMmr}
                              stroke="#06b6d4"
                              strokeDasharray="6 4"
                              strokeOpacity={0.5}
                              label={{ value: `現在 ${currentLaneMmr}`, position: 'right', fill: '#06b6d4', fontSize: 10 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="mmr"
                              stroke="#06b6d4"
                              strokeWidth={2.5}
                              fill="url(#mmrGradient)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                // 大勝/大敗(MMR変動±30以上)は大きめ＆リング付きで強調（#49）
                                const big = payload.bigSwing;
                                return (
                                  <circle
                                    key={`dot-${payload.game}`}
                                    cx={cx}
                                    cy={cy}
                                    r={big ? 6.5 : 4.5}
                                    fill={payload.isWin ? '#10b981' : '#f43f5e'}
                                    stroke={big ? '#fff' : (payload.isWin ? '#047857' : '#be123c')}
                                    strokeWidth={big ? 2 : 1.5}
                                  />
                                );
                              }}
                              activeDot={{ r: 6, stroke: '#06b6d4', strokeWidth: 2 }}
                            />
                            {/* 5戦移動平均線（#49）: 調子の波を滑らかに可視化 */}
                            <Line
                              type="monotone"
                              dataKey="ma"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              strokeDasharray="5 3"
                              dot={false}
                              activeDot={false}
                              isAnimationActive={false}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        {/* 凡例 */}
                        <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                            <span>勝利</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                            <span>敗北</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 border-t-2 border-dashed border-cyan-400/50"></div>
                            <span>現在のMMR</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 border-t-2 border-dashed border-amber-500"></div>
                            <span>5戦移動平均</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-white/80 border border-gray-400"></div>
                            <span>大勝/大敗(±30)</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-12 border border-dashed border-white/5 rounded-2xl">
                        まだ試合データがありません
                      </div>
                    )}
                  </div>


                </div>
              )}

              {/* 2. レーン別戦績タブ */}
              {activeTab === 'lanes' && (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
                  <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
                    <Swords className="w-5 h-5 text-emerald-400" />
                    <span>KTM レーン別戦績詳細</span>
                  </h3>
                  
                  {stats && Object.keys(stats).some(k => stats[k] !== null) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => {
                        const s = stats[role];
                        if (!s) return null;
                        
                        return (
                          <div 
                            key={role} 
                            className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden group"
                          >
                            {/* ホバー時のバックグラウンド発光 */}
                            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="flex justify-between items-center mb-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-white/5 rounded-lg">
                                  {roleIcons[role]}
                                </div>
                                <span className="font-black text-lg tracking-wider text-gray-200">{role}</span>
                              </div>
                              <span className="text-[10px] text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                                MMR {player[`mmr_${role.toLowerCase()}`] || 1000}
                              </span>
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs text-gray-400 font-bold">
                                <span>{s.totalGames}戦 {s.totalWins}勝</span>
                                <span className={s.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {s.winRate}%
                                </span>
                              </div>
                              <div className="w-full bg-black/60 rounded-full h-2.5 shadow-inner overflow-hidden border border-white/5">
                                <div 
                                  className={`h-full rounded-full ${s.winRate >= 50 ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-rose-500 to-pink-400 shadow-[0_0_8px_rgba(244,63,94,0.3)]'}`} 
                                  style={{ width: `${s.winRate}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className="space-y-2 mt-5 pt-4 border-t border-white/5">
                              <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>使用率の高いキャラ</span>
                              </div>
                              {s.topChampions.map((champ: any, cIdx: number) => {
                                if (champ.name === 'Unknown') {
                                  return (
                                    <div key={cIdx} className="flex items-center gap-3 bg-black/25 p-2 rounded-xl border border-white/5">
                                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 text-xs border border-white/5">?</div>
                                      <div className="flex-1 font-bold text-gray-500 italic text-xs truncate">記録なし</div>
                                      <div className="text-xs font-semibold text-gray-600">
                                        {champ.wins}W - {champ.games - champ.wins}L
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={cIdx} className="flex items-center gap-3 bg-black/25 p-2 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <img 
                                      src={getChampIcon(champ.name)} 
                                      className="w-8 h-8 rounded-full border border-white/10 shadow-sm"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                    <div className="flex-1 font-bold text-gray-300 text-xs truncate">{champ.name}</div>
                                    <div className="text-xs font-bold text-gray-400">
                                      <span className={champ.winRate >= 50 ? 'text-emerald-400' : 'text-gray-400'}>{champ.wins}W</span>
                                      <span className="text-gray-600 mx-1">-</span>
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
                    <div className="text-center text-gray-500 py-12 border border-dashed border-white/5 rounded-2xl">
                      まだKTMでの試合記録がありません。内戦に参加してデータを集めましょう！
                    </div>
                  )}
                </div>
              )}

              {/* 3. 相性・好敵手タブ */}
              {activeTab === 'chemistry' && (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                  <h3 className="text-lg font-black flex items-center gap-2 border-b border-white/5 pb-3">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span>相性 ＆ ライバル分析</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* 味方相性 (Chemistry) */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-emerald-400" />
                        <span>🤝 最高の相棒 (味方時の勝率が高い)</span>
                      </h4>
                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {chemistry.length > 0 ? (
                          chemistry.slice(0, 5).map((c, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-black/40 p-3.5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                              <span className="font-bold text-gray-200 text-sm">{c.name}</span>
                              <div className="text-right">
                                <span className="text-emerald-400 font-black text-sm">{c.winRate}%</span>
                                <span className="text-[10px] text-gray-500 block font-medium mt-0.5">{c.wins}勝 - {c.games - c.wins}敗</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-xs py-8 text-center border border-dashed border-white/5 rounded-2xl">
                            まだ十分な味方データがありません
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 宿敵ライバル (Rivals) */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-400" />
                        <span>🔥 宿敵・好敵手 (敵対時の敗率が高い)</span>
                      </h4>
                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {rivals.length > 0 ? (
                          rivals.slice(0, 5).map((r, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-black/40 p-3.5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                              <span className="font-bold text-gray-200 text-sm">{r.name}</span>
                              <div className="text-right">
                                <span className="text-rose-400 font-black text-sm">{100 - r.winRate}%</span>
                                <span className="text-[10px] text-gray-500 block font-medium mt-0.5">対面敗率 (相手の勝率: {r.winRate}%)</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-xs py-8 text-center border border-dashed border-white/5 rounded-2xl">
                            まだ十分な敵対データがありません
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. 魂のキャラ ＆ 対面勝率タブ */}
              {activeTab === 'champions' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 魂のチャンピオン */}
                  <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
                      <Star className="w-5 h-5 text-amber-400" />
                      <span>魂のチャンピオン (マスタリー)</span>
                    </h3>
                    <div className="space-y-3">
                      {riotMasteries.length > 0 ? riotMasteries.map((m, idx) => (
                        <div key={idx} className="flex items-center gap-4 bg-black/40 p-3.5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                          <img 
                            src={m.iconUrl} 
                            className="w-12 h-12 rounded-full border border-white/10 shadow-md"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                          <div className="space-y-1">
                            <div className="font-black text-base text-white">{m.name === 'Unknown' ? `ID:${m.championId}` : m.name}</div>
                            <div className="text-[10px] text-gray-400 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5 inline-block">
                              マスタリーLv {m.championLevel} ({m.championPoints.toLocaleString()} pt)
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-gray-500 text-sm py-8 text-center border border-dashed border-white/5 rounded-2xl">
                          データがありません
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 对面マッチアップ勝率 */}
                  <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
                      <Crosshair className="w-5 h-5 text-rose-500" />
                      <span>⚔️ 対面マッチアップ勝率</span>
                    </h3>
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {matchups.length > 0 ? matchups.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <img 
                              src={getChampIcon(m.opponentChampion)} 
                              className="w-9 h-9 rounded-full border border-white/10 shadow-sm"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            <div className="font-bold text-gray-300 text-sm w-32 truncate">vs {m.opponentChampion}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-black text-sm ${m.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {m.winRate}%
                            </div>
                            <div className="text-[9px] text-gray-500 font-bold mt-0.5">
                              {m.wins}W - {m.games - m.wins}L
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-gray-500 text-sm py-12 text-center border border-dashed border-white/5 rounded-2xl">
                          まだ対面データがありません
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. 試合履歴タブ */}
              {activeTab === 'history' && (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
                  <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    <span>直近の戦績 (KTMカスタム)</span>
                  </h3>
                  <div className="space-y-3">
                    {history && history.length > 0 ? history.map((match, idx) => (
                      <div 
                        key={idx} 
                        className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.005] ${
                          match.isWin 
                            ? 'bg-emerald-500/[0.02] border-emerald-500/20 hover:border-emerald-500/40' 
                            : 'bg-rose-500/[0.02] border-rose-500/20 hover:border-rose-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-5 w-full sm:w-auto">
                          <div className={`w-[3px] h-12 rounded-full ${match.isWin ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <img 
                                src={getChampIcon(match.champion)} 
                                className="w-12 h-12 rounded-full shadow-md border border-white/10"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                              <div className="absolute -bottom-1 -right-1 bg-black p-0.5 rounded-full border border-white/20">
                                {roleIcons[match.role] || <div className="w-3 h-3 bg-gray-500 rounded-full"></div>}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className={`font-black text-base ${match.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {match.isWin ? 'WIN' : 'LOSS'}
                              </div>
                              <div className="text-[10px] text-gray-500 font-bold">
                                {new Date(match.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-8 mt-4 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-center sm:text-left">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-wider mb-1">K / D / A</div>
                            <div className="font-bold text-sm text-gray-200">
                              <span>{match.kills}</span>
                              <span className="text-gray-600 mx-1">/</span>
                              <span className="text-rose-400">{match.deaths}</span>
                              <span className="text-gray-600 mx-1">/</span>
                              <span>{match.assists}</span>
                            </div>
                          </div>
                          
                          <div className="text-right min-w-[80px]">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-wider mb-1">MMRの変動</div>
                            <div className={`font-black text-sm ${match.mmrDelta > 0 ? 'text-emerald-400' : match.mmrDelta < 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                              {match.mmrDelta > 0 ? '+' : ''}{match.mmrDelta}
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center text-gray-500 py-12 border border-dashed border-white/5 rounded-2xl">
                        直近の試合データがありません
                      </div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
