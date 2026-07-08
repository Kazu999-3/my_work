"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, Trees, Zap, Target, Heart, Sparkles, Settings } from "lucide-react";
import { getChampIcon } from "../../lib/ddragonClient";
import ProfileModal from "../ktm-admin/ProfileModal";
import MatchRecordPanel from "../ktm-admin/MatchRecordPanel";

const RoleIcon = ({ role, className = "w-3.5 h-3.5" }: { role: string; className?: string }) => {
  const r = role.toUpperCase();
  switch (r) {
    case 'TOP': return <Shield className={`${className} text-orange-400`} />;
    case 'JG': return <Trees className={`${className} text-green-500`} />;
    case 'MID': return <Zap className={`${className} text-red-400`} />;
    case 'ADC': return <Target className={`${className} text-blue-400`} />;
    case 'SUP': return <Heart className={`${className} text-teal-300`} />;
    default: return null;
  }
};

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
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposalIdx, setSelectedProposalIdx] = useState<number>(0);
  const [analysis, setAnalysis] = useState<any>(null);
  const [sendingDiscord, setSendingDiscord] = useState(false);
  
  const [sortConfig, setSortConfig] = useState({ key: "no", direction: "asc" });
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [showRecordPanel, setShowRecordPanel] = useState(false);

  const [flashingPlayerIds, setFlashingPlayerIds] = useState<number[]>([]);

  const triggerRowFlash = (id: number) => {
    if (!id) return;
    setFlashingPlayerIds(prev => [...prev, id]);
    setTimeout(() => {
      setFlashingPlayerIds(prev => prev.filter(x => x !== id));
    }, 1000);
  };

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [fetchingDiscord, setFetchingDiscord] = useState(false);

  useEffect(() => {
    fetchPlayers();

    // Supabase Realtime 購読によるプレイヤーロールのリアルタイム同期＆画面上での通知メッセージ
    const channel = supabase
      .channel('realtime-ktm-players')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ktm_players' },
        (payload: any) => {
          const updatedPlayer = payload.new;
          setPlayers(prev => prev.map(p => {
            if (p.id === updatedPlayer.id) {
              const oldPref = p.role_preferences || {};
              const newPref = updatedPlayer.role_preferences || {};
              if (oldPref.primary !== newPref.primary || oldPref.secondary !== newPref.secondary) {
                const primaryStr = `${oldPref.primary || 'ALL'} ➜ ${newPref.primary || 'ALL'}`;
                const secondaryStr = `${oldPref.secondary || '-'} ➜ ${newPref.secondary || '-'}`;
                setMessage({
                  type: "success",
                  text: `🔔 [通知] ${updatedPlayer.name} の希望レーンが更新されました！ (メイン: ${primaryStr} / サブ: ${secondaryStr})`
                });
              }
              return { ...p, ...updatedPlayer };
            }
            return p;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ktm_players")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      
      // No順にソートして保持。ローカル用フラグ is_fixed も初期化
      const playersWithNo = (data || []).sort((a: any, b: any) => {
        const timeA = a.metadata?.joined_at ? new Date(a.metadata.joined_at).getTime() : Infinity;
        const timeB = b.metadata?.joined_at ? new Date(b.metadata.joined_at).getTime() : Infinity;
        return timeA - timeB;
      }).map((p: any, index: number) => ({ ...p, no: index + 1, is_fixed: false, is_spectator_fixed: false }));

      setPlayers(playersWithNo);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDiscordReactions = async () => {
    if (!confirm("Discordの募集チャンネルから「カスタム募集」の参加者を取得し、チェックを自動入力しますか？")) return;
    
    setFetchingDiscord(true);
    setMessage({ type: "", text: "" });
    try {
      // APIキャッシュを確実にバイパスするためのクエリとオプション
      const res = await fetch(`/api/discord/participants?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Discordからの取得に失敗しました');
      if (!data.activeDiscordIds || data.activeDiscordIds.length === 0) {
        throw new Error("募集メッセージに参加者が見つかりませんでした。");
      }

      // 取得したDiscord IDの配列を使って、プレイヤー一覧の is_active と name を更新
      setPlayers(prevPlayers => {
        const nextPlayers = prevPlayers.map(p => {
          if (p.discord_id && data.activeDiscordIds.includes(p.discord_id)) {
            // APIから取得した最新のDiscord名があれば上書きする
            const discordInfo = data.participants?.find((dp: any) => dp.id === p.discord_id);
            const newName = (discordInfo && discordInfo.name && discordInfo.name !== "Unknown") ? discordInfo.name : p.name;
            return { ...p, is_active: true, name: newName };
          }
          return { ...p, is_active: false };
        });

        // 自動保存処理をトリガー
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          handleSave(nextPlayers);
        }, 1500);

        return nextPlayers;
      });

      setMessage({ type: "success", text: `✅ Discordからカスタム募集の参加者 ${data.activeDiscordIds.length} 人を自動チェックしました！` });
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ " + err.message });
    } finally {
      setFetchingDiscord(false);
    }
  };

  const handleInputChange = (uid: string, field: string, value: any) => {
    setPlayers(prevPlayers => {
      const nextPlayers = prevPlayers.map(p => {
        if ((p.id || p.discord_id) === uid) {
          triggerRowFlash(p.id);
          if (field === "primary_role") {
            const nextPrefs = { ...p.role_preferences, primary: value };
            if (value === "ALL") {
              nextPrefs.secondary = "-";
            }
            return { ...p, role_preferences: nextPrefs };
          } else if (field === "secondary_role") {
            return { ...p, role_preferences: { ...p.role_preferences, secondary: value } };
          } else if (field === "notes") {
            return { ...p, metadata: { ...p.metadata, notes: value } };
          } else {
            return { ...p, [field]: value };
          }
        }
        return p;
      });

      // is_fixed の変更はDBに保存しない一時フラグなので保存トリガーを引かない
      if (field !== "is_fixed") {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          handleSave(nextPlayers);
        }, 1500);
      }

      return nextPlayers;
    });
  };

  const handleSave = async (currentPlayers?: any[]) => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const targetPlayers = currentPlayers || players;
      const existingPlayers = targetPlayers.filter(p => p.id);

      // バランサーページでは「Activeかどうか」と「希望レーン」および名前等を更新
      for (const p of existingPlayers) {
        await supabase.from("ktm_players").update({
          name: p.name,
          role_preferences: p.role_preferences,
          is_active: p.is_active,
          ng_lane_1: p.ng_lane_1,
          ng_lane_2: p.ng_lane_2,
          weight: p.weight,
          allow_higher: p.allow_higher,
          pity: p.pity,
          off_pity: p.off_pity,
          metadata: p.metadata
        }).eq('id', p.id);
      }
      setSaving(false);
      setMessage({ type: "success", text: "✅ プレイヤー情報を更新しました。" });
    } catch (err: any) {
      setMessage({ type: "error", text: "保存エラー: " + err.message });
      setSaving(false);
    }
  };

  const handleBalance = async () => {
    const activePlayers = players.filter((p: any) => p.is_active);
    if (activePlayers.length < 10) {
      setMessage({ type: "error", text: `チーム分けには最低10人のActiveプレイヤーが必要です。(現在 ${activePlayers.length}人)` });
      return;
    }
    
    // 前回のチーム分け結果が表示されている場合、結果記録の確認を促す
    if (balanceResult) {
      const confirmNext = confirm("前回のチーム分けの試合結果は記録しましたか？\n（[キャンセル] を押すと、結果記録パネルへスクロールします）");
      if (!confirmNext) {
        setShowRecordPanel(true);
        // パネルがレンダリングされてからスクロールさせるため少し遅延
        setTimeout(() => {
          const el = document.getElementById("record-panel-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return;
      }
    }
    
    setBalancing(true);
    setMessage({ type: "", text: "" });
    setBalanceResult(null);
    setShowRecordPanel(false);

    try {
      const res = await fetch('/api/balancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: activePlayers.map(p => {
            const pref1 = p.role_preferences?.primary;
            return {
              name: p.name,
              isFixed: p.is_fixed || false,
              isSpectatorFixed: p.is_spectator_fixed || false,
              fixedRole: (p.is_fixed && pref1 && pref1 !== 'ALL' && pref1 !== '-') ? pref1 : null
            };
          })
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'チーム分けに失敗しました');
      
      if (data.proposals && Array.isArray(data.proposals) && data.proposals.length > 0) {
        setProposals(data.proposals);
        setBalanceResult(data.proposals[0]);
        setSelectedProposalIdx(0);
        setAnalysis(data.analysis || null);
      } else {
        setBalanceResult(data);
        setProposals([data]);
        setSelectedProposalIdx(0);
        setAnalysis(null);
      }
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
    // proposalsの該当する案も同期
    setProposals(prev => prev.map((p, idx) => idx === selectedProposalIdx ? newResult : p));
  };

  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, team: string, role: string, name: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ team, role, name }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    if (dragOverSlot !== slotKey) {
      setDragOverSlot(slotKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDropPlayer = (e: React.DragEvent, targetTeam: 'teamBlue' | 'teamRed' | 'spectators', targetRole: string) => {
    e.preventDefault();
    setDragOverSlot(null);
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const dragSource = JSON.parse(dataStr);
      if (dragSource.team === targetTeam && dragSource.role === targetRole) return;
      handleSwapPlayer(targetTeam, targetRole, dragSource.name);
    } catch (err) {
      console.error("Drop error:", err);
    }
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

  const requestSort = (key: string) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const sortedPlayers = [...players].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    const numericKeys = ["mmr", "no", "pity", "off_pity", "spectator_pity", "weight"];
    if (numericKeys.includes(sortConfig.key)) {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    }
    
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const SortableHeader = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th 
      className={`px-4 py-3 font-medium cursor-pointer hover:bg-gray-800 transition whitespace-nowrap ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1 justify-center">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-blue-400 text-xs">{sortConfig.direction === "desc" ? "↓" : "↑"}</span>
        )}
        {sortConfig.key !== sortKey && <span className="text-gray-600 text-xs">↕</span>}
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
              参加者にチェックを入れ、希望レーンを変更して「チーム分け実行」を押してください。<br/>
              ※<Crown className="inline w-4 h-4 text-amber-400"/>マークを入れると、AIがそのプレイヤーを最優先で第1希望レーンに配属します。
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 flex flex-col items-center justify-center min-w-[120px]">
              <span className="text-xs font-bold text-gray-500">参加人数</span>
              <span className={`text-2xl font-black ${activeCount >= 10 ? 'text-emerald-400' : 'text-amber-500'}`}>
                {activeCount} <span className="text-sm font-normal text-gray-500">人</span>
              </span>
            </div>
            <Link 
              href="/ktm-admin"
              prefetch={false}
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 hover:border-amber-500/50 text-amber-400 hover:text-white px-3 py-2 md:px-6 md:py-4 rounded-xl font-bold transition shadow-lg text-sm md:text-lg flex-1 md:flex-none justify-center"
            >
              <Shield className="h-5 w-5 text-amber-400" />
              管理者画面へ 🔑
            </Link>
            <Link 
              href="/history"
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-orange-400 px-3 py-2 md:px-6 md:py-4 rounded-xl font-bold transition shadow-lg text-sm md:text-lg border border-orange-900/50 flex-1 md:flex-none justify-center"
            >
              <History className="h-5 w-5" />
              過去の試合を閲覧
            </Link>
            <a 
              href="/balancer/record"
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 md:px-6 md:py-4 rounded-xl font-bold transition shadow-lg text-sm md:text-lg flex-1 md:flex-none justify-center"
            >
              <Trophy className="h-5 w-5 text-emerald-400" />
              カスタム成績を手動入力
            </a>
            <button
              onClick={handleBalance}
              disabled={balancing || activeCount < 10}
              className={`flex items-center justify-center gap-2 px-4 py-3 md:px-8 md:py-4 rounded-xl font-black transition text-sm md:text-lg w-full md:w-auto ${
                balancing || activeCount < 10 ? "bg-gray-800 text-gray-600 cursor-not-allowed" : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]"
              }`}
            >
              {balancing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Swords className="h-6 w-6" />}
              {balancing ? "AIが編成中..." : "チーム分け実行"}
            </button>
          </div>
        </div>

        {/* KTM運用ステップガイド */}
        <div className="bg-gray-900/20 border border-gray-800/80 rounded-2xl p-5 shadow-inner">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5 justify-center sm:justify-start">
            <Activity className="h-4 w-4 text-amber-500" /> KTM内戦 運用フロー
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-gray-950/40 border border-gray-900/50 p-3.5 rounded-xl flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black mb-2">1</span>
              <span className="font-bold text-gray-300 text-xs mb-1">参加者の取得</span>
              <p className="text-[10px] text-gray-500 leading-tight">募集から参加者を自動(または手動)でチェックします。</p>
            </div>
            <div className="bg-gray-950/40 border border-gray-900/50 p-3.5 rounded-xl flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black mb-2">2</span>
              <span className="font-bold text-gray-300 text-xs mb-1">チーム分け</span>
              <p className="text-[10px] text-gray-500 leading-tight">「チーム分け実行」を押しAI編成結果を出力します。</p>
            </div>
            <div className="bg-gray-950/40 border border-gray-900/50 p-3.5 rounded-xl flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black mb-2">3</span>
              <span className="font-bold text-gray-300 text-xs mb-1">Discordへ通知</span>
              <p className="text-[10px] text-gray-500 leading-tight">編成結果をワンクリックでDiscordへ共有・対戦開始！</p>
            </div>
            <div className="bg-gray-950/40 border border-gray-900/50 p-3.5 rounded-xl flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black mb-2">4</span>
              <span className="font-bold text-gray-300 text-xs mb-1">戦績の記録</span>
              <p className="text-[10px] text-gray-500 leading-tight">試合後、結果記録フォームからKDAを入力して保存。</p>
            </div>
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
            
            {/* 本日のカスタム環境分析 */}
            {analysis && (
              <div className={`mb-6 p-4 rounded-xl border text-sm flex flex-col gap-2 ${
                analysis.level === 'HIGH_DIFFERENCE' 
                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-200' 
                  : analysis.level === 'CLOSE'
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : 'bg-indigo-950/40 border-indigo-800/80 text-indigo-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-base">
                  {analysis.level === 'HIGH_DIFFERENCE' ? (
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                  ) : analysis.level === 'CLOSE' ? (
                    <Globe className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <Info className="h-5 w-5 text-indigo-400 shrink-0" />
                  )}
                  <span>本日のカスタム環境分析:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-black ${
                    analysis.level === 'HIGH_DIFFERENCE'
                      ? 'bg-amber-800 text-amber-100'
                      : analysis.level === 'CLOSE'
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-indigo-800 text-indigo-100'
                  }`}>
                    {analysis.level === 'HIGH_DIFFERENCE' ? '格差大（レート差多）' : analysis.level === 'CLOSE' ? '実力拮抗' : '標準的'}
                  </span>
                </div>
                <p className="text-gray-300 font-medium leading-relaxed">
                  {analysis.message}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400 mt-1 pt-2 border-t border-gray-800/60">
                  <div>平均レート: <strong className="text-white font-mono">{analysis.averageMMR}</strong></div>
                  <div>最低レート: <strong className="text-white font-mono">{analysis.minMMR}</strong></div>
                  <div>最高レート: <strong className="text-white font-mono">{analysis.maxMMR}</strong></div>
                  <div>レート差: <strong className={`font-mono ${analysis.level === 'HIGH_DIFFERENCE' ? 'text-amber-400 font-bold' : 'text-white'}`}>{analysis.mmrRange}</strong></div>
                </div>
              </div>
            )}
            
            {/* 案選択タブUI */}
            {proposals && proposals.length > 1 && (
              <div className="flex border-b border-gray-800 mb-6 gap-2 overflow-x-auto pb-1">
                {proposals.map((prop, idx) => (
                  <button
                    key={prop.id || idx}
                    onClick={() => {
                      setBalanceResult(prop);
                      setSelectedProposalIdx(idx);
                    }}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap ${
                      selectedProposalIdx === idx 
                        ? 'border-amber-500 text-amber-400 font-black' 
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {prop.title || `案${prop.id || idx}`}
                  </button>
                ))}
              </div>
            )}

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
                  className="flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-2 md:px-6 md:py-2 rounded-lg font-bold transition shadow-lg shadow-[#5865F2]/20 text-xs md:text-base w-full md:w-auto"
                >
                  {sendingDiscord ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  Discordへ通知
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {/* Teams Headers */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center border-b border-gray-800 pb-4">
                <div className="col-span-5 bg-gradient-to-r from-blue-950/40 to-transparent p-3 rounded-xl border-l-4 border-blue-500 flex justify-between items-center">
                  <span className="text-lg font-black text-blue-400 tracking-wider">BLUE TEAM</span>
                  <span className="text-sm font-mono font-bold text-blue-300">合計MMR: {balanceResult.teamBlueMMR}</span>
                </div>
                <div className="col-span-1 flex justify-center text-gray-600 font-black italic text-base">VS</div>
                <div className="col-span-5 bg-gradient-to-l from-red-950/40 to-transparent p-3 rounded-xl border-r-4 border-red-500 flex justify-between items-center text-right">
                  <span className="text-sm font-mono font-bold text-red-300">合計MMR: {balanceResult.teamRedMMR}</span>
                  <span className="text-lg font-black text-red-400 tracking-wider">RED TEAM</span>
                </div>
              </div>

              {/* Lane by Lane Matchups */}
              <div className="space-y-3">
                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map((role) => {
                  const pBlue = balanceResult.teamBlue.find((x: any) => x.currentRole === role);
                  const pRed = balanceResult.teamRed.find((x: any) => x.currentRole === role);
                  
                  const isBlueOff = pBlue && pBlue.mainLane !== 'ALL' && pBlue.mainLane !== '-' && pBlue.currentRole !== pBlue.mainLane;
                  const isRedOff = pRed && pRed.mainLane !== 'ALL' && pRed.mainLane !== '-' && pRed.currentRole !== pRed.mainLane;
                  
                  const blueKey = `teamBlue-${role}`;
                  const redKey = `teamRed-${role}`;
                  
                  const isBlueDrag = dragOverSlot === blueKey;
                  const isRedDrag = dragOverSlot === redKey;
                  
                  const blueMmr = pBlue?.mmr || 1000;
                  const redMmr = pRed?.mmr || 1000;
                  const mmrDiff = blueMmr - redMmr;

                  return (
                    <div key={role} className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center bg-gray-900/40 p-2 md:p-3 rounded-2xl border border-gray-800/80 hover:border-gray-700/80 hover:bg-gray-900/60 transition duration-300">
                      
                      {/* BLUE SLOT */}
                      <div 
                        draggable={!!pBlue?.name}
                        onDragStart={(e) => handleDragStart(e, 'teamBlue', role, pBlue?.name || '')}
                        onDragOver={(e) => handleDragOver(e, blueKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropPlayer(e, 'teamBlue', role)}
                        className={`col-span-5 flex items-center gap-3 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${
                          isBlueDrag 
                            ? 'border-blue-500 bg-blue-950/30 border-dashed shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                            : 'bg-blue-950/10 border-blue-900/20 hover:bg-blue-950/20'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {renderSwapSelect('teamBlue', role, pBlue?.name || '')}
                        </div>
                        {isBlueOff && (
                          <span className="text-[9px] bg-red-950/80 border border-red-800 text-red-400 px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0" title="希望外レーン (オフロール)">
                            ⚠️ OFF
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold text-blue-400 shrink-0 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/30">{blueMmr}</span>
                      </div>

                      {/* ROLE & MMR DIFF */}
                      <div className="col-span-1 flex flex-col items-center justify-center py-2 md:py-0">
                        <div className="w-8 h-8 rounded-full bg-gray-950 border border-gray-800 flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                          <RoleIcon role={role} className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] font-mono mt-1 font-extrabold ${
                          mmrDiff > 0 ? 'text-blue-400' : mmrDiff < 0 ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          {mmrDiff > 0 ? `+${mmrDiff}` : mmrDiff < 0 ? mmrDiff : '±0'}
                        </span>
                      </div>

                      {/* RED SLOT */}
                      <div 
                        draggable={!!pRed?.name}
                        onDragStart={(e) => handleDragStart(e, 'teamRed', role, pRed?.name || '')}
                        onDragOver={(e) => handleDragOver(e, redKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropPlayer(e, 'teamRed', role)}
                        className={`col-span-5 flex items-center gap-3 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${
                          isRedDrag 
                            ? 'border-red-500 bg-red-950/30 border-dashed shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                            : 'bg-red-950/10 border-red-900/20 hover:bg-red-950/20'
                        }`}
                      >
                        <span className="font-mono text-xs font-bold text-red-400 shrink-0 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/30">{redMmr}</span>
                        {isRedOff && (
                          <span className="text-[9px] bg-red-950/80 border border-red-800 text-red-400 px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0" title="希望外レーン (オフロール)">
                            ⚠️ OFF
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          {renderSwapSelect('teamRed', role, pRed?.name || '')}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI 分析レポート */}
            {balanceResult.balanceReport && (
              <div className="mt-6 p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-lg">
                <h3 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" /> AI バランス分析レポート
                </h3>
                <div className="text-sm text-indigo-100/90 leading-relaxed font-mono space-y-3">
                  {Array.isArray(balanceResult.balanceReport) 
                    ? balanceResult.balanceReport.map((line: string, i: number) => (
                        <div key={i}>{line}</div>
                      ))
                    : balanceResult.balanceReport
                  }
                </div>
              </div>
            )}

            {/* SPECTATORS */}
            {balanceResult.spectators && balanceResult.spectators.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-800">
                <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4" /> 観戦 / 待機メンバー
                </h3>
                <div className="flex flex-wrap gap-2">
                  {balanceResult.spectators.map((name: string, index: number) => {
                    const slotKey = `spectators-${index}`;
                    const isDragOver = dragOverSlot === slotKey;
                    
                    return (
                      <div 
                        key={`spec-${index}`} 
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, 'spectators', index.toString(), name)}
                        onDragOver={(e) => handleDragOver(e, slotKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropPlayer(e, 'spectators', index.toString())}
                        className={`border rounded px-3 py-1.5 min-w-[120px] transition cursor-grab active:cursor-grabbing ${
                          isDragOver 
                            ? 'border-indigo-400 bg-indigo-950/40 border-dashed shadow-[0_0_15px_rgba(129,140,248,0.2)]' 
                            : 'bg-gray-950 border-gray-800 hover:bg-gray-800'
                        }`}
                      >
                        {renderSwapSelect('spectators', index.toString(), name)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 試合結果記録セクション */}
            <div className="mt-8 pt-8 border-t border-gray-800">
              {!showRecordPanel ? (
                <div className="text-center">
                  <button
                    onClick={() => setShowRecordPanel(true)}
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl font-black transition flex items-center gap-2 mx-auto shadow-lg shadow-emerald-950/20 animate-pulse"
                  >
                    <Trophy className="h-5 w-5" /> この編成で試合結果を記録する 🏆
                  </button>
                </div>
              ) : (
                <div id="record-panel-section">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-800">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-emerald-400 animate-bounce" />
                      対戦戦績の直接入力
                    </h3>
                    <button
                      onClick={() => setShowRecordPanel(false)}
                      type="button"
                      className="text-xs bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-700 transition"
                    >
                      記録パネルを閉じる ×
                    </button>
                  </div>
                  <MatchRecordPanel
                    balanceResult={balanceResult}
                    onComplete={() => {
                      setShowRecordPanel(false);
                      // MMR再計算の完了等により、最新のプレイヤー一覧を再取得
                      fetchPlayers();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 用語解説エリア */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl text-sm">
          <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5" /> KTM専用マッチング用語
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-amber-500 mb-1 block">こだわり (1〜3)</span>
              <p className="text-gray-400">メインレーンをどれくらいやりたいかの度合いです。1(絶対やりたい) 〜 3(どこでもいい) で設定し、AIが希望レーンを割り当てる優先度になります。</p>
            </div>
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-rose-500 mb-1 block">格上許可 (ON/OFF)</span>
              <p className="text-gray-400">自分よりMMRが高い相手と対面することを許容するかどうかの設定です。ONにすると、格上とマッチしやすくなります。</p>
            </div>
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-emerald-500 mb-1 block">PITY (ピティ)</span>
              <p className="text-gray-400">過去の試合で「希望外レーン」に飛ばされた人に貯まる同情ポイント。これが高い人ほど、次回の試合で優先的にメインレーンに配属されます。</p>
            </div>
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-fuchsia-500 mb-1 block">OFF PITY (オフピティ)</span>
              <p className="text-gray-400">逆に「希望レーン」を連続でやっている人に貯まるポイント。全体のバランスを調整するため、一時的に他レーンに飛ばされる確率が上がります。</p>
            </div>
          </div>
        </div>

        {/* プレイヤー一覧 (Active変更・レーン変更用) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              参加者リスト
            </h2>
            <button
              onClick={handleFetchDiscordReactions}
              disabled={fetchingDiscord}
              className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-lg font-bold transition border text-xs md:text-sm ${
                fetchingDiscord ? 'bg-[#404eed]/50 border-[#404eed]/50 text-gray-400 cursor-not-allowed' : 'bg-[#5865F2]/20 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${fetchingDiscord ? 'animate-spin' : ''}`} /> 
              {fetchingDiscord ? "取得中..." : "Discordから参加者を取得"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 bg-gray-950 border-b border-gray-800">
                <tr>
                  <SortableHeader label="参加" sortKey="is_active" className="w-16 text-center" />
                  <SortableHeader label="👑固定" sortKey="is_fixed" className="w-16 text-center" />
                  <SortableHeader label="📺見学" sortKey="is_spectator_fixed" className="w-16 text-center" />
                  <SortableHeader label="No." sortKey="no" className="w-16 text-center" />
                  <SortableHeader label="プレイヤー名" sortKey="name" />
                  <SortableHeader label="ランク" sortKey="highest_rank" />
                  <SortableHeader label="総合MMR" sortKey="mmr" />
                  <th className="px-4 py-3 font-medium">第1希望</th>
                  <th className="px-4 py-3 font-medium">第2希望</th>
                  <th className="px-2 py-3 font-medium text-red-400">NG 1</th>
                  <th className="px-2 py-3 font-medium text-red-400">NG 2</th>
                  <SortableHeader label="こだわり" sortKey="weight" />
                  <SortableHeader label="格上" sortKey="allow_higher" />
                  <SortableHeader label="Pity" sortKey="pity" />
                  <SortableHeader label="OffPity" sortKey="off_pity" />
                  <SortableHeader label="観戦Pity" sortKey="spectator_pity" />
                  <th className="px-4 py-3 font-medium">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {sortedPlayers.map((p) => {
                  const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-gray-800/60 transition-all duration-1000 ${
                        flashingPlayerIds.includes(p.id) 
                          ? 'bg-emerald-950/40 text-emerald-400 font-bold border-y border-emerald-500/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.15)]' 
                          : p.is_active 
                            ? 'bg-blue-950/15 border-l-2 border-blue-500 text-gray-200' 
                            : 'opacity-40 hover:opacity-100'
                      }`}
                    >
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={p.is_active}
                          onChange={(e) => handleInputChange(p.id, "is_active", e.target.checked)}
                          className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500/50 cursor-pointer transition-transform hover:scale-110"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleInputChange(p.id, "is_fixed", !p.is_fixed)}
                          className={`p-1 rounded-lg border transition-all ${
                            p.is_fixed 
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]' 
                              : 'border-transparent text-gray-600 hover:text-amber-500 hover:bg-amber-500/10'
                          }`}
                          title="第1希望レーンで固定する"
                        >
                          <Crown className={`w-4 h-4 ${p.is_fixed ? 'scale-110' : 'opacity-60'}`} />
                        </button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleInputChange(p.id, "is_spectator_fixed", !p.is_spectator_fixed)}
                          className={`p-1 rounded-lg border transition-all ${
                            p.is_spectator_fixed 
                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]' 
                              : 'border-transparent text-gray-600 hover:text-indigo-400 hover:bg-indigo-500/10'
                          }`}
                          title="この回は見学固定にする"
                        >
                          <X className={`w-4 h-4 ${p.is_spectator_fixed ? 'scale-110 font-black' : 'opacity-60'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-2 text-center font-bold text-gray-600 text-xs">
                        {p.no}
                      </td>
                      <td className="px-4 py-2 font-bold text-white whitespace-nowrap flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedPlayer(p)}
                          className="text-blue-400 hover:text-white p-1 hover:bg-gray-800 rounded transition flex-shrink-0"
                          title="プロフィールを表示"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        {p.name}
                      </td>
                      <td className={`px-4 py-2 text-xs ${getColorFromRankName(p.highest_rank)}`}>
                        {p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNRANKED'}
                      </td>
                      <td className="px-4 py-2 text-center font-mono text-blue-400 font-bold">
                        {p.mmr}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5 bg-gray-950 border border-gray-800 rounded px-2 py-1 w-28">
                          <RoleIcon role={prefs.primary || 'ALL'} className="w-3.5 h-3.5 flex-shrink-0" />
                          <select
                            value={prefs.primary || 'ALL'}
                            onChange={(e) => handleInputChange(p.id, "primary_role", e.target.value)}
                            className="bg-transparent text-white outline-none cursor-pointer w-full text-xs font-bold"
                          >
                            <option value="ALL" className="bg-gray-950 text-gray-200">ALL</option>
                            <option value="TOP" className="bg-gray-950 text-gray-200">TOP</option>
                            <option value="JG" className="bg-gray-950 text-gray-200">JG</option>
                            <option value="MID" className="bg-gray-950 text-gray-200">MID</option>
                            <option value="ADC" className="bg-gray-950 text-gray-200">ADC</option>
                            <option value="SUP" className="bg-gray-950 text-gray-200">SUP</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5 bg-gray-950 border border-gray-800 rounded px-2 py-1 w-28 disabled:opacity-50">
                          <RoleIcon role={prefs.secondary || '-'} className="w-3.5 h-3.5 flex-shrink-0" />
                          <select
                            value={prefs.secondary || '-'}
                            disabled={prefs.primary === 'ALL'}
                            onChange={(e) => handleInputChange(p.id, "secondary_role", e.target.value)}
                            className="bg-transparent text-gray-300 outline-none cursor-pointer w-full text-xs disabled:cursor-not-allowed"
                          >
                            <option value="-" className="bg-gray-950 text-gray-200">-</option>
                            <option value="ALL" className="bg-gray-950 text-gray-200">ALL</option>
                            <option value="TOP" className="bg-gray-950 text-gray-200">TOP</option>
                            <option value="JG" className="bg-gray-950 text-gray-200">JG</option>
                            <option value="MID" className="bg-gray-950 text-gray-200">MID</option>
                            <option value="ADC" className="bg-gray-950 text-gray-200">ADC</option>
                            <option value="SUP" className="bg-gray-950 text-gray-200">SUP</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded px-1.5 py-1 w-20 mx-auto">
                          <RoleIcon role={p.ng_lane_1 || ''} className="w-3 h-3 flex-shrink-0" />
                          <select
                            value={p.ng_lane_1 || ""}
                            onChange={(e) => handleInputChange(p.id, "ng_lane_1", e.target.value)}
                            className="bg-transparent text-red-400 font-bold outline-none cursor-pointer w-full text-xs"
                          >
                            <option value="" className="bg-gray-950 text-gray-400">なし</option>
                            <option value="TOP" className="bg-gray-950 text-red-400">TOP</option>
                            <option value="JG" className="bg-gray-950 text-red-400">JG</option>
                            <option value="MID" className="bg-gray-950 text-red-400">MID</option>
                            <option value="ADC" className="bg-gray-950 text-red-400">ADC</option>
                            <option value="SUP" className="bg-gray-950 text-red-400">SUP</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded px-1.5 py-1 w-20 mx-auto">
                          <RoleIcon role={p.ng_lane_2 || ''} className="w-3 h-3 flex-shrink-0" />
                          <select
                            value={p.ng_lane_2 || ""}
                            onChange={(e) => handleInputChange(p.id, "ng_lane_2", e.target.value)}
                            className="bg-transparent text-red-400 font-bold outline-none cursor-pointer w-full text-xs"
                          >
                            <option value="" className="bg-gray-950 text-gray-400">なし</option>
                            <option value="TOP" className="bg-gray-950 text-red-400">TOP</option>
                            <option value="JG" className="bg-gray-950 text-red-400">JG</option>
                            <option value="MID" className="bg-gray-950 text-red-400">MID</option>
                            <option value="ADC" className="bg-gray-950 text-red-400">ADC</option>
                            <option value="SUP" className="bg-gray-950 text-red-400">SUP</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select
                          value={p.weight || 2}
                          onChange={(e) => handleInputChange(p.id, "weight", parseInt(e.target.value))}
                          className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-amber-300 font-bold outline-none focus:border-amber-500 w-14 cursor-pointer text-xs"
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!p.allow_higher}
                          onChange={(e) => handleInputChange(p.id, "allow_higher", e.target.checked)}
                          className="w-5 h-5 rounded border-gray-700 bg-gray-950 text-rose-500 focus:ring-rose-500/50 cursor-pointer transition-transform hover:scale-110"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-mono font-bold">
                          {p.pity || 0}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-fuchsia-950/40 border border-fuchsia-800/60 text-fuchsia-400 text-xs font-mono font-bold">
                          {p.off_pity || 0}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-sky-950/40 border border-sky-800/60 text-sky-400 text-xs font-mono font-bold">
                          {p.spectator_pity || 0}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={p.metadata?.notes || ""}
                          onChange={(e) => handleInputChange(p.id, "notes", e.target.value)}
                          placeholder="備考"
                          className="bg-transparent border border-transparent hover:border-gray-800 focus:border-gray-700 hover:bg-gray-900/60 focus:bg-gray-900 focus:ring-1 focus:ring-blue-500/30 rounded px-2 py-1 outline-none text-xs text-gray-300 w-28 transition-all"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}
