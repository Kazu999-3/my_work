"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import RadarChart from "../../../../components/RadarChart";
import { Activity, Shield, Swords, Star, Zap, Crosshair, RefreshCw, CheckCircle2 } from "lucide-react";
import { getChampIcon, getChampNameById } from "../../../../lib/ddragonClient";

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

        // 3. マスタリーの解決
        if (pData.main_champions && Array.isArray(pData.main_champions)) {
          const resolved = await Promise.all(
            pData.main_champions.map(async (m: any) => {
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

  const toggleActive = async () => {
    if (!player) return;
    setSaving(true);
    const newStatus = !player.is_active;
    try {
      const { error } = await supabase
        .from("ktm_players")
        .update({ is_active: newStatus })
        .eq("id", player.id);
      
      if (!error) {
        setPlayer({ ...player, is_active: newStatus });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (type: 'primary' | 'secondary', val: string) => {
    if (!player) return;
    setSaving(true);
    const newPrefs = { ...player.role_preferences, [type]: val };
    try {
      const { error } = await supabase
        .from("ktm_players")
        .update({ role_preferences: newPrefs })
        .eq("id", player.id);
      
      if (!error) {
        setPlayer({ ...player, role_preferences: newPrefs });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

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

            {/* Participation Controls */}
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 w-full md:w-auto shadow-inner">
              <div className="flex items-center justify-between gap-6 mb-4">
                <div className="font-bold text-gray-300">本日の内戦に参加する</div>
                <button 
                  onClick={toggleActive}
                  disabled={saving}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${player.is_active ? 'bg-emerald-500' : 'bg-gray-700'} ${saving ? 'opacity-50' : ''}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${player.is_active ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex gap-2">
                <select 
                  className="bg-gray-800 border border-gray-700 rounded text-sm px-2 py-1 outline-none text-white w-24"
                  value={player.role_preferences?.primary || "ALL"}
                  onChange={(e) => updateRole('primary', e.target.value)}
                  disabled={saving}
                >
                  <option value="TOP">TOP</option>
                  <option value="JG">JG</option>
                  <option value="MID">MID</option>
                  <option value="ADC">ADC</option>
                  <option value="SUP">SUP</option>
                  <option value="ALL">ALL</option>
                </select>
                <select 
                  className="bg-gray-800 border border-gray-700 rounded text-sm px-2 py-1 outline-none text-white w-24"
                  value={player.role_preferences?.secondary || "ALL"}
                  onChange={(e) => updateRole('secondary', e.target.value)}
                  disabled={saving}
                >
                  <option value="TOP">TOP</option>
                  <option value="JG">JG</option>
                  <option value="MID">MID</option>
                  <option value="ADC">ADC</option>
                  <option value="SUP">SUP</option>
                  <option value="ALL">ALL</option>
                </select>
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
              <RadarChart stats={stats} mmr={player.mmr || 1000} />
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
                        {s.topChampions.map((champ: any, cIdx: number) => (
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
                        ))}
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
