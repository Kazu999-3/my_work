"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare } from "lucide-react";
import { getChampIcon } from "../../lib/ddragonClient";

// ランク名から色を判定するユーティリティ
function getColorFromRankName(rank: string): string {
  const r = (rank || "").toUpperCase();
  if (r.includes("IRON")) return "text-gray-500 font-bold";
  if (r.includes("BRONZE")) return "text-amber-700 font-bold";
  if (r.includes("SILVER")) return "text-slate-300 font-bold";
  if (r.includes("GOLD")) return "text-yellow-400 font-bold";
  if (r.includes("PLATINUM")) return "text-teal-400 font-bold";
  if (r.includes("EMERALD")) return "text-emerald-500 font-bold";
  if (r.includes("DIAMOND")) return "text-blue-400 font-bold";
  if (r.includes("MASTER")) return "text-purple-500 font-bold";
  if (r.includes("GRANDMASTER")) return "text-red-500 font-bold";
  if (r.includes("CHALLENGER")) return "text-sky-300 font-bold";
  return "text-gray-400 font-medium";
}

export default function BalancerPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  const [balancing, setBalancing] = useState(false);
  const [balanceResult, setBalanceResult] = useState<any>(null);
  const [sendingDiscord, setSendingDiscord] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ktm_players")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      
      // No順にソートして保持
      const playersWithNo = (data || []).sort((a, b) => {
        const timeA = a.metadata?.joined_at ? new Date(a.metadata.joined_at).getTime() : Infinity;
        const timeB = b.metadata?.joined_at ? new Date(b.metadata.joined_at).getTime() : Infinity;
        return timeA - timeB;
      }).map((p, index) => ({ ...p, no: index + 1 }));

      setPlayers(playersWithNo);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (uid: string, field: string, value: any) => {
    setPlayers(prevPlayers => {
      const nextPlayers = prevPlayers.map(p => {
        if ((p.id || p.discord_id) === uid) {
          if (field === "primary_role") {
            return { ...p, role_preferences: { ...p.role_preferences, primary: value } };
          } else if (field === "secondary_role") {
            return { ...p, role_preferences: { ...p.role_preferences, secondary: value } };
          } else {
            return { ...p, [field]: value };
          }
        }
        return p;
      });

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        handleSave(nextPlayers);
      }, 1500);

      return nextPlayers;
    });
  };

  const handleSave = async (currentPlayers?: any[]) => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const targetPlayers = currentPlayers || players;
      const existingPlayers = targetPlayers.filter(p => p.id);

      // バランサーページでは「Activeかどうか」と「希望レーン」のみ更新を許可する
      for (const p of existingPlayers) {
        await supabase.from("ktm_players").update({
          role_preferences: p.role_preferences,
          is_active: p.is_active,
        }).eq('id', p.id);
      }
      setSaving(false);
    } catch (err: any) {
      setMessage({ type: "error", text: "保存エラー: " + err.message });
      setSaving(false);
    }
  };

  const handleBalance = async () => {
    const activePlayers = players.filter(p => p.is_active);
    if (activePlayers.length < 10) {
      setMessage({ type: "error", text: `チーム分けには最低10人のActiveプレイヤーが必要です。(現在 ${activePlayers.length}人)` });
      return;
    }

    setBalancing(true);
    setMessage({ type: "", text: "" });
    setBalanceResult(null);

    try {
      const res = await fetch('/api/balancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: activePlayers.map(p => ({
            name: p.name,
            isFixed: false
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'チーム分けに失敗しました');
      setBalanceResult(data);
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ バランス計算エラー: " + err.message });
    } finally {
      setBalancing(false);
    }
  };

  const handleSendDiscord = async () => {
    if (!balanceResult) return;
    if (!confirm("チーム分けの結果をDiscordのKTMチャンネルへ通知しますか？")) return;
    
    setSendingDiscord(true);
    try {
      const res = await fetch('/api/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(balanceResult)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discord通知に失敗しました');
      setMessage({ type: "success", text: "✅ Discordに結果を送信しました！" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSendingDiscord(false);
    }
  };

  const handleSwapPlayer = (targetTeam: 'teamBlue' | 'teamRed' | 'spectators', targetRole: string, newPlayerName: string) => {
    if (!balanceResult) return;
    
    let sourceLocation = { team: '', role: '', index: -1 };
    
    const blueIdx = balanceResult.teamBlue.findIndex((p:any) => p.name === newPlayerName);
    if (blueIdx !== -1) sourceLocation = { team: 'teamBlue', role: balanceResult.teamBlue[blueIdx].currentRole, index: blueIdx };
    
    const redIdx = balanceResult.teamRed.findIndex((p:any) => p.name === newPlayerName);
    if (redIdx !== -1 && sourceLocation.index === -1) sourceLocation = { team: 'teamRed', role: balanceResult.teamRed[redIdx].currentRole, index: redIdx };
    
    const specIdx = balanceResult.spectators?.findIndex((name:string) => name === newPlayerName);
    if (specIdx !== -1 && specIdx !== undefined && sourceLocation.index === -1) sourceLocation = { team: 'spectators', role: '', index: specIdx };

    if (sourceLocation.index === -1) return; 

    const newResult = { ...balanceResult };

    let targetPlayer: any = null;
    let targetIndex = -1;
    if (targetTeam === 'spectators') {
      targetPlayer = balanceResult.spectators[parseInt(targetRole)];
      targetIndex = parseInt(targetRole);
    } else {
      targetIndex = newResult[targetTeam].findIndex((p:any) => p.currentRole === targetRole);
      if (targetIndex !== -1) targetPlayer = newResult[targetTeam][targetIndex];
    }

    let sourcePlayerObj: any = null;
    if (sourceLocation.team === 'spectators') {
      const pData = players.find(p => p.name === newPlayerName);
      sourcePlayerObj = { 
        name: newPlayerName, 
        currentRole: targetRole,
        mmr: pData ? pData.mmr : 1000,
        mainLane: pData?.role_preferences?.primary || 'ALL',
        subLane: pData?.role_preferences?.secondary || 'ALL'
      };
    } else {
      sourcePlayerObj = { ...newResult[sourceLocation.team][sourceLocation.index] };
    }
    
    if (sourceLocation.team === 'spectators') {
      if (targetPlayer) {
        newResult.spectators[sourceLocation.index] = targetPlayer.name; 
      } else {
        newResult.spectators.splice(sourceLocation.index, 1); 
      }
    } else {
      if (targetPlayer) {
        targetPlayer.currentRole = sourceLocation.role;
        newResult[sourceLocation.team][sourceLocation.index] = targetPlayer;
      } else {
        newResult[sourceLocation.team].splice(sourceLocation.index, 1);
      }
    }

    if (targetTeam === 'spectators') {
      if (sourcePlayerObj) {
        newResult.spectators[targetIndex] = sourcePlayerObj.name;
      }
    } else {
      sourcePlayerObj.currentRole = targetRole;
      if (targetIndex !== -1) {
        newResult[targetTeam][targetIndex] = sourcePlayerObj;
      } else {
        newResult[targetTeam].push(sourcePlayerObj);
      }
    }

    setBalanceResult(newResult);
  };

  const renderSwapSelect = (team: 'teamBlue' | 'teamRed' | 'spectators', role: string, currentPlayerName: string) => {
    return (
      <select 
        value={currentPlayerName || ""}
        onChange={(e) => {
          if (e.target.value && e.target.value !== currentPlayerName) {
            handleSwapPlayer(team, role, e.target.value);
          }
        }}
        className="w-full bg-transparent border-none text-white font-bold outline-none cursor-pointer appearance-none text-center"
      >
        {(!currentPlayerName) && <option value="" className="text-gray-900">選択</option>}
        {balanceResult && (
          <>
            <optgroup label="Blue Team" className="text-gray-900 font-bold bg-blue-100">
              {balanceResult.teamBlue.map((p:any) => <option key={`blue-${p.name}`} value={p.name} className="text-gray-900 bg-white">{p.name}</option>)}
            </optgroup>
            <optgroup label="Red Team" className="text-gray-900 font-bold bg-red-100">
              {balanceResult.teamRed.map((p:any) => <option key={`red-${p.name}`} value={p.name} className="text-gray-900 bg-white">{p.name}</option>)}
            </optgroup>
            {balanceResult.spectators && balanceResult.spectators.length > 0 && (
              <optgroup label="Spectators" className="text-gray-900 font-bold bg-gray-200">
                {balanceResult.spectators.map((name:string) => <option key={`spec-${name}`} value={name} className="text-gray-900 bg-white">{name}</option>)}
              </optgroup>
            )}
          </>
        )}
      </select>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3">データを読み込み中...</span>
      </div>
    );
  }

  const activeCount = players.filter(p => p.is_active).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* ヘッダーエリア */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="h-8 w-8 text-amber-500" />
              チーム分けバランサー
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              今日の参加者のActiveチェックを入れ、希望レーンを変更してから「チーム分け実行」ボタンを押してください。
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 flex flex-col items-center justify-center min-w-[120px]">
              <span className="text-xs font-bold text-gray-500">参加人数</span>
              <span className={`text-2xl font-black ${activeCount >= 10 ? 'text-emerald-400' : 'text-amber-500'}`}>
                {activeCount} <span className="text-sm font-normal text-gray-500">人</span>
              </span>
            </div>
            <button
              onClick={handleBalance}
              disabled={balancing || activeCount < 10}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black transition text-lg ${
                balancing || activeCount < 10 ? "bg-gray-800 text-gray-600 cursor-not-allowed" : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]"
              }`}
            >
              {balancing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Swords className="h-6 w-6" />}
              {balancing ? "AIがチームを編成中..." : "チーム分け実行"}
            </button>
          </div>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg font-bold border ${message.type === 'error' ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-emerald-900/30 border-emerald-800 text-emerald-400'}`}>
            {message.text}
          </div>
        )}

        {/* チーム分け結果表示エリア */}
        {balanceResult && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <Globe className="h-6 w-6 text-indigo-400" />
                マッチング結果
              </h2>
              <div className="flex items-center gap-4">
                <div className="bg-gray-950 px-4 py-2 rounded border border-gray-800 font-mono text-sm text-gray-400">
                  MMR差: <span className="text-white font-bold">{balanceResult.mmrDiff}</span>
                </div>
                <button
                  onClick={handleSendDiscord}
                  disabled={sendingDiscord}
                  className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-lg font-bold transition shadow-lg shadow-[#5865F2]/20"
                >
                  {sendingDiscord ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Discordへ通知
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative">
              {/* VS Divider */}
              <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-gray-950 border-2 border-gray-800 rounded-full items-center justify-center font-black text-gray-600 italic text-xl">
                VS
              </div>

              {/* BLUE TEAM */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-blue-900/50 pb-2">
                  <h3 className="text-xl font-black text-blue-400 tracking-wider">BLUE TEAM</h3>
                  <div className="text-sm font-bold text-gray-500">MMR: {balanceResult.teamBlueMMR}</div>
                </div>
                <div className="space-y-2">
                  {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map((role) => {
                    const p = balanceResult.teamBlue.find((x:any) => x.currentRole === role);
                    const isOffRole = p && p.mainLane !== 'ALL' && p.mainLane !== 'FILL' && p.currentRole !== p.mainLane;
                    return (
                      <div key={`blue-${role}`} className="flex items-center gap-3 bg-gray-950/50 hover:bg-gray-800 p-2 rounded border border-gray-800 transition group relative">
                        <div className="w-10 text-center font-bold text-gray-600 text-xs">{role}</div>
                        <div className="flex-1">
                          {renderSwapSelect('teamBlue', role, p?.name || '')}
                        </div>
                        {isOffRole && (
                          <div className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-bold border border-red-900/50" title="オフロール (希望外レーン)">
                            OFF
                          </div>
                        )}
                        <div className="w-12 text-right font-mono text-xs text-gray-500">{p?.mmr || '---'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RED TEAM */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-red-900/50 pb-2">
                  <h3 className="text-xl font-black text-red-400 tracking-wider">RED TEAM</h3>
                  <div className="text-sm font-bold text-gray-500">MMR: {balanceResult.teamRedMMR}</div>
                </div>
                <div className="space-y-2">
                  {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map((role) => {
                    const p = balanceResult.teamRed.find((x:any) => x.currentRole === role);
                    const isOffRole = p && p.mainLane !== 'ALL' && p.mainLane !== 'FILL' && p.currentRole !== p.mainLane;
                    return (
                      <div key={`red-${role}`} className="flex items-center gap-3 bg-gray-950/50 hover:bg-gray-800 p-2 rounded border border-gray-800 transition group relative">
                        <div className="w-10 text-center font-bold text-gray-600 text-xs">{role}</div>
                        <div className="flex-1">
                          {renderSwapSelect('teamRed', role, p?.name || '')}
                        </div>
                        {isOffRole && (
                          <div className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-bold border border-red-900/50" title="オフロール (希望外レーン)">
                            OFF
                          </div>
                        )}
                        <div className="w-12 text-right font-mono text-xs text-gray-500">{p?.mmr || '---'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SPECTATORS */}
            {balanceResult.spectators && balanceResult.spectators.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-800">
                <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4" /> 観戦 / 待機メンバー
                </h3>
                <div className="flex flex-wrap gap-2">
                  {balanceResult.spectators.map((name: string, index: number) => (
                    <div key={`spec-${index}`} className="bg-gray-950 border border-gray-800 rounded px-3 py-1.5 min-w-[120px]">
                      {renderSwapSelect('spectators', index.toString(), name)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* プレイヤー一覧 (Active変更・レーン変更用) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 bg-gray-950 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium w-16 text-center">参加</th>
                  <th className="px-4 py-3 font-medium">プレイヤー名</th>
                  <th className="px-4 py-3 font-medium">ランク</th>
                  <th className="px-4 py-3 font-medium text-center">総合MMR</th>
                  <th className="px-4 py-3 font-medium">第1希望</th>
                  <th className="px-4 py-3 font-medium">第2希望</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {players.map((p) => {
                  const prefs = p.role_preferences || { primary: 'ALL', secondary: 'FILL' };
                  return (
                    <tr key={p.id} className={`hover:bg-gray-800/50 transition ${p.is_active ? 'bg-blue-900/5' : 'opacity-40'}`}>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={p.is_active}
                          onChange={(e) => handleInputChange(p.id, "is_active", e.target.checked)}
                          className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500/50 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2 font-bold text-white whitespace-nowrap">
                        {p.name}
                      </td>
                      <td className={`px-4 py-2 text-xs ${getColorFromRankName(p.highest_rank)}`}>
                        {p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNRANKED'}
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-blue-400 font-bold">
                        {p.mmr}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={prefs.primary || 'ALL'}
                          onChange={(e) => handleInputChange(p.id, "primary_role", e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white outline-none focus:border-blue-500 w-24 font-bold"
                        >
                          <option value="ALL">ALL</option>
                          <option value="TOP">TOP</option>
                          <option value="JG">JG</option>
                          <option value="MID">MID</option>
                          <option value="ADC">ADC</option>
                          <option value="SUP">SUP</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={prefs.secondary || 'FILL'}
                          onChange={(e) => handleInputChange(p.id, "secondary_role", e.target.value)}
                          className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-gray-300 outline-none focus:border-blue-500 w-24"
                        >
                          <option value="FILL">FILL</option>
                          <option value="ALL">ALL</option>
                          <option value="TOP">TOP</option>
                          <option value="JG">JG</option>
                          <option value="MID">MID</option>
                          <option value="ADC">ADC</option>
                          <option value="SUP">SUP</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
