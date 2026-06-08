"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import ScoutingReport from "../../../components/ScoutingReport";
import { Activity, Shield, Swords, Star, Zap, Crosshair, RefreshCw, CheckCircle2 } from "lucide-react";
import { getChampIcon, getChampNameById } from "../../../lib/ddragonClient";

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
  const [riotMasteries, setRiotMasteries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

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
      </div>
    </div>
  );
}
