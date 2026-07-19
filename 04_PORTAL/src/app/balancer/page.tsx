"use client";

import { useEffect, useState, useRef, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, Trees, Zap, Target, Heart, Sparkles, Settings } from "lucide-react";
import { getChampIcon } from "../../lib/ddragonClient";
import ProfileModal from "../ktm-admin/ProfileModal";
import MatchRecordPanel from "../ktm-admin/MatchRecordPanel";
import { Spinner } from "../../components/Feedback";

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

// ★ グループ判定ユーティリティ（固定0 > 通常参加1 > 見学固定2 > 不参加3）
function getGroup(p: any): number {
  if (p.is_fixed) return 0;
  if (p.is_active && !p.is_spectator_fixed) return 1;
  if (p.is_spectator_fixed) return 2;
  return 3;
}

export default function BalancerPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPending, setSavingPending] = useState(false);
  const [announcingStats, setAnnouncingStats] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // ★ 管理者パネル (ktm-admin/balancerをページ分割せず、ログイン中の管理者だけに
  // MMR整合性・Rebuildなど「見たいデータ」をこの画面内で見せるための状態群)
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [rebuildingMmr, setRebuildingMmr] = useState(false);

  useEffect(() => {
    fetch("/api/auth/verify", { method: "POST", credentials: "include" })
      .then((res) => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false));
  }, []);

  const checkIntegrity = async () => {
    setCheckingIntegrity(true);
    try {
      const res = await fetch("/api/mmr/check-integrity", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntegrityData(data);
    } catch (err: any) {
      console.error("Integrity check failed:", err);
    } finally {
      setCheckingIntegrity(false);
    }
  };

  // バランサー予測勝率の的中率（課題: 予測勝率の検証）
  const [predStats, setPredStats] = useState<{ total: number; correct: number; accuracy: number; avgConfidence: number; avgCloseness: number; recentCloseness: number[] } | null>(null);
  const fetchPredStats = async () => {
    try {
      const { data } = await supabase
        .from('balancer_predictions')
        .select('predicted_blue_winprob, correct')
        .not('correct', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      const rows = data || [];
      if (rows.length === 0) { setPredStats({ total: 0, correct: 0, accuracy: 0, avgConfidence: 0, avgCloseness: 0, recentCloseness: [] }); return; }
      const correct = rows.filter((r: any) => r.correct).length;
      // 予測の自信度 = 50%からどれだけ離れているか（0=完全拮抗, 50=一方的予測）。低いほどバランサーが拮抗を作れている
      const avgConfidence = rows.reduce((s: number, r: any) => s + Math.abs(Number(r.predicted_blue_winprob) - 0.5) * 100, 0) / rows.length;
      // 接戦度(#82): 100=完全拮抗(予測50%)、0=一方的(予測0/100%)。毎試合の「良いチーム分けだったか」採点
      const closenessOf = (p: number) => Math.round(100 - Math.abs(p - 0.5) * 200);
      const avgCloseness = rows.reduce((s: number, r: any) => s + closenessOf(Number(r.predicted_blue_winprob)), 0) / rows.length;
      const recentCloseness = rows.slice(0, 10).map((r: any) => closenessOf(Number(r.predicted_blue_winprob)));
      setPredStats({ total: rows.length, correct, accuracy: Math.round((correct / rows.length) * 100), avgConfidence: +avgConfidence.toFixed(1), avgCloseness: Math.round(avgCloseness), recentCloseness });
    } catch (e) {
      console.error('pred stats fetch failed', e);
    }
  };

  // 初期MMRの基準レーン（凍結値）編集: 希望レーンを変えても過去の出発点が変わらないよう
  // initial_prefs を凍結する仕組みに対し、管理者が「本来のメイン/サブ」を手入力できるパネル。
  const [showInitialPrefs, setShowInitialPrefs] = useState(false);
  const [initialDraft, setInitialDraft] = useState<Record<string, { primary: string; secondary: string }>>({});
  const [savingInitial, setSavingInitial] = useState(false);
  const openInitialPrefs = () => {
    const draft: Record<string, { primary: string; secondary: string }> = {};
    players.forEach((p: any) => {
      const src = p.initial_prefs || p.role_preferences || {};
      draft[p.id] = { primary: src.primary || 'ALL', secondary: src.secondary || '-' };
    });
    setInitialDraft(draft);
    setShowInitialPrefs(true);
  };
  const saveInitialPrefs = async () => {
    setSavingInitial(true);
    try {
      const updates = players.map((p: any) => ({ id: p.id, initial_prefs: initialDraft[p.id] })).filter(u => u.initial_prefs);
      const res = await fetch('/api/admin/players/save', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存に失敗しました');
      setPlayers(prev => prev.map((p: any) => ({ ...p, initial_prefs: initialDraft[p.id] || p.initial_prefs })));
      setMessage({ type: 'success', text: `✅ 初期レーン（凍結値）を${updates.length}人分保存しました。反映にはRebuildを実行してください。` });
      setShowInitialPrefs(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: '❌ ' + e.message });
    } finally {
      setSavingInitial(false);
    }
  };

  // サイド偏り検証(#81): Blue/Redの勝率差を集計（headカウントでエグレス最小）
  const [sideStats, setSideStats] = useState<{ total: number; blueWins: number; blueRate: number } | null>(null);
  const fetchSideStats = async () => {
    try {
      const [{ count: total }, { count: blueWins }] = await Promise.all([
        supabase.from('ktm_matches').select('id', { count: 'exact', head: true }),
        supabase.from('ktm_matches').select('id', { count: 'exact', head: true }).eq('winning_team', 'BLUE'),
      ]);
      const t = total || 0;
      const b = blueWins || 0;
      setSideStats({ total: t, blueWins: b, blueRate: t > 0 ? Math.round((b / t) * 1000) / 10 : 0 });
    } catch (e) {
      console.error('side stats fetch failed', e);
    }
  };

  // バランス満足度(👍/👎)の集計（課題#42）
  const [satStats, setSatStats] = useState<{ tallied: number; totalUp: number; totalDown: number; totalNeutral?: number; recent?: { up: number; down: number; neutral: number }[]; satisfactionRate: number | null } | null>(null);
  const [tallyingSat, setTallyingSat] = useState(false);
  const fetchSatStats = async () => {
    setTallyingSat(true);
    try {
      const res = await fetch('/api/admin/satisfaction-tally', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setSatStats(data);
    } catch (e) {
      console.error('satisfaction tally failed', e);
    } finally {
      setTallyingSat(false);
    }
  };

  useEffect(() => {
    if (isAdmin) { checkIntegrity(); fetchPredStats(); fetchSideStats(); }
  }, [isAdmin]);

  const handleRebuildMmr = async () => {
    if (!confirm("過去のすべての試合履歴をもとに全プレイヤーのMMRを再計算します。よろしいですか？")) return;
    setRebuildingMmr(true);
    try {
      const res = await fetch("/api/mmr/rebuild", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "再計算に失敗しました");
      setMessage({ type: "success", text: "✅ " + data.message });
      await checkIntegrity();
      fetchPlayers();
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ Rebuild エラー: " + err.message });
    } finally {
      setRebuildingMmr(false);
    }
  };

  const handleRecordNavigate = async () => {
    if (!balanceResult) return;
    setSavingPending(true);
    try {
      const res = await fetch('/api/balancer/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balanceResult })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '一時保存に失敗しました。');
      
      router.push(`/balancer/record?pending_id=${data.pendingId}`);
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setSavingPending(false);
    }
  };

  const handleAnnounceStats = async () => {
    const activeCount = players.filter(p => p.is_active && !p.is_spectator_fixed).length;
    if (activeCount === 0) {
      alert("参加予定のプレイヤーが選択されていません。");
      return;
    }
    setAnnouncingStats(true);
    try {
      const res = await fetch('/api/discord/announce-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "通知に失敗しました。");
      
      alert("📢 Discordへ現在の募集・希望レーン状況を通知しました！");
    } catch (err: any) {
      alert(`通知エラー: ${err.message}`);
    } finally {
      setAnnouncingStats(false);
    }
  };
  
  const [balancing, setBalancing] = useState(false);
  const [balanceResult, setBalanceResult] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposalIdx, setSelectedProposalIdx] = useState<number>(0);
  const [analysis, setAnalysis] = useState<any>(null);
  
  // フィルター用State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // タップスワップ用State
  const [swapSource, setSwapSource] = useState<{ team: string; role: string; name: string } | null>(null);
  const [sendingDiscord, setSendingDiscord] = useState(false);
  // ★ チーム分け結果モーダルの表示フラグ
  const [showResultModal, setShowResultModal] = useState(false);
  const [modalTab, setModalTab] = useState<'teams' | 'matchups'>('teams');
  
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

  // ★ ESCキーでモーダルを閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowResultModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

      // 取得したDiscord IDの配列で is_active のみ更新する。
      // 【重要】名前はここでは上書きしない。以前はDiscordから取った名前をDBへ自動保存していたが、
      // ギルド情報の取得に失敗するとグローバル名(旧名)にフォールバックし、改名後の名前が
      // 定期的に旧名へ巻き戻るバグの原因になっていた。名前の正は管理ダッシュボードの同期に一本化。
      setPlayers(prevPlayers => {
        const nextPlayers = prevPlayers.map(p => {
          if (p.discord_id && data.activeDiscordIds.includes(p.discord_id)) {
            return { ...p, is_active: true };
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
          } else if (field === "ng_lane_1") {
            const ignore_role = value === "" ? "-" : value;
            return { 
              ...p, 
              ng_lane_1: value,
              role_preferences: { ...p.role_preferences, ignore_role }
            };
          } else if (field === "ng_lane_2") {
            return { ...p, ng_lane_2: value };
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

      if (isAdmin) {
        // 管理者は weight 等も含めフル書き込み可能。RLSをバイパスするサーバーAPI経由。
        const updates = existingPlayers.map(p => ({
          id: p.id,
          role_preferences: p.role_preferences,
          is_active: p.is_active,
          ng_lane_1: p.ng_lane_1 || null,
          ng_lane_2: p.ng_lane_2 || null,
          weight: p.weight,
          allow_higher: p.allow_higher,
          pity: p.pity,
          off_role_pity: p.off_role_pity,
          metadata: p.metadata,
        }));
        const res = await fetch('/api/admin/players/save', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '保存に失敗しました'); }
      } else {
        // 一般ユーザーはRLSで許可された非センシティブ列のみ（名前・weightは書き込まない）。
        await Promise.all(existingPlayers.map(p =>
          supabase.from("ktm_players").update({
            role_preferences: p.role_preferences,
            is_active: p.is_active,
            ng_lane_1: p.ng_lane_1 || null,
            ng_lane_2: p.ng_lane_2 || null,
            allow_higher: p.allow_higher,
            pity: p.pity,
            off_role_pity: p.off_role_pity,
            metadata: p.metadata
          }).eq('id', p.id)
        ));
      }
      setSaving(false);
      setMessage({ type: "success", text: "✅ プレイヤー情報を更新しました。" });
    } catch (err: any) {
      setMessage({ type: "error", text: "保存エラー: " + err.message });
      setSaving(false);
    }
  };

  // BL-02: 探索強度（40=速い/100=標準/200=精密）
  const [searchDepth, setSearchDepth] = useState(100);

  const handleBalance = async () => {
    const activePlayers = players.filter((p: any) => p.is_active);
    if (activePlayers.length < 10) {
      setMessage({ type: "error", text: `チーム分けには最低10人のActiveプレイヤーが必要です。(現在 ${activePlayers.length}人)` });
      return;
    }
    
    // 前回のチーム分け結果が表示されている場合、結果記録の確認を促す
    if (balanceResult) {
      const confirmNext = confirm("前回のチーム分けの試合結果は記録しましたか？\n（[キャンセル] を押すと結果画面に戻ります）");
      if (!confirmNext) {
        setShowResultModal(true);
        return;
      }
    }
    
    setBalancing(true);
    setMessage({ type: "", text: "" });
    setBalanceResult(null);
    setShowRecordPanel(false);
    setShowResultModal(false);

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
          }),
          searchDepth, // BL-02: 探索強度
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
      // ★ 完了後に自動でモーダルを開く
      setShowResultModal(true);
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ バランス計算エラー: " + err.message });
    } finally {
      setBalancing(false);
    }
  };

  // 対戦分析の実データ(#75): 表示中の10人のプレイスタイルを試合履歴から計算
  const [vsStyles, setVsStyles] = useState<Record<string, any>>({});
  const fetchVsStyles = async (result: any) => {
    try {
      const names = [...(result?.teamBlue || []), ...(result?.teamRed || [])].map((p: any) => p.name).filter(Boolean);
      if (names.length === 0) return;
      const res = await fetch('/api/balancer/vs-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });
      const data = await res.json();
      if (data.success) setVsStyles((prev) => ({ ...prev, ...data.styles }));
    } catch (e) {
      console.warn('vs-analytics fetch failed', e);
    }
  };
  useEffect(() => {
    if (showResultModal && balanceResult) fetchVsStyles(balanceResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResultModal, balanceResult]);

  // 4案すべてをDiscordへ投稿(#77)。メンバーはリアクションで希望表明。
  const [sendingProposals, setSendingProposals] = useState(false);
  const handleSendProposals = async () => {
    if (!proposals || proposals.length === 0) return;
    if (!confirm(`チーム分け候補 ${proposals.length}案 をすべてDiscordへ投稿しますか？（メンバーがリアクションで投票できます）`)) return;
    setSendingProposals(true);
    try {
      const res = await fetch('/api/discord/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '投稿に失敗しました');
      setMessage({ type: 'success', text: `✅ ${proposals.length}案をDiscordに投稿しました！` });
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setSendingProposals(false);
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

  const handleSelectSwapPlayer = (team: string, role: string, name: string) => {
    if (!name) return;
    if (!swapSource) {
      setSwapSource({ team, role, name });
    } else {
      if (swapSource.name === name) {
        setSwapSource(null);
        return;
      }
      handleSwapPlayer(team as any, role, swapSource.name);
      setSwapSource(null);
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

  // ★ グループ優先ソート（固定 > 通常参加 > 見学固定 > 不参加）
  const sortedPlayers = [...players].sort((a, b) => {
    const ga = getGroup(a), gb = getGroup(b);
    if (ga !== gb) return ga - gb;
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    const numericKeys = ["mmr", "no", "pity", "off_role_pity", "spectator_pity", "weight"];
    if (numericKeys.includes(sortConfig.key)) { aVal = parseInt(aVal)||0; bVal = parseInt(bVal)||0; }
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // ★ フィルター適用 (名前検索、希望ロール、アクティブ状態)
  const filteredPlayers = sortedPlayers.filter(p => {
    const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (roleFilter && prefs.primary !== roleFilter) {
      return false;
    }
    if (statusFilter) {
      if (statusFilter === 'active' && (!p.is_active || p.is_spectator_fixed)) return false;
      if (statusFilter === 'spectator' && !p.is_spectator_fixed) return false;
      if (statusFilter === 'inactive' && p.is_active) return false;
    }
    return true;
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
        <Spinner label="メンバーデータを読み込み中..." />
      </div>
    );
  }

  // ★ 各種カウント
  const activeCount    = players.filter(p => p.is_active && !p.is_spectator_fixed).length;
  const spectatorCount = players.filter(p => p.is_spectator_fixed).length;
  const inactiveCount  = players.filter(p => !p.is_active).length;
  const canBalance     = activeCount >= 10;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">

      {/* ★ チーム分け結果モーダル */}
      {balanceResult && showResultModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-2 md:p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setShowResultModal(false); }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl my-4">
            {/* モーダルヘッダー */}
            <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-400" />
                マッチング結果
                <span className="hidden md:inline text-xs font-mono text-gray-500 ml-2">MMR差: <span className="text-white font-bold">{balanceResult.mmrDiff}</span></span>
              </h2>
              <div className="flex items-center gap-2">
                {proposals.length > 1 && (
                  <button onClick={handleSendProposals} disabled={sendingProposals}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg font-bold transition text-xs md:text-sm"
                    title="全候補をDiscordに投稿してリアクション投票してもらう">
                    {sendingProposals ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <>🗳️</>}
                    <span className="hidden sm:inline">{proposals.length}案を投稿</span>
                  </button>
                )}
                <button onClick={handleSendDiscord} disabled={sendingDiscord}
                  className="flex items-center gap-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 rounded-lg font-bold transition text-xs md:text-sm">
                  {sendingDiscord ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  Discord通知
                </button>
                <button onClick={() => setShowResultModal(false)}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition" title="閉じる (ESC)">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {/* 環境分析 */}
              {analysis && (
                <div className={`p-3 rounded-xl border text-sm flex flex-col gap-2 ${analysis.level === 'HIGH_DIFFERENCE' ? 'bg-amber-950/40 border-amber-800/80 text-amber-200' : analysis.level === 'CLOSE' ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200' : 'bg-indigo-950/40 border-indigo-800/80 text-indigo-200'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    {analysis.level === 'HIGH_DIFFERENCE' ? <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" /> : <Globe className="h-4 w-4 text-emerald-400 shrink-0" />}
                    <span>本日のカスタム環境:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-black ${analysis.level === 'HIGH_DIFFERENCE' ? 'bg-amber-800 text-amber-100' : analysis.level === 'CLOSE' ? 'bg-emerald-800 text-emerald-100' : 'bg-indigo-800 text-indigo-100'}`}>
                      {analysis.level === 'HIGH_DIFFERENCE' ? '格差大' : analysis.level === 'CLOSE' ? '実力拮抗' : '標準的'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{analysis.message}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span>平均: <strong className="text-white font-mono">{analysis.averageMMR}</strong></span>
                    <span>最低: <strong className="text-white font-mono">{analysis.minMMR}</strong></span>
                    <span>最高: <strong className="text-white font-mono">{analysis.maxMMR}</strong></span>
                    <span>差: <strong className={`font-mono ${analysis.level === 'HIGH_DIFFERENCE' ? 'text-amber-400' : 'text-white'}`}>{analysis.mmrRange}</strong></span>
                  </div>
                </div>
              )}

              {/* 勝利予想（#79）: pending保存時と同じElo式で表示 */}
              {(() => {
                const blueAvg = balanceResult.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamBlue.length || 1);
                const redAvg = balanceResult.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamRed.length || 1);
                const pBlue = 1 / (1 + Math.pow(10, (redAvg - blueAvg) / 400));
                const bluePct = Math.round(pBlue * 100);
                const redPct = 100 - bluePct;
                return (
                  <div className="p-3 rounded-xl border border-gray-800 bg-gray-950/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-gray-400">🔮 勝利予想 (MMRベース)</span>
                      <span className="text-[10px] text-gray-600">50%に近いほど接戦</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-blue-400 w-24 text-right">BLUE {bluePct}%</span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden bg-gray-800 flex">
                        <div className="bg-blue-500/80" style={{ width: `${bluePct}%` }}></div>
                        <div className="bg-red-500/80" style={{ width: `${redPct}%` }}></div>
                      </div>
                      <span className="text-sm font-black text-red-400 w-24">RED {redPct}%</span>
                    </div>
                  </div>
                );
              })()}

              {/* 案タブ */}
              {proposals.length > 1 && (
                <div className="flex border-b border-gray-800 gap-2 overflow-x-auto pb-1">
                  {proposals.map((prop, idx) => (
                    <button key={prop.id || idx} onClick={() => { setBalanceResult(prop); setSelectedProposalIdx(idx); }}
                      className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap ${selectedProposalIdx === idx ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                      {prop.title || `案${prop.id || idx}`}
                    </button>
                  ))}
                </div>
              )}

              {/* モーダル内タブ切り替え */}
              <div className="flex gap-2 border-b border-gray-800 pb-1">
                <button
                  type="button"
                  onClick={() => setModalTab('teams')}
                  className={`px-4 py-2 text-xs font-black transition-all ${
                    modalTab === 'teams'
                      ? 'border-b-2 border-cyan-500 text-cyan-400 font-extrabold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  チーム編成
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('matchups')}
                  className={`px-4 py-2 text-xs font-black transition-all ${
                    modalTab === 'matchups'
                      ? 'border-b-2 border-amber-500 text-amber-400 font-extrabold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  対戦分析 (VS Analytics)
                </button>
              </div>

              {/* チーム表示 */}
              {modalTab === 'teams' && (
                <>
                  <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center border-b border-gray-800 pb-3">
                  <div className="col-span-5 bg-gradient-to-r from-blue-950/40 to-transparent p-3 rounded-xl border-l-4 border-blue-500 flex justify-between items-center">
                    <span className="text-base font-black text-blue-400">BLUE TEAM</span>
                    <span className="text-xs font-mono font-bold text-blue-300">合計MMR: {balanceResult.teamBlueMMR}</span>
                  </div>
                  <div className="col-span-1 flex justify-center text-gray-600 font-black">VS</div>
                  <div className="col-span-5 bg-gradient-to-l from-red-950/40 to-transparent p-3 rounded-xl border-r-4 border-red-500 flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-red-300">合計MMR: {balanceResult.teamRedMMR}</span>
                    <span className="text-base font-black text-red-400">RED TEAM</span>
                  </div>
                </div>
                {['TOP','JG','MID','ADC','SUP'].map(role => {
                  const pB = balanceResult.teamBlue.find((x: any) => x.currentRole === role);
                  const pR = balanceResult.teamRed.find((x: any) => x.currentRole === role);
                  const offB = pB && pB.mainLane !== 'ALL' && pB.mainLane !== '-' && pB.currentRole !== pB.mainLane;
                  const offR = pR && pR.mainLane !== 'ALL' && pR.mainLane !== '-' && pR.currentRole !== pR.mainLane;
                  const bKey = `teamBlue-${role}`, rKey = `teamRed-${role}`;
                  const bMMR = pB?.mmr || 1000, rMMR = pR?.mmr || 1000, diff = bMMR - rMMR;
                  return (
                    <div key={role} className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center bg-gray-900/40 p-2 md:p-3 rounded-2xl border border-gray-800/80">
                      <div draggable={!!pB?.name} onDragStart={e => handleDragStart(e,'teamBlue',role,pB?.name||'')} onDragOver={e => handleDragOver(e,bKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'teamBlue',role)}
                        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${dragOverSlot===bKey?'border-blue-500 bg-blue-950/30 border-dashed':'bg-blue-950/10 border-blue-900/20 hover:bg-blue-950/20'} ${swapSource?.name === pB?.name ? 'border-amber-500 bg-amber-950/20 animate-pulse' : ''}`}>
                        <div className="flex-1 min-w-0">{renderSwapSelect('teamBlue',role,pB?.name||'')}</div>
                        {pB?.name && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('teamBlue', role, pB.name); }}
                            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === pB.name ? 'bg-amber-500 text-black' : 'text-blue-400 hover:text-white hover:bg-blue-900/40'}`}
                            title="タップして入れ替え"
                          >
                            ⇄
                          </button>
                        )}
                        {offB && <span className="text-[9px] bg-red-950/80 border border-red-800 text-red-400 px-1.5 py-0.5 rounded font-black shrink-0">⚠️OFF</span>}
                        <span className="font-mono text-xs font-bold text-blue-400 shrink-0 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/30">{bMMR}</span>
                      </div>
                      <div className="col-span-1 flex flex-col items-center py-1">
                        <div className="w-8 h-8 rounded-full bg-gray-950 border border-gray-800 flex items-center justify-center shadow-lg"><RoleIcon role={role} className="w-4 h-4" /></div>
                        <span className={`text-[10px] font-mono mt-1 font-extrabold ${diff>0?'text-blue-400':diff<0?'text-red-400':'text-gray-500'}`}>{diff>0?`+${diff}`:diff<0?diff:'±0'}</span>
                      </div>
                      <div draggable={!!pR?.name} onDragStart={e => handleDragStart(e,'teamRed',role,pR?.name||'')} onDragOver={e => handleDragOver(e,rKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'teamRed',role)}
                        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${dragOverSlot===rKey?'border-red-500 bg-red-950/30 border-dashed':'bg-red-950/10 border-red-900/20 hover:bg-red-950/20'} ${swapSource?.name === pR?.name ? 'border-amber-500 bg-amber-950/20 animate-pulse' : ''}`}>
                        <span className="font-mono text-xs font-bold text-red-400 shrink-0 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/30">{rMMR}</span>
                        {offR && <span className="text-[9px] bg-red-950/80 border border-red-800 text-red-400 px-1.5 py-0.5 rounded font-black shrink-0">⚠️OFF</span>}
                        {pR?.name && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('teamRed', role, pR.name); }}
                            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === pR.name ? 'bg-amber-500 text-black' : 'text-red-400 hover:text-white hover:bg-red-900/40'}`}
                            title="タップして入れ替え"
                          >
                            ⇄
                          </button>
                        )}
                        <div className="flex-1 min-w-0">{renderSwapSelect('teamRed',role,pR?.name||'')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AIレポート */}
              {balanceResult.balanceReport && (
                <div className="p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-lg">
                  <h3 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-2"><Activity className="h-4 w-4" /> AIバランス分析レポート</h3>
                  <div className="text-sm text-indigo-100/90 leading-relaxed font-mono space-y-2">
                    {Array.isArray(balanceResult.balanceReport) ? balanceResult.balanceReport.map((l: string, i: number) => <div key={i}>{l}</div>) : balanceResult.balanceReport}
                  </div>
                </div>
              )}

              {/* 観戦 */}
              {balanceResult.spectators && balanceResult.spectators.length > 0 && (
                <div className="pt-3 border-t border-gray-800">
                  <h3 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> 観戦 / 待機メンバー</h3>
                  <div className="flex flex-wrap gap-2">
                    {balanceResult.spectators.map((name: string, index: number) => {
                      const slotKey = `spectators-${index}`;
                      return (
                        <div key={`spec-${index}`} draggable onDragStart={e => handleDragStart(e,'spectators',index.toString(),name)} onDragOver={e => handleDragOver(e,slotKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'spectators',index.toString())}
                          className={`border rounded px-2.5 py-1.5 min-w-[120px] flex items-center justify-between gap-1.5 transition cursor-grab ${dragOverSlot===slotKey?'border-indigo-400 bg-indigo-950/40 border-dashed':'bg-gray-950 border-gray-800 hover:bg-gray-800'} ${swapSource?.name === name ? 'border-amber-500 bg-amber-950/20 animate-pulse' : ''}`}>
                          <div className="flex-1 min-w-0">{renderSwapSelect('spectators',index.toString(),name)}</div>
                          {name && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('spectators', index.toString(), name); }}
                              className={`p-0.5 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === name ? 'bg-amber-500 text-black' : 'text-indigo-400 hover:text-white hover:bg-gray-800'}`}
                              title="タップして入れ替え"
                            >
                              ⇄
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 試合結果記録 */}
              <div className="pt-3 border-t border-gray-800">
                <div className="text-center">
                  <button
                    onClick={handleRecordNavigate}
                    disabled={savingPending}
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-8 py-3 rounded-xl font-black transition flex items-center gap-2 mx-auto shadow-lg"
                  >
                    <Trophy className="h-5 w-5" />
                    {savingPending ? '一時保存中...' : 'この編成で試合結果を記録する 🏆'}
                  </button>
                </div>
              </div>
            </>)}

              {/* 対面分析 (VS Analytics) */}
              {modalTab === 'matchups' && (
                <div className="space-y-4">
                  {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => {
                    const pB = balanceResult.teamBlue.find((x: any) => x.currentRole === role);
                    const pR = balanceResult.teamRed.find((x: any) => x.currentRole === role);
                    
                    if (!pB || !pR) return null;

                    const dbB = players.find((p: any) => p.name === pB.name);
                    const dbR = players.find((p: any) => p.name === pR.name);

                    // 実データ優先(#75): 試合履歴から計算したスタイル → キャッシュ → デフォルト
                    const defaultStyle = {
                      sliders: { aggressive: 50, farming: 50, supportive: 50 },
                      tags: [{ id: 'balanced', name: 'バランス型', description: '標準的なプレイスタイル。', reason: '' }],
                      diffs: { goldDiff: 0, xpDiff: 0, csDiff: 0 }
                    };
                    const liveB = vsStyles[pB.name];
                    const liveR = vsStyles[pR.name];
                    const styleB = (liveB && liveB.games > 0 && liveB.tags?.length > 0) ? liveB
                      : (liveB && liveB.games > 0) ? { ...liveB, tags: defaultStyle.tags }
                      : dbB?.metadata?.playstyle_cache?.custom || defaultStyle;
                    const styleR = (liveR && liveR.games > 0 && liveR.tags?.length > 0) ? liveR
                      : (liveR && liveR.games > 0) ? { ...liveR, tags: defaultStyle.tags }
                      : dbR?.metadata?.playstyle_cache?.custom || defaultStyle;

                    const tagB = styleB.tags?.[0] || { id: 'balanced', name: 'バランス型' };
                    const tagR = styleR.tags?.[0] || { id: 'balanced', name: 'バランス型' };
                    const tip = generateMatchupTip(tagB, tagR, role);

                    const goldDiffB = styleB.diffs?.goldDiff || 0;
                    const goldDiffR = styleR.diffs?.goldDiff || 0;
                    const csDiffB = styleB.diffs?.csDiff || 0;
                    const csDiffR = styleR.diffs?.csDiff || 0;
                    
                    const goldDiff = goldDiffB - goldDiffR;
                    const csDiff = csDiffB - csDiffR;

                    return (
                      <div key={role} className="bg-gray-950 p-4 rounded-2xl border border-gray-800 space-y-4">
                        {/* ロールヘッダー */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center">
                              <RoleIcon role={role} className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm font-black text-white">{role} 対面分析</span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">MMR差: {pB.mmr - pR.mmr > 0 ? `+${pB.mmr - pR.mmr}` : pB.mmr - pR.mmr}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                          {/* BLUE側 */}
                          <div className="col-span-4 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-blue-400">{pB.name}</span>
                              <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-black">{tagB.name}</span>
                            </div>
                            <div className="space-y-1 text-[10px] text-gray-400">
                              <div className="flex justify-between"><span>Aggressive:</span> <span className="font-bold text-white">{styleB.sliders?.aggressive || 50}%</span></div>
                              <div className="flex justify-between"><span>Farming:</span> <span className="font-bold text-white">{styleB.sliders?.farming || 50}%</span></div>
                            </div>
                          </div>

                          {/* VS (差分比較) */}
                          <div className="col-span-3 flex flex-col items-center justify-center space-y-2">
                            <span className="text-[10px] text-gray-500 font-black">9分スタッツ差 (B - R)</span>
                            <div className="space-y-1 w-full text-[9px] font-mono text-center">
                              <div className="flex justify-between px-2 bg-black/40 py-1 rounded border border-white/5">
                                <span className="text-gray-500">ゴールド:</span>
                                <span className={goldDiff >= 0 ? 'text-amber-400 font-bold' : 'text-rose-500 font-bold'}>
                                  {goldDiff >= 0 ? `+${goldDiff}` : goldDiff} G
                                </span>
                              </div>
                              <div className="flex justify-between px-2 bg-black/40 py-1 rounded border border-white/5">
                                <span className="text-gray-500">CS:</span>
                                <span className={csDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                                  {csDiff >= 0 ? `+${csDiff.toFixed(1)}` : csDiff.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* RED側 */}
                          <div className="col-span-4 space-y-1.5 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 font-black">{tagR.name}</span>
                              <span className="text-xs font-black text-red-400">{pR.name}</span>
                            </div>
                            <div className="space-y-1 text-[10px] text-gray-400">
                              <div className="flex justify-between"><span>Aggressive:</span> <span className="font-bold text-white">{styleR.sliders?.aggressive || 50}%</span></div>
                              <div className="flex justify-between"><span>Farming:</span> <span className="font-bold text-white">{styleR.sliders?.farming || 50}%</span></div>
                            </div>
                          </div>
                        </div>

                        {/* 対面アドバイス */}
                        <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl text-[11px] text-amber-200 leading-relaxed">
                          <div className="flex items-center gap-1 font-bold mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>マッチアップ攻略アドバイス</span>
                          </div>
                          {tip}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-3 md:p-6 space-y-4">

        {/* ヘッダー */}
        <div className="flex flex-col gap-3 border-b border-gray-800 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 md:h-8 md:w-8 text-amber-500" /> チーム分けバランサー
            </h1>
            <div className="flex items-center gap-2">
              {saving && <span className="flex items-center gap-1 text-amber-400 text-xs"><RefreshCw className="h-3 w-3 animate-spin" /> 保存中...</span>}
              <Link href="/history" className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-orange-400 px-3 py-1.5 rounded-lg font-bold transition text-xs border border-orange-900/50">
                <History className="h-3.5 w-3.5" /> 過去の試合
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs border ${
                    integrityData?.hasDiscrepancy
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" /> 管理者パネル
                  {integrityData?.hasDiscrepancy && (
                    <span className="bg-rose-500 text-white rounded-full px-1.5 text-[10px] font-black">{integrityData.discrepancyCount}</span>
                  )}
                </button>
              )}
              <Link href="/ktm-admin" prefetch={false} className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg font-bold transition text-xs">
                <Shield className="h-3.5 w-3.5" /> {isAdmin ? '詳細管理へ' : '管理者 🔑'}
              </Link>
              <button
                onClick={handleAnnounceStats}
                disabled={announcingStats}
                className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {announcingStats ? '通知中...' : '募集状況を通知 📢'}
              </button>
            </div>
          </div>

          {/* ★ リアルタイム参加者バッジ */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${
              canBalance ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-amber-950/40 border-amber-700/60 text-amber-300'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${canBalance ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
              <span className="text-xs">参加</span>
              <span className={`text-2xl font-black leading-none ${canBalance ? 'text-emerald-300' : 'text-amber-300'}`}>{activeCount}</span>
              <span className="text-xs opacity-60">人</span>
              {canBalance && <span className="text-xs text-emerald-400 font-black border-l border-emerald-700 pl-2">✅ 準備完了！</span>}
            </div>
            {spectatorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-sky-800/60 bg-sky-950/30 text-sky-300 font-bold text-sm">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span className="text-xs">観戦</span>
                <span className="text-xl font-black text-sky-300">{spectatorCount}</span>
                <span className="text-xs opacity-60">人</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-800 bg-gray-900/50 text-gray-500 font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-gray-600"></span>
              <span className="text-xs">不参加</span>
              <span className="text-xl font-black text-gray-400">{inactiveCount}</span>
              <span className="text-xs opacity-60">人</span>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* BL-02: 探索強度 */}
              <select value={searchDepth} onChange={e => setSearchDepth(Number(e.target.value))}
                title="精密ほど良い組み合わせを探すが計算が遅くなる"
                className="bg-gray-900 border border-gray-800 text-gray-300 text-xs font-bold rounded-lg px-2 py-2 outline-none">
                <option value={40}>⚡ 速い</option>
                <option value={100}>⚖️ 標準</option>
                <option value={200}>🔬 精密</option>
              </select>
              <button onClick={handleFetchDiscordReactions} disabled={fetchingDiscord}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition border text-xs ${
                  fetchingDiscord ? 'bg-[#404eed]/50 border-[#404eed]/50 text-gray-400 cursor-not-allowed' : 'bg-[#5865F2]/20 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white'
                }`}>
                <RefreshCw className={`h-3.5 w-3.5 ${fetchingDiscord ? 'animate-spin' : ''}`} />
                {fetchingDiscord ? '取得中...' : 'Discord参加者取得'}
              </button>
              <button onClick={handleBalance} disabled={balancing || !canBalance}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 md:px-8 md:py-3 rounded-xl font-black transition text-sm md:text-base ${
                  balancing || !canBalance ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]'
                }`}>
                {balancing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
                {balancing ? 'AIが編成中...' : 'チーム分け実行'}
              </button>
            </div>
          </div>
          {/* 前回結果の再表示ボタン */}
          {balanceResult && !showResultModal && (
            <button onClick={() => setShowResultModal(true)}
              className="flex items-center gap-2 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 px-4 py-2 rounded-lg font-bold transition text-sm">
              <Globe className="h-4 w-4" /> 前回のチーム分け結果を再表示
            </button>
          )}
        </div>

        {/* ★ 管理者パネル (isAdmin時のみ・/ktm-adminへ移動せずこの画面内でMMR整合性とRebuildを確認できる) */}
        {isAdmin && showAdminPanel && (
          <div className="bg-gray-900 border border-amber-800/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${integrityData?.hasDiscrepancy ? 'text-rose-400' : 'text-emerald-400'}`} />
                <span className="text-sm font-bold text-white">MMR整合性ステータス</span>
                {checkingIntegrity ? (
                  <span className="text-xs text-gray-500">確認中...</span>
                ) : integrityData ? (
                  <span className={`text-xs font-bold ${integrityData.hasDiscrepancy ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {integrityData.hasDiscrepancy ? `${integrityData.discrepancyCount}人にズレがあります` : '全員一致しています'}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">未確認</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={checkIntegrity}
                  disabled={checkingIntegrity}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkingIntegrity ? 'animate-spin' : ''}`} /> 再チェック
                </button>
                <button
                  onClick={handleRebuildMmr}
                  disabled={rebuildingMmr}
                  className="flex items-center gap-1.5 bg-red-900/40 hover:bg-red-800 text-red-200 border border-red-800/50 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                  title="過去のすべての試合履歴を元にMMRを再計算し、全員のデータを上書きします"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${rebuildingMmr ? 'animate-spin' : ''}`} /> 🔄 Rebuild
                </button>
              </div>
            </div>
            {integrityData?.hasDiscrepancy && (
              <div className="text-xs text-gray-400">
                名簿の編集・Riot/Discord同期・アフィリエイト管理などの詳細操作は
                <Link href="/ktm-admin" prefetch={false} className="text-amber-400 hover:underline mx-1">KTM管理ダッシュボード</Link>
                で行えます。
              </div>
            )}

            {/* バランサー予測の的中率（課題: 予測勝率の検証） */}
            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-white">🎯 バランサー予測の精度</span>
                <button
                  onClick={fetchPredStats}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg font-bold transition text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> 更新
                </button>
              </div>
              {predStats ? (
                predStats.total === 0 ? (
                  <p className="text-xs text-gray-500 mt-2">まだ結果と突き合わせ済みの予測がありません（チーム分け→試合結果記録が蓄積されると表示されます）。</p>
                ) : (
                  <>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <div className="bg-gray-950/60 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">予測的中率</div>
                      <div className="text-lg font-black text-emerald-400">{predStats.accuracy}%</div>
                      <div className="text-[10px] text-gray-600">{predStats.correct}/{predStats.total}戦</div>
                    </div>
                    <div className="bg-gray-950/60 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">平均接戦度</div>
                      <div className={`text-lg font-black ${predStats.avgCloseness >= 80 ? 'text-amber-400' : predStats.avgCloseness >= 60 ? 'text-sky-400' : 'text-rose-400'}`}>{predStats.avgCloseness}</div>
                      <div className="text-[10px] text-gray-600">100=完全拮抗</div>
                    </div>
                    <div className="bg-gray-950/60 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">平均の偏り</div>
                      <div className="text-lg font-black text-sky-400">±{predStats.avgConfidence}%</div>
                      <div className="text-[10px] text-gray-600">低=拮抗</div>
                    </div>
                    <div className="bg-gray-950/60 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">サンプル</div>
                      <div className="text-lg font-black text-white">{predStats.total}</div>
                      <div className="text-[10px] text-gray-600">直近200戦</div>
                    </div>
                  </div>
                  {/* 直近10戦の接戦度（#82: 毎試合採点。左が最新） */}
                  {predStats.recentCloseness.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] text-gray-500 mb-1">直近10戦の接戦度（左が最新）</div>
                      <div className="flex gap-1">
                        {predStats.recentCloseness.map((c, i) => (
                          <div key={i} title={`接戦度 ${c}`} className={`flex-1 h-6 rounded flex items-center justify-center text-[9px] font-black ${c >= 80 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : c >= 60 ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25' : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'}`}>
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                )
              ) : (
                <p className="text-xs text-gray-500 mt-2">読み込み中...</p>
              )}
              <p className="text-[10px] text-gray-600 mt-2">
                的中率が50%近い＝実力拮抗、極端に高い＝MMR差が大きいまま組んでいる可能性。平均の偏りが小さいほどバランサーが互角の試合を作れています。
              </p>
            </div>

            {/* サイド偏り検証(#81): Blue/Red勝率 */}
            {sideStats && sideStats.total > 0 && (
              <div className="border-t border-gray-800 pt-3">
                <span className="text-sm font-bold text-white">🎨 サイド偏り（Blue/Red勝率）</span>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-black text-blue-400 w-28 text-right">BLUE {sideStats.blueRate}%</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden bg-gray-800 flex">
                    <div className="bg-blue-500/80" style={{ width: `${sideStats.blueRate}%` }}></div>
                    <div className="bg-red-500/80" style={{ width: `${100 - sideStats.blueRate}%` }}></div>
                  </div>
                  <span className="text-xs font-black text-red-400 w-28">RED {Math.round((100 - sideStats.blueRate) * 10) / 10}%</span>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  全{sideStats.total}戦（Blue {sideStats.blueWins}勝）。50%から大きくズレている場合はサイド有利かサイド公平化ロジックの見直し材料になります。
                </p>
              </div>
            )}

            {/* 初期MMRの基準レーン（凍結値）編集 */}
            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-white">🧊 初期MMRの基準レーン（凍結値）</span>
                <button
                  onClick={() => showInitialPrefs ? setShowInitialPrefs(false) : openInitialPrefs()}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg font-bold transition text-xs"
                >
                  {showInitialPrefs ? '閉じる' : '編集する'}
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">
                初期MMRの計算に使う「本来のメイン/サブレーン」です。希望レーンを後から変えてもここは変わりません（Rebuildの出発点が固定されます）。
                誤って凍結された人はここで直して、保存後にRebuildしてください。
              </p>
              {showInitialPrefs && (
                <div className="mt-3 space-y-3">
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-800 divide-y divide-gray-800/60">
                    {players.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-950/40">
                        <span className="flex-1 text-xs font-bold text-white truncate">{p.name}</span>
                        <select
                          value={initialDraft[p.id]?.primary || 'ALL'}
                          onChange={e => setInitialDraft(d => ({ ...d, [p.id]: { ...(d[p.id] || { primary: 'ALL', secondary: '-' }), primary: e.target.value } }))}
                          className="bg-gray-900 border border-gray-700 text-white text-xs rounded px-1.5 py-1 outline-none w-20"
                        >
                          {['TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          value={initialDraft[p.id]?.secondary || '-'}
                          onChange={e => setInitialDraft(d => ({ ...d, [p.id]: { ...(d[p.id] || { primary: 'ALL', secondary: '-' }), secondary: e.target.value } }))}
                          className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded px-1.5 py-1 outline-none w-20"
                        >
                          {['-', 'TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowInitialPrefs(false)} className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-800 text-gray-300 hover:bg-gray-700">キャンセル</button>
                    <button onClick={saveInitialPrefs} disabled={savingInitial}
                      className="px-4 py-2 rounded-lg text-xs font-black bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center gap-1.5">
                      {savingInitial && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      保存（要Rebuild）
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* バランス満足度(Discord 👍/👎)（課題#42） */}
            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-white">👍 チーム分け満足度（Discord投票）</span>
                <button
                  onClick={fetchSatStats}
                  disabled={tallyingSat}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${tallyingSat ? 'animate-spin' : ''}`} /> 集計
                </button>
              </div>
              {satStats ? (
                satStats.tallied === 0 ? (
                  <p className="text-xs text-gray-500 mt-2">まだ投票付きの試合結果がありません（試合を記録するとDiscordの結果メッセージに👍/👎が付きます）。</p>
                ) : (
                  <>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-gray-950/60 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">満足度</div>
                      <div className="text-lg font-black text-emerald-400">{satStats.satisfactionRate !== null ? `${satStats.satisfactionRate}%` : '—'}</div>
                    </div>
                    <div className="bg-gray-950/60 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">👍 / 😐 / 👎</div>
                      <div className="text-lg font-black text-white">{satStats.totalUp} / {satStats.totalNeutral ?? 0} / {satStats.totalDown}</div>
                    </div>
                    <div className="bg-gray-950/60 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">集計試合</div>
                      <div className="text-lg font-black text-white">{satStats.tallied}</div>
                    </div>
                  </div>
                  {/* 直近の試合ごとの内訳（#76: 左が最新） */}
                  {(satStats.recent && satStats.recent.length > 0) && (
                    <div className="mt-2">
                      <div className="text-[10px] text-gray-500 mb-1">直近の試合ごとの投票（左が最新）</div>
                      <div className="flex gap-1 flex-wrap">
                        {satStats.recent.map((r, i) => {
                          const votes = r.up + r.down;
                          const good = votes > 0 && r.up / votes >= 0.6;
                          const bad = votes > 0 && r.up / votes <= 0.4;
                          return (
                            <div key={i} title={`👍${r.up} 😐${r.neutral} 👎${r.down}`}
                              className={`px-2 py-1 rounded text-[9px] font-black border ${votes === 0 ? 'bg-gray-800/60 text-gray-500 border-gray-700' : good ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : bad ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-sky-500/10 text-sky-300 border-sky-500/25'}`}>
                              {votes === 0 ? '票なし' : `👍${r.up}/👎${r.down}`}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </>
                )
              ) : (
                <p className="text-xs text-gray-500 mt-2">「集計」を押すと直近の試合結果メッセージの👍/👎を集計します。</p>
              )}
            </div>
          </div>
        )}

        {/* メッセージ */}
        {message.text && (
          <div className={`p-3 rounded-lg font-bold border text-sm flex items-start justify-between gap-3 ${message.type === 'error' ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-emerald-900/30 border-emerald-800 text-emerald-400'}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type:'', text:'' })} className="flex-shrink-0 opacity-60 hover:opacity-100 transition"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* 参加者リスト */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-3 md:p-4 border-b border-gray-800 flex items-center gap-2 bg-gray-900">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
            <h2 className="text-base md:text-xl font-bold text-white">参加者リスト</h2>
            <span className="text-xs text-gray-500 font-normal hidden md:inline ml-1">
              ｜ <Crown className="inline w-3 h-3 text-amber-400" /> = 第1希望固定、<X className="inline w-3 h-3 text-indigo-400" /> = 見学固定
            </span>
          </div>

          {/* ★ 追加: フィルターUI (junglepedia風のインタラクティブなフィルタリング機能) */}
          <div className="p-3 md:p-4 bg-gray-950/60 border-b border-gray-800/80 flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* 検索入力 */}
            <div className="relative w-full lg:max-w-xs">
              <input
                type="text"
                placeholder="プレイヤーを検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
              {/* ステータスフィルター */}
              <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 text-xs">
                <button
                  onClick={() => setStatusFilter(null)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${!statusFilter ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  全員
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'active' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  参加予定
                </button>
                <button
                  onClick={() => setStatusFilter('spectator')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'spectator' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  見学のみ
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'inactive' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  不参加
                </button>
              </div>

              {/* 希望ロールフィルター */}
              <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 text-xs">
                <button
                  onClick={() => setRoleFilter(null)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${!roleFilter ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  すべてのロール
                </button>
                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                    className={`px-2.5 py-1.5 rounded-md font-bold transition flex items-center gap-1 ${roleFilter === role ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* デスクトップ：テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 bg-gray-950 border-b border-gray-800">
                <tr>
                  <th className="px-2 py-3 font-medium text-center w-28">参加設定</th>
                  <SortableHeader label="No." sortKey="no" className="w-10 text-center" />
                  <SortableHeader label="プレイヤー名" sortKey="name" className="px-2" />
                  <SortableHeader label="ランク" sortKey="highest_rank" className="px-2" />
                  <SortableHeader label="総合MMR" sortKey="mmr" className="px-2" />
                  <th className="px-2 py-3 font-medium text-center">第1希望</th>
                  <th className="px-2 py-3 font-medium text-center">第2希望</th>
                  <th className="px-1.5 py-3 font-medium text-center text-red-400">NG 1</th>
                  <th className="px-1.5 py-3 font-medium text-center text-red-400">NG 2</th>
                  <SortableHeader label="こだわり" sortKey="weight" className="px-1.5 text-center" />
                  <SortableHeader label="格上" sortKey="allow_higher" className="px-1.5 text-center" />
                  <th className="px-2 py-3 font-medium text-center">Pity (正/負/観)</th>
                  <th className="px-2 py-3 font-medium">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredPlayers.map((p, idx) => {
                  const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
                  const curGroup = getGroup(p);
                  const prevGroup = idx > 0 ? getGroup(filteredPlayers[idx - 1]) : -1;
                  const isBoundary = idx > 0 && curGroup !== prevGroup;
                  const groupLabelMap: Record<number,string> = { 0:'👑 固定メンバー', 2:'👁 観戦固定', 3:'⚫ 不参加' };
                  const groupColorMap: Record<number,string> = { 0:'text-amber-500 bg-amber-950/10', 2:'text-indigo-400 bg-indigo-950/10', 3:'text-gray-600 bg-gray-950/50' };
                  return (
                    <Fragment key={`balancer-row-${p.id}`}>
                      {isBoundary && groupLabelMap[curGroup] && (
                        <tr key={`div-${idx}`}>
                          <td colSpan={13} className={`px-4 py-1.5 text-[11px] font-bold border-t border-gray-800/80 ${groupColorMap[curGroup]}`}>
                            {groupLabelMap[curGroup]}
                          </td>
                        </tr>
                      )}
                      <tr key={p.id}
                        className={`hover:bg-gray-800/60 transition-all duration-500 ${
                          flashingPlayerIds.includes(p.id) ? 'bg-emerald-950/40 border-y border-emerald-500/50' :
                          p.is_fixed ? 'bg-amber-950/10 border-l-2 border-amber-500/70' :
                          p.is_spectator_fixed ? 'bg-indigo-950/10 border-l-2 border-indigo-600/60 opacity-70' :
                          p.is_active ? 'bg-blue-950/15 border-l-2 border-blue-500 text-gray-200' :
                          'opacity-40 hover:opacity-100'
                        }`}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 min-w-[76px] h-7 mx-auto">
                            <input type="checkbox" checked={p.is_active}
                              onChange={e => { const a = e.target.checked; handleInputChange(p.id,'is_active',a); if(!a){handleInputChange(p.id,'is_fixed',false);handleInputChange(p.id,'is_spectator_fixed',false);} }}
                              className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500/50 cursor-pointer transition-transform hover:scale-110 flex-shrink-0" title="参加/不参加" />
                            <div className={`flex items-center gap-1 transition-all duration-300 overflow-hidden ${p.is_active?'opacity-100 max-w-[50px]':'opacity-0 max-w-0 pointer-events-none'}`}>
                              <button onClick={() => { if(p.is_spectator_fixed) handleInputChange(p.id,'is_spectator_fixed',false); handleInputChange(p.id,'is_fixed',!p.is_fixed); }}
                                className={`p-0.5 rounded border transition-all ${p.is_fixed?'bg-amber-500/20 border-amber-500/40 text-amber-400':'border-gray-800 text-gray-600 hover:text-amber-500 hover:bg-amber-500/10'}`}
                                title="第1希望レーンで固定する"><Crown className="w-3 h-3" /></button>
                              <button onClick={() => { if(p.is_fixed) handleInputChange(p.id,'is_fixed',false); handleInputChange(p.id,'is_spectator_fixed',!p.is_spectator_fixed); }}
                                className={`p-0.5 rounded border transition-all ${p.is_spectator_fixed?'bg-indigo-500/20 border-indigo-500/40 text-indigo-400':'border-gray-800 text-gray-600 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
                                title="見学固定にする"><X className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold text-gray-600 text-xs">{p.no}</td>
                        <td className="px-2 py-1.5 font-bold text-white whitespace-nowrap text-xs">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setSelectedPlayer(p)} className="text-blue-400 hover:text-white p-0.5 hover:bg-gray-800 rounded transition flex-shrink-0" title="プロフィール">
                              <Info className="w-3.5 h-3.5" /></button>
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className={`px-2 py-1.5 text-xs font-semibold ${getColorFromRankName(p.highest_rank)}`}>{p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNRANKED'}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-blue-400 font-bold text-xs">{p.mmr}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded px-1 py-0.5 w-20">
                            <RoleIcon role={prefs.primary || 'ALL'} className="w-3 h-3 flex-shrink-0" />
                            <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-white outline-none cursor-pointer w-full text-[11px] font-bold">
                              {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-gray-950 text-gray-200">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded px-1 py-0.5 w-20">
                            <RoleIcon role={prefs.secondary || '-'} className="w-3 h-3 flex-shrink-0" />
                            <select value={prefs.secondary || '-'} disabled={prefs.primary === 'ALL'} onChange={e => handleInputChange(p.id,'secondary_role',e.target.value)} className="bg-transparent text-gray-300 outline-none cursor-pointer w-full text-[11px] disabled:cursor-not-allowed">
                              {['-','ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-gray-950 text-gray-200">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded px-1 py-0.5 w-16 mx-auto">
                            <RoleIcon role={p.ng_lane_1 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                            <select value={p.ng_lane_1 || ''} onChange={e => handleInputChange(p.id,'ng_lane_1',e.target.value)} className="bg-transparent text-red-400 font-bold outline-none cursor-pointer w-full text-[10px]">
                              <option value="" className="bg-gray-950 text-gray-400">なし</option>
                              {['TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-gray-950 text-red-400">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded px-1 py-0.5 w-16 mx-auto">
                            <RoleIcon role={p.ng_lane_2 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                            <select value={p.ng_lane_2 || ''} onChange={e => handleInputChange(p.id,'ng_lane_2',e.target.value)} className="bg-transparent text-red-400 font-bold outline-none cursor-pointer w-full text-[10px]">
                              <option value="" className="bg-gray-950 text-gray-400">なし</option>
                              {['TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-gray-950 text-red-400">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <select value={p.weight || 2} disabled={!isAdmin} onChange={e => handleInputChange(p.id,'weight',parseInt(e.target.value))} title={isAdmin ? '' : 'こだわり度の変更は管理者のみ可能です'} className="bg-gray-950 border border-gray-700 rounded px-1.5 py-0.5 text-amber-300 font-bold outline-none focus:border-amber-500 w-12 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                            {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <input type="checkbox" checked={!!p.allow_higher} onChange={e => handleInputChange(p.id,'allow_higher',e.target.checked)} className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-rose-500 focus:ring-rose-500/50 cursor-pointer transition-transform hover:scale-110" />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1 w-24 mx-auto">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-[10px] font-mono font-bold" title="Pity">{p.pity || 0}</span>
                            <span className="px-1.5 py-0.5 rounded bg-fuchsia-950/40 border border-fuchsia-800/40 text-fuchsia-400 text-[10px] font-mono font-bold" title="OffPity">{p.off_role_pity || 0}</span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-800/60 text-sky-400 text-[10px] font-mono font-bold" title="観戦Pity">{p.spectator_pity || 0}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={p.metadata?.notes || ''} onChange={e => handleInputChange(p.id,'notes',e.target.value)} placeholder="備考"
                            className="bg-transparent border border-transparent hover:border-gray-800 focus:border-gray-700 hover:bg-gray-900/60 focus:bg-gray-900 focus:ring-1 focus:ring-blue-500/30 rounded px-2 py-0.5 outline-none text-xs text-gray-300 w-20 transition-all" />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ★ モバイル：カードリスト */}
          <div className="md:hidden divide-y divide-gray-800/50">
            {filteredPlayers.map((p, idx) => {
              const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
              const curGroup = getGroup(p);
              const prevGroup = idx > 0 ? getGroup(filteredPlayers[idx - 1]) : -1;
              const isBoundary = idx > 0 && curGroup !== prevGroup;
              const groupLabelMap: Record<number,string> = { 0:'👑 固定メンバー', 2:'👁 観戦固定', 3:'⚫ 不参加' };
              const groupBgMap: Record<number,string> = { 0:'bg-amber-950/20 text-amber-500', 2:'bg-indigo-950/20 text-indigo-400', 3:'bg-gray-950 text-gray-600' };
              return (
                <div key={p.id}>
                  {isBoundary && groupLabelMap[curGroup] && (
                    <div className={`px-4 py-2 text-[11px] font-bold ${groupBgMap[curGroup]}`}>{groupLabelMap[curGroup]}</div>
                  )}
                  <div className={`p-3 flex items-start gap-3 transition-all ${
                    p.is_fixed ? 'bg-amber-950/10 border-l-2 border-amber-500/70' :
                    p.is_spectator_fixed ? 'bg-indigo-950/10 border-l-2 border-indigo-600/60 opacity-70' :
                    p.is_active ? 'bg-blue-950/10 border-l-2 border-blue-500' : 'opacity-40'
                  }`}>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-1">
                      <input type="checkbox" checked={p.is_active}
                        onChange={e => { const a = e.target.checked; handleInputChange(p.id,'is_active',a); if(!a){handleInputChange(p.id,'is_fixed',false);handleInputChange(p.id,'is_spectator_fixed',false);} }}
                        className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 cursor-pointer" />
                      {p.is_active && (
                        <div className="flex gap-0.5">
                          <button onClick={() => { if(p.is_spectator_fixed) handleInputChange(p.id,'is_spectator_fixed',false); handleInputChange(p.id,'is_fixed',!p.is_fixed); }}
                            className={`p-0.5 rounded border ${p.is_fixed?'bg-amber-500/20 border-amber-500/40 text-amber-400':'border-gray-700 text-gray-600'}`}><Crown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(p.is_fixed) handleInputChange(p.id,'is_fixed',false); handleInputChange(p.id,'is_spectator_fixed',!p.is_spectator_fixed); }}
                            className={`p-0.5 rounded border ${p.is_spectator_fixed?'bg-indigo-500/20 border-indigo-500/40 text-indigo-400':'border-gray-700 text-gray-600'}`}><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-sm">{p.name}</span>
                        <span className={`text-xs font-semibold ${getColorFromRankName(p.highest_rank)}`}>{p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNR'}</span>
                        <span className="font-mono text-blue-400 text-xs font-bold ml-auto">{p.mmr}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-0.5 bg-gray-950 border border-gray-800 rounded px-1.5 py-0.5">
                          <RoleIcon role={prefs.primary || 'ALL'} className="w-3 h-3" />
                          <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-white outline-none cursor-pointer text-[11px] font-bold">
                            {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-gray-950">{r}</option>)}
                          </select>
                        </div>
                        {(p.ng_lane_1 || p.ng_lane_2) && (
                          <div className="flex items-center gap-1 text-red-400 text-xs font-bold">
                            <span className="opacity-60">NG:</span>
                            {p.ng_lane_1 && <span className="bg-red-950/40 border border-red-900/50 px-1.5 rounded">{p.ng_lane_1}</span>}
                            {p.ng_lane_2 && <span className="bg-red-950/40 border border-red-900/50 px-1.5 rounded">{p.ng_lane_2}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-0.5 ml-auto">
                          <span className="px-1 py-0.5 rounded bg-emerald-950/40 text-emerald-400 text-[9px] font-mono" title="Pity">{p.pity || 0}</span>
                          <span className="px-1 py-0.5 rounded bg-fuchsia-950/40 text-fuchsia-400 text-[9px] font-mono" title="OffPity">{p.off_role_pity || 0}</span>
                          <span className="px-1 py-0.5 rounded bg-sky-950/40 text-sky-400 text-[9px] font-mono" title="観戦Pity">{p.spectator_pity || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 用語解説（折りたたみ） */}
        <details className="bg-gray-900 border border-gray-800 rounded-xl text-sm group">
          <summary className="p-4 cursor-pointer flex items-center gap-2 font-bold text-blue-400 list-none select-none">
            <Info className="h-4 w-4" /> KTM専用マッチング用語
            <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-amber-500 mb-1 block">こだわり (1～3)</span>
              <p className="text-gray-400">メインレーンをどれくらいやりたいかの度合い。1(絶対やりたい) ～ 3(どこでもいい)。</p>
            </div>
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-rose-500 mb-1 block">格上許可 (ON/OFF)</span>
              <p className="text-gray-400">自分よりMMRが高い相手と対面することを許容するかどうかの設定です。</p>
            </div>
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-emerald-500 mb-1 block">PITY (ピティ)</span>
              <p className="text-gray-400">「希望外レーン」に飛ばされた人に貯まる同情ポイント。高いほど次回優先的にメインレーンへ。</p>
            </div>
            <div className="bg-gray-950 p-4 rounded border border-gray-800">
              <span className="font-bold text-fuchsia-500 mb-1 block">OFF PITY (オフピティ)</span>
              <p className="text-gray-400">「希望レーン」を連続でやっている人に貯まるポイント。一時的に他レーンへ飛ばされる確率が上がります。</p>
            </div>
          </div>
        </details>

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}

/**
 * 対面のプレイスタイルタグの組み合わせに基づいて、動的な攻略ヒントを生成します。
 */
function generateMatchupTip(tagB: any, tagR: any, role: string): string {
  const idB = tagB.id || 'balanced';
  const idR = tagR.id || 'balanced';

  if (role === 'JG') {
    if (idB === 'early-brawler' && idR === 'speed-demon') {
      return "BLUE側は戦闘重視で序盤から動くガンク型、RED側はファーム優先の周回型。BLUE側はレーンへの早期アクションで試合を壊す必要があり、RED側は視界で相手のGankを防ぎながら周回差をつけてカウンタージャングルを狙うべきです。";
    }
    if (idB === 'speed-demon' && idR === 'early-brawler') {
      return "BLUE側は周回重視、RED側は戦闘重視のガンク型。RED側は早い段階でインベイドやレーンへの強襲を仕掛ける傾向があります。BLUE側はカウンターGank用のカバー視界を整え、ファーム速度の差で中盤以降圧倒するルートを目指しましょう。";
    }
  }

  if (idB === 'early-brawler' && idR === 'kda-safeplayer') {
    return "BLUE側は戦闘意欲が極めて高いアグレッシブ型、RED側はデスを避ける防壁型。BLUE側はタワーダイブや強引なトレードを仕掛けがちですが、RED側はそれをいなして中盤の集団戦へ繋ぎます。序盤の主導権争いが勝負の分かれ目です。";
  }
  
  if (idB === 'kda-safeplayer' && idR === 'early-brawler') {
    return "BLUE側はデスを最小限に抑える安定型、RED側は積極的に戦闘を起こす戦闘狂。RED側はジャングラーを巻き込んだ早期の仕掛けを得意とするため、BLUE側は無理なトレードをせず、ロームやタワー下でのファームで耐え切るのが最も勝率を高めます。";
  }

  if (idB === 'speed-demon' && idR === 'speed-demon') {
    return "両者ともに高いCS管理能力を持つファーム型。お互いにレーンを押し合い、ファーム差での有利形成を目指すため、ジャングラーの介入や他レーンへのロームによるテンポ破壊がこの対面を崩す鍵となります。";
  }

  // デフォルト
  return `BLUE側（${tagB.name || 'バランス型'}）とRED側（${tagR.name || 'バランス型'}）の対面です。MMRはほぼ均衡しています。自身のプレイスタイルを崩さず、味方のレーンカバーやオブジェクト周辺での視界争いを徹底することで主導権を握りましょう。`;
}

