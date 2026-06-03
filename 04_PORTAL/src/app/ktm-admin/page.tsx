"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Save, Plus, Users, Swords, AlertCircle, RefreshCw, Filter, ArrowUpDown, X } from "lucide-react";
import MatchRecordPanel from "./MatchRecordPanel";

// MMRからランクと色を判定するユーティリティ
function getRankFromMMR(mmr: number): { tier: string, color: string } {
  if (mmr < 1000) return { tier: "IRON", color: "text-gray-500 bg-gray-500/10" };
  if (mmr < 1600) return { tier: "BRONZE", color: "text-amber-700 bg-amber-700/10" };
  if (mmr < 2300) return { tier: "SILVER", color: "text-slate-300 bg-slate-300/10" };
  if (mmr < 3100) return { tier: "GOLD", color: "text-yellow-400 bg-yellow-400/10" };
  if (mmr < 4100) return { tier: "PLATINUM", color: "text-teal-400 bg-teal-400/10" };
  if (mmr < 4800) return { tier: "EMERALD", color: "text-emerald-500 bg-emerald-500/10" };
  if (mmr < 5500) return { tier: "DIAMOND", color: "text-blue-400 bg-blue-400/10" };
  if (mmr < 6200) return { tier: "MASTER", color: "text-purple-500 bg-purple-500/10" };
  if (mmr < 6900) return { tier: "GRANDMASTER", color: "text-red-500 bg-red-500/10" };
  return { tier: "CHALLENGER", color: "text-sky-300 bg-sky-300/10" };
}

// MMR用のクリックして編集できるバッジコンポーネント
const MmrBadgeInput = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => {
  const [editing, setEditing] = useState(false);
  const rank = getRankFromMMR(value);
  
  if (editing) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        onBlur={() => setEditing(false)}
        autoFocus
        className="bg-gray-950 border border-blue-500 rounded px-1 py-0.5 outline-none w-14 text-center font-mono text-xs text-white"
      />
    );
  }
  return (
    <div 
      onClick={() => setEditing(true)} 
      className={`cursor-pointer text-[10px] font-bold ${rank.color} hover:opacity-80 px-1 py-0.5 rounded border border-current/20 text-center w-14 overflow-hidden text-ellipsis`}
      title={`MMR: ${value} (クリックで編集)`}
    >
      {rank.tier}
    </div>
  );
};

export default function KtmAdminPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [sortConfig, setSortConfig] = useState({ key: "mmr", direction: "desc" });
  const [filterActive, setFilterActive] = useState(false);
  
  // バランサー用ステート
  const [balancing, setBalancing] = useState(false);
  const [balanceResult, setBalanceResult] = useState<any>(null);
  
  // Discord通知用ステート
  const [sendingDiscord, setSendingDiscord] = useState(false);

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
      setPlayers(data || []);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (uid: string, field: string, value: any) => {
    const updated = [...players];
    const index = updated.findIndex(p => (p.id || p.discord_id) === uid);
    if (index === -1) return;
    
    // role_preferences の入れ子に対応
    if (field === "primary_role") {
      updated[index].role_preferences = {
        ...updated[index].role_preferences,
        primary: value
      };
    } else if (field === "secondary_role") {
      updated[index].role_preferences = {
        ...updated[index].role_preferences,
        secondary: value
      };
    } else {
      updated[index][field] = value;
    }
    
    setPlayers(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const { error } = await supabase.from("ktm_players").upsert(
        players.map((p) => ({
          id: p.id,
          discord_id: p.discord_id,
          name: p.name,
          ign: p.ign,
          mmr: parseInt(p.mmr) || 1000,
          role_preferences: p.role_preferences,
          is_active: p.is_active,
          ng_lane_1: p.ng_lane_1 || null,
          ng_lane_2: p.ng_lane_2 || null,
          weight: parseInt(p.weight) || 2,
          allow_higher: p.allow_higher !== undefined ? p.allow_higher : true,
          highest_rank: p.highest_rank || null,
          mmr_top: parseInt(p.mmr_top) || 1000,
          mmr_jg: parseInt(p.mmr_jg) || 1000,
          mmr_mid: parseInt(p.mmr_mid) || 1000,
          mmr_adc: parseInt(p.mmr_adc) || 1000,
          mmr_sup: parseInt(p.mmr_sup) || 1000,
        }))
      );
      if (error) throw error;
      setMessage({ type: "success", text: "✅ プレイヤー情報をすべて保存しました。" });
      fetchPlayers();
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ 保存エラー: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const addNewPlayer = () => {
    const newPlayer = {
      discord_id: `new-${Date.now()}`,
      name: "新規プレイヤー",
      ign: "",
      mmr: 1000,
      role_preferences: { primary: "ALL", secondary: "ALL" },
      is_active: true,
      ng_lane_1: "", ng_lane_2: "",
      weight: 2, allow_higher: true, highest_rank: "",
      mmr_top: 1000, mmr_jg: 1000, mmr_mid: 1000, mmr_adc: 1000, mmr_sup: 1000
    };
    setPlayers([newPlayer, ...players]);
  };

  const requestSort = (key: string) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
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
            isFixed: false // TODO: 今後UIから固定プレイヤーを指定可能にする
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'チーム分けに失敗しました');
      
      setBalanceResult(data);
      setMessage({ type: "success", text: "✅ チーム分けが完了しました！" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBalancing(false);
    }
  };

  const handleSendDiscord = async () => {
    if (!balanceResult) return;
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

  const sortedPlayers = [...players]
    .filter(p => filterActive ? p.is_active : true)
    .sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      // 数値として扱うカラム
      if (sortConfig.key === "mmr" || sortConfig.key.startsWith("mmr_") || sortConfig.key === "weight") {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      }
      
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  const SortableHeader = ({ label, sortKey, sticky = false }: { label: string, sortKey: string, sticky?: boolean }) => (
    <th 
      className={`px-2 py-2 font-medium cursor-pointer hover:bg-gray-700/50 transition whitespace-nowrap ${sticky ? 'sticky left-0 z-20 bg-gray-900 shadow-[2px_0_5px_rgba(0,0,0,0.5)]' : ''}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1 justify-center">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-blue-400 text-xs">{sortConfig.direction === "desc" ? "↓" : "↑"}</span>
        )}
        {sortConfig.key !== sortKey && <ArrowUpDown className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100" />}
      </div>
    </th>
  );

  if (loading && players.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3">データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              KTM 管理ダッシュボード
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              プレイヤー名簿の管理とMMRの手動調整（旧スプレッドシート機能）
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterActive(!filterActive)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${filterActive ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
            >
              <Filter className="h-4 w-4" /> {filterActive ? "参加者のみ" : "全員表示"}
            </button>
            <button
              onClick={addNewPlayer}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus className="h-4 w-4" /> 行を追加
            </button>
            <button
              onClick={handleBalance}
              disabled={balancing}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition ${
                balancing ? "bg-amber-800 text-amber-300 cursor-not-allowed" : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-orange-900/20"
              }`}
            >
              {balancing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              {balancing ? "計算中..." : "チーム分け実行"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition ${
                saving ? "bg-blue-800 text-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "保存中..." : "変更を保存"}
            </button>
          </div>
        </div>

        {/* バランス結果表示エリア */}
        {balanceResult && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl relative mb-8">
            <button 
              onClick={() => setBalanceResult(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-full p-1 transition"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="p-6 border-b border-gray-800 bg-gray-800/50 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Swords className="h-6 w-6 text-amber-500" /> チーム分け結果
              </h2>
              <button
                onClick={handleSendDiscord}
                disabled={sendingDiscord}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 ${
                  sendingDiscord ? 'bg-[#404eed] text-white opacity-50 cursor-not-allowed' : 'bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-lg shadow-indigo-500/20'
                }`}
              >
                {sendingDiscord ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                {sendingDiscord ? "送信中..." : "Discordへ結果を送信"}
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-800">
              {/* BLUE TEAM */}
              <div className="flex-1 p-6">
                <h3 className="text-xl font-black text-blue-400 mb-4 tracking-wider flex items-center justify-between">
                  <span>BLUE TEAM</span>
                  <span className="text-sm font-medium text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                    Avg: {Math.round(balanceResult.teamBlue.reduce((s:number,p:any)=>s+p.mmr,0)/5)}
                  </span>
                </h3>
                <div className="space-y-2">
                  {['TOP','JG','MID','ADC','SUP'].map((role) => {
                    const player = balanceResult.teamBlue.find((p:any) => p.currentRole === role);
                    if (!player) return null;
                    const rank = getRankFromMMR(player.mmr);
                    return (
                      <div key={role} className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 text-center font-bold text-gray-400 text-xs">{role}</div>
                          <div className="font-bold text-white text-lg">{player.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${rank.color}`}>{rank.tier}</div>
                          <div className="w-12 text-right font-mono text-blue-300 font-bold">{player.mmr}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* RED TEAM */}
              <div className="flex-1 p-6">
                <h3 className="text-xl font-black text-red-400 mb-4 tracking-wider flex items-center justify-between">
                  <span>RED TEAM</span>
                  <span className="text-sm font-medium text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                    Avg: {Math.round(balanceResult.teamRed.reduce((s:number,p:any)=>s+p.mmr,0)/5)}
                  </span>
                </h3>
                <div className="space-y-2">
                  {['TOP','JG','MID','ADC','SUP'].map((role) => {
                    const player = balanceResult.teamRed.find((p:any) => p.currentRole === role);
                    if (!player) return null;
                    const rank = getRankFromMMR(player.mmr);
                    return (
                      <div key={role} className="flex items-center justify-between bg-gray-800/40 hover:bg-gray-800 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 text-center font-bold text-gray-400 text-xs">{role}</div>
                          <div className="font-bold text-white text-lg">{player.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${rank.color}`}>{rank.tier}</div>
                          <div className="w-12 text-right font-mono text-red-300 font-bold">{player.mmr}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {balanceResult.spectators && balanceResult.spectators.length > 0 && (
              <div className="p-4 bg-gray-800/80 border-t border-gray-700 flex flex-col md:flex-row items-center gap-4">
                <div className="text-sm font-bold text-gray-400 whitespace-nowrap">観戦 (Pity選抜漏れ):</div>
                <div className="flex flex-wrap gap-2">
                  {balanceResult.spectators.map((name: string) => (
                    <span key={name} className="px-3 py-1 bg-gray-900 border border-gray-700 text-gray-300 rounded text-sm font-medium">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 試合結果記録用パネル */}
            <MatchRecordPanel 
              balanceResult={balanceResult} 
              onComplete={() => {
                setBalanceResult(null);
                fetchPlayers();
              }} 
            />
          </div>
        )}

        {/* Message Banner */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Player Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-800/80 text-gray-400 uppercase text-xs tracking-wider sticky top-0 z-30 shadow-md backdrop-blur-sm">
                <tr>
                  <SortableHeader label="Active" sortKey="is_active" />
                  <SortableHeader label="名前" sortKey="name" sticky={true} />
                  <SortableHeader label="最高Rank" sortKey="highest_rank" />
                  <th className="px-2 py-2 font-medium text-center">Main</th>
                  <th className="px-2 py-2 font-medium text-center">Sub</th>
                  <th className="px-2 py-2 font-medium text-center">NG 1</th>
                  <th className="px-2 py-2 font-medium text-center">NG 2</th>
                  <SortableHeader label="こだわり" sortKey="weight" />
                  <SortableHeader label="格上" sortKey="allow_higher" />
                  <SortableHeader label="Top" sortKey="mmr_top" />
                  <SortableHeader label="Jg" sortKey="mmr_jg" />
                  <SortableHeader label="Mid" sortKey="mmr_mid" />
                  <SortableHeader label="Adc" sortKey="mmr_adc" />
                  <SortableHeader label="Sup" sortKey="mmr_sup" />
                  <SortableHeader label="総合" sortKey="mmr" />
                  <SortableHeader label="Discord ID" sortKey="discord_id" />
                  <SortableHeader label="Riot IGN" sortKey="ign" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-sm">
                {sortedPlayers.map((p) => {
                  const uid = p.id || p.discord_id;
                  return (
                  <tr key={uid} className="hover:bg-gray-800/40 transition">
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        onChange={(e) => handleInputChange(uid, "is_active", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 sticky left-0 z-10 bg-gray-900 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleInputChange(uid, "name", e.target.value)}
                        className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-24 font-bold text-white text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={p.highest_rank || ""}
                        onChange={(e) => handleInputChange(uid, "highest_rank", e.target.value)}
                        placeholder="Gold 1"
                        className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-16 text-yellow-500 font-medium text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={p.role_preferences?.primary || "ALL"}
                        onChange={(e) => handleInputChange(uid, "primary_role", e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-blue-500 w-20 text-xs"
                      >
                        <option value="TOP">TOP</option>
                        <option value="JUNGLE">JUNGLE</option>
                        <option value="MID">MID</option>
                        <option value="ADC">ADC</option>
                        <option value="SUPPORT">SUPPORT</option>
                        <option value="ALL">ALL</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={p.role_preferences?.secondary || "ALL"}
                        onChange={(e) => handleInputChange(uid, "secondary_role", e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-blue-500 w-20 text-xs"
                      >
                        <option value="TOP">TOP</option>
                        <option value="JUNGLE">JUNGLE</option>
                        <option value="MID">MID</option>
                        <option value="ADC">ADC</option>
                        <option value="SUPPORT">SUPPORT</option>
                        <option value="ALL">ALL</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={p.ng_lane_1 || ""}
                        onChange={(e) => handleInputChange(uid, "ng_lane_1", e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-red-500 w-20 text-red-400 text-xs"
                      >
                        <option value="">なし</option>
                        <option value="TOP">TOP</option>
                        <option value="JUNGLE">JUNGLE</option>
                        <option value="MID">MID</option>
                        <option value="ADC">ADC</option>
                        <option value="SUPPORT">SUPPORT</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={p.ng_lane_2 || ""}
                        onChange={(e) => handleInputChange(uid, "ng_lane_2", e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-red-500 w-20 text-red-400 text-xs"
                      >
                        <option value="">なし</option>
                        <option value="TOP">TOP</option>
                        <option value="JUNGLE">JUNGLE</option>
                        <option value="MID">MID</option>
                        <option value="ADC">ADC</option>
                        <option value="SUPPORT">SUPPORT</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <select
                        value={p.weight || 2}
                        onChange={(e) => handleInputChange(uid, "weight", parseInt(e.target.value))}
                        className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-blue-500 w-12 text-center text-xs"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={p.allow_higher !== false}
                        onChange={(e) => handleInputChange(uid, "allow_higher", e.target.checked)}
                        className="h-3 w-3 rounded border-gray-700 text-green-500 focus:ring-green-500 bg-gray-800 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <MmrBadgeInput value={p.mmr_top || 1000} onChange={(v) => handleInputChange(uid, "mmr_top", v)} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <MmrBadgeInput value={p.mmr_jg || 1000} onChange={(v) => handleInputChange(uid, "mmr_jg", v)} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <MmrBadgeInput value={p.mmr_mid || 1000} onChange={(v) => handleInputChange(uid, "mmr_mid", v)} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <MmrBadgeInput value={p.mmr_adc || 1000} onChange={(v) => handleInputChange(uid, "mmr_adc", v)} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <MmrBadgeInput value={p.mmr_sup || 1000} onChange={(v) => handleInputChange(uid, "mmr_sup", v)} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <MmrBadgeInput value={p.mmr || 1000} onChange={(v) => handleInputChange(uid, "mmr", v)} />
                    </td>
                    <td className="px-2 py-1.5 opacity-50 hover:opacity-100 transition">
                      <input
                        type="text"
                        value={p.discord_id}
                        onChange={(e) => handleInputChange(uid, "discord_id", e.target.value)}
                        className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-24 text-[10px]"
                        title={p.discord_id}
                      />
                    </td>
                    <td className="px-2 py-1.5 opacity-50 hover:opacity-100 transition">
                      <input
                        type="text"
                        value={p.ign || ""}
                        onChange={(e) => handleInputChange(uid, "ign", e.target.value)}
                        placeholder="Name#TAG"
                        className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-24 text-[10px] text-blue-300"
                        title={p.ign || "未登録"}
                      />
                    </td>
                  </tr>
                  );
                })}
                
                {players.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      プレイヤーが登録されていません。「行を追加」から新規作成するか、Discord Botで登録を行ってください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
