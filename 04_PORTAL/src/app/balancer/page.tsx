"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Fragment } from "react";
import { toast } from '../../components/Toaster';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, Trees, Zap, Target, Heart, Settings, Sparkles, Coins, Copy, Check, Shuffle } from "lucide-react";
import { getColorFromRankName, calculateBlueWinProbability, getKtmRank, getRankBadgeStyle, getHighestLaneMmr } from "../../lib/mmr";
import { getPlayerTier } from "../../lib/playerTier";
import { BalancerVcManager, updateVcStatus } from "./components/BalancerVcManager";
import { BalancerBo3Manager } from "./components/BalancerBo3Manager";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Spinner } from "../../components/Feedback";
import dynamic from "next/dynamic";
import { RoleIcon, getPlayerCasinoBadges, MAX_VISIBLE_BADGES, CasinoBadges, getGroup } from "./_parts/helpers";
import { diagnoseMmrGaps, splitTables } from "../../lib/balancer/diagnosis";
import { sortPlayers, filterPlayers } from "../../lib/balancer/playerList";
import { buildFestivalResult, applyManualSwap, buildResultCopyText } from "../../lib/balancer/teams";
import { useBalancerAdminStats } from "./_parts/useBalancerAdminStats";
import BalanceResultModal from "./_parts/BalanceResultModal";
import BalancerHeader from "./_parts/BalancerHeader";
import AdminPanel from "./_parts/AdminPanel";
import GapDiagnosisPanel from "./_parts/GapDiagnosisPanel";
import TableSplitPanel from "./_parts/TableSplitPanel";
import PlayerListTable from "./_parts/PlayerListTable";
import QuickActionBar from "./_parts/QuickActionBar";

// ── 遅延読込 ───────────────────────────────────────────────────────
// いずれも「常に表示されるわけではない」ものを、必要になるまで読み込まない。
//   ProfileModal        … selectedPlayer が選ばれたときだけ表示するモーダル
//   BalancerStadiumView … balanceResult が確定したあとにだけ表示
//   AramRotationPanel   … modeTab === 'aram_rotation' のときだけ表示される専用タブ
// ⚠️ dynamic 化が効くのは「描画されるまでマウントされない」場合だけ。
//    上記3つはいずれも元から条件付き描画なので、そのまま効果が出る。
const ProfileModal = dynamic(() => import("../ktm-admin/ProfileModal"), { ssr: false });
const BalancerStadiumView = dynamic(() => import("./components/BalancerStadiumView"), { ssr: false });
const AramRotationPanel = dynamic(() => import("./AramRotationPanel"), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-xs text-faint">読み込み中…</div>,
});



export default function BalancerPage() {
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeTab, setModeTab] = useState<'standard' | 'aram_rotation'>('standard');
  const [saving, setSaving] = useState(false);
  const [savingPending, setSavingPending] = useState(false);
  const [announcingStats, setAnnouncingStats] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // ★ 管理者パネル (ktm-admin/balancerをページ分割せず、ログイン中の管理者だけに
  // MMR整合性・Rebuildなど「見たいデータ」をこの画面内で見せるための状態群)
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [rebuildingMmr, setRebuildingMmr] = useState(false);
  const {
    integrityData, checkingIntegrity, checkIntegrity,
    predStats, fetchPredStats, sideStats, fetchSideStats, satStats, tallyingSat, fetchSatStats,
  } = useBalancerAdminStats(isAdmin);

  // 🏆 BO3 (Best of 3) シリーズ管理ステート
  const [bo3State, setBo3State] = useState<{
    isActive: boolean;
    gameNumber: number; // 1, 2, 3
    team1Name: string;
    team2Name: string;
    team1Wins: number;
    team2Wins: number;
    team1IsCurrentlyBlue: boolean;
    isFinished: boolean;
    history: Array<{ game: number; winnerTeamName: string; winnerSide: 'BLUE' | 'RED' }>;
  } | null>(null);

  // BO3シリーズ開始
  const handleStartBo3 = () => {
    if (!balanceResult) return;
    const t1Name = `Team ${balanceResult.teamBlue?.[0]?.name || 'Blue'}`;
    const t2Name = `Team ${balanceResult.teamRed?.[0]?.name || 'Red'}`;
    setBo3State({
      isActive: true,
      gameNumber: 1,
      team1Name: t1Name,
      team2Name: t2Name,
      team1Wins: 0,
      team2Wins: 0,
      team1IsCurrentlyBlue: true,
      isFinished: false,
      history: []
    });
    setMessage({ type: 'success', text: `🏆 【BO3シリーズ開始】${t1Name} vs ${t2Name} の2本先取マッチがスタートしました！` });
  };

  // BO3ゲーム勝敗記録
  const handleRecordBo3Win = (side: 'BLUE' | 'RED') => {
    if (!bo3State || bo3State.isFinished) return;

    const isTeam1Winner = (side === 'BLUE' && bo3State.team1IsCurrentlyBlue) || (side === 'RED' && !bo3State.team1IsCurrentlyBlue);
    const winnerName = isTeam1Winner ? bo3State.team1Name : bo3State.team2Name;
    const nextT1Wins = isTeam1Winner ? bo3State.team1Wins + 1 : bo3State.team1Wins;
    const nextT2Wins = !isTeam1Winner ? bo3State.team2Wins + 1 : bo3State.team2Wins;
    const isSeriesFinished = nextT1Wins >= 2 || nextT2Wins >= 2;

    const newHistory = [
      ...bo3State.history,
      { game: bo3State.gameNumber, winnerTeamName: winnerName, winnerSide: side }
    ];

    setBo3State({
      ...bo3State,
      team1Wins: nextT1Wins,
      team2Wins: nextT2Wins,
      isFinished: isSeriesFinished,
      history: newHistory
    });

    if (isSeriesFinished) {
      const champion = nextT1Wins >= 2 ? bo3State.team1Name : bo3State.team2Name;
      const score = `${Math.max(nextT1Wins, nextT2Wins)} - ${Math.min(nextT1Wins, nextT2Wins)}`;
      setMessage({ type: 'success', text: `🎉 【BO3シリーズ決着】${champion} が ${score} でシリーズを制覇しました！🏆` });
      toast.success(`🎉 【BO3シリーズ決着】\n${champion} が ${score} でシリーズを制覇しました！\nDiscordへ総合リザルトを投稿できます。`);
    } else {
      setMessage({ type: 'success', text: `✅ 第${bo3State.gameNumber}戦: ${winnerName} が勝利！「第${bo3State.gameNumber + 1}戦へ（サイド交代）」を押して次戦へ進んでください。` });
    }
  };

  // BO3次戦移行（サイド交代）
  const handleNextBo3Game = () => {
    if (!bo3State || !balanceResult) return;
    if (bo3State.isFinished) return;

    // 陣営を交代
    setBalanceResult({
      ...balanceResult,
      teamBlue: balanceResult.teamRed,
      teamRed: balanceResult.teamBlue,
      teamBlueMMR: balanceResult.teamRedMMR,
      teamRedMMR: balanceResult.teamBlueMMR,
    });

    setBo3State({
      ...bo3State,
      gameNumber: bo3State.gameNumber + 1,
      team1IsCurrentlyBlue: !bo3State.team1IsCurrentlyBlue
    });

    setMessage({
      type: 'success',
      text: `🔄 【BO3 第${bo3State.gameNumber + 1}戦】サイドを交代しました！（${bo3State.gameNumber + 1 === 3 ? '🔥 1-1 運命の最終決戦！' : ''}）`
    });
  };

  // BO3リセット
  const handleResetBo3 = () => {
    if (!confirm('BO3シリーズを終了してリセットしますか？')) return;
    setBo3State(null);
    setMessage({ type: 'success', text: 'BO3シリーズを終了しました。' });
  };

  // 参加者の経験度（新規・ライト・常連・経験者・復帰勢）判定（共通ロジックに集約）
  const getPlayerExperienceBadge = (p: any) => {
    const info = getPlayerTier(p);
    return {
      tier: info.tier,
      label: info.label,
      color: info.colorClass,
      tip: info.tip,
    };
  };

  useEffect(() => {
    fetch("/api/auth/verify", { method: "POST", credentials: "include" })
      .then((res) => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false));

    // 一般ユーザー向けに最新の進行中チーム分けを自動ロード
    fetch("/api/balancer/pending")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.balanceResult) {
          setBalanceResult((prev: any) => prev || data.balanceResult);
        }
      })
      .catch(() => {});
  }, []);



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

  // 🎗️ 案E用: 実践的レーン戦ハンデ縛り設定
  const [selectedHandicaps, setSelectedHandicaps] = useState<Record<string, { role: string; targetName: string; level: number; penalty: number; rule: string; cost: number }>>({});




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
      try {
        localStorage.setItem('balancer_last_result', JSON.stringify(balanceResult));
      } catch (e) {
        console.error('Failed to cache balancer_last_result:', e);
      }
      const res = await fetch('/api/balancer/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balanceResult })
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        const pendingId = data.pendingId || data.id;
        if (pendingId) {
          router.push(`/balancer/record?pending_id=${pendingId}`);
          return;
        }
      }
      // API保存が失敗しても、localStorageフォールバックがあるので記録画面へ遷移
      router.push('/balancer/record');
    } catch (err: any) {
      console.error('Navigate error:', err);
      router.push('/balancer/record');
    } finally {
      setSavingPending(false);
    }
  };

  const handleAnnounceStats = async () => {
    const activeCount = players.filter(p => p.is_active && !p.is_spectator_fixed).length;
    if (activeCount === 0) {
      toast.info("参加予定のプレイヤーが選択されていません。");
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
      
      toast.success("📢 Discordへ現在の募集・希望レーン状況を通知しました！");
    } catch (err: any) {
      toast.error(`通知エラー: ${err.message}`);
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
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
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
  // 保存待ち（デバウンス中〜保存完了前）のプレイヤーID。Realtime購読からの更新が
  // 未保存のローカル編集を丸ごと上書きしてしまうのを防ぐためのガード。
  const dirtyPlayerIdsRef = useRef<Set<any>>(new Set());


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
              // このプレイヤーに未保存のローカル編集がある場合、DB由来のスナップショットで
              // 丸ごと上書きすると入力中のデータが消えてしまうためスキップする
              if (dirtyPlayerIdsRef.current.has(p.id)) return p;

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
      let data: any[] = [];
      try {
        const res = await fetch('/api/players/list', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.players && Array.isArray(json.players) && json.players.length > 0) {
            data = json.players;
          }
        }
      } catch (apiErr) {
        console.warn('[balancer] /api/players/list fetch failed, falling back to direct supabase:', apiErr);
      }

      if (data.length === 0) {
        const { data: sbData, error } = await supabase
          .from("ktm_players")
          .select("*")
          .order("name", { ascending: true });

        if (error) throw error;
        data = sbData || [];
      }
      
      // No順にソートして保持。ローカル用フラグ is_fixed も初期化
      const playersWithNo = (data || []).sort((a: any, b: any) => {
        const timeA = a.metadata?.joined_at ? new Date(a.metadata.joined_at).getTime() : Infinity;
        const timeB = b.metadata?.joined_at ? new Date(b.metadata.joined_at).getTime() : Infinity;
        return timeA - timeB;
      }).map((p: any, index: number) => ({
        ...p,
        name: p.name || p.ign || `Player-${index + 1}`,
        no: index + 1,
        is_fixed: false,
        is_spectator_fixed: false
      }));

      setPlayers(playersWithNo);
    } catch (err: any) {
      console.error("fetchPlayers error:", err);
      setMessage({ type: "error", text: "プレイヤーデータ読み込みエラー: " + err.message });
    } finally {
      setLoading(false);
    }
  };


  // 🔄 2戦目へのメンバー交代（1戦のみ抜け ➔ 途中参加メンバー参戦）
  const handleSwitchToMatch2 = () => {
    let singleCount = 0;
    let lateCount = 0;

    const updated = players.map(p => {
      if (p.participation_style === 'single') {
        singleCount++;
        return { ...p, is_active: false, is_fixed: false };
      }
      if (p.participation_style === 'late') {
        lateCount++;
        return { ...p, is_active: true };
      }
      return p;
    });

    setPlayers(updated);
    try {
      localStorage.setItem('balancer_active_ids', JSON.stringify(updated.filter(p => p.is_active).map(p => p.id)));
    } catch {}

    setMessage({
      type: "success",
      text: `🔄 2戦目メンバーに交代しました！（1戦のみ ${singleCount}名を待機にし、途中参加 ${lateCount}名を参加ONにしました）`
    });
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
        dirtyPlayerIdsRef.current.add(uid);
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
      const dirtyIds = dirtyPlayerIdsRef.current;
      // 編集されたプレイヤーのみを対象にする（無関係な他プレイヤーの最新設定上書きを完全防止）
      const existingPlayers = targetPlayers.filter(p => p.id && (dirtyIds.size === 0 || dirtyIds.has(p.id) || dirtyIds.has(p.discord_id)));

      if (existingPlayers.length === 0) {
        setSaving(false);
        return;
      }

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
        // 一般ユーザーは非センシティブ列のみ（名前・weightは書き込まない）。サーバーAPI経由。
        const updates = existingPlayers.map(p => ({
          id: p.id,
          role_preferences: p.role_preferences,
          is_active: p.is_active,
          ng_lane_1: p.ng_lane_1 || null,
          ng_lane_2: p.ng_lane_2 || null,
          allow_higher: p.allow_higher,
          pity: p.pity,
          off_role_pity: p.off_role_pity,
          metadata: { notes: p.metadata?.notes },
        }));
        const res = await fetch('/api/players/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '保存に失敗しました'); }
      }
      // 保存が成功したので、これらのプレイヤーはもうRealtime更新を受け取っても安全
      existingPlayers.forEach(p => dirtyPlayerIdsRef.current.delete(p.id));
      setSaving(false);
      setMessage({ type: "success", text: "✅ プレイヤー情報を更新しました。" });
    } catch (err: any) {
      setMessage({ type: "error", text: "保存エラー: " + err.message });
      setSaving(false);
    }
  };

  // BL-02: 探索強度（40=速い/100=標準/200=精密）
  const [searchDepth, setSearchDepth] = useState(100);

  // 格差診断: 参加者をMMR順に2人ずつペアにし、「近い実力の相手がいない人」を検出する。
  // チーム全体のMMR幅より「レーン対面の格差」が体験に効くため、対面を組めない外れ値を警告する。
  const GAP_THRESHOLD = 250;
  const gapDiagnosis = useMemo(() => diagnoseMmrGaps(players, GAP_THRESHOLD), [players]);

  // ハンデ参加(オフロール等)の指定。チーム分け結果とDiscord通知に明示する。
  // ハンデ参加時にチーム分けの計算上で差し引くMMR（実際の戦績・MMRは変わらない）
  const HANDICAP_MMR_PENALTY = 150;
  const [handicapIds, setHandicapIds] = useState<any[]>([]);
  const toggleHandicap = (id: any) => setHandicapIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  // チーム分け結果は名前ベースなので、ハンデ対象の「名前」集合に変換して照合する
  const handicapNames = useMemo(
    () => new Set(players.filter((p: any) => handicapIds.includes(p.id)).map((p: any) => p.name)),
    [players, handicapIds]
  );

  // 卓分割: 参加者が20人以上のとき、代表MMR順で「上位卓/下位卓」に自動分割する。
  // 卓分け=代表MMR(ktm_players.mmr)、卓の中のチーム分け=レーン別MMR、という役割分担。
  const [selectedTable, setSelectedTable] = useState<{ label: string; ids: any[] } | null>(null);
  const tableSplit = useMemo(() => splitTables(players), [players]);

  const handleBalance = async () => {
    // 卓分割(#B): 20人以上いる場合、選択中の卓のメンバーだけをチーム分け対象にする
    const allActive = players.filter((p: any) => p.is_active);
    const activePlayers = selectedTable
      ? allActive.filter((p: any) => selectedTable.ids.includes(p.id))
      : allActive;
    if (activePlayers.length < 10) {
      setMessage({ type: "error", text: `チーム分けには最低10人のActiveプレイヤーが必要です。(現在 ${activePlayers.length}人)` });
      return;
    }

    // 「⏪前回構成を復元」ボタンが参照する保存先。以前は「全員参加ON/解除」ボタンでしか
    // 書き込まれず、通常のチェックボックス操作やチーム分け実行時には一切保存されていなかった
    // ため、「前回のチーム分け時の構成」を復元しようとしても常に「見つかりません」になっていた
    // (2026-08-08発覚)。実際にチーム分けを実行するこの時点で、使ったメンバー構成を保存する。
    try { localStorage.setItem('balancer_active_ids', JSON.stringify(activePlayers.map(p => p.id))); } catch {}

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
            const customH = (p as any).customHandicap;
            return {
              name: p.name,
              isFixed: p.is_fixed || false,
              isSpectatorFixed: p.is_spectator_fixed || false,
              fixedRole: (p.is_fixed && pref1 && pref1 !== 'ALL' && pref1 !== '-') ? pref1 : null,
              // ハンデ参加: チーム分けの計算上だけMMRを下げて格差を緩和する（実際の戦績は変えない）
              handicap: handicapIds.includes(p.id) || !!customH,
              handicapMmrPenalty: customH?.mmrPenalty || (handicapIds.includes(p.id) ? HANDICAP_MMR_PENALTY : 0),
              handicapRule: customH?.rule || (handicapIds.includes(p.id) ? 'ハンデ参加' : null),
              handicappedBy: customH?.by || null,
            };
          }),
          searchDepth, // BL-02: 探索強度
          handicapPenalty: HANDICAP_MMR_PENALTY,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'チーム分けに失敗しました');
      
      let activeResult: any = null;
      if (data.proposals && Array.isArray(data.proposals) && data.proposals.length > 0) {
        setProposals(data.proposals);
        setBalanceResult(data.proposals[0]);
        activeResult = data.proposals[0];
        setSelectedProposalIdx(0);
        setAnalysis(data.analysis || null);
      } else {
        setBalanceResult(data);
        activeResult = data;
        setProposals([data]);
        setSelectedProposalIdx(0);
        setAnalysis(null);
      }
      try {
        if (activeResult) {
          localStorage.setItem('balancer_last_result', JSON.stringify(activeResult));
          // 🎲 勝敗予想（/casino）へ即時連動するため、自動で pending マッチを保存・更新
          fetch('/api/balancer/pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balanceResult: activeResult }),
          }).catch(pErr => console.warn('[balancer] Auto-save pending match failed:', pErr));
        }
      } catch (e) {
        console.error('Failed to cache balancer_last_result:', e);
      }
      // ★ 完了後に自動でモーダルを開く
      setShowResultModal(true);
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ バランス計算エラー: " + err.message });
    } finally {
      setBalancing(false);
    }
  };

  // 🎪 日曜お祭り用: 完全ランダム・闇鍋シャッフル（MMR計算なし / 公式勝敗除外）
  const handleFestivalRandomBalance = () => {
    const allActive = players.filter((p: any) => p.is_active && !p.is_spectator_fixed);
    const activePlayers = selectedTable
      ? allActive.filter(p => selectedTable.ids.includes(p.id))
      : allActive;
    if (activePlayers.length < 10) {
      setMessage({ type: "error", text: `お祭りシャッフルには最低10人のActiveプレイヤーが必要です。(現在 ${activePlayers.length}人)` });
      return;
    }

    try { localStorage.setItem('balancer_active_ids', JSON.stringify(activePlayers.map(p => p.id))); } catch {}

    const festivalResult = buildFestivalResult(activePlayers, players);

    setProposals([festivalResult]);
    setSelectedProposalIdx(0);
    setBalanceResult(festivalResult);
    setShowResultModal(true);
    setMessage({ type: "success", text: "🎉 【日曜お祭り】完全ランダムシャッフルを実行しました！（MMR変動なし）" });
  };

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
        // ハンデ参加者を通知にも明示する
        body: JSON.stringify({ ...balanceResult, handicaps: Array.from(handicapNames) })
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

  const handleCopyResultText = () => {
    if (!balanceResult) return;
    const text = buildResultCopyText(balanceResult);

    navigator.clipboard.writeText(text).then(() => {
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
      setMessage({ type: "success", text: "📋 チーム分け結果テキストをクリップボードにコピーしました！" });
    }).catch(err => {
      setMessage({ type: "error", text: "コピーに失敗しました: " + err.message });
    });
  };

  const handleSwapPlayer = (targetTeam: 'teamBlue' | 'teamRed' | 'spectators', targetRole: string, newPlayerName: string) => {
    if (!balanceResult) return;
    
    const newResult = applyManualSwap(balanceResult, players, targetTeam, targetRole, newPlayerName);
    if (!newResult) return;

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
        className="w-full bg-transparent border-none text-foreground font-bold outline-none cursor-pointer appearance-none text-center truncate"
        title={currentPlayerName || "選択"}
      >
        {(!currentPlayerName) && <option value="" className="text-foreground">選択</option>}
        {balanceResult && (
          <>
            <optgroup label="Blue Team" className="text-foreground font-bold bg-secondary-100">
              {balanceResult.teamBlue.map((p:any) => (
                <option key={`blue-${p.name}`} value={p.name} className="text-foreground bg-surface">
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Red Team" className="text-foreground font-bold bg-danger-100">
              {balanceResult.teamRed.map((p:any) => (
                <option key={`red-${p.name}`} value={p.name} className="text-foreground bg-surface">
                  {p.name}
                </option>
              ))}
            </optgroup>
            {balanceResult.spectators && balanceResult.spectators.length > 0 && (
              <optgroup label="Spectators" className="text-foreground font-bold bg-surface-hover">
                {balanceResult.spectators.map((name:string) => (
                  <option key={`spec-${name}`} value={name} className="text-foreground bg-surface">
                    {name}
                  </option>
                ))}
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
  const sortedPlayers = sortPlayers(players, sortConfig);

  // ★ フィルター適用 (名前検索、希望ロール、アクティブ状態)
  const filteredPlayers = filterPlayers(sortedPlayers, { searchQuery, roleFilter, statusFilter });

  const SortableHeader = ({ label, sortKey, className = "" }: { label: string, sortKey: string, className?: string }) => (
    <th 
      className={`px-4 py-3 font-medium cursor-pointer hover:bg-surface-subtle transition whitespace-nowrap ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1 justify-center">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-primary-700 text-xs">{sortConfig.direction === "desc" ? "↓" : "↑"}</span>
        )}
        {sortConfig.key !== sortKey && <span className="text-muted-strong text-xs">↕</span>}
      </div>
    </th>
  );

  if (loading && players.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <Spinner label="メンバーデータを読み込み中..." />
      </div>
    );
  }

  // ★ 各種カウント
  const activeCount    = players.filter(p => p.is_active && !p.is_spectator_fixed).length;
  const spectatorCount = players.filter(p => p.is_spectator_fixed).length;
  const inactiveCount  = players.filter(p => !p.is_active).length;
  const canBalance     = activeCount >= 10;

  if (modeTab === 'aram_rotation') {
    return (
      <div className="min-h-screen bg-background text-foreground-soft p-4 md:p-8 lg:p-10 max-w-[1680px] w-full mx-auto space-y-6">
        {/* 🔄 モード切り替えタブバー */}
        <div className="flex items-center gap-3 p-1.5 bg-[#2b2620]/90 border border-stone-800 rounded-2xl shadow-md w-full max-w-xl">
          <button
            type="button"
            onClick={() => setModeTab('standard')}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer text-faint hover:text-stone-200"
          >
            <Swords className="w-4 h-4" />
            <span>⚔️ 通常 5v5 バランサー</span>
          </button>

          <button
            type="button"
            onClick={() => setModeTab('aram_rotation')}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-primary-500 to-primary-600 text-stone-950 shadow-md shadow-primary-500/20"
          >
            <Shuffle className="w-4 h-4" />
            <span>🔄 大人数 ARAM ローテーション</span>
          </button>
        </div>

        <AramRotationPanel availablePlayers={players} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground-soft p-4 md:p-8 lg:p-10 max-w-[1680px] w-full mx-auto space-y-6">

      {/* 🔄 モード切り替えタブバー */}
      <div className="flex items-center gap-3 p-1.5 bg-[#2b2620]/90 border border-stone-800 rounded-2xl shadow-md w-full max-w-xl">
        <button
          type="button"
          onClick={() => setModeTab('standard')}
          className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer bg-primary-500 text-stone-950 shadow-md shadow-primary-500/20"
        >
          <Swords className="w-4 h-4" />
          <span>⚔️ 通常 5v5 バランサー</span>
        </button>

        <button
          type="button"
          onClick={() => setModeTab('aram_rotation')}
          className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer text-faint hover:text-stone-200"
        >
          <Shuffle className="w-4 h-4" />
          <span>🔄 大人数 ARAM ローテーション</span>
        </button>
      </div>

      {/* 🔰 チーム分けツールの使い方ガイド */}
      <div className="bg-primary-500/10 border border-primary-edge/60 rounded-2xl p-3.5 text-foreground shadow-xs">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full flex items-center justify-between font-bold text-xs text-primary-900 hover:text-primary-950 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <span className="font-black text-xs sm:text-sm">3秒でわかるチーム分け手順</span>
          </div>
          <span className="text-[10px] bg-primary-200/80 px-2 py-0.5 rounded-full font-black">
            {isGuideOpen ? '閉じる ▲' : '見る ▼'}
          </span>
        </button>

        {isGuideOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-primary-edge/40 text-xs text-foreground-soft space-y-1.5 leading-relaxed animate-fade-in font-bold">
            <p>① 参加するメンバーにチェックを入れる（10人〜）</p>
            <p>② 希望レーン（TOP/JG/MID/ADC/SUP）を選ぶ</p>
            <p>③ 下の「⚔️ チーム分け実行」を押すだけ！</p>
          </div>
        )}
      </div>

      {/* 👥 参加者層サマリー ＆ 🔊 Discord VC進行状況のワンクリック更新バー */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* 参加者層（新規・ライト・常連・復帰）集計サマリー */}
        {(() => {
          const activePlayers = players.filter(p => p.is_active && !p.is_spectator_fixed);
          const totalActive = activePlayers.length;
          const newPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'new');
          const lightPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'light');
          const returningPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'returning');
          const regularPlayers = activePlayers.filter(p => getPlayerExperienceBadge(p).tier === 'regular');
          const newLightRatio = totalActive > 0 ? Math.round(((newPlayers.length + lightPlayers.length + returningPlayers.length) / totalActive) * 100) : 0;

          return (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-success-500/10 via-secondary-500/5 to-transparent border border-success-edge-strong/30 flex flex-col justify-between gap-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔰</span>
                  <div>
                    <h4 className="text-xs font-black text-success-950">参加メンバーの経験層分析</h4>
                    <p className="text-[10px] text-muted">初心者・初参加の方も安心して参加できる環境です</p>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-success-500 text-stone-950">
                  新規・ライト・復帰層 {newLightRatio}%
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-success-edge-strong/20">
                <span className="inline-flex items-center gap-1 font-bold text-success-900 bg-success-100/80 px-2 py-0.5 rounded-md text-[11px]">
                  🔰 初参加: <strong>{newPlayers.length}名</strong>
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-secondary-900 bg-secondary-100/80 px-2 py-0.5 rounded-md text-[11px]">
                  🌱 ライト: <strong>{lightPlayers.length}名</strong>
                </span>
                {returningPlayers.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-primary-900 bg-primary-100/80 px-2 py-0.5 rounded-md text-[11px]">
                    ⏳ 復帰勢: <strong>{returningPlayers.length}名</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-bold text-primary-900 bg-primary-100/80 px-2 py-0.5 rounded-md text-[11px]">
                  👑 常連: <strong>{regularPlayers.length}名</strong>
                </span>
              </div>
            </div>
          );
        })()}

        {/* 🔊 Discord VCチャンネル名・進行状況の動的更新（プリセット追加・保存対応） */}
        <BalancerVcManager onMessage={setMessage} />
      </div>


      {/* ★ チーム分け結果モーダル */}
      {balanceResult && showResultModal && (
          <BalanceResultModal players={players} savingPending={savingPending} copiedResult={copiedResult} setMessage={setMessage} balanceResult={balanceResult} setBalanceResult={setBalanceResult} proposals={proposals} selectedProposalIdx={selectedProposalIdx} setSelectedProposalIdx={setSelectedProposalIdx} analysis={analysis} swapSource={swapSource} sendingDiscord={sendingDiscord} setShowResultModal={setShowResultModal} selectedTable={selectedTable} sendingProposals={sendingProposals} dragOverSlot={dragOverSlot} bo3State={bo3State} handleStartBo3={handleStartBo3} handleRecordBo3Win={handleRecordBo3Win} handleNextBo3Game={handleNextBo3Game} handleResetBo3={handleResetBo3} handleRecordNavigate={handleRecordNavigate} handleSendProposals={handleSendProposals} handleSendDiscord={handleSendDiscord} handleCopyResultText={handleCopyResultText} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDropPlayer={handleDropPlayer} handleSelectSwapPlayer={handleSelectSwapPlayer} renderSwapSelect={renderSwapSelect} handicapNames={handicapNames} />
      )}

      {/* 参加者リストの表は13列(参加設定/No./名前/ランク/MMR/希望×2/NG×2/こだわり/格上/
          Pity/備考)あり、自然な幅は約1300pxに達する。旧max-w-[1400px]では左サイドバー
          (約256px)や余白を差し引くと1440px前後の画面でも収まりきらず、常に横スクロール
          が発生していた。ワイドモニタでは表がしっかり収まるよう広げる(2026-08-15)。 */}
      <div className="max-w-[1900px] mx-auto p-3 md:p-6 space-y-4">

        {/* 🏟️ 観戦スタジアムビュー (確定した最新マッチがある場合) */}
        {balanceResult && (
          <div className="mb-2">
            <BalancerStadiumView
              result={balanceResult}
              currentUserName={currentUser?.playerName || currentUser?.displayName}
              isAdmin={isAdmin}
              onOpenAdminModal={() => setShowResultModal(true)}
            />
          </div>
        )}

        {/* ヘッダー */}
        <BalancerHeader players={players} setPlayers={setPlayers} saving={saving} announcingStats={announcingStats} isAdmin={isAdmin} setShowAdminPanel={setShowAdminPanel} integrityData={integrityData} balancing={balancing} balanceResult={balanceResult} showResultModal={showResultModal} setShowResultModal={setShowResultModal} searchDepth={searchDepth} setSearchDepth={setSearchDepth} selectedTable={selectedTable} setSelectedTable={setSelectedTable} bo3State={bo3State} handleResetBo3={handleResetBo3} handleAnnounceStats={handleAnnounceStats} handleSwitchToMatch2={handleSwitchToMatch2} handleBalance={handleBalance} handleFestivalRandomBalance={handleFestivalRandomBalance} activeCount={activeCount} spectatorCount={spectatorCount} inactiveCount={inactiveCount} canBalance={canBalance} />

        {/* ★ 管理者パネル (isAdmin時のみ・/ktm-adminへ移動せずこの画面内でMMR整合性とRebuildを確認できる) */}
        {isAdmin && showAdminPanel && (
          <AdminPanel players={players} integrityData={integrityData} checkingIntegrity={checkingIntegrity} rebuildingMmr={rebuildingMmr} predStats={predStats} showInitialPrefs={showInitialPrefs} setShowInitialPrefs={setShowInitialPrefs} initialDraft={initialDraft} setInitialDraft={setInitialDraft} savingInitial={savingInitial} sideStats={sideStats} satStats={satStats} tallyingSat={tallyingSat} checkIntegrity={checkIntegrity} fetchPredStats={fetchPredStats} openInitialPrefs={openInitialPrefs} saveInitialPrefs={saveInitialPrefs} fetchSatStats={fetchSatStats} handleRebuildMmr={handleRebuildMmr} />
        )}

        {/* 格差診断: 対面が組めない外れ値を警告し、観戦orハンデ参加を選ばせる。
            個人名を挙げる内容なので主催者(管理者)にだけ表示する。 */}
        {isAdmin && gapDiagnosis && (
          <GapDiagnosisPanel handicapIds={handicapIds} handleInputChange={handleInputChange} toggleHandicap={toggleHandicap} gapDiagnosis={gapDiagnosis} HANDICAP_MMR_PENALTY={HANDICAP_MMR_PENALTY} />
        )}

        {/* 卓分割パネル: 20人以上のとき、代表MMRで2卓に分けて提示（主催者の判断用） */}
        {isAdmin && tableSplit && (
          <TableSplitPanel selectedTable={selectedTable} setSelectedTable={setSelectedTable} tableSplit={tableSplit} />
        )}

        {/* メッセージ */}
        {message.text && (
          <div className={`p-3 rounded-lg font-bold border text-sm flex items-start justify-between gap-3 ${message.type === 'error' ? 'bg-danger-100 border-danger-edge text-danger-700' : 'bg-success-100 border-success-edge-strong text-success-700'}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type:'', text:'' })} className="flex-shrink-0 opacity-60 hover:opacity-100 transition"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* 参加者リスト */}
        <PlayerListTable isAdmin={isAdmin} searchQuery={searchQuery} setSearchQuery={setSearchQuery} roleFilter={roleFilter} setRoleFilter={setRoleFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} setSelectedPlayer={setSelectedPlayer} flashingPlayerIds={flashingPlayerIds} getPlayerExperienceBadge={getPlayerExperienceBadge} handleInputChange={handleInputChange} SortableHeader={SortableHeader} filteredPlayers={filteredPlayers} />

        {/* 用語解説（折りたたみ） */}
        <details className="bg-surface border border-border rounded-xl text-sm group">
          <summary className="p-4 cursor-pointer flex items-center gap-2 font-bold text-primary-700 list-none select-none">
            <Info className="h-4 w-4" /> KTM専用マッチング用語
            <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="bg-surface-subtle p-4 rounded border border-border">
              <span className="font-bold text-primary-700 mb-1 block">こだわり (1～3)</span>
              <p className="text-faint">メインレーンをどれくらいやりたいかの度合い。1(絶対やりたい) ～ 3(どこでもいい)。</p>
            </div>
            <div className="bg-surface-subtle p-4 rounded border border-border">
              <span className="font-bold text-danger-700 mb-1 block">格上許可 (ON/OFF)</span>
              <p className="text-faint">自分よりMMRが高い相手と対面することを許容するかどうかの設定です。</p>
            </div>
            <div className="bg-surface-subtle p-4 rounded border border-border">
              <span className="font-bold text-success-700 mb-1 block">PITY (ピティ)</span>
              <p className="text-faint">「希望外レーン」に飛ばされた人に貯まる同情ポイント。高いほど次回優先的にメインレーンへ。</p>
            </div>
            <div className="bg-surface-subtle p-4 rounded border border-border">
              <span className="font-bold text-primary-700 mb-1 block">OFF PITY (オフピティ)</span>
              <p className="text-faint">「希望レーン」を連続でやっている人に貯まるポイント。一時的に他レーンへ飛ばされる確率が上がります。</p>
            </div>
          </div>
        </details>

        {/* ★ スティッキー下部クイックアクションバー */}
        <QuickActionBar balancing={balancing} balanceResult={balanceResult} setShowResultModal={setShowResultModal} handleBalance={handleBalance} handleFestivalRandomBalance={handleFestivalRandomBalance} activeCount={activeCount} spectatorCount={spectatorCount} canBalance={canBalance} />

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}


