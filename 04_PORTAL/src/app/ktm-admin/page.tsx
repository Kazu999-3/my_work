"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import MatchHistoryPanel from "./MatchHistoryPanel";
import ProfileModal from "./ProfileModal";
import { Info, Users, RefreshCw, Save, Trophy, Filter, Plus, AlertCircle, X, History, Globe } from "lucide-react";

function getRankFromMMR(mmr: number): { tier: string, color: string } {
  if (mmr >= 2000) return { tier: "CHALLENGER", color: "text-sky-300 bg-sky-300/10" };
  if (mmr >= 1900) return { tier: "GRANDMASTER", color: "text-red-500 bg-red-500/10" };
  if (mmr >= 1850) return { tier: "MASTER", color: "text-purple-500 bg-purple-500/10" };
  if (mmr >= 1800) return { tier: "DIAMOND", color: "text-blue-400 bg-blue-400/10" };
  if (mmr >= 1650) return { tier: "EMERALD", color: "text-emerald-500 bg-emerald-500/10" };
  if (mmr >= 1500) return { tier: "PLATINUM", color: "text-teal-400 bg-teal-400/10" };
  if (mmr >= 1350) return { tier: "GOLD", color: "text-yellow-400 bg-yellow-400/10" };
  if (mmr >= 1200) return { tier: "SILVER", color: "text-slate-300 bg-slate-300/10" };
  if (mmr >= 1050) return { tier: "BRONZE", color: "text-amber-700 bg-amber-700/10" };
  return { tier: "IRON", color: "text-gray-500 bg-gray-500/10" };
}

const RANKS_MMR: Record<string, number> = { 
  'UNRANKED': 1200, 'IRON': 1100, 'BRONZE': 1200, 'SILVER': 1350, 
  'GOLD': 1500, 'PLATINUM': 1650, 'EMERALD': 1800, 'DIAMOND': 2000, 
  'MASTER': 2200, 'GRANDMASTER': 2400, 'CHALLENGER': 2600 
};

function calculateAutoMmr(highestRank: string | null, targetRole: string, prefs: { primary: string, secondary: string }) {
  const rankStr = highestRank ? highestRank.split(' ')[0].toUpperCase() : 'UNRANKED';
  const originalRankMmr = RANKS_MMR[rankStr] || 1200;
  const COMPRESSION_RATE = 0.8;
  const baseMmr = Math.round(1200 + (originalRankMmr - 1200) * COMPRESSION_RATE);

  if (!prefs) return baseMmr - 200;

  const norm = (r: string) => {
    if (!r) return '';
    const upper = r.toUpperCase();
    if (upper === 'JUNGLE') return 'JG';
    if (upper === 'SUPPORT') return 'SUP';
    return upper;
  };

  const p = norm(prefs.primary);
  const s = norm(prefs.secondary);
  const r = norm(targetRole);

  if (p === r) return baseMmr;
  if (p === 'ALL' || p === 'FILL') return baseMmr - 100;
  if (s === r || s === 'ALL' || s === 'FILL') return baseMmr - 100;
  return baseMmr - 200;
}

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

function getColorFromRole(role: string): string {
  const r = (role || "").toUpperCase();
  if (r.includes("TOP")) return "text-orange-400 font-bold";
  if (r.includes("JUNGLE") || r.includes("JG")) return "text-green-500 font-bold";
  if (r.includes("MID")) return "text-red-400 font-bold";
  if (r.includes("ADC")) return "text-blue-400 font-bold";
  if (r.includes("SUPPORT") || r.includes("SUP")) return "text-teal-300 font-bold";
  if (r === "ALL") return "text-amber-300 font-bold";
  return "text-gray-400 font-medium";
}

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
  const [sortConfig, setSortConfig] = useState({ key: "no", direction: "asc" });
  const [filterActive, setFilterActive] = useState(false);
  const [showMmrInfo, setShowMmrInfo] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'players' | 'history'>('players');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [syncingDiscord, setSyncingDiscord] = useState(false);
  const [syncData, setSyncData] = useState<any>(null);

  const [syncingRiot, setSyncingRiot] = useState(false);

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
      const playersToInsert = targetPlayers.filter(p => !p.id);

      let updatedCount = 0;
      for (const p of existingPlayers) {
        const { data, error } = await supabase.from("ktm_players").update({
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
          pity: parseInt(p.pity) || 0,
          off_role_pity: parseInt(p.off_role_pity) || 0,
        }).eq('id', p.id).select();
        
        if (error) throw error;
        if (data && data.length > 0) updatedCount++;
      }

      if (existingPlayers.length > 0 && updatedCount === 0) {
        throw new Error("更新が0件でした。Supabaseの RLS によりフロントエンドからの更新が弾かれている可能性があります。");
      }

      if (playersToInsert.length > 0) {
        const { error } = await supabase.from("ktm_players").insert(
          playersToInsert.map(p => ({
            discord_id: p.discord_id.startsWith('new-') ? '' : p.discord_id,
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
            pity: parseInt(p.pity) || 0,
            off_role_pity: parseInt(p.off_role_pity) || 0,
          }))
        );
        if (error) throw error;
      }

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
      mmr_top: 1000, mmr_jg: 1000, mmr_mid: 1000, mmr_adc: 1000, mmr_sup: 1000,
      pity: 0, off_role_pity: 0
    };
    setPlayers([newPlayer, ...players]);
  };

  const handleAutoFillMmr = (uid: string) => {
    setPlayers(prevPlayers => prevPlayers.map(p => {
      if ((p.id || p.discord_id) === uid) {
        const prefs = p.role_preferences || { primary: 'ALL', secondary: 'FILL' };
        const mmr_top = calculateAutoMmr(p.highest_rank, 'TOP', prefs);
        const mmr_jg = calculateAutoMmr(p.highest_rank, 'JG', prefs);
        const mmr_mid = calculateAutoMmr(p.highest_rank, 'MID', prefs);
        const mmr_adc = calculateAutoMmr(p.highest_rank, 'ADC', prefs);
        const mmr_sup = calculateAutoMmr(p.highest_rank, 'SUP', prefs);
        const mmr = Math.round((mmr_top + mmr_jg + mmr_mid + mmr_adc + mmr_sup) / 5);
        return { ...p, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, mmr };
      }
      return p;
    }));
  };

  const handleRebuildMmr = async () => {
    if (!confirm("過去のすべての試合履歴をもとに全プレイヤーのMMRを再計算します。よろしいですか？")) return;
    
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/mmr/rebuild", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "再計算に失敗しました");
      
      setMessage({ type: "success", text: "✅ " + data.message });
      fetchPlayers(); 
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ Rebuild エラー: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  const requestSort = (key: string) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const handleRiotSync = async () => {
    if (!confirm('Riot APIから全員の最新のランク情報を取得・同期しますか？\n（※数十秒かかる場合があります）')) return;
    
    setSyncingRiot(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch('/api/admin/riot-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (data.errors && data.errors.length > 0) {
        console.warn("Riot Sync Errors:", data.errors);
        const errorDetails = data.errors.join('\n');
        setMessage({ type: "error", text: `⚠️ ${data.message} ただし ${data.errors.length}件のエラーが発生しました。\n\n【失敗リスト】\n${errorDetails}` });
      } else {
        setMessage({ type: "success", text: data.message });
      }
      
      fetchPlayers(); 
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSyncingRiot(false);
    }
  };

  const handleSyncCheck = async () => {
    setSyncingDiscord(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch('/api/discord/members');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discordメンバーの取得に失敗しました');
      
      setSyncData(data);
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ Discord同期エラー: " + err.message });
      setSyncingDiscord(false);
    }
  };

  const executeSync = async () => {
    if (!syncData) return;
    setSyncingDiscord(true);
    try {
      const res = await fetch('/api/discord/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          add: syncData.toAdd,
          deactivate: syncData.toDeactivate,
          update_metadata: syncData.activeSync
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同期処理に失敗しました');
      
      setMessage({ type: "success", text: `✅ 同期が完了しました: ${data.message}` });
      setSyncData(null);
      fetchPlayers();
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ 同期実行エラー: " + err.message });
    } finally {
      setSyncingDiscord(false);
    }
  };

  const playersWithNo = [...players].sort((a, b) => {
    const timeA = a.metadata?.joined_at ? new Date(a.metadata.joined_at).getTime() : Infinity;
    const timeB = b.metadata?.joined_at ? new Date(b.metadata.joined_at).getTime() : Infinity;
    return timeA - timeB;
  }).map((p, index) => ({ ...p, no: index + 1 }));

  const sortedPlayers = playersWithNo
    .filter(p => filterActive ? p.is_active : true)
    .sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === "mmr" || sortConfig.key.startsWith("mmr_") || sortConfig.key === "weight" || sortConfig.key === "no") {
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
        {sortConfig.key !== sortKey && <span className="text-gray-500 opacity-30 text-xs">↕</span>}
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
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('players')}
            className={`px-6 py-3 font-bold text-sm flex items-center gap-2 transition border-b-2 ${
              activeTab === 'players' 
                ? 'border-blue-500 text-blue-400 bg-blue-500/5' 
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <Users className="h-4 w-4" /> プレイヤー名簿・MMR編集
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-bold text-sm flex items-center gap-2 transition border-b-2 ${
              activeTab === 'history' 
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <History className="h-4 w-4" /> 戦績履歴
          </button>
        </div>

        {activeTab === 'history' && (
          <MatchHistoryPanel />
        )}

        {activeTab === 'players' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  KTM 管理ダッシュボード
                </h1>
                <p className="text-gray-400 mt-2 text-sm">
                  管理者用: プレイヤー名簿の管理とMMRの手動調整
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => fetchPlayers()}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg font-bold transition"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  更新
                </button>
                
                <button
                  onClick={() => {
                    if (confirm('全ての変更を保存しますか？')) handleSave();
                  }}
                  disabled={saving}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition shadow-lg ${
                    saving ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                  }`}
                >
                  {saving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  {saving ? "保存中..." : "変更を保存"}
                </button>

                <a 
                  href="/balancer/record"
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition ml-auto"
                >
                  <Trophy className="h-4 w-4" />
                  カスタム試合を手動記録
                </a>

                <button
                  onClick={handleSyncCheck}
                  disabled={syncingDiscord}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition border ${
                    syncingDiscord ? 'bg-[#404eed]/50 border-[#404eed]/50 text-gray-400 cursor-not-allowed' : 'bg-[#5865F2]/20 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white'
                  }`}
                >
                  <Users className={`h-4 w-4 ${syncingDiscord && !syncData ? 'animate-spin' : ''}`} /> 
                  {syncingDiscord && !syncData ? "確認中..." : "Discord同期"}
                </button>
                <button
                  onClick={handleRiotSync}
                  disabled={syncingRiot}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition border ${
                    syncingRiot ? 'bg-sky-900/50 border-sky-500/50 text-sky-400 cursor-not-allowed' : 'bg-sky-900/20 border-sky-500/50 text-sky-400 hover:bg-sky-800/40 hover:text-white'
                  }`}
                >
                  <Globe className={`h-4 w-4 ${syncingRiot ? 'animate-pulse' : ''}`} /> 
                  {syncingRiot ? "同期中..." : "Riotランク同期"}
                </button>
                <button
                  onClick={handleRebuildMmr}
                  className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800 text-red-200 border border-red-800/50 px-4 py-2 rounded-lg font-bold transition"
                  title="過去のすべての試合履歴を元にMMRを再計算し、全員のデータを上書きします"
                >
                  <RefreshCw className="h-4 w-4" /> 🔄 Rebuild
                </button>
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
                  onClick={() => setShowMmrInfo(!showMmrInfo)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition border ${showMmrInfo ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                  title="MMR計算ロジックを見る"
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sync Preview Modal */}
            {syncData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Users className="h-6 w-6 text-[#5865F2]" />
                      Discordメンバー同期の確認
                    </h2>
                    <button onClick={() => { setSyncData(null); setSyncingDiscord(false); }} className="text-gray-500 hover:text-white">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    <p className="text-gray-300 text-sm">
                      現在のDiscordサーバーには <strong>{syncData.totalDiscordMembers}</strong> 人のメンバーがいます（Botを除く）。<br />
                      以下の差分が見つかりました。同期を実行すると、データベースが自動的に更新されます。
                    </p>

                    {syncData.toAdd.length > 0 && (
                      <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4">
                        <h3 className="text-green-400 font-bold mb-3 flex items-center gap-2">
                          <Plus className="h-4 w-4" /> 新規追加されるメンバー ({syncData.toAdd.length}人)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {syncData.toAdd.map((p: any) => (
                            <span key={p.discord_id} className="bg-green-900/40 text-green-300 px-2 py-1 rounded text-xs border border-green-800">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncData.toDeactivate.length > 0 && (
                      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                        <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" /> 削除 (名簿から完全消去) されるメンバー ({syncData.toDeactivate.length}人)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {syncData.toDeactivate.map((p: any) => (
                            <span key={p.id} className="bg-red-900/40 text-red-300 px-2 py-1 rounded text-xs border border-red-800 line-through">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncData.toAdd.length === 0 && syncData.toDeactivate.length === 0 && (
                      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-6 text-center text-blue-300">
                        メンバーの増減はありませんが、参加日時などの隠しデータ（メタデータ）を最新に更新するため「同期を実行する」を押してください。
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t border-gray-800 bg-gray-800/30 flex justify-end gap-3">
                    <button 
                      onClick={() => { setSyncData(null); setSyncingDiscord(false); }}
                      className="px-4 py-2 rounded-lg font-bold text-gray-400 hover:bg-gray-800 transition"
                    >
                      キャンセル
                    </button>
                    <button 
                      onClick={executeSync}
                      className="px-6 py-2 rounded-lg font-bold bg-[#5865F2] hover:bg-[#4752C4] text-white transition shadow-lg disabled:opacity-50 flex items-center gap-2"
                    >
                      {syncingDiscord && syncData.toAdd.length > 0 ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                      同期を実行する
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MMR Info Panel */}
            {showMmrInfo && (
              <div className="bg-gray-900 border border-cyan-800/50 rounded-xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                    <Info className="h-6 w-6" /> MMR計算ロジック
                  </h2>
                  <button onClick={() => setShowMmrInfo(false)} className="text-gray-500 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-bold text-white text-base">1. Eloベースの勝敗変動</h3>
                      <p>相手のMMRと自分のMMRの差から期待勝率を計算し、勝利時は加点、敗北時は減点。基本変動幅は <span className="text-amber-400 font-mono">±16</span> 前後。</p>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">2. KDAボーナス</h3>
                      <p>KDAスコア <span className="text-amber-400 font-mono">(K+A)/D</span> の基準を 3.0 とし、それを上回ればボーナス、下回ればマイナス。（最大 <span className="text-amber-400 font-mono">±20</span>）</p>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">3. ランク収束引力</h3>
                      <p>RiotのSolo/Duoランク帯（Gold等）の適正MMRへ引き寄せられる力が働き、ランクとかけ離れたMMRに滞在しにくくします。</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-bold text-white text-base">4. 視界・CSボーナス (Riot同期後)</h3>
                      <ul className="list-disc list-inside pl-2 space-y-1">
                        <li><span className="text-teal-300">SUP</span>: 視界スコア 40以上で <span className="text-green-400">+5</span>, 60以上で <span className="text-green-400">+10</span></li>
                        <li><span className="text-blue-300">ADC/MID</span>: CS 200以上で <span className="text-green-400">+5</span>, 250以上で <span className="text-green-400">+10</span></li>
                        <li><span className="text-green-400">JG</span>: 視界20以上で <span className="text-green-400">+5</span>, CS 150以上で <span className="text-green-400">+5</span></li>
                        <li><span className="text-orange-400">TOP</span>: CS 180以上で <span className="text-green-400">+5</span>, 視界15以上で <span className="text-green-400">+3</span></li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">5. 対面回数ダンパー & 勝率補正</h3>
                      <p>同じ相手と短期間に何度も対面すると、MMRの変動幅が縮小します（最大0.4倍）。また、特定ロールでの全体勝率が極端に高い/低い場合は補正がかかります。</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
                  ※ Riot同期による視界・CSボーナスは、Discordで勝敗報告をした約3分後にバックグラウンドで自動計算され上書き反映されます。
                </div>
              </div>
            )}

            {/* Message Banner */}
            {message.text && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium whitespace-pre-wrap">{message.text}</p>
              </div>
            )}

            {/* Player Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-800/80 text-gray-400 uppercase text-xs tracking-wider sticky top-0 z-30 shadow-md backdrop-blur-sm">
                    <tr>
                      <SortableHeader label="No." sortKey="no" />
                      <SortableHeader label="Active" sortKey="is_active" />
                      <SortableHeader label="名前" sortKey="name" sticky={true} />
                      <SortableHeader label="最高Rank" sortKey="highest_rank" />
                      <SortableHeader label="こだわり" sortKey="weight" />
                      <SortableHeader label="格上" sortKey="allow_higher" />
                      <SortableHeader label="Pity" sortKey="pity" />
                      <SortableHeader label="Off Pity" sortKey="off_role_pity" />
                      <SortableHeader label="Top" sortKey="mmr_top" />
                      <SortableHeader label="Jg" sortKey="mmr_jg" />
                      <SortableHeader label="Mid" sortKey="mmr_mid" />
                      <SortableHeader label="Adc" sortKey="mmr_adc" />
                      <SortableHeader label="Sup" sortKey="mmr_sup" />
                      <SortableHeader label="総合" sortKey="mmr" />
                      <SortableHeader label="Discord ID" sortKey="discord_id" />
                      <SortableHeader label="Riot IGN" sortKey="ign" />
                      <th className="px-2 py-2 font-medium text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50 text-sm">
                    {sortedPlayers.map((p) => {
                      const uid = p.id || p.discord_id;
                      return (
                      <tr key={uid} className="hover:bg-gray-800/40 transition">
                        <td className="px-2 py-1.5 text-center font-bold text-gray-500 text-xs">
                          {p.no}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={p.is_active}
                            onChange={(e) => handleInputChange(uid, "is_active", e.target.checked)}
                            className="h-4 w-4 rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1.5 sticky left-0 z-10 bg-gray-900 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setSelectedPlayer(p)}
                              className="text-blue-400 hover:text-white p-1 hover:bg-gray-800 rounded transition"
                              title="プロフィールを表示"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => handleInputChange(uid, "name", e.target.value)}
                              className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-20 font-bold text-white text-xs"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={p.highest_rank || "UNRANKED"}
                            onChange={(e) => handleInputChange(uid, "highest_rank", e.target.value)}
                            className={`bg-gray-800 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-blue-500 w-24 text-xs ${getColorFromRankName(p.highest_rank)}`}
                          >
                            {["UNRANKED", "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
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
                          <input
                            type="number"
                            value={p.pity || 0}
                            onChange={(e) => handleInputChange(uid, "pity", parseInt(e.target.value) || 0)}
                            className="bg-transparent text-amber-500 border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-10 text-center text-xs font-bold"
                            title="参加漏れPity"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            value={p.off_role_pity || 0}
                            onChange={(e) => handleInputChange(uid, "off_role_pity", parseInt(e.target.value) || 0)}
                            className="bg-transparent text-purple-400 border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-10 text-center text-xs font-bold"
                            title="希望外レーンPity"
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
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => handleAutoFillMmr(uid)}
                            className="bg-indigo-900/50 hover:bg-indigo-800 text-indigo-300 border border-indigo-700/50 rounded px-2 py-1 text-[10px] font-bold transition flex items-center gap-1 mx-auto"
                            title="ランクと希望レーンから初期MMRを自動計算して仮入力します"
                          >
                            ✨ Auto
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                    
                    {players.length === 0 && !loading && (
                      <tr>
                        <td colSpan={17} className="px-6 py-12 text-center text-gray-500">
                          プレイヤーが登録されていません。「行を追加」から新規作成するか、Discord Botで登録を行ってください。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}
