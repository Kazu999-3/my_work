"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import MatchHistoryPanel from "./MatchHistoryPanel";
import ProfileModal from "./ProfileModal";
import { Info, Users, RefreshCw, Save, Trophy, Filter, Plus, AlertCircle, X, History, Globe } from "lucide-react";
import { getKtmRank, RANKS, calculateInitialMmr } from "../../lib/mmr";

function getRankFromMMR(mmr: number): { tier: string, color: string } {
  const badge = getKtmRank(mmr);
  const tierName = badge.name.split(' ')[0];
  return { tier: tierName, color: `${badge.color} ${badge.bg}` };
}

const RANKS_MMR = RANKS;

function calculateAutoMmr(highestRank: string | null, targetRole: string, prefs: { primary: string, secondary: string }) {
  return calculateInitialMmr(highestRank, targetRole, prefs);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showMmrInfo, setShowMmrInfo] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'players' | 'history' | 'affiliate'>('players');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [syncingDiscord, setSyncingDiscord] = useState(false);
  const [syncData, setSyncData] = useState<any>(null);

  const [syncingRiot, setSyncingRiot] = useState(false);
  const [syncingAutoAll, setSyncingAutoAll] = useState(false);
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  // アフィリエイト管理用ステート
  const [affiliateLinks, setAffiliateLinks] = useState<Record<string, string>>({});
  const [affiliateArticles, setAffiliateArticles] = useState<any[]>([]);
  const [loadingAffiliate, setLoadingAffiliate] = useState(false);
  const [syncingAffiliate, setSyncingAffiliate] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [isDryRun, setIsDryRun] = useState(true);


  const fetchAffiliateData = async () => {
    setLoadingAffiliate(true);
    try {
      const res = await fetch('/api/admin/affiliate');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'データの読み込みに失敗しました');
      setAffiliateLinks(data.links || {});
      setAffiliateArticles(data.articles || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ アフィリエイトデータ読み込みエラー: ' + err.message });
    } finally {
      setLoadingAffiliate(false);
    }
  };

  const handleLinkChange = (key: string, value: string) => {
    setAffiliateLinks(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveLinks = async () => {
    setSyncingAffiliate(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_links',
          links: affiliateLinks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'リンクの保存に失敗しました');
      setMessage({ type: 'success', text: '✅ ' + data.message });
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ リンク保存エラー: ' + err.message });
    } finally {
      setSyncingAffiliate(false);
    }
  };

  const handleAddLink = () => {
    const key = prompt("追加するツールの名前を入力してください（例: Notion）:");
    if (!key) return;
    if (affiliateLinks[key] !== undefined) {
      alert("そのツール名は既に登録されています。");
      return;
    }
    setAffiliateLinks(prev => ({
      ...prev,
      [key]: ""
    }));
  };

  const handleDeleteLink = (key: string) => {
    if (!confirm(`本当に「${key}」のアフィリエイトリンクを削除しますか？`)) return;
    setAffiliateLinks(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleTriggerForge = async () => {
    if (!confirm("最新トレンドツールの自動収集 ＆ 広告リンク埋め込み記事の生成を実行します。数分かかる場合がありますがよろしいですか？")) return;
    
    setSyncingAffiliate(true);
    setMessage({ type: 'info', text: '🤖 アフィリエイト記事を自律生成中 (Scout & Forge実行中)...' });
    try {
      const res = await fetch('/api/admin/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_forge'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '記事生成に失敗しました');
      setMessage({ type: 'success', text: '✅ ' + data.message });
      setAffiliateArticles(data.articles || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ 記事生成エラー: ' + err.message });
    } finally {
      setSyncingAffiliate(false);
    }
  };

  const handleTriggerBatch = async () => {
    const modeText = isDryRun ? "【テストモード (Dry Run)】" : "【本番モード (実際の投稿を実行)】";
    if (!confirm(`${modeText} で一気通貫アフィリエイトバッチを実行します。\nよろしいですか？`)) return;
    
    setSyncingAffiliate(true);
    setMessage({ 
      type: 'info', 
      text: isDryRun 
        ? '🚀 一気通貫アフィリエイトバッチをテスト実行中 (実際の投稿はスキップされます)...' 
        : '🚀 一気通貫アフィリエイトバッチを本番実行中 (Scout ➔ Forge ➔ note下書き ➔ Xプロモ)...' 
    });
    try {
      const res = await fetch('/api/admin/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_batch',
          dryRun: isDryRun
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'バッチ実行に失敗しました');
      setMessage({ type: 'success', text: '✅ ' + data.message });
      setAffiliateArticles(data.articles || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ バッチ実行エラー: ' + err.message });
    } finally {
      setSyncingAffiliate(false);
    }
  };


  // タブ切り替え時のデータ取得
  useEffect(() => {
    if (activeTab === 'affiliate') {
      fetchAffiliateData();
    }
  }, [activeTab]);

  const checkIntegrity = async () => {
    setCheckingIntegrity(true);
    try {
      const res = await fetch('/api/mmr/check-integrity');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntegrityData(data);
    } catch (err: any) {
      console.error("Integrity check failed:", err);
    } finally {
      setCheckingIntegrity(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    checkIntegrity();

    // ktm_playersテーブルのリアルタイム購読をセットアップ
    const channel = supabase
      .channel('ktm_players_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ktm_players' },
        (payload: any) => {
          console.log('Realtime change detected in ktm_players:', payload);
          // 他ユーザーによる追加・編集・削除が発生した際に自動で再読み込み
          fetchPlayers();
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
      setPlayers(data || []);
      // 名簿リフレッシュ時に整合性も再確認
      checkIntegrity();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 単にローカルの players ステートを更新する関数
  const handleInputChange = (uid: string, field: string, value: any) => {
    setPlayers(prevPlayers => {
      return prevPlayers.map(p => {
        if ((p.id || p.discord_id) === uid) {
          if (field === "primary_role") {
            return { ...p, role_preferences: { ...p.role_preferences, primary: value } };
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
    });
  };

  // 即時セーブをトリガーする関数 (Select, Checkbox, MmrBadgeInput 用)
  const handleInputSave = async (uid: string, field: string, value: any) => {
    setPlayers(prevPlayers => {
      const nextPlayers = prevPlayers.map(p => {
        if ((p.id || p.discord_id) === uid) {
          if (field === "primary_role") {
            return { ...p, role_preferences: { ...p.role_preferences, primary: value } };
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
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      handleSave(nextPlayers);
      
      return nextPlayers;
    });
  };

  // フォーカスアウト時 (onBlur) に即時保存を実行する関数 (Text Input用)
  const handleBlurSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    handleSave();
  };

  const handleAutoSyncAll = async () => {
    if (!confirm("【一括オート同期】\nDiscordメンバー同期 ➔ Riot API同期 ➔ MMRの再計算 (Rebuild) を、モーダル確認なしでノンストップで一括実行します。よろしいですか？")) return;
    
    setSyncingAutoAll(true);
    setMessage({ type: "", text: "" });
    setLoading(true);
    
    try {
      // 1. Discord メンバー情報取得
      setMessage({ type: "info", text: "1/3: Discordサーバーからメンバー情報を取得中..." });
      const discRes = await fetch('/api/discord/members');
      const discData = await discRes.json();
      if (!discRes.ok) throw new Error(discData.error || 'Discordメンバー取得に失敗しました');

      // 新規追加メンバーにデフォルトのRankと希望ロールを設定し、初期MMRを計算
      const processedAdd = discData.toAdd.map((p: any) => {
        const highest_rank = "UNRANKED";
        const prefs = { primary: "ALL", secondary: "-" };
        
        const mmr_top = calculateAutoMmr(highest_rank, 'TOP', prefs);
        const mmr_jg = calculateAutoMmr(highest_rank, 'JG', prefs);
        const mmr_mid = calculateAutoMmr(highest_rank, 'MID', prefs);
        const mmr_adc = calculateAutoMmr(highest_rank, 'ADC', prefs);
        const mmr_sup = calculateAutoMmr(highest_rank, 'SUP', prefs);
        const mmr = Math.round((mmr_top + mmr_jg + mmr_mid + mmr_adc + mmr_sup) / 5);
        
        return {
          ...p,
          highest_rank,
          role_preferences: prefs,
          mmr_top,
          mmr_jg,
          mmr_mid,
          mmr_adc,
          mmr_sup,
          mmr,
          is_active: false
        };
      });

      // 2. Discord同期 POST 実行
      setMessage({ type: "info", text: "1/3: データベースへのDiscord情報同期を実行中..." });
      const discPostRes = await fetch('/api/discord/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          add: processedAdd,
          deactivate: discData.toDeactivate,
          update_metadata: discData.activeSync
        })
      });
      const discPostData = await discPostRes.json();
      if (!discPostRes.ok) throw new Error(discPostData.error || 'Discord同期処理に失敗しました');

      // 3. Riot情報の同期実行 (タイムアウト回避のため5人ずつ分割実行)
      setMessage({ type: "info", text: "2/3: Riot APIから全員の最新情報を同期中..." });
      const playerIdsToSync = players.map(p => p.id).filter(Boolean);
      const riotData = await runRiotSyncInChunks(playerIdsToSync, (msg) => {
        setMessage({ type: "info", text: `2/3: ${msg}` });
      });

      // 4. MMR 再計算の実行
      setMessage({ type: "info", text: "3/3: 過去の全試合からMMRを再計算(Rebuild)中..." });
      const rebuildRes = await fetch("/api/mmr/rebuild", { method: "POST" });
      const rebuildData = await rebuildRes.json();
      if (!rebuildRes.ok) throw new Error(rebuildData.error || 'MMR再計算に失敗しました');

      // 全行程完了後のリフレッシュ
      let successMsg = "✅ 一括オート同期がすべて正常に完了しました！";
      if (riotData.errors && riotData.errors.length > 0) {
        successMsg += `\n(※Riot API同期で一部エラーあり: ${riotData.errors.length}件)`;
      }
      setMessage({ type: "success", text: successMsg });
      
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ 一括オート同期エラー: " + err.message });
    } finally {
      setSyncingAutoAll(false);
      setLoading(false);
      fetchPlayers();
      checkIntegrity();
    }
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
        const { data: oldPlayer } = await supabase
          .from('ktm_players')
          .select('name')
          .eq('id', p.id)
          .single();

        const oldName = oldPlayer?.name;
        const newName = p.name;

        const { data, error } = await supabase.from("ktm_players").update({
          discord_id: p.discord_id,
          name: newName,
          ign: p.ign,
          mmr: parseInt(p.mmr) || 1000,
          role_preferences: p.role_preferences,
          is_active: p.is_active,
          ng_lane_1: p.ng_lane_1 || null,
          ng_lane_2: p.ng_lane_2 || null,
          highest_rank: p.highest_rank || null,
          mmr_top: parseInt(p.mmr_top) || 1000,
          mmr_jg: parseInt(p.mmr_jg) || 1000,
          mmr_mid: parseInt(p.mmr_mid) || 1000,
          mmr_adc: parseInt(p.mmr_adc) || 1000,
          mmr_sup: parseInt(p.mmr_sup) || 1000,
          metadata: p.metadata
        }).eq('id', p.id).select();
        
        if (error) throw error;
        if (data && data.length > 0) {
          updatedCount++;
          if (oldName && oldName !== newName) {
            console.log(`[Manual Name Change] Updating matches for ${oldName} -> ${newName}`);
            await supabase
              .from('ktm_match_participants')
              .update({ player_name: newName })
              .eq('player_name', oldName);
          }
        }
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
            highest_rank: p.highest_rank || null,
            mmr_top: parseInt(p.mmr_top) || 1000,
            mmr_jg: parseInt(p.mmr_jg) || 1000,
            mmr_mid: parseInt(p.mmr_mid) || 1000,
            mmr_adc: parseInt(p.mmr_adc) || 1000,
            mmr_sup: parseInt(p.mmr_sup) || 1000,
            metadata: p.metadata || { notes: "" }
          }))
        );
        if (error) throw error;
      }

      // 自動保存時は全体リロード(fetchPlayers)をせずチラつきを防ぐ
      checkIntegrity(); 
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ 保存エラー: " + err.message });
    } finally {
      setSaving(false);
    }
  };

// addNewPlayer and handleAutoFillMmr are removed. New players are added via Discord sync modal with auto-calculation.

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
      checkIntegrity(); // 再計算完了後に整合性を再確認
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

  const runRiotSyncInChunks = async (playerIds: number[], onProgress: (msg: string) => void) => {
    const chunkSize = 5;
    const allErrors: string[] = [];
    let totalUpdated = 0;

    for (let i = 0; i < playerIds.length; i += chunkSize) {
      const chunk = playerIds.slice(i, i + chunkSize);
      onProgress(`Riot APIから最新情報を同期中 (${i + chunk.length}/${playerIds.length}人)...`);

      const res = await fetch('/api/admin/riot-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: chunk })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Riot同期処理に失敗しました');

      if (data.errors && data.errors.length > 0) {
        allErrors.push(...data.errors);
      }
      totalUpdated += chunk.length;
    }

    return {
      message: `${totalUpdated} 人のプレイヤーのRiot情報を同期しました。`,
      errors: allErrors
    };
  };

  const handleRiotSync = async () => {
    if (!confirm('Riot APIから全員の最新のランク情報を取得・同期しますか？\n（※数十秒かかる場合があります）')) return;
    
    setSyncingRiot(true);
    setMessage({ type: "", text: "" });
    try {
      const playerIdsToSync = players.map(p => p.id).filter(Boolean);
      const data = await runRiotSyncInChunks(playerIdsToSync, (msg) => {
        setMessage({ type: "info", text: msg });
      });
      
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
    setMessage({ type: "", text: "" });
    try {
      // 1. 新規追加メンバーのMMRをフロント側で自動計算してマージする
      const processedAdd = syncData.toAdd.map((p: any) => {
        const highest_rank = p.highest_rank || "UNRANKED";
        const prefs = p.role_preferences || { primary: "ALL", secondary: "-" };
        
        const mmr_top = calculateAutoMmr(highest_rank, 'TOP', prefs);
        const mmr_jg = calculateAutoMmr(highest_rank, 'JG', prefs);
        const mmr_mid = calculateAutoMmr(highest_rank, 'MID', prefs);
        const mmr_adc = calculateAutoMmr(highest_rank, 'ADC', prefs);
        const mmr_sup = calculateAutoMmr(highest_rank, 'SUP', prefs);
        const mmr = Math.round((mmr_top + mmr_jg + mmr_mid + mmr_adc + mmr_sup) / 5);
        
        return {
          ...p,
          highest_rank,
          role_preferences: prefs,
          mmr_top,
          mmr_jg,
          mmr_mid,
          mmr_adc,
          mmr_sup,
          mmr,
          is_active: false
        };
      });

      // 2. Discord同期 POST の実行
      const res = await fetch('/api/discord/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          add: processedAdd,
          deactivate: syncData.toDeactivate,
          update_metadata: syncData.activeSync
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同期処理に失敗しました');

      // 3. 複合機能：Riot同期も自動で連続実行
      setMessage({ type: "success", text: "✅ Discord同期が完了しました。続けてRiot情報の同期を開始します..." });
      
      const playerIdsToSync = players.map(p => p.id).filter(Boolean);
      const riotData = await runRiotSyncInChunks(playerIdsToSync, (msg) => {
        setMessage({ type: "info", text: msg });
      });

      if (riotData.errors && riotData.errors.length > 0) {
        const errorDetails = riotData.errors.slice(0, 10).join('\n') + (riotData.errors.length > 10 ? `\n...他 ${riotData.errors.length - 10} 件` : '');
        setMessage({ 
          type: "success", 
          text: `✅ Discord & Riot情報の同期が完了しました（※Riot APIで一部エラーあり: ${riotData.errors.length}件）。\n新規プレイヤーの初期MMR計算値を反映させるため、名簿上部の「🔄 Rebuild」を実行してください。\n\n【エラー詳細（サモナー名不一致など）】\n${errorDetails}` 
        });
      } else {
        setMessage({ 
          type: "success", 
          text: `✅ Discord & Riot情報の同期がすべて正常に完了しました！\n新規プレイヤーの初期MMR計算値を反映させるため、名簿上部の「🔄 Rebuild」を実行してください。` 
        });
      }
      
      setSyncData(null);
      fetchPlayers();
      checkIntegrity();
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
    .filter(p => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const nameMatch = p.name?.toLowerCase().includes(query);
      const ignMatch = p.ign?.toLowerCase().includes(query);
      const discordMatch = p.discord_id?.toLowerCase().includes(query);
      return nameMatch || ignMatch || discordMatch;
    })
    .sort((a, b) => {
      let aVal = sortConfig.key === "notes" ? (a.metadata?.notes || "") : a[sortConfig.key];
      let bVal = sortConfig.key === "notes" ? (b.metadata?.notes || "") : b[sortConfig.key];
      
      if (sortConfig.key === "mmr" || sortConfig.key.startsWith("mmr_") || sortConfig.key === "no") {
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
          <button
            onClick={() => setActiveTab('affiliate')}
            className={`px-6 py-3 font-bold text-sm flex items-center gap-2 transition border-b-2 ${
              activeTab === 'affiliate' 
                ? 'border-amber-500 text-amber-400 bg-amber-500/5' 
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <Globe className="h-4 w-4" /> 💰 アフィリエイト管理
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

              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                {/* 検索窓 */}
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    placeholder="名前・IGN・Discord IDで検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 pl-9 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                  <Filter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500" />
                </div>

                {/* 自動保存ステータス */}
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                  {saving ? (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      自動保存中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span>✓</span>
                      自動保存済み
                    </span>
                  )}
                </div>

                <div className="h-4 w-px bg-gray-800 hidden md:block"></div>

                <button
                  onClick={() => fetchPlayers()}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg font-bold transition text-xs"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  更新
                </button>
                
                <button
                  onClick={handleSyncCheck}
                  disabled={syncingDiscord || syncingAutoAll}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition border text-xs ${
                    syncingDiscord ? 'bg-[#404eed]/50 border-[#404eed]/50 text-gray-400 cursor-not-allowed' : 'bg-[#5865F2]/20 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white'
                  }`}
                >
                  <Users className={`h-4 w-4 ${syncingDiscord && !syncData ? 'animate-spin' : ''}`} /> 
                  {syncingDiscord && !syncData ? "同期確認中..." : "👤 Discord & Riot同期"}
                </button>

                <button
                  onClick={handleAutoSyncAll}
                  disabled={syncingAutoAll || syncingDiscord}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition border text-xs ${
                    syncingAutoAll ? 'bg-amber-900/50 border-amber-800/50 text-gray-400 cursor-not-allowed' : 'bg-amber-500/20 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white'
                  }`}
                  title="Discord同期、Riot同期、MMR Rebuildをモーダル確認なしでノンストップ実行します"
                >
                  <RefreshCw className={`h-4 w-4 ${syncingAutoAll ? 'animate-spin' : ''}`} /> 
                  一括オート同期 (Auto)
                </button>

                <button
                  onClick={handleRebuildMmr}
                  disabled={syncingAutoAll}
                  className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800 text-red-200 border border-red-800/50 px-4 py-2 rounded-lg font-bold transition text-xs"
                  title="過去のすべての試合履歴を元にMMRを再計算し、全員のデータを上書きします"
                >
                  <RefreshCw className="h-4 w-4" /> 🔄 Rebuild
                </button>

                <a 
                  href="/balancer/record"
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition text-xs"
                >
                  <Trophy className="h-4 w-4" />
                  手動記録 🏆
                </a>

                <button
                  onClick={() => setShowMmrInfo(!showMmrInfo)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition border text-xs ${showMmrInfo ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
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
                      <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4 space-y-3">
                        <h3 className="text-green-400 font-bold mb-1 flex items-center gap-2">
                          <Plus className="h-4 w-4" /> 新規追加されるメンバー ({syncData.toAdd.length}人)
                        </h3>
                        <p className="text-gray-400 text-xs mb-3">
                          新メンバーの最高Rankおよび希望レーンを選択してください。同期時に初期MMRが自動計算されて登録されます。
                        </p>
                        <div className="space-y-3">
                          {syncData.toAdd.map((p: any, idx: number) => (
                            <div key={p.discord_id} className="bg-green-950/40 border border-green-800/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <span className="font-bold text-green-300 text-sm">
                                {p.name}
                              </span>
                              <div className="flex flex-wrap items-center gap-4">
                                {/* 最高Rank選択 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-400">最高Rank:</span>
                                  <select
                                    value={p.highest_rank || "UNRANKED"}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      updatedAdd[idx].highest_rank = e.target.value;
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 outline-none focus:border-green-500 cursor-pointer"
                                  >
                                    {["UNRANKED", "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"].map(r => (
                                      <option key={r} value={r}>{r}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* メインロール選択 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-400">メイン:</span>
                                  <select
                                    value={p.role_preferences?.primary || "ALL"}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      if (!updatedAdd[idx].role_preferences) updatedAdd[idx].role_preferences = { primary: "ALL", secondary: "-" };
                                      const newVal = e.target.value;
                                      updatedAdd[idx].role_preferences.primary = newVal;
                                      if (newVal === "ALL") {
                                        updatedAdd[idx].role_preferences.secondary = "-";
                                      }
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 outline-none focus:border-green-500 cursor-pointer"
                                  >
                                    {["ALL", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* サブロール選択 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-400">サブ:</span>
                                  <select
                                    value={p.role_preferences?.secondary || "-"}
                                    disabled={p.role_preferences?.primary === "ALL"}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      if (!updatedAdd[idx].role_preferences) updatedAdd[idx].role_preferences = { primary: "ALL", secondary: "-" };
                                      updatedAdd[idx].role_preferences.secondary = e.target.value;
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 outline-none focus:border-green-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {["-", "ALL", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Riot ID (ign) 入力 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-400">Riot ID:</span>
                                  <input
                                    type="text"
                                    placeholder="Name#TAG"
                                    value={p.ign || ""}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      updatedAdd[idx].ign = e.target.value;
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 outline-none focus:border-green-500 w-36 placeholder-gray-600 font-mono"
                                  />
                                </div>
                              </div>
                            </div>
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

                    {syncData.toUpdateName && syncData.toUpdateName.length > 0 && (
                      <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4">
                        <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" /> Discord名に修正されるメンバー ({syncData.toUpdateName.length}人)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {syncData.toUpdateName.map((p: any) => (
                            <div key={p.id} className="bg-amber-900/40 text-amber-300 px-3 py-1.5 rounded text-xs border border-amber-800 flex items-center justify-between">
                              <span className="text-gray-400 truncate max-w-[45%]">{p.oldName}</span>
                              <span className="text-gray-500 font-bold">→</span>
                              <span className="font-semibold text-amber-200 truncate max-w-[45%]">{p.newName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncData.toAdd.length === 0 && syncData.toDeactivate.length === 0 && (!syncData.toUpdateName || syncData.toUpdateName.length === 0) && (
                      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-6 text-center text-blue-300">
                        メンバーの増減や名前の変更はありませんが、参加日時などの隠しデータ（メタデータ）を最新に更新するため「同期を実行する」を押してください。
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
                      <h3 className="font-bold text-white text-base">1. Eloベースの勝敗変動 (K=48)</h3>
                      <p>対面相手との現在のMMR差から期待勝率を計算し、勝利時は加点、敗北時は減点。Elo変動係数（Kファクター）は <span className="text-amber-400 font-mono">48</span> を採用しています。</p>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">2. KDAボーナス</h3>
                      <p>基準KDAを 3.0 とし、<span className="text-amber-400 font-mono">(KDA - 3.0) * 8</span> でボーナス値を算出します。（最小 <span className="text-amber-400 font-mono">-20</span> から最大 <span className="text-amber-400 font-mono">+20</span>）</p>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">3. ランク収束引力</h3>
                      <p>設定された最高Rankの適正レートへ引き寄せられる引力が働きます。引力強度はそのロールの試合数（5試合未満: 0.005, 10試合未満: 0.003, それ以上: 0.001）に応じて減衰します。</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-bold text-white text-base">4. 習熟度（試合数）倍率</h3>
                      <p>レートが安定するまでの未熟期（そのロールで5試合未満は <span className="text-amber-400 font-mono">3.0倍</span>、10試合未満は <span className="text-amber-400 font-mono">2.0倍</span>、それ以降は <span className="text-amber-400 font-mono">1.0倍</span>）は変動幅が大きく増幅され、素早く適正MMRへ収束させます。</p>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">5. 对面回数倍率 ＆ 最終セーフティ</h3>
                      <p>同じ相手との対戦回数が少ないうちは変動幅を大きくする対面回数倍率（最大1.5倍〜最小1.0倍）が掛かります。また、勝利時は最低でも <span className="text-green-400 font-mono">+10</span> を保証し、敗北時は最大でも <span className="text-red-400 font-mono">-5</span>（必ずMMR減少）に制限するガードを適用しています。</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
                  ※ MMRは、手動またはDiscordからの戦績記録時、および管理ダッシュボードからの「🔄 Rebuild」実行時に過去の全試合から最新仕様で一括再計算されます。
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

            {/* MMR整合性チェックの表示 */}
            {integrityData && (
              <div className={`p-4 rounded-xl border ${
                integrityData.hasDiscrepancy 
                  ? 'bg-amber-950/40 border-amber-900/60 text-amber-200' 
                  : 'bg-emerald-950/40 border-emerald-900/60 text-emerald-200'
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${integrityData.hasDiscrepancy ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">MMR整合性ステータス</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {integrityData.hasDiscrepancy 
                          ? `⚠️ ${integrityData.discrepancyCount}名のプレイヤーのMMRに過去の対戦履歴（累積値）とのズレが発生しています。Rebuildを実行して再計算してください。` 
                          : '✅ すべてのプレイヤーのMMRは過去の対戦履歴と完全に一致しています。'
                        }
                      </p>
                    </div>
                  </div>
                  {integrityData.hasDiscrepancy && (
                    <button
                      onClick={handleRebuildMmr}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-black text-xs rounded-lg transition shadow-md shadow-amber-900/20"
                    >
                      🔄 Rebuildを実行
                    </button>
                  )}
                </div>
                {integrityData.hasDiscrepancy && (
                  <div className="mt-3 pt-3 border-t border-amber-900/40 text-[10px] text-amber-300/80 max-h-24 overflow-y-auto space-y-1 font-mono">
                    {integrityData.discrepancies.map((d: any) => (
                      <div key={d.name}>
                        • {d.name}: 現在値と期待値にズレがあります (差分: TOP: {d.diff.TOP}, JG: {d.diff.JG}, MID: {d.diff.MID}, ADC: {d.diff.ADC}, SUP: {d.diff.SUP}, 総合: {d.diff.TOTAL})
                      </div>
                    ))}
                  </div>
                )}
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
                      <th className="px-2 py-1.5 text-xs text-gray-400 font-semibold text-center">希望レーン</th>
                      <th className="px-2 py-1.5 text-xs text-gray-400 font-semibold text-center">NG</th>
                      <SortableHeader label="Top" sortKey="mmr_top" />
                      <SortableHeader label="Jg" sortKey="mmr_jg" />
                      <SortableHeader label="Mid" sortKey="mmr_mid" />
                      <SortableHeader label="Adc" sortKey="mmr_adc" />
                      <SortableHeader label="Sup" sortKey="mmr_sup" />
                      <SortableHeader label="総合" sortKey="mmr" />
                      <SortableHeader label="Discord ID" sortKey="discord_id" />
                      <SortableHeader label="Riot IGN" sortKey="ign" />
                      <SortableHeader label="備考" sortKey="notes" />
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
                            onChange={(e) => handleInputSave(uid, "is_active", e.target.checked)}
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
                              onBlur={handleBlurSave}
                              className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-20 font-bold text-white text-xs"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={p.highest_rank || "UNRANKED"}
                            onChange={(e) => handleInputSave(uid, "highest_rank", e.target.value)}
                            className={`bg-gray-800 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-blue-500 w-24 text-xs ${getColorFromRankName(p.highest_rank)}`}
                          >
                            {["UNRANKED", "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          <span className={getColorFromRole(p.role_preferences?.primary)}>
                            {p.role_preferences?.primary || '-'}
                          </span>
                          <span className="text-gray-500 mx-0.5">/</span>
                          <span className={getColorFromRole(p.role_preferences?.secondary)}>
                            {p.role_preferences?.secondary || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          <span className="text-rose-400 font-bold">
                            {p.role_preferences?.ignore_role || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <MmrBadgeInput value={p.mmr_top || 1000} onChange={(v) => handleInputSave(uid, "mmr_top", v)} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <MmrBadgeInput value={p.mmr_jg || 1000} onChange={(v) => handleInputSave(uid, "mmr_jg", v)} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <MmrBadgeInput value={p.mmr_mid || 1000} onChange={(v) => handleInputSave(uid, "mmr_mid", v)} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <MmrBadgeInput value={p.mmr_adc || 1000} onChange={(v) => handleInputSave(uid, "mmr_adc", v)} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <MmrBadgeInput value={p.mmr_sup || 1000} onChange={(v) => handleInputSave(uid, "mmr_sup", v)} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <MmrBadgeInput value={p.mmr || 1000} onChange={(v) => handleInputSave(uid, "mmr", v)} />
                        </td>
                        <td className="px-2 py-1.5 opacity-50 hover:opacity-100 transition">
                          <input
                            type="text"
                            value={p.discord_id}
                            onChange={(e) => handleInputChange(uid, "discord_id", e.target.value)}
                            onBlur={handleBlurSave}
                            className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-24 text-[10px]"
                            title={p.discord_id}
                          />
                        </td>
                        <td className="px-2 py-1.5 opacity-50 hover:opacity-100 transition">
                          <input
                            type="text"
                            value={p.ign || ""}
                            onChange={(e) => handleInputChange(uid, "ign", e.target.value)}
                            onBlur={handleBlurSave}
                            placeholder="Name#TAG"
                            className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-24 text-[10px] text-blue-300"
                            title={p.ign || "未登録"}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={p.metadata?.notes || ""}
                            onChange={(e) => handleInputChange(uid, "notes", e.target.value)}
                            onBlur={handleBlurSave}
                            placeholder="備考を入力"
                            className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-1 py-0.5 outline-none w-32 text-xs text-gray-200"
                          />
                        </td>
                      </tr>
                      );
                    })}
                    
                    {players.length === 0 && !loading && (
                      <tr>
                        <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                          プレイヤーが登録されていません。Discord & Riot同期を実行して登録してください。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'affiliate' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Globe className="h-8 w-8 text-amber-500" />
                  収益化 ＆ アフィリエイト管理
                </h1>
                <p className="text-gray-400 mt-2 text-sm">
                  管理者用: アフィリエイトリンクの登録とトレンドツール記事の自律生成
                </p>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDryRun}
                    onChange={(e) => setIsDryRun(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-800 bg-gray-950 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  テストモード (Dry Run)
                </label>

                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchAffiliateData}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg font-bold transition text-xs"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingAffiliate ? 'animate-spin' : ''}`} />
                    更新
                  </button>
                  <button
                    onClick={handleTriggerForge}
                    disabled={syncingAffiliate}
                    className={`flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg font-bold transition text-xs ${
                      syncingAffiliate ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {syncingAffiliate ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    🤖 トレンド記事の自律生成 (Auto-Forge)
                  </button>
                  <button
                    onClick={handleTriggerBatch}
                    disabled={syncingAffiliate}
                    className={`flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-black px-4 py-2 rounded-lg font-bold transition text-xs shadow-lg shadow-amber-900/10 ${
                      syncingAffiliate ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {syncingAffiliate ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                    🚀 一気通貫バッチ実行 (Auto-Publish)
                  </button>
                </div>
              </div>
            </div>

            {/* Message Banner */}
            {message.text && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium whitespace-pre-wrap">{message.text}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Link Settings */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4 lg:col-span-1">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    🔗 アフィリエイトリンク設定
                  </h2>
                  <button
                    onClick={handleAddLink}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-white font-bold transition"
                  >
                    <Plus className="w-4 h-4" /> 追加
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {Object.entries(affiliateLinks).map(([key, url]) => (
                    <div key={key} className="bg-gray-950/50 border border-gray-800 rounded-xl p-3 space-y-2 relative group">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-amber-400">{key}</span>
                        <button
                          onClick={() => handleDeleteLink(key)}
                          className="text-gray-500 hover:text-red-400 transition"
                          title="削除"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => handleLinkChange(key, e.target.value)}
                        placeholder="http://..."
                        className="w-full bg-gray-900 border border-gray-800 focus:border-blue-500 rounded px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                  ))}

                  {Object.keys(affiliateLinks).length === 0 && (
                    <div className="text-center py-12 text-gray-500 text-sm">
                      登録されているアフィリエイトリンクがありません。
                    </div>
                  )}
                </div>

                {Object.keys(affiliateLinks).length > 0 && (
                  <button
                    onClick={handleSaveLinks}
                    disabled={syncingAffiliate}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {syncingAffiliate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    アフィリエイトリンクの変更を保存
                  </button>
                )}
              </div>

              {/* Right Column: Draft Articles List */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4 lg:col-span-2">
                <div className="border-b border-gray-800 pb-3">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    📄 自動生成ドラフト記事一覧 (Supabase)
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
                  {affiliateArticles.map((art) => (
                    <div 
                      key={art.id} 
                      onClick={() => setSelectedArticle(art)}
                      className="bg-gray-950/40 border border-gray-800 hover:border-amber-600/40 rounded-xl p-4 space-y-3 cursor-pointer transition hover:bg-gray-950/80 group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-950/50 border border-amber-900/50 text-amber-400 rounded-full">
                          {art.champion || "ITツール"}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(art.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition line-clamp-2">
                        {art.title.replace("[ITツール攻略] ", "")}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-3">
                        {art.content.replace(/#.*?\n/g, "").replace(/\[.*?\]\(.*?\)/g, "").substring(0, 150)}...
                      </p>
                      <div className="text-[10px] text-blue-400 group-hover:text-blue-300 font-bold flex items-center gap-1">
                        プレビュー・詳細を表示 →
                      </div>
                    </div>
                  ))}

                  {affiliateArticles.length === 0 && (
                    <div className="col-span-2 text-center py-24 text-gray-500 text-sm">
                      生成されたドラフト記事がまだありません。上の「Auto-Forge」ボタンを押して自律生成を実行してください。
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Article Detail Modal */}
            {selectedArticle && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 bg-amber-950 border border-amber-900 text-amber-400 rounded-full">
                        {selectedArticle.champion || "ITツール"}
                      </span>
                      <h2 className="text-lg font-bold text-white truncate max-w-[60vw]">
                        {selectedArticle.title.replace("[ITツール攻略] ", "")}
                      </h2>
                    </div>
                    <button onClick={() => setSelectedArticle(null)} className="text-gray-500 hover:text-white">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-4 flex-1 font-mono text-xs bg-gray-950 text-gray-300 select-text whitespace-pre-wrap">
                    {selectedArticle.content}
                  </div>

                  <div className="p-6 border-t border-gray-800 bg-gray-800/30 flex justify-between items-center">
                    <span className="text-[10px] text-gray-500">
                      保存パス: <code className="bg-gray-950 px-1 py-0.5 rounded text-gray-400">{selectedArticle.file_path}</code>
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedArticle.content);
                        alert("Markdown 本文をクリップボードにコピーしました！ noteの下書きへ貼り付けてください。");
                      }}
                      className="px-6 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg flex items-center gap-2 text-xs"
                    >
                      <Save className="w-4 h-4" />
                      Markdownをコピー
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}
