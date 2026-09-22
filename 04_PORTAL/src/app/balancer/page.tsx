"use client";

import { useEffect, useState, useRef, useCallback, useMemo, Fragment } from "react";
import { toast } from '../../components/Toaster';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, Trees, Zap, Target, Heart, Settings, Sparkles, Coins, Copy, Check, Shuffle } from "lucide-react";
import { getColorFromRankName, calculateBlueWinProbability, getKtmRank, getRankBadgeStyle, getHighestLaneMmr } from "../../lib/mmr";
import { BalancerVcManager, updateVcStatus } from "./components/BalancerVcManager";
import { BalancerBo3Manager } from "./components/BalancerBo3Manager";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Spinner } from "../../components/Feedback";
import dynamic from "next/dynamic";

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
  loading: () => <div className="py-10 text-center text-xs text-stone-400">読み込み中…</div>,
});


const RoleIcon = ({ role, className = "w-3.5 h-3.5" }: { role: string; className?: string }) => {
  const r = role.toUpperCase();
  switch (r) {
    case 'TOP': return <Shield className={`${className} text-orange-700`} />;
    case 'JG': return <Trees className={`${className} text-green-700`} />;
    case 'MID': return <Zap className={`${className} text-red-700`} />;
    case 'ADC': return <Target className={`${className} text-amber-700`} />;
    case 'SUP': return <Heart className={`${className} text-teal-700`} />;
    default: return null;
  }
};

// ★ カジノ特典バッジ抽出ユーティリティ（※宝くじ等の非試合アイテムは除外、同アイテムは集約表示）
function getPlayerCasinoBadges(player: any): Array<{ id: string; icon: string; label: string; count: number }> {
  const inv = (player?.inventory || player?.role_preferences?.inventory || []) as Array<{ id?: string; name?: string; icon?: string }>;
  if (!Array.isArray(inv) || inv.length === 0) return [];

  // 試合に関係のないアイテム（宝くじ等）はバランサーに表示しない。
  // ★ 2026-09-22: 以前は id の完全一致(`id !== 'lottery_ticket'`)だけで弾いていたため、
  // id が欠けている/異なる経路で付与された宝くじが素通りし、チーム分け画面に
  // 「週末メガ宝」バッジが大量に並んでプレイヤー名を画面外へ押し出していた。
  // 名前側でも判定して取りこぼさないようにする。
  const gameItems = inv.filter(item => {
    const id = String(item.id || '');
    const name = String(item.name || '');
    if (id.includes('lottery')) return false;
    if (name.includes('宝くじ')) return false;
    return true;
  });

  if (gameItems.length === 0) return [];

  // アイテムごとに集約
  const itemMap: Record<string, { id: string; icon: string; label: string; count: number }> = {};

  for (const item of gameItems) {
    // id が欠けている場合に全て同一バケットへ入れると、別アイテムなのに最初の1件の
    // 名前で一括表示されてしまうため、名前をフォールバックキーにする。
    const id = item.id || item.name || 'unknown';
    if (!itemMap[id]) {
      let label = (item.name || '').replace(/^[^\s]+\s*/, '').slice(0, 5) || 'アイテム';
      let icon = item.icon || '👑';
      if (id === 'force_champ_pick') { icon = '👑'; label = '下剋上'; }
      else if (id === 'lane_heavy_ban') { icon = '🚫'; label = '集中BAN'; }
      else if (id === 'champ_protect') { icon = '🛡️'; label = '保護'; }
      else if (id === 'force_enemy_roles') { icon = '🔀'; label = 'ロール指定'; }
      else if (id === 'all_offmeta_match') { icon = '🤡'; label = 'オフメタ'; }
      else if (id === 'side_pick') { icon = '🟦'; label = 'サイド指定'; }
      else if (id === 'bounty_target') { icon = '🎯'; label = '賞金首'; }
      else if (id === 'ban_free') { icon = '🚫'; label = 'BAN禁止'; }
      else if (id === 'all_random_match' || id === 'ultimate_bravery') { icon = '🎲'; label = 'ランダム'; }
      itemMap[id] = { id, icon, label, count: 0 };
    }
    itemMap[id].count += 1;
  }

  return Object.values(itemMap).map(b => ({
    ...b,
    label: b.count > 1 ? `${b.label}×${b.count}` : b.label
  }));
}

// チーム分け結果の1行に表示するカジノ特典バッジ。
// ★ 表示上限を設ける理由(2026-09-22): バッジは全て shrink-0 で、行内で唯一縮むのが
// プレイヤー名だったため、特典を多く持つ人がいると名前もMMRも画面外へ押し出されて
// 「誰の行か分からない」状態になっていた(実際のスクリーンショットで確認)。
// 行の主役は「誰がどのレーンでMMRいくつか」なので、バッジ側を畳む方針にする。
const MAX_VISIBLE_BADGES = 2;

function CasinoBadges({ player }: { player: any }) {
  const badges = getPlayerCasinoBadges(player);
  if (badges.length === 0) return null;

  const visible = badges.slice(0, MAX_VISIBLE_BADGES);
  const hidden = badges.slice(MAX_VISIBLE_BADGES);
  const allLabels = badges.map(b => `${b.icon}${b.label}`).join(' / ');

  return (
    <span className="flex items-center gap-1 shrink min-w-0 overflow-hidden" title={`カジノ特典: ${allLabels}`}>
      {visible.map(b => (
        <span key={b.id} className="text-[9px] bg-purple-100 border border-purple-300 text-purple-900 px-1.5 py-0.5 rounded font-black shrink-0 whitespace-nowrap">
          {b.icon}{b.label}
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="text-[9px] bg-purple-50 border border-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-black shrink-0 whitespace-nowrap">
          +{hidden.length}
        </span>
      )}
    </span>
  );
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
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [rebuildingMmr, setRebuildingMmr] = useState(false);

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

  // 参加者の経験度（新規・ライト・常連・復帰勢）判定
  const getPlayerExperienceBadge = (p: any) => {
    const totalG = p.total_games ?? p.games ?? p.metadata?.games ?? 0;
    const recent30d = p.recent_games_30d ?? (p.days_since_last_match !== null && p.days_since_last_match <= 30 ? 1 : 0);
    const daysAgo = p.days_since_last_match;

    // 1. 初参加（通算0戦）
    if (totalG === 0) {
      return { 
        tier: 'new',
        label: '🔰 初参加', 
        color: 'bg-emerald-100 text-emerald-900 border-emerald-300', 
        tip: '通算0戦：初参加のプレイヤーです！大歓迎✨' 
      };
    }
    // 2. ライト層（通算1〜4戦）
    if (totalG <= 4) {
      return { 
        tier: 'light',
        label: '🌱 ライト', 
        color: 'bg-teal-100 text-teal-900 border-teal-300', 
        tip: `通算${totalG}戦：参加経験が浅いライトプレイヤーです` 
      };
    }
    // 3. 通算5戦以上だが直近参加がない（30日以上ブランク）
    if (daysAgo !== null && daysAgo > 30) {
      if (daysAgo >= 60) {
        return { 
          tier: 'returning',
          label: '⏳ 復帰勢', 
          color: 'bg-purple-100 text-purple-900 border-purple-300', 
          tip: `通算${totalG}戦（最終参加: ${daysAgo}日前）：久しぶりの参加となる復帰プレイヤーです！大歓迎✨` 
        };
      }
      return { 
        tier: 'returning',
        label: '🎖️ 経験者', 
        color: 'bg-sky-100 text-sky-900 border-sky-300', 
        tip: `通算${totalG}戦（最終参加: ${daysAgo}日前）：久しぶりに参加の経験者プレイヤーです` 
      };
    }
    // 4. 直近も定期参加している現役常連
    return { 
      tier: 'regular',
      label: '👑 常連', 
      color: 'bg-amber-100 text-amber-900 border-amber-300', 
      tip: `通算${totalG}戦（直近30日: ${recent30d}戦）：定期的に参加しているアクティブ常連メンバーです` 
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

  // 🎗️ 案E用: 実践的レーン戦ハンデ縛り設定
  const [selectedHandicaps, setSelectedHandicaps] = useState<Record<string, { role: string; targetName: string; level: number; penalty: number; rule: string; cost: number }>>({});

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
  // 満足度は成績入力時に記録される方式になったため、Discordを叩かずDBから直接集計する。
  const fetchSatStats = async () => {
    setTallyingSat(true);
    try {
      const { data } = await supabase
        .from('balancer_predictions')
        .select('satisfaction_up, satisfaction_down')
        .not('satisfaction_updated_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      const rows = data || [];
      const totalUp = rows.filter((r: any) => r.satisfaction_up > 0).length;
      const totalDown = rows.filter((r: any) => r.satisfaction_down > 0).length;
      const totalNeutral = rows.filter((r: any) => !r.satisfaction_up && !r.satisfaction_down).length;
      const votes = totalUp + totalDown;
      setSatStats({
        tallied: rows.length,
        totalUp,
        totalDown,
        totalNeutral,
        recent: rows.slice(0, 10).map((r: any) => ({ up: r.satisfaction_up || 0, down: r.satisfaction_down || 0, neutral: (!r.satisfaction_up && !r.satisfaction_down) ? 1 : 0 })),
        satisfactionRate: votes > 0 ? Math.round((totalUp / votes) * 100) : null,
      });
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
  const gapDiagnosis = useMemo(() => {
    const act = players.filter((p: any) => p.is_active);
    if (act.length < 10) return null;
    const sorted = [...act].sort((a: any, b: any) => (b.mmr || 1200) - (a.mmr || 1200));
    const orphans: { player: any; gap: number; nearest: number }[] = [];
    for (let i = 0; i < sorted.length; i += 2) {
      const a = sorted[i], b = sorted[i + 1];
      if (!b) break; // 奇数余りは観戦候補なのでスキップ
      const gap = (a.mmr || 1200) - (b.mmr || 1200);
      if (gap > GAP_THRESHOLD) {
        // ペアの相手と離れすぎ＝この2人のどちらかが浮いている。上側を外れ値として報告
        orphans.push({ player: a, gap, nearest: b.mmr || 1200 });
      }
    }
    return orphans.length > 0 ? { orphans, spread: (sorted[0].mmr || 1200) - (sorted[sorted.length - 1].mmr || 1200) } : null;
  }, [players]);

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
  const tableSplit = useMemo(() => {
    const act = players.filter((p: any) => p.is_active);
    if (act.length < 20) return null;
    const sorted = [...act].sort((a: any, b: any) => (b.mmr || 1200) - (a.mmr || 1200));
    const half = Math.floor(sorted.length / 2);
    // 10人単位で切り出す（20人なら10/10、24人なら12人ずつではなく上位10/下位10＋残りは待機）
    const upper = sorted.slice(0, 10);
    const lower = sorted.slice(half, half + 10);
    return {
      upper: { label: '上位卓', members: upper, ids: upper.map((p: any) => p.id) },
      lower: { label: '下位卓', members: lower, ids: lower.map((p: any) => p.id) },
      total: act.length,
    };
  }, [players]);

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

    // Fisher-Yates で完全シャッフル
    const shuffled = [...activePlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
    const teamBlue = shuffled.slice(0, 5).map((p, idx) => ({
      name: p.name,
      currentRole: roles[idx],
      mainLane: p.role_preferences?.primary || 'ALL',
      subLane: p.role_preferences?.secondary || '-',
      mmr: p.mmr || 1200,
    }));
    const teamRed = shuffled.slice(5, 10).map((p, idx) => ({
      name: p.name,
      currentRole: roles[idx],
      mainLane: p.role_preferences?.primary || 'ALL',
      subLane: p.role_preferences?.secondary || '-',
      mmr: p.mmr || 1200,
    }));
    const spectators = [
      ...players.filter((p: any) => p.is_spectator_fixed).map(p => p.name),
      ...shuffled.slice(10).map(p => p.name),
    ];

    const blueMmr = teamBlue.reduce((s, p) => s + p.mmr, 0);
    const redMmr = teamRed.reduce((s, p) => s + p.mmr, 0);

    const festivalResult = {
      teamBlue,
      teamRed,
      spectators,
      teamBlueMMR: blueMmr,
      teamRedMMR: redMmr,
      totalMmrBlue: blueMmr,
      totalMmrRed: redMmr,
      mmrDiff: Math.abs(blueMmr - redMmr),
      diff: Math.abs(blueMmr - redMmr),
      predictedBlueWinProb: 0.5,
      isFestivalMode: true,
      title: '🎪 日曜お祭りカスタム（完全ランダム / MMR変動なし）'
    };

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
    const blueAvg = balanceResult.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamBlue.length || 1);
    const redAvg = balanceResult.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamRed.length || 1);
    const pBlue = calculateBlueWinProbability(blueAvg, redAvg);
    const bluePct = Math.round(pBlue * 100);
    const redPct = 100 - bluePct;

    const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
    const blueLines = roles.map(r => {
      const p = balanceResult.teamBlue.find((x: any) => x.currentRole === r);
      return p ? `  ${r.padEnd(3, ' ')}: ${p.name} (${p.mmr || 1200})` : `  ${r.padEnd(3, ' ')}: -`;
    }).join('\n');

    const redLines = roles.map(r => {
      const p = balanceResult.teamRed.find((x: any) => x.currentRole === r);
      return p ? `  ${r.padEnd(3, ' ')}: ${p.name} (${p.mmr || 1200})` : `  ${r.padEnd(3, ' ')}: -`;
    }).join('\n');

    const specText = (balanceResult.spectators && balanceResult.spectators.length > 0)
      ? `\n👀 観戦/待機: ${balanceResult.spectators.join(', ')}`
      : '';

    const text = `【KTM カスタム チーム分け結果】\n` +
      `🟦 BLUE TEAM (合計: ${balanceResult.teamBlueMMR} / 勝率予測: ${bluePct}%)\n${blueLines}\n\n` +
      `🟥 RED TEAM (合計: ${balanceResult.teamRedMMR} / 勝率予測: ${redPct}%)\n${redLines}\n\n` +
      `⚖️ MMR差: ${balanceResult.mmrDiff}${specText}`;

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

    // スワップ後の各チームMMRとBlue勝率をリアルタイム再計算
    const totalBlue = (newResult.teamBlue || []).reduce((sum: number, p: any) => sum + (Number(p.mmr) || 1200), 0);
    const totalRed = (newResult.teamRed || []).reduce((sum: number, p: any) => sum + (Number(p.mmr) || 1200), 0);
    newResult.totalMmrBlue = totalBlue;
    newResult.totalMmrRed = totalRed;
    newResult.diff = Math.abs(totalBlue - totalRed);
    newResult.predictedBlueWinProb = calculateBlueWinProbability(totalBlue, totalRed);

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
        className="w-full bg-transparent border-none text-stone-900 font-bold outline-none cursor-pointer appearance-none text-center truncate"
        title={currentPlayerName || "選択"}
      >
        {(!currentPlayerName) && <option value="" className="text-stone-900">選択</option>}
        {balanceResult && (
          <>
            <optgroup label="Blue Team" className="text-stone-900 font-bold bg-blue-100">
              {balanceResult.teamBlue.map((p:any) => (
                <option key={`blue-${p.name}`} value={p.name} className="text-stone-900 bg-white">
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Red Team" className="text-stone-900 font-bold bg-red-100">
              {balanceResult.teamRed.map((p:any) => (
                <option key={`red-${p.name}`} value={p.name} className="text-stone-900 bg-white">
                  {p.name}
                </option>
              ))}
            </optgroup>
            {balanceResult.spectators && balanceResult.spectators.length > 0 && (
              <optgroup label="Spectators" className="text-stone-900 font-bold bg-stone-200">
                {balanceResult.spectators.map((name:string) => (
                  <option key={`spec-${name}`} value={name} className="text-stone-900 bg-white">
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
    if (!p) return false;
    const pName = (p.name || p.ign || '').toLowerCase();
    const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
    if (searchQuery && !pName.includes(searchQuery.trim().toLowerCase())) {
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
      className={`px-4 py-3 font-medium cursor-pointer hover:bg-stone-100 transition whitespace-nowrap ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1 justify-center">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-amber-700 text-xs">{sortConfig.direction === "desc" ? "↓" : "↑"}</span>
        )}
        {sortConfig.key !== sortKey && <span className="text-stone-500 text-xs">↕</span>}
      </div>
    </th>
  );

  if (loading && players.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-stone-900">
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
      <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8 lg:p-10 max-w-[1680px] w-full mx-auto space-y-6">
        {/* 🔄 モード切り替えタブバー */}
        <div className="flex items-center gap-3 p-1.5 bg-[#2b2620]/90 border border-stone-800 rounded-2xl shadow-md w-full max-w-xl">
          <button
            type="button"
            onClick={() => setModeTab('standard')}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer text-stone-400 hover:text-stone-200"
          >
            <Swords className="w-4 h-4" />
            <span>⚔️ 通常 5v5 バランサー</span>
          </button>

          <button
            type="button"
            onClick={() => setModeTab('aram_rotation')}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-md shadow-amber-500/20"
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
    <div className="min-h-screen bg-background text-stone-800 p-4 md:p-8 lg:p-10 max-w-[1680px] w-full mx-auto space-y-6">

      {/* 🔄 モード切り替えタブバー */}
      <div className="flex items-center gap-3 p-1.5 bg-[#2b2620]/90 border border-stone-800 rounded-2xl shadow-md w-full max-w-xl">
        <button
          type="button"
          onClick={() => setModeTab('standard')}
          className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
        >
          <Swords className="w-4 h-4" />
          <span>⚔️ 通常 5v5 バランサー</span>
        </button>

        <button
          type="button"
          onClick={() => setModeTab('aram_rotation')}
          className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer text-stone-400 hover:text-stone-200"
        >
          <Shuffle className="w-4 h-4" />
          <span>🔄 大人数 ARAM ローテーション</span>
        </button>
      </div>

      {/* 🔰 チーム分けツールの使い方ガイド */}
      <div className="bg-amber-500/10 border border-amber-300/60 rounded-2xl p-3.5 text-stone-900 shadow-xs">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full flex items-center justify-between font-bold text-xs text-amber-900 hover:text-amber-950 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <span className="font-black text-xs sm:text-sm">3秒でわかるチーム分け手順</span>
          </div>
          <span className="text-[10px] bg-amber-200/80 px-2 py-0.5 rounded-full font-black">
            {isGuideOpen ? '閉じる ▲' : '見る ▼'}
          </span>
        </button>

        {isGuideOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-300/40 text-xs text-stone-800 space-y-1.5 leading-relaxed animate-fade-in font-bold">
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
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 flex flex-col justify-between gap-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔰</span>
                  <div>
                    <h4 className="text-xs font-black text-emerald-950">参加メンバーの経験層分析</h4>
                    <p className="text-[10px] text-stone-600">初心者・初参加の方も安心して参加できる環境です</p>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-stone-950">
                  新規・ライト・復帰層 {newLightRatio}%
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-emerald-500/20">
                <span className="inline-flex items-center gap-1 font-bold text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-md text-[11px]">
                  🔰 初参加: <strong>{newPlayers.length}名</strong>
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded-md text-[11px]">
                  🌱 ライト: <strong>{lightPlayers.length}名</strong>
                </span>
                {returningPlayers.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded-md text-[11px]">
                    ⏳ 復帰勢: <strong>{returningPlayers.length}名</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md text-[11px]">
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
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-2 md:p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setShowResultModal(false); }}
        >
          <div className="bg-white border border-stone-300 rounded-2xl w-full max-w-4xl shadow-2xl my-4">
            {/* モーダルヘッダー */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-stone-200 px-4 md:px-6 py-3 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-stone-900 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-700" />
                  マッチング結果
                  <span className="hidden md:inline text-xs font-mono text-stone-500 ml-2">MMR差: <span className="text-stone-900 font-bold">{balanceResult.mmrDiff}</span></span>
                </h2>
                {/* ピック形式バッジ */}
                {(() => {
                  if (balanceResult.isFestivalMode) {
                    return (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 shadow-xs">
                        🎪 ピック形式: <strong>日曜お祭り (完全ランダム / MMRなし)</strong>
                      </span>
                    );
                  }
                  const avgMMR = ((balanceResult.teamBlueMMR || 0) + (balanceResult.teamRedMMR || 0)) / 10;
                  const isSilverTier = avgMMR < 1350 || selectedTable?.label?.includes('シルバー');
                  return isSilverTier ? (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 flex items-center gap-1 shadow-xs">
                      🔲 ピック形式: <strong>ブラインドピック (MMRあり)</strong>
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs">
                      ⚔️ ピック形式: <strong>ドラフトピック (MMRあり)</strong>
                    </span>
                  );
                })()}
              </div>
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
                <button
                  type="button"
                  onClick={async () => {
                    const res = await updateVcStatus('game1');
                    if (res.success) {
                      setMessage({ type: 'success', text: `🔊 ${res.message}` });
                      toast.info(`🔊 ${res.message}`);
                    } else {
                      toast.error(`VC更新エラー: ${res.error}`);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-bold transition text-xs md:text-sm cursor-pointer"
                  title="DiscordのVCチャンネル名を「1戦目進行中・途中交代歓迎」に更新"
                >
                  <span>🔊 VC更新 (1戦目)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyResultText}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 px-3 py-1.5 rounded-lg font-bold transition text-xs md:text-sm cursor-pointer"
                  title="チャットやメモに貼り付け可能な整形テキストをコピー"
                >
                  {copiedResult ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-stone-600" />}
                  <span>{copiedResult ? 'コピー完了！' : 'テキストコピー'}</span>
                </button>
                <button onClick={() => setShowResultModal(false)}
                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-900 transition" title="閉じる (ESC)">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {/* 環境分析 */}
              {analysis && (
                <div className={`p-3 rounded-xl border text-sm flex flex-col gap-2 ${analysis.level === 'HIGH_DIFFERENCE' ? 'bg-amber-100 border-amber-200 text-amber-700' : analysis.level === 'CLOSE' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-orange-100 border-orange-200 text-orange-700'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    {analysis.level === 'HIGH_DIFFERENCE' ? <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" /> : <Globe className="h-4 w-4 text-emerald-700 shrink-0" />}
                    <span>本日のカスタム環境:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-black ${analysis.level === 'HIGH_DIFFERENCE' ? 'bg-amber-800 text-amber-100' : analysis.level === 'CLOSE' ? 'bg-emerald-800 text-emerald-100' : 'bg-orange-800 text-orange-100'}`}>
                      {analysis.level === 'HIGH_DIFFERENCE' ? '格差大' : analysis.level === 'CLOSE' ? '実力拮抗' : '標準的'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{analysis.message}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
                    <span>KTM平均MMR: <strong className="text-stone-900 font-mono">{analysis.averageMMR}</strong></span>
                    <span>最低: <strong className="text-stone-900 font-mono">{analysis.minMMR}</strong></span>
                    <span>最高: <strong className="text-stone-900 font-mono">{analysis.maxMMR}</strong></span>
                    <span>差: <strong className={`font-mono ${analysis.level === 'HIGH_DIFFERENCE' ? 'text-amber-700' : 'text-stone-900'}`}>{analysis.mmrRange}</strong></span>
                    <span className="text-[10px] text-stone-500 font-normal">※SoloQではなくKTM内戦独自のランクMMR基準です</span>
                  </div>
                </div>
              )}

              {/* 勝利予想（#79）: リッチなグラデーション予測ゲージメーター */}
              {(() => {
                const blueAvg = balanceResult.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamBlue.length || 1);
                const redAvg = balanceResult.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamRed.length || 1);
                const pBlue = calculateBlueWinProbability(blueAvg, redAvg);
                const bluePct = Math.round(pBlue * 100);
                const redPct = 100 - bluePct;
                const mmrDiff = Math.abs(balanceResult.teamBlueMMR - balanceResult.teamRedMMR);
                const isCloseMatch = mmrDiff <= 50;

                return (
                  <div className="p-4 rounded-2xl border border-stone-200 bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-stone-900">🔮 Elo勝率予測 ＆ 接戦度診断</span>
                        {isCloseMatch ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            🔥 超接戦（名勝負の予感！）
                          </span>
                        ) : mmrDiff <= 120 ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            ⚔️ 互角（実力拮抗）
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300">
                            ⚖️ やや戦力差あり (差: {mmrDiff} MMR)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-500 font-bold">50%に近いほど理想的なバランス</span>
                    </div>

                    {/* ゲージバー */}
                    <div className="flex items-center gap-3">
                      <div className="text-right w-24 shrink-0">
                        <span className="text-xs font-extrabold text-blue-700 block">🟦 BLUE TEAM</span>
                        <strong className="text-base font-black text-blue-900 font-mono">{bluePct}%</strong>
                      </div>
                      <div className="flex-1 h-4 rounded-full overflow-hidden bg-stone-100 p-0.5 border border-stone-200 flex shadow-inner">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-l-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
                          style={{ width: `${bluePct}%` }}
                        >
                          {bluePct >= 20 ? `${bluePct}%` : ''}
                        </div>
                        <div
                          className="bg-gradient-to-l from-rose-600 to-pink-500 rounded-r-full transition-all duration-700 flex items-center justify-center text-[9px] text-white font-black"
                          style={{ width: `${redPct}%` }}
                        >
                          {redPct >= 20 ? `${redPct}%` : ''}
                        </div>
                      </div>
                      <div className="text-left w-24 shrink-0">
                        <span className="text-xs font-extrabold text-rose-700 block">🟥 RED TEAM</span>
                        <strong className="text-base font-black text-rose-900 font-mono">{redPct}%</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 案タブ */}
              {proposals.length > 1 && (
                <div className="flex border-b border-stone-200 gap-2 overflow-x-auto pb-1">
                  {proposals.map((prop, idx) => (
                    <button key={prop.id || idx} onClick={() => { setBalanceResult(prop); setSelectedProposalIdx(idx); }}
                      className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap ${selectedProposalIdx === idx ? 'border-amber-500 text-amber-700 font-black' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
                      {prop.title || `案${prop.id || idx}`}
                      {prop.id === 'E' && <span className="ml-1 text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full">🎗️ルール設定</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* 🎗️ 案E選択時: 実践的レーン戦ハンデ縛り ＆ 再微調整パネル */}
              {balanceResult.id === 'E' && (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎗️</span>
                      <div>
                        <h3 className="text-xs font-black text-amber-950">案E：実践的レーン戦ハンデ縛り設定 ＆ 再微調整</h3>
                        <p className="text-[11px] text-amber-800">不利対面（2ランク格差等）の格上プレイヤーに縛りルールを設定し、戦力を完全に均等化します。</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-xs">
                    {/* Lv.1 */}
                    <div className="p-3 rounded-xl bg-white border border-amber-200 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-amber-900 text-xs">Lv.1 軽度ハンデ</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">実効MMR -150</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        ▫ <strong>フラッシュ禁止</strong>（ゴースト/TP強制）<br />
                        ▫ <strong>序盤5分間リコール禁止</strong>
                      </p>
                      <div className="text-[10px] text-amber-700 font-bold">消費: 300 コイン</div>
                    </div>

                    {/* Lv.2 */}
                    <div className="p-3 rounded-xl bg-white border-2 border-amber-400 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-amber-950 text-xs">Lv.2 中度ハンデ</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-white">実効MMR -300 (1ランク差)</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        ▫ <strong>ポーション購入禁止</strong>（回復封じ）<br />
                        ▫ <strong>メインチャンプBAN＆セカンド強制</strong>
                      </p>
                      <div className="text-[10px] text-amber-700 font-bold">消費: 600 コイン</div>
                    </div>

                    {/* Lv.3 */}
                    <div className="p-3 rounded-xl bg-white border border-amber-200 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-amber-900 text-xs">Lv.3 重度ハンデ</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">実効MMR -500 (完全互角)</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        ▫ <strong>初手『女神の涙』スタート縛り</strong><br />
                        ▫ <strong>スキル1つ（Ult除く）使用禁止</strong>
                      </p>
                      <div className="text-[10px] text-amber-700 font-bold">消費: 1,200 コイン</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
                    <span className="text-[11px] text-amber-900 font-bold">
                      ※この設定で推定MMRが再計算され、対面格差がピタッと埋まります。
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // 案Eの再微調整を実行: 格上プレイヤーの実効MMRを補正して再描画
                        const updatedBlue = balanceResult.teamBlue.map((p: any) => {
                          const penalty = handicapNames.has(p.name) ? 300 : 0;
                          return { ...p, mmr: Math.max(100, p.mmr - penalty) };
                        });
                        const updatedRed = balanceResult.teamRed.map((p: any) => {
                          const penalty = handicapNames.has(p.name) ? 300 : 0;
                          return { ...p, mmr: Math.max(100, p.mmr - penalty) };
                        });
                        const newBlueMMR = updatedBlue.reduce((s: number, p: any) => s + p.mmr, 0);
                        const newRedMMR = updatedRed.reduce((s: number, p: any) => s + p.mmr, 0);
                        const updatedRes = {
                          ...balanceResult,
                          teamBlue: updatedBlue,
                          teamRed: updatedRed,
                          teamBlueMMR: newBlueMMR,
                          teamRedMMR: newRedMMR,
                          mmrDiff: Math.abs(newBlueMMR - newRedMMR),
                        };
                        setBalanceResult(updatedRes);
                        toast.success("⚡ 【案E微調整完了】 ハンデ補正（実効MMR -300）を適用し、対面格差と勝率予想を再計算しました！");
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles size={14} />
                      推定MMRを反映してチーム分けを微調整する
                    </button>
                  </div>
                </div>
              )}

              {/* チーム表示 */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center border-b border-stone-200 pb-3">
                  <div className="col-span-5 bg-gradient-to-r from-blue-100 to-transparent p-3 rounded-xl border-l-4 border-blue-500 flex justify-between items-center">
                    <span className="text-base font-black text-blue-700">BLUE TEAM</span>
                    <span className="text-xs font-mono font-bold text-blue-600">合計MMR: {balanceResult.teamBlueMMR}</span>
                  </div>
                  <div className="col-span-1 flex justify-center text-stone-500 font-black">VS</div>
                  <div className="col-span-5 bg-gradient-to-l from-red-100 to-transparent p-3 rounded-xl border-r-4 border-red-500 flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-red-600">合計MMR: {balanceResult.teamRedMMR}</span>
                    <span className="text-base font-black text-red-700">RED TEAM</span>
                  </div>
                </div>
                {['TOP','JG','MID','ADC','SUP'].map(role => {
                  const pB = balanceResult.teamBlue.find((x: any) => x.currentRole === role);
                  const pR = balanceResult.teamRed.find((x: any) => x.currentRole === role);
                  const pBData = players.find((p: any) => p.name === pB?.name);
                  const pRData = players.find((p: any) => p.name === pR?.name);
                  const offB = pB && pB.mainLane !== 'ALL' && pB.mainLane !== '-' && pB.currentRole !== pB.mainLane;
                  const offR = pR && pR.mainLane !== 'ALL' && pR.mainLane !== '-' && pR.currentRole !== pR.mainLane;
                  const bKey = `teamBlue-${role}`, rKey = `teamRed-${role}`;
                  const bMMR = pB?.mmr || 1200, rMMR = pR?.mmr || 1200, diff = bMMR - rMMR;
                  return (
                    <div key={role} className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center bg-black/[0.03] p-2 md:p-3 rounded-2xl border border-black/5">
                      <div draggable={!!pB?.name} onDragStart={e => handleDragStart(e,'teamBlue',role,pB?.name||'')} onDragOver={e => handleDragOver(e,bKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'teamBlue',role)}
                        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${dragOverSlot===bKey?'border-blue-500 bg-blue-100 border-dashed':'bg-blue-50 border-blue-200 hover:bg-blue-100'} ${swapSource?.name === pB?.name ? 'border-amber-500 bg-amber-100 animate-pulse' : ''}`}>
                        {/* 名前は行の主役なので、バッジがいくつ増えても潰れないよう最低幅を確保する */}
                        <div className="flex-1 min-w-[5.5rem]">{renderSwapSelect('teamBlue',role,pB?.name||'')}</div>
                        {pB?.name && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('teamBlue', role, pB.name); }}
                            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === pB.name ? 'bg-amber-500 text-black' : 'text-blue-700 hover:text-stone-900 hover:bg-blue-200'}`}
                            title="タップして入れ替え"
                          >
                            ⇄
                          </button>
                        )}
                        {offB && <span className="text-[9px] bg-red-100 border border-red-300 text-red-700 px-1.5 py-0.5 rounded font-black shrink-0">⚠️OFF</span>}
                        {pB?.name && handicapNames.has(pB.name) && <span className="text-[9px] bg-amber-100 border border-amber-300 text-amber-700 px-1.5 py-0.5 rounded font-black shrink-0" title="ハンデ参加（オフロール等の制約付き）">🎗️ハンデ</span>}
                        <CasinoBadges player={pBData} />
                        {pB?.name && (pB.mainLane !== 'ALL' || pB.subLane !== 'ALL') && (
                          <span className="text-[9px] bg-black/5 border border-black/10 text-stone-500 px-1.5 py-0.5 rounded font-bold shrink-0" title="第一希望／第二希望レーン">
                            {pB.mainLane !== 'ALL' && pB.mainLane !== '-' ? pB.mainLane : '指定無'}
                            {pB.subLane !== 'ALL' && pB.subLane !== '-' ? `/${pB.subLane}` : ''}
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold text-blue-700 shrink-0 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">{bMMR}</span>
                      </div>
                      <div className="col-span-1 flex flex-col items-center py-1">
                        <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shadow-lg"><RoleIcon role={role} className="w-4 h-4" /></div>
                        <span className={`text-[10px] font-mono mt-1 font-extrabold ${diff>0?'text-blue-700':diff<0?'text-red-700':'text-stone-500'}`}>{diff>0?`+${diff}`:diff<0?diff:'±0'}</span>
                      </div>
                      <div draggable={!!pR?.name} onDragStart={e => handleDragStart(e,'teamRed',role,pR?.name||'')} onDragOver={e => handleDragOver(e,rKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'teamRed',role)}
                        className={`col-span-5 flex items-center gap-2 p-2 rounded-xl border transition cursor-grab active:cursor-grabbing ${dragOverSlot===rKey?'border-red-500 bg-red-100 border-dashed':'bg-red-50 border-red-200 hover:bg-red-100'} ${swapSource?.name === pR?.name ? 'border-amber-500 bg-amber-100 animate-pulse' : ''}`}>
                        <span className="font-mono text-xs font-bold text-red-700 shrink-0 bg-red-100 px-2 py-0.5 rounded border border-red-300">{rMMR}</span>
                        {offR && <span className="text-[9px] bg-red-100 border border-red-300 text-red-700 px-1.5 py-0.5 rounded font-black shrink-0">⚠️OFF</span>}
                        {pR?.name && handicapNames.has(pR.name) && <span className="text-[9px] bg-amber-100 border border-amber-300 text-amber-700 px-1.5 py-0.5 rounded font-black shrink-0" title="ハンデ参加（オフロール等の制約付き）">🎗️ハンデ</span>}
                        <CasinoBadges player={pRData} />
                        {pR?.name && (pR.mainLane !== 'ALL' || pR.subLane !== 'ALL') && (
                          <span className="text-[9px] bg-black/5 border border-black/10 text-stone-500 px-1.5 py-0.5 rounded font-bold shrink-0" title="第一希望／第二希望レーン">
                            {pR.mainLane !== 'ALL' && pR.mainLane !== '-' ? pR.mainLane : '指定無'}
                            {pR.subLane !== 'ALL' && pR.subLane !== '-' ? `/${pR.subLane}` : ''}
                          </span>
                        )}
                        {pR?.name && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('teamRed', role, pR.name); }}
                            className={`p-1 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === pR.name ? 'bg-amber-500 text-black' : 'text-red-700 hover:text-stone-900 hover:bg-red-200'}`}
                            title="タップして入れ替え"
                          >
                            ⇄
                          </button>
                        )}
                        {/* 名前は行の主役なので、バッジがいくつ増えても潰れないよう最低幅を確保する */}
                        <div className="flex-1 min-w-[5.5rem]">{renderSwapSelect('teamRed',role,pR?.name||'')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AIレポート */}
              {balanceResult.balanceReport && (
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-300/80 rounded-2xl shadow-2xs space-y-2">
                  <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-600" />
                    <span>AIバランス分析 ＆ 勝敗予想レポート</span>
                  </h3>
                  <div className="text-xs text-stone-800 leading-relaxed font-sans space-y-1.5 bg-white/80 p-3.5 rounded-xl border border-amber-200/60">
                    {(Array.isArray(balanceResult.balanceReport)
                      ? balanceResult.balanceReport
                      : [balanceResult.balanceReport]
                    ).map((line: string, i: number) => {
                      if (!line) return <div key={i} className="h-1" />;
                      // **太字** や `コード` の簡易リッチテキスト変換
                      const formatted = line
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-amber-950">$1</strong>')
                        .replace(/`(.*?)`/g, '<code class="bg-amber-100 text-amber-900 font-mono px-1 py-0.5 rounded text-[11px] font-bold border border-amber-200">$1</code>');
                      return (
                        <div
                          key={i}
                          dangerouslySetInnerHTML={{ __html: formatted }}
                          className="leading-relaxed"
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 観戦 */}
              {balanceResult.spectators && balanceResult.spectators.length > 0 && (
                <div className="pt-3 border-t border-stone-200">
                  <h3 className="text-xs font-bold text-stone-500 mb-2 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> 観戦 / 待機メンバー</h3>
                  <div className="flex flex-wrap gap-2">
                    {balanceResult.spectators.map((name: string, index: number) => {
                      const slotKey = `spectators-${index}`;
                      const specP = players.find((p: any) => p.name === name);
                      const specMmr = specP?.mmr || 1200;
                      return (
                        <div key={`spec-${index}`} draggable onDragStart={e => handleDragStart(e,'spectators',index.toString(),name)} onDragOver={e => handleDragOver(e,slotKey)} onDragLeave={handleDragLeave} onDrop={e => handleDropPlayer(e,'spectators',index.toString())}
                          className={`border rounded px-2.5 py-1.5 min-w-[140px] flex items-center justify-between gap-1.5 transition cursor-grab ${dragOverSlot===slotKey?'border-orange-400 bg-orange-100 border-dashed':'bg-stone-100 border-stone-200 hover:bg-stone-100'} ${swapSource?.name === name ? 'border-amber-500 bg-amber-100 animate-pulse' : ''}`}>
                          <div className="flex-1 min-w-0">{renderSwapSelect('spectators',index.toString(),name)}</div>
                          <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0" title="KTM代表MMR">
                            {specMmr}
                          </span>
                          {name && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectSwapPlayer('spectators', index.toString(), name); }}
                              className={`p-0.5 rounded transition-colors text-xs font-black shrink-0 ${swapSource?.name === name ? 'bg-amber-500 text-black' : 'text-orange-700 hover:text-stone-900 hover:bg-stone-100'}`}
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

              {/* 🏆 BO3 シリーズスコアボード (アクティブ時) */}
              <BalancerBo3Manager
                bo3State={bo3State}
                onStartBo3={handleStartBo3}
                onRecordBo3Win={handleRecordBo3Win}
                onNextBo3Game={handleNextBo3Game}
                onResetBo3={handleResetBo3}
              />


              {/* 試合結果記録 & BO3 / ドラフトシミュレータ直結 */}
              <div className="pt-3 border-t border-stone-200 space-y-2">
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    onClick={handleRecordNavigate}
                    disabled={savingPending}
                    type="button"
                    className="flex-1 min-w-[200px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-5 py-3 rounded-xl font-black transition flex items-center justify-center gap-2 shadow-lg cursor-pointer text-xs sm:text-sm"
                  >
                    <Trophy className="h-4 w-4" />
                    {savingPending ? '一時保存中...' : 'この編成で試合結果を記録 🏆'}
                  </button>

                  {!bo3State && (
                    <button
                      type="button"
                      onClick={handleStartBo3}
                      className="bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 px-4 py-3 rounded-xl font-black transition flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm shadow-xs"
                      title="このチーム編成のままBO3（2本先取）マッチを開始します"
                    >
                      <Trophy className="h-4 w-4 text-amber-700" />
                      🏆 BO3シリーズ開始 (2本先取)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!balanceResult) return;
                      setBalanceResult({
                        ...balanceResult,
                        teamBlue: balanceResult.teamRed,
                        teamRed: balanceResult.teamBlue,
                        teamBlueMMR: balanceResult.teamRedMMR,
                        teamRedMMR: balanceResult.teamBlueMMR,
                      });
                      setMessage({ type: 'success', text: '🔄 BLUE ⇄ RED の陣営を入れ替えました！' });
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs sm:text-sm"
                    title="BLUEとREDの陣営を丸ごと入れ替えます"
                  >
                    <Shuffle className="h-4 w-4 text-indigo-600" />
                    サイド交代 (BLUE ⇄ RED)
                  </button>

                  <Link
                    href="/coach?tab=live"
                    className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-black transition flex items-center justify-center gap-2 shadow-lg cursor-pointer text-xs sm:text-sm"
                    title="コーチ画面の5v5シミュレータ・勝ち筋診断へ直結"
                  >
                    <Sparkles className="h-4 w-4" />
                    5v5ドラフト診断 🎯
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
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
        <div className="flex flex-col gap-3 border-b border-stone-200 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-stone-900 flex items-center gap-2">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-amber-700" /> チーム分けバランサー
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {saving && <span className="flex items-center gap-1 text-amber-700 text-xs"><RefreshCw className="h-3 w-3 animate-spin" /> 保存中...</span>}
              <Link href="/ktm-admin?tab=history" className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-orange-700 px-3 py-1.5 rounded-lg font-bold transition text-xs border border-orange-200 whitespace-nowrap shrink-0">
                <History className="h-3.5 w-3.5" /> 過去の試合
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(v => !v)}
                  title="管理者専用操作"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs border whitespace-nowrap shrink-0 ${
                    integrityData?.hasDiscrepancy
                      ? 'bg-rose-100 hover:bg-rose-100 border-rose-200 text-rose-700'
                      : 'bg-amber-100 hover:bg-amber-100 border-amber-200 text-amber-700'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" /> 管理者パネル
                  {integrityData?.hasDiscrepancy && (
                    <span className="bg-rose-500 text-white rounded-full px-1.5 text-[10px] font-black">{integrityData.discrepancyCount}</span>
                  )}
                </button>
              )}
              <Link href="/ktm-admin" prefetch={false} className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 px-3 py-1.5 rounded-lg font-bold transition text-xs whitespace-nowrap shrink-0">
                <Shield className="h-3.5 w-3.5" /> {isAdmin ? '詳細管理へ' : '管理者 🔑'}
              </Link>
              <button
                onClick={handleAnnounceStats}
                disabled={announcingStats}
                className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-100 border border-orange-200 text-orange-700 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {announcingStats ? '通知中...' : '募集状況を通知 📢'}
              </button>
            </div>
          </div>

          {/* ★ リアルタイム参加者バッジ */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${
              canBalance ? 'bg-emerald-100 border-emerald-300/60 text-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-amber-100 border-amber-300/60 text-amber-700'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${canBalance ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
              <span className="text-xs">参加</span>
              <span className={`text-2xl font-black leading-none ${canBalance ? 'text-emerald-700' : 'text-amber-700'}`}>{activeCount}</span>
              <span className="text-xs opacity-60">人</span>
              {canBalance ? (
                <span className="text-xs text-emerald-700 font-black border-l border-emerald-300 pl-2">✅ 準備完了！</span>
              ) : (
                <span className="text-xs text-amber-700 font-bold border-l border-amber-300 pl-2">あと {10 - activeCount} 人必要</span>
              )}
            </div>
            {spectatorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-100 text-amber-700 font-bold text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-xs">観戦</span>
                <span className="text-xl font-black text-amber-700">{spectatorCount}</span>
                <span className="text-xs opacity-60">人</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 bg-black/[0.03] text-stone-500 font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-stone-600"></span>
              <span className="text-xs">不参加</span>
              <span className="text-xl font-black text-stone-400">{inactiveCount}</span>
              <span className="text-xs opacity-60">人</span>
            </div>

            {/* 🏆 BO3 シリーズ進行状況バナー (アクティブ時) */}
            {bo3State && (
              <div className="w-full flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-2 border-amber-500/40 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xl">🏆</span>
                  <span className="text-xs font-black text-amber-950">
                    BO3 シリーズ進行中 [第{bo3State.gameNumber}戦]
                  </span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300">
                    🔵 {bo3State.team1IsCurrentlyBlue ? bo3State.team1Name : bo3State.team2Name}: {bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins}勝
                  </span>
                  <span className="text-xs font-black text-stone-500">VS</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300">
                    🔴 {!bo3State.team1IsCurrentlyBlue ? bo3State.team1Name : bo3State.team2Name}: {!bo3State.team1IsCurrentlyBlue ? bo3State.team1Wins : bo3State.team2Wins}勝
                  </span>
                  {bo3State.gameNumber === 3 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                      🔥 1-1 最終決戦！
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResultModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <span>スコアボードを開く 📊</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBo3}
                    className="text-[11px] font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
                  >
                    終了
                  </button>
                </div>
              </div>
            )}

            {/* 📢 KTMカスタム新方針・ルール案内チップ */}
            <div className="w-full flex flex-wrap items-center gap-2 text-xs bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-amber-950">
              <span className="font-black flex items-center gap-1 text-amber-900">
                <Info className="h-3.5 w-3.5 text-amber-700" />
                カスタム方針:
              </span>
              <span className="bg-white border border-amber-300/60 px-2 py-0.5 rounded-md font-bold text-[11px] text-cyan-900">
                🛡️ シルバー以下: <strong>ブラインドピック (MMRあり)</strong>
              </span>
              <span className="bg-white border border-amber-300/60 px-2 py-0.5 rounded-md font-bold text-[11px] text-amber-900">
                👑 ゴルプラ: <strong>ドラフトピック (MMRあり)</strong>
              </span>
              {/* スタイル別集計チップ */}
              <div className="flex items-center gap-1.5 ml-auto text-[11px] font-bold">
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md">
                  🟢 フル: {players.filter(p => p.participation_style === 'full').length}名
                </span>
                <span className="bg-cyan-100 text-cyan-800 border border-cyan-300 px-2 py-0.5 rounded-md">
                  ⏱️ 1戦のみ: {players.filter(p => p.participation_style === 'single').length}名
                </span>
                <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-md">
                  🌙 途中参加: {players.filter(p => p.participation_style === 'late').length}名
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {/* 🔄 2戦目移行ボタン */}
              <button
                type="button"
                onClick={handleSwitchToMatch2}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xs transition flex items-center gap-1"
                title="1戦のみのメンバーを待機にし、途中参加メンバーを参加ONに一括交代します"
              >
                🔄 2戦目メンバーへ交代
              </button>

              {/* 一括参加切り替えボタン */}
              <button
                type="button"
                onClick={() => {
                  const updated = players.map(p => p.is_spectator_fixed ? p : { ...p, is_active: true });
                  setPlayers(updated);
                  try { localStorage.setItem('balancer_active_ids', JSON.stringify(updated.filter(p => p.is_active).map(p => p.id))); } catch {}
                }}
                className="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 text-emerald-800 font-bold text-xs transition"
                title="観戦固定メンバーを除く全員の参加チェックをONにします"
              >
                ✅ 全員参加ON
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = players.map(p => p.is_spectator_fixed ? p : { ...p, is_active: false });
                  setPlayers(updated);
                  try { localStorage.setItem('balancer_active_ids', JSON.stringify(updated.filter(p => p.is_active).map(p => p.id))); } catch {}
                }}
                className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 border border-stone-300 text-stone-700 font-bold text-xs transition"
                title="観戦固定メンバーを除く全員の参加チェックをクリアします"
              >
                ❌ 全員解除
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const savedIds = JSON.parse(localStorage.getItem('balancer_active_ids') || '[]');
                    if (Array.isArray(savedIds) && savedIds.length > 0) {
                      setPlayers(prev => prev.map(p => ({ ...p, is_active: savedIds.includes(p.id) })));
                    } else {
                      toast.info('保存された前回のメンバー構成が見つかりません。');
                    }
                  } catch {
                    toast.error('復元に失敗しました。');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-bold text-xs transition"
                title="前回のチーム分け時に参加していたメンバー構成を一元復元します"
              >
                ⏪ 前回構成を復元
              </button>

              {/* 卓分割の選択状態表示 */}
              {selectedTable && (
                <span className="text-xs font-black px-3 py-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                  {selectedTable.label}でチーム分け
                  <button onClick={() => setSelectedTable(null)} className="text-amber-700/70 hover:text-stone-900">✕</button>
                </span>
              )}
              {/* BL-02: 探索強度 */}
              <select value={searchDepth} onChange={e => setSearchDepth(Number(e.target.value))}
                title="精密ほど良い組み合わせを探すが計算が遅くなる"
                className="bg-white border border-stone-200 text-stone-700 text-xs font-bold rounded-lg px-2 py-2 outline-none">
                <option value={40}>⚡ 速い</option>
                <option value={100}>⚖️ 標準</option>
                <option value={200}>🔬 精密</option>
              </select>
              {/* 🎪 日曜お祭りランダムシャッフル */}
              <button
                type="button"
                onClick={handleFestivalRandomBalance}
                disabled={balancing || !canBalance}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-black transition text-xs md:text-sm border ${
                  balancing || !canBalance
                    ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-purple-400 shadow-md shadow-purple-500/20 cursor-pointer'
                }`}
                title="MMRやレーン希望に関係なく、10名を完全ランダムにBlue/Redへ振り分けます（公式MMR変動なし）"
              >
                <span>🎲 お祭りランダム</span>
              </button>

              <button onClick={handleBalance} disabled={balancing || !canBalance}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 md:px-8 md:py-3 rounded-xl font-black transition text-sm md:text-base ${
                  balancing || !canBalance ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]'
                }`}>
                {balancing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
                {balancing ? 'AIが編成中...' : 'チーム分け実行'}
              </button>
            </div>
          </div>

          {/* 🛒 発動中の特権・ハンデ確認メモ */}
          <details className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-xs">
            <summary className="font-bold text-amber-900 cursor-pointer select-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>🛒 発動中の特権・ハンデを確認する</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">KTMショップ連動</span>
              </span>
              <span className="text-[10px] text-amber-700">▼</span>
            </summary>
            <div className="mt-2.5 pt-2.5 border-t border-amber-500/20 space-y-2 text-stone-700">
              <p className="text-[11px] text-stone-600">
                参加者がKTMショップで購入した特権（下剋上キャラ指定、特定レーンBAN、お祭りマッチ等）がある場合は、ここで確認しながらドラフトや試合記録を行えます。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-xl bg-white border border-amber-200">
                  <span className="font-bold text-amber-900">👑 下剋上キャラ指定:</span>
                  <span className="ml-1 text-stone-600">対象の高レートに苦手チャンプを指定 (実効MMR -400)</span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-amber-200">
                  <span className="font-bold text-amber-900">🎪 お祭りカスタム:</span>
                  <span className="ml-1 text-stone-600">結果記録時に「戦績ノーカウント保護」をONにする</span>
                </div>
              </div>
            </div>
          </details>
          {/* 前回結果の再表示ボタン */}
          {balanceResult && !showResultModal && (
            <button onClick={() => setShowResultModal(true)}
              className="flex items-center gap-2 bg-orange-100 hover:bg-orange-100 border border-orange-300/50 text-orange-700 px-4 py-2 rounded-lg font-bold transition text-sm">
              <Globe className="h-4 w-4" /> 前回のチーム分け結果を再表示
            </button>
          )}
        </div>

        {/* ★ 管理者パネル (isAdmin時のみ・/ktm-adminへ移動せずこの画面内でMMR整合性とRebuildを確認できる) */}
        {isAdmin && showAdminPanel && (
          <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${integrityData?.hasDiscrepancy ? 'text-rose-700' : 'text-emerald-700'}`} />
                <span className="text-sm font-bold text-stone-900">MMR整合性ステータス</span>
                {checkingIntegrity ? (
                  <span className="text-xs text-stone-500">確認中...</span>
                ) : integrityData ? (
                  <span className={`text-xs font-bold ${integrityData.hasDiscrepancy ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {integrityData.hasDiscrepancy ? `${integrityData.discrepancyCount}人にズレがあります` : '全員一致しています'}
                  </span>
                ) : (
                  <span className="text-xs text-stone-500">未確認</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={checkIntegrity}
                  disabled={checkingIntegrity}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkingIntegrity ? 'animate-spin' : ''}`} /> 再チェック
                </button>
                <button
                  onClick={handleRebuildMmr}
                  disabled={rebuildingMmr}
                  className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                  title="過去のすべての試合履歴を元にMMRを再計算し、全員のデータを上書きします"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${rebuildingMmr ? 'animate-spin' : ''}`} /> 🔄 Rebuild
                </button>
              </div>
            </div>
            {integrityData?.hasDiscrepancy && (
              <div className="text-xs text-stone-400">
                名簿の編集・Riot/Discord同期・アフィリエイト管理などの詳細操作は
                <Link href="/ktm-admin" prefetch={false} className="text-amber-700 hover:underline mx-1">KTM管理ダッシュボード</Link>
                で行えます。
              </div>
            )}

            {/* バランサー予測の的中率（課題: 予測勝率の検証） */}
            <div className="border-t border-stone-200 pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-stone-900">🎯 バランサー予測の精度</span>
                <button
                  onClick={fetchPredStats}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-1.5 rounded-lg font-bold transition text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> 更新
                </button>
              </div>
              {predStats ? (
                predStats.total === 0 ? (
                  <p className="text-xs text-stone-500 mt-2">まだ結果と突き合わせ済みの予測がありません（チーム分け→試合結果記録が蓄積されると表示されます）。</p>
                ) : (
                  <>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">予測的中率</div>
                      <div className="text-lg font-black text-emerald-700">{predStats.accuracy}%</div>
                      <div className="text-[10px] text-stone-500">{predStats.correct}/{predStats.total}戦</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">平均接戦度</div>
                      <div className={`text-lg font-black ${predStats.avgCloseness >= 80 ? 'text-amber-700' : predStats.avgCloseness >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>{predStats.avgCloseness}</div>
                      <div className="text-[10px] text-stone-500">100=完全拮抗</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">平均の偏り</div>
                      <div className="text-lg font-black text-amber-700">±{predStats.avgConfidence}%</div>
                      <div className="text-[10px] text-stone-500">低=拮抗</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">サンプル</div>
                      <div className="text-lg font-black text-stone-900">{predStats.total}</div>
                      <div className="text-[10px] text-stone-500">直近200戦</div>
                    </div>
                  </div>
                  {/* 直近10戦の接戦度（#82: 毎試合採点。左が最新） */}
                  {predStats.recentCloseness.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] text-stone-500 mb-1">直近10戦の接戦度（左が最新）</div>
                      <div className="flex gap-1">
                        {predStats.recentCloseness.map((c, i) => (
                          <div key={i} title={`接戦度 ${c}`} className={`flex-1 h-6 rounded flex items-center justify-center text-[9px] font-black ${c >= 80 ? 'bg-amber-100 text-amber-700 border border-amber-200' : c >= 60 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                )
              ) : (
                <p className="text-xs text-stone-500 mt-2">読み込み中...</p>
              )}
              <p className="text-[10px] text-stone-500 mt-2">
                的中率が50%近い＝実力拮抗、極端に高い＝MMR差が大きいまま組んでいる可能性。平均の偏りが小さいほどバランサーが互角の試合を作れています。
              </p>
            </div>

            {/* サイド偏り検証(#81): Blue/Red勝率 */}
            {sideStats && sideStats.total > 0 && (
              <div className="border-t border-stone-200 pt-3">
                <span className="text-sm font-bold text-stone-900">🎨 サイド偏り（Blue/Red勝率）</span>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-black text-blue-700 w-28 text-right">BLUE {sideStats.blueRate}%</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden bg-stone-100 flex">
                    <div className="bg-blue-500/80" style={{ width: `${sideStats.blueRate}%` }}></div>
                    <div className="bg-red-500/80" style={{ width: `${100 - sideStats.blueRate}%` }}></div>
                  </div>
                  <span className="text-xs font-black text-red-700 w-28">RED {Math.round((100 - sideStats.blueRate) * 10) / 10}%</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-1.5">
                  全{sideStats.total}戦（Blue {sideStats.blueWins}勝）。50%から大きくズレている場合はサイド有利かサイド公平化ロジックの見直し材料になります。
                </p>
              </div>
            )}

            {/* 初期MMRの基準レーン（凍結値）編集 */}
            <div className="border-t border-stone-200 pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-stone-900">🧊 初期MMRの基準レーン（凍結値）</span>
                <button
                  onClick={() => showInitialPrefs ? setShowInitialPrefs(false) : openInitialPrefs()}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-1.5 rounded-lg font-bold transition text-xs"
                >
                  {showInitialPrefs ? '閉じる' : '編集する'}
                </button>
              </div>
              <p className="text-[10px] text-stone-500 mt-1.5">
                初期MMRの計算に使う「本来のメイン/サブレーン」です。希望レーンを後から変えてもここは変わりません（Rebuildの出発点が固定されます）。
                誤って凍結された人はここで直して、保存後にRebuildしてください。
              </p>
              {showInitialPrefs && (
                <div className="mt-3 space-y-3">
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-stone-200 divide-y divide-black/5">
                    {players.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-black/[0.03]">
                        <span className="flex-1 text-xs font-bold text-stone-900 truncate">{p.name}</span>
                        <select
                          value={initialDraft[p.id]?.primary || 'ALL'}
                          onChange={e => setInitialDraft(d => ({ ...d, [p.id]: { ...(d[p.id] || { primary: 'ALL', secondary: '-' }), primary: e.target.value } }))}
                          className="bg-white border border-stone-300 text-stone-900 text-xs rounded px-1.5 py-1 outline-none w-20"
                        >
                          {['TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          value={initialDraft[p.id]?.secondary || '-'}
                          onChange={e => setInitialDraft(d => ({ ...d, [p.id]: { ...(d[p.id] || { primary: 'ALL', secondary: '-' }), secondary: e.target.value } }))}
                          className="bg-white border border-stone-300 text-stone-700 text-xs rounded px-1.5 py-1 outline-none w-20"
                        >
                          {['-', 'TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowInitialPrefs(false)} className="px-4 py-2 rounded-lg text-xs font-bold bg-stone-100 text-stone-700 hover:bg-stone-200">キャンセル</button>
                    <button onClick={saveInitialPrefs} disabled={savingInitial}
                      className="px-4 py-2 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 flex items-center gap-1.5">
                      {savingInitial && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      保存（要Rebuild）
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* バランス満足度(Discord 👍/👎)（課題#42） */}
            <div className="border-t border-stone-200 pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-stone-900">👍 チーム分け満足度（成績入力時に記録）</span>
                <button
                  onClick={fetchSatStats}
                  disabled={tallyingSat}
                  className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${tallyingSat ? 'animate-spin' : ''}`} /> 集計
                </button>
              </div>
              {satStats ? (
                satStats.tallied === 0 ? (
                  <p className="text-xs text-stone-500 mt-2">まだ記録がありません（試合成績を入力する画面で「今日のチーム分けは?」を選ぶと貯まります）。</p>
                ) : (
                  <>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">満足度</div>
                      <div className="text-lg font-black text-emerald-700">{satStats.satisfactionRate !== null ? `${satStats.satisfactionRate}%` : '—'}</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">👍 / 😐 / 👎</div>
                      <div className="text-lg font-black text-stone-900">{satStats.totalUp} / {satStats.totalNeutral ?? 0} / {satStats.totalDown}</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">集計試合</div>
                      <div className="text-lg font-black text-stone-900">{satStats.tallied}</div>
                    </div>
                  </div>
                  {/* 直近の試合ごとの内訳（#76: 左が最新） */}
                  {(satStats.recent && satStats.recent.length > 0) && (
                    <div className="mt-2">
                      <div className="text-[10px] text-stone-500 mb-1">直近の試合ごとの投票（左が最新）</div>
                      <div className="flex gap-1 flex-wrap">
                        {satStats.recent.map((r, i) => {
                          const votes = r.up + r.down;
                          const good = votes > 0 && r.up / votes >= 0.6;
                          const bad = votes > 0 && r.up / votes <= 0.4;
                          return (
                            <div key={i} title={`👍${r.up} 😐${r.neutral} 👎${r.down}`}
                              className={`px-2 py-1 rounded text-[9px] font-black border ${votes === 0 ? 'bg-black/[0.04] text-stone-500 border-stone-300' : good ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : bad ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
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
                <p className="text-xs text-stone-500 mt-2">「集計」を押すと、成績入力時に記録された満足度を直近50戦ぶん集計します。</p>
              )}
            </div>
          </div>
        )}

        {/* 格差診断: 対面が組めない外れ値を警告し、観戦orハンデ参加を選ばせる。
            個人名を挙げる内容なので主催者(管理者)にだけ表示する。 */}
        {isAdmin && gapDiagnosis && (
          <div className="bg-white border border-rose-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-rose-700">⚠️ レート差の警告</span>
              <span className="text-[10px] text-stone-500">MMR幅 {gapDiagnosis.spread} — 近い実力の相手がいない人がいます</span>
            </div>
            <div className="space-y-2">
              {gapDiagnosis.orphans.map(({ player: p, gap, nearest }) => (
                <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap bg-black/[0.04] rounded-lg px-3 py-2 border border-stone-200">
                  <div className="text-xs text-stone-700 min-w-0">
                    <span className="font-black text-stone-900">{p.name}</span>
                    <span className="text-stone-500 font-mono ml-2">{p.mmr || 1200}</span>
                    <span className="text-rose-700 ml-2">次点 {nearest}（差 {gap}）</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleInputChange(p.id, 'is_spectator_fixed', true)}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-100">
                      観戦に回す
                    </button>
                    <button
                      onClick={() => toggleHandicap(p.id)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${handicapIds.includes(p.id) ? 'bg-amber-600 text-white border-amber-500' : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'}`}>
                      {handicapIds.includes(p.id) ? '✓ ハンデ参加' : 'ハンデ参加'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-500">
              観戦に回した人は観戦Pityが溜まり次回は優先出場します。ハンデ参加は<strong className="text-amber-700">チーム分けの計算上のみMMRを{HANDICAP_MMR_PENALTY}下げて</strong>格差を緩和します（実際のMMR・戦績は変わりません）。結果とDiscord通知にも🎗️で明示されます。
            </p>
          </div>
        )}

        {/* 卓分割パネル: 20人以上のとき、代表MMRで2卓に分けて提示（主催者の判断用） */}
        {isAdmin && tableSplit && (
          <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-amber-700">🪑 参加者{tableSplit.total}人 — 2卓に分けられます</span>
              <span className="text-[10px] text-stone-500">代表MMR順に上位卓／下位卓へ自動仕分け（卓を選んでからチーム分けを実行）</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[tableSplit.upper, tableSplit.lower].map((t: any) => (
                <div key={t.label} className={`rounded-xl border p-3 ${selectedTable?.label === t.label ? 'border-amber-500 bg-amber-100' : 'border-stone-200 bg-black/[0.03]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-stone-900">{t.label}</span>
                    <button
                      onClick={() => setSelectedTable({ label: t.label, ids: t.ids })}
                      className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition ${selectedTable?.label === t.label ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>
                      {selectedTable?.label === t.label ? '選択中' : 'この卓を選ぶ'}
                    </button>
                  </div>
                  <div className="text-[10px] text-stone-400 space-y-0.5 max-h-40 overflow-y-auto">
                    {t.members.map((m: any) => (
                      <div key={m.id} className="flex justify-between gap-2">
                        <span className="truncate">{m.name}</span>
                        <span className="font-mono text-stone-500 shrink-0">{m.mmr || 1200}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* メッセージ */}
        {message.text && (
          <div className={`p-3 rounded-lg font-bold border text-sm flex items-start justify-between gap-3 ${message.type === 'error' ? 'bg-red-100 border-red-300 text-red-700' : 'bg-emerald-100 border-emerald-800 text-emerald-700'}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type:'', text:'' })} className="flex-shrink-0 opacity-60 hover:opacity-100 transition"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* 参加者リスト */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-3 md:p-4 border-b border-stone-200 flex items-center gap-2 bg-white">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-amber-700" />
            <h2 className="text-base md:text-xl font-bold text-stone-900">参加者リスト</h2>
            <span className="text-xs text-stone-500 font-normal hidden md:inline ml-1">
              ｜ <Crown className="inline w-3 h-3 text-amber-700" /> = 第1希望固定、<X className="inline w-3 h-3 text-orange-700" /> = 見学固定
            </span>
          </div>

          {/* ★ 追加: フィルターUI (junglepedia風のインタラクティブなフィルタリング機能) */}
          <div className="p-3 md:p-4 bg-black/[0.04] border-b border-black/5 flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* 検索入力 */}
            <div className="relative w-full lg:max-w-xs flex items-center">
              <input
                type="text"
                placeholder="プレイヤーを検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-lg pl-3 pr-16 py-2 text-xs text-stone-900 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-stone-400 hover:text-stone-700 text-xs font-bold"
                    title="検索クリア"
                  >
                    ✕
                  </button>
                )}
                <span className="text-[10px] font-mono font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                  {filteredPlayers.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
              {/* ステータスフィルター */}
              <div className="flex bg-white rounded-lg p-0.5 border border-stone-200 text-xs">
                <button
                  onClick={() => setStatusFilter(null)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${!statusFilter ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-900'}`}
                >
                  全員
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'active' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-900'}`}
                >
                  参加予定
                </button>
                <button
                  onClick={() => setStatusFilter('spectator')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'spectator' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-900'}`}
                >
                  見学のみ
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'inactive' ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-900'}`}
                >
                  不参加
                </button>
              </div>

              {/* 希望ロールフィルター */}
              <div className="flex bg-white rounded-lg p-0.5 border border-stone-200 text-xs">
                <button
                  onClick={() => setRoleFilter(null)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${!roleFilter ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-900'}`}
                >
                  すべてのロール
                </button>
                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                    className={`px-2.5 py-1.5 rounded-md font-bold transition flex items-center gap-1 ${roleFilter === role ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-900'}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* デスクトップ：テーブル。参加者数分の列(参加設定/No./名前/ランク/MMR/希望×2/NG×2/
              こだわり/棚上げ)が多く、768px(mdブレークポイント)ではまだ収まりきらず横スクロール
              が常に発生していた(scrollWidth約1300pxに対しclientWidthは900px幅ですら530px程度)。
              PCで少し縮めただけでも「はみ出す」体感になっていたため、lgブレークポイント(1024px)
              まではモバイル用カード表示に寄せる(2026-08-15)。 */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-stone-400 bg-stone-100 border-b border-stone-200">
                <tr>
                  <th className="px-2 py-3 font-medium text-center w-28">参加設定</th>
                  <SortableHeader label="No." sortKey="no" className="w-10 text-center" />
                  <SortableHeader label="プレイヤー名" sortKey="name" className="px-2" />
                  <SortableHeader label="SoloQランク" sortKey="highest_rank" className="px-2" />
                  <SortableHeader label="KTM内戦MMR" sortKey="mmr" className="px-2" />
                  <th className="px-2 py-3 font-medium text-center">第1希望</th>
                  <th className="px-2 py-3 font-medium text-center">第2希望</th>
                  <th className="px-1.5 py-3 font-medium text-center text-red-700">NG 1</th>
                  <th className="px-1.5 py-3 font-medium text-center text-red-700">NG 2</th>
                  <SortableHeader label="こだわり" sortKey="weight" className="px-1.5 text-center" />
                  <SortableHeader label="格上" sortKey="allow_higher" className="px-1.5 text-center" />
                  <th className="px-2 py-3 font-medium text-center">Pity (正/負/観)</th>
                  <th className="px-2 py-3 font-medium">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredPlayers.map((p, idx) => {
                  const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
                  const curGroup = getGroup(p);
                  const prevGroup = idx > 0 ? getGroup(filteredPlayers[idx - 1]) : -1;
                  const isBoundary = idx > 0 && curGroup !== prevGroup;
                  const groupLabelMap: Record<number,string> = { 0:'👑 固定メンバー', 2:'👁 観戦固定', 3:'⚫ 不参加' };
                  const groupColorMap: Record<number,string> = { 0:'text-amber-700 bg-amber-100', 2:'text-orange-700 bg-orange-100', 3:'text-stone-500 bg-black/[0.03]' };
                  return (
                    <Fragment key={`balancer-row-${p.id}`}>
                      {isBoundary && groupLabelMap[curGroup] && (
                        <tr key={`div-${idx}`}>
                          <td colSpan={13} className={`px-4 py-1.5 text-[11px] font-bold border-t border-black/5 ${groupColorMap[curGroup]}`}>
                            {groupLabelMap[curGroup]}
                          </td>
                        </tr>
                      )}
                      <tr key={p.id}
                        className={`hover:bg-black/[0.04] transition-all duration-500 ${
                          flashingPlayerIds.includes(p.id) ? 'bg-emerald-100 border-y border-emerald-500/50' :
                          p.is_fixed ? 'bg-amber-100 border-l-2 border-amber-500/70' :
                          p.is_spectator_fixed ? 'bg-orange-100 border-l-2 border-orange-600/60 opacity-70' :
                          p.is_active ? 'bg-amber-100 border-l-2 border-amber-500 text-stone-800' :
                          'opacity-40 hover:opacity-100'
                        }`}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 min-w-[76px] h-7 mx-auto">
                            <input type="checkbox" checked={p.is_active}
                              onChange={e => { const a = e.target.checked; handleInputChange(p.id,'is_active',a); if(!a){handleInputChange(p.id,'is_fixed',false);handleInputChange(p.id,'is_spectator_fixed',false);} }}
                              className="w-4 h-4 rounded border-stone-300 bg-stone-100 text-amber-700 focus:ring-amber-500/50 cursor-pointer transition-transform hover:scale-110 flex-shrink-0" title="参加/不参加" />
                            <div className={`flex items-center gap-1 transition-all duration-300 overflow-hidden ${p.is_active?'opacity-100 max-w-[50px]':'opacity-0 max-w-0 pointer-events-none'}`}>
                              <button onClick={() => { if(p.is_spectator_fixed) handleInputChange(p.id,'is_spectator_fixed',false); handleInputChange(p.id,'is_fixed',!p.is_fixed); }}
                                className={`p-0.5 rounded border transition-all ${p.is_fixed?'bg-amber-100 border-amber-200 text-amber-700':'border-stone-200 text-stone-500 hover:text-amber-700 hover:bg-amber-100'}`}
                                title="第1希望レーンで固定する"><Crown className="w-3 h-3" /></button>
                              <button onClick={() => { if(p.is_fixed) handleInputChange(p.id,'is_fixed',false); handleInputChange(p.id,'is_spectator_fixed',!p.is_spectator_fixed); }}
                                className={`p-0.5 rounded border transition-all ${p.is_spectator_fixed?'bg-orange-100 border-orange-200 text-orange-700':'border-stone-200 text-stone-500 hover:text-orange-700 hover:bg-orange-100'}`}
                                title="見学固定にする"><X className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold text-stone-500 text-xs">{p.no}</td>
                        <td className="px-2 py-1.5 font-bold text-stone-900 text-xs max-w-[240px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => setSelectedPlayer(p)} className="text-amber-700 hover:text-stone-900 p-0.5 hover:bg-stone-100 rounded transition flex-shrink-0" title="プロフィール">
                              <Info className="w-3.5 h-3.5" /></button>
                            <span className="font-extrabold text-stone-900 truncate max-w-[130px]" title={p.name}>{p.name}</span>
                            
                            {/* 🔰/🌱/👑 参加者層バッジ */}
                            {(() => {
                              const exp = getPlayerExperienceBadge(p);
                              return (
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.2 rounded border shadow-2xs ${exp.color}`}
                                  title={exp.tip}
                                >
                                  {exp.label}
                                </span>
                              );
                            })()}

                            {/* ⏱️/🌙 参加スタイルバッジ */}
                            {p.participation_style && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextStyle = p.participation_style === 'full' ? 'single' : (p.participation_style === 'single' ? 'late' : 'full');
                                  handleInputChange(p.id, 'participation_style', nextStyle);
                                }}
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded border transition-transform hover:scale-105 cursor-pointer shadow-2xs ${
                                  p.participation_style === 'single'
                                    ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                                    : p.participation_style === 'late'
                                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                }`}
                                title="クリックで参加スタイルを切り替え (フル ➔ 1戦のみ ➔ 途中参加)"
                              >
                                {p.participation_style === 'single' ? '⏱️ 1戦のみ' : p.participation_style === 'late' ? '🌙 途中参加' : '🟢 フル'}
                              </button>
                            )}

                            {/* 🪙 所持コイン */}
                            {(p.coins > 0 || (p.metadata?.coins && p.metadata.coins > 0)) && (
                              <span className="text-[10px] font-mono font-black bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shadow-2xs" title={`所持コイン: ${p.coins || p.metadata?.coins}枚`}>
                                <Coins className="w-2.5 h-2.5 text-amber-600" />
                                {p.coins || p.metadata?.coins}
                              </span>
                            )}

                            {/* 👑 カジノ保有アイテムバッジ（幅を圧迫しないようコンパクトにまとめ表示） */}
                            {(() => {
                              const casinoBadges = getPlayerCasinoBadges(p);
                              if (casinoBadges.length === 0) return null;
                              return (
                                <div className="flex items-center gap-1">
                                  {casinoBadges.map((badge, idx) => (
                                    <span key={idx} className="text-[9px] font-black bg-purple-100 text-purple-900 border border-purple-300 px-1 py-0.2 rounded flex items-center gap-0.5 shadow-2xs" title={`カジノ特典: ${badge.label}`}>
                                      <span>{badge.icon}</span>
                                      <span className="max-w-[65px] truncate">{badge.label}</span>
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className={`px-2 py-1.5 text-xs font-semibold ${getColorFromRankName(p.highest_rank)}`}>{p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNRANKED'}</td>
                        <td className="px-2 py-1.5 text-center">
                          {(() => {
                            const repMmr = p.mmr || 1200;
                            const highestLaneMmr = getHighestLaneMmr(p);
                            const ktmTier = getKtmRank(highestLaneMmr);
                            const badgeStyle = getRankBadgeStyle(ktmTier.name);
                            const hasDiff = highestLaneMmr !== repMmr;
                            const tooltip = hasDiff
                              ? `最高レーン基準: ${ktmTier.name} (${highestLaneMmr}) / 代表MMR: ${repMmr}`
                              : `KTMランク: ${ktmTier.name} (MMR: ${repMmr})`;
                            return (
                              <div className="flex items-center justify-center gap-1.5" title={tooltip}>
                                <span className="font-mono text-xs font-black text-amber-800 dark:text-amber-300">{repMmr}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeStyle.bg} ${badgeStyle.color} ${badgeStyle.border}`}>
                                  {ktmTier.name.split(' ')[0]}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded px-1 py-0.5 w-20">
                            <RoleIcon role={prefs.primary || 'ALL'} className="w-3 h-3 flex-shrink-0" />
                            <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-stone-900 outline-none cursor-pointer w-full text-[11px] font-bold">
                              {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-stone-100 text-stone-800">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded px-1 py-0.5 w-20">
                            <RoleIcon role={prefs.secondary || '-'} className="w-3 h-3 flex-shrink-0" />
                            <select value={prefs.secondary || '-'} disabled={prefs.primary === 'ALL'} onChange={e => handleInputChange(p.id,'secondary_role',e.target.value)} className="bg-transparent text-stone-700 outline-none cursor-pointer w-full text-[11px] disabled:cursor-not-allowed">
                              {['-','ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-stone-100 text-stone-800">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded px-1 py-0.5 w-16 mx-auto">
                            <RoleIcon role={p.ng_lane_1 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                            <select value={p.ng_lane_1 || ''} onChange={e => handleInputChange(p.id,'ng_lane_1',e.target.value)} className="bg-transparent text-red-700 font-bold outline-none cursor-pointer w-full text-[10px]">
                              <option value="" className="bg-stone-100 text-stone-400">なし</option>
                              {['TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-stone-100 text-red-700">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded px-1 py-0.5 w-16 mx-auto">
                            <RoleIcon role={p.ng_lane_2 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                            <select value={p.ng_lane_2 || ''} onChange={e => handleInputChange(p.id,'ng_lane_2',e.target.value)} className="bg-transparent text-red-700 font-bold outline-none cursor-pointer w-full text-[10px]">
                              <option value="" className="bg-stone-100 text-stone-400">なし</option>
                              {['TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-stone-100 text-red-700">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <select value={p.weight || 2} disabled={!isAdmin} onChange={e => handleInputChange(p.id,'weight',parseInt(e.target.value))} title={isAdmin ? '' : 'こだわり度の変更は管理者のみ可能です'} className="bg-stone-100 border border-stone-300 rounded px-1.5 py-0.5 text-amber-700 font-bold outline-none focus:border-amber-500 w-12 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                            {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <input type="checkbox" checked={!!p.allow_higher} onChange={e => handleInputChange(p.id,'allow_higher',e.target.checked)} className="w-4 h-4 rounded border-stone-300 bg-stone-100 text-rose-700 focus:ring-rose-500/50 cursor-pointer transition-transform hover:scale-110" />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1 w-24 mx-auto">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold" title="Pity">{p.pity || 0}</span>
                            <span className="px-1.5 py-0.5 rounded bg-fuchsia-100 border border-fuchsia-200 text-fuchsia-700 text-[10px] font-mono font-bold" title="OffPity">{p.off_role_pity || 0}</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-mono font-bold" title="観戦Pity">{p.spectator_pity || 0}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={p.metadata?.notes || ''} onChange={e => handleInputChange(p.id,'notes',e.target.value)} placeholder="備考"
                            className="bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-300 hover:bg-black/[0.04] focus:bg-white focus:ring-1 focus:ring-amber-500/30 rounded px-2 py-0.5 outline-none text-xs text-stone-700 w-20 transition-all" />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-stone-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl">🔍</span>
                        <span className="text-sm font-bold text-stone-700">条件に一致するプレイヤーが見つかりません</span>
                        <p className="text-xs text-stone-400">検索文字やフィルター条件を変更してください。</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter(null);
                            setRoleFilter(null);
                          }}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition cursor-pointer"
                        >
                          フィルター条件をリセット
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ★ モバイル：カードリスト（〜lg幅、上のテーブル注記を参照） */}
          <div className="lg:hidden divide-y divide-black/5">
            {filteredPlayers.map((p, idx) => {
              const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
              const curGroup = getGroup(p);
              const prevGroup = idx > 0 ? getGroup(filteredPlayers[idx - 1]) : -1;
              const isBoundary = idx > 0 && curGroup !== prevGroup;
              const groupLabelMap: Record<number,string> = { 0:'👑 固定メンバー', 2:'👁 観戦固定', 3:'⚫ 不参加' };
              const groupBgMap: Record<number,string> = { 0:'bg-amber-100 text-amber-700', 2:'bg-orange-100 text-orange-700', 3:'bg-stone-100 text-stone-500' };
              const repMmr = p.mmr || 1200;
              const highestLaneMmr = getHighestLaneMmr(p);
              const ktmTier = getKtmRank(highestLaneMmr);
              const badgeStyle = getRankBadgeStyle(ktmTier.name);
              const hasDiff = highestLaneMmr !== repMmr;
              const tooltip = hasDiff
                ? `最高レーン基準: ${ktmTier.name} (${highestLaneMmr}) / 代表MMR: ${repMmr}`
                : `KTMランク: ${ktmTier.name} (MMR: ${repMmr})`;
              return (
                <div key={p.id}>
                  {isBoundary && groupLabelMap[curGroup] && (
                    <div className={`px-4 py-2 text-[11px] font-bold ${groupBgMap[curGroup]}`}>{groupLabelMap[curGroup]}</div>
                  )}
                  <div className={`p-3 flex items-start gap-3 transition-all ${
                    p.is_fixed ? 'bg-amber-100 border-l-2 border-amber-500/70' :
                    p.is_spectator_fixed ? 'bg-orange-100 border-l-2 border-orange-600/60 opacity-70' :
                    p.is_active ? 'bg-amber-100 border-l-2 border-amber-500' : 'opacity-40'
                  }`}>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-1">
                      <input type="checkbox" checked={p.is_active}
                        onChange={e => { const a = e.target.checked; handleInputChange(p.id,'is_active',a); if(!a){handleInputChange(p.id,'is_fixed',false);handleInputChange(p.id,'is_spectator_fixed',false);} }}
                        className="w-5 h-5 rounded border-stone-300 bg-stone-100 text-amber-700 cursor-pointer" />
                      {p.is_active && (
                        <div className="flex gap-0.5">
                          <button onClick={() => { if(p.is_spectator_fixed) handleInputChange(p.id,'is_spectator_fixed',false); handleInputChange(p.id,'is_fixed',!p.is_fixed); }}
                            className={`p-0.5 rounded border ${p.is_fixed?'bg-amber-100 border-amber-200 text-amber-700':'border-stone-300 text-stone-500'}`}><Crown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(p.is_fixed) handleInputChange(p.id,'is_fixed',false); handleInputChange(p.id,'is_spectator_fixed',!p.is_spectator_fixed); }}
                            className={`p-0.5 rounded border ${p.is_spectator_fixed?'bg-orange-100 border-orange-200 text-orange-700':'border-stone-300 text-stone-500'}`}><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 text-sm">{p.name}</span>
                        {/* 🔰/🌱/👑 参加者層バッジ */}
                        {(() => {
                          const exp = getPlayerExperienceBadge(p);
                          return (
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border shadow-2xs ${exp.color}`}>
                              {exp.label}
                            </span>
                          );
                        })()}
                        {p.participation_style && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded border bg-purple-100 text-purple-900 border-purple-300">
                            {p.participation_style === 'single' ? '⏱️1戦のみ' : p.participation_style === 'late' ? '🌙途中参加' : '🟢フル'}
                          </span>
                        )}
                        <span className={`text-xs font-semibold ${getColorFromRankName(p.highest_rank)}`}>{p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNR'}</span>
                        
                        {/* MMR ＆ KTMランクバッジ */}
                        <div className="ml-auto flex items-center gap-1" title={tooltip}>
                          <span className="font-mono text-amber-700 text-xs font-bold">{repMmr}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${badgeStyle.bg} ${badgeStyle.color} ${badgeStyle.border}`}>
                            {ktmTier.name.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-0.5 bg-stone-100 border border-stone-200 rounded px-1.5 py-0.5">
                          <RoleIcon role={prefs.primary || 'ALL'} className="w-3 h-3" />
                          <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-stone-900 outline-none cursor-pointer text-[11px] font-bold">
                            {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-stone-100">{r}</option>)}
                          </select>
                        </div>
                        {(p.ng_lane_1 || p.ng_lane_2) && (
                          <div className="flex items-center gap-1 text-red-700 text-xs font-bold">
                            <span className="opacity-60">NG:</span>
                            {p.ng_lane_1 && <span className="bg-red-50 border border-red-200 px-1.5 rounded">{p.ng_lane_1}</span>}
                            {p.ng_lane_2 && <span className="bg-red-50 border border-red-200 px-1.5 rounded">{p.ng_lane_2}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-0.5 ml-auto">
                          <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-mono" title="Pity">{p.pity || 0}</span>
                          <span className="px-1 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 text-[9px] font-mono" title="OffPity">{p.off_role_pity || 0}</span>
                          <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-mono" title="観戦Pity">{p.spectator_pity || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredPlayers.length === 0 && (
              <div className="p-8 text-center text-stone-500 space-y-2">
                <div className="text-xl">🔍</div>
                <div className="text-sm font-bold text-stone-700">条件に一致するプレイヤーが見つかりません</div>
                <p className="text-xs text-stone-400">検索文字やフィルターを変更してください。</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter(null);
                    setRoleFilter(null);
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition cursor-pointer"
                >
                  条件をリセット
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 用語解説（折りたたみ） */}
        <details className="bg-white border border-stone-200 rounded-xl text-sm group">
          <summary className="p-4 cursor-pointer flex items-center gap-2 font-bold text-amber-700 list-none select-none">
            <Info className="h-4 w-4" /> KTM専用マッチング用語
            <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="bg-stone-100 p-4 rounded border border-stone-200">
              <span className="font-bold text-amber-700 mb-1 block">こだわり (1～3)</span>
              <p className="text-stone-400">メインレーンをどれくらいやりたいかの度合い。1(絶対やりたい) ～ 3(どこでもいい)。</p>
            </div>
            <div className="bg-stone-100 p-4 rounded border border-stone-200">
              <span className="font-bold text-rose-700 mb-1 block">格上許可 (ON/OFF)</span>
              <p className="text-stone-400">自分よりMMRが高い相手と対面することを許容するかどうかの設定です。</p>
            </div>
            <div className="bg-stone-100 p-4 rounded border border-stone-200">
              <span className="font-bold text-emerald-700 mb-1 block">PITY (ピティ)</span>
              <p className="text-stone-400">「希望外レーン」に飛ばされた人に貯まる同情ポイント。高いほど次回優先的にメインレーンへ。</p>
            </div>
            <div className="bg-stone-100 p-4 rounded border border-stone-200">
              <span className="font-bold text-fuchsia-700 mb-1 block">OFF PITY (オフピティ)</span>
              <p className="text-stone-400">「希望レーン」を連続でやっている人に貯まるポイント。一時的に他レーンへ飛ばされる確率が上がります。</p>
            </div>
          </div>
        </details>

        {/* ★ スティッキー下部クイックアクションバー */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl bg-white/95 text-stone-900 backdrop-blur-md border border-stone-300 rounded-2xl p-3 px-5 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-stone-600 font-bold">参加:</span>
              <strong className={`font-mono text-xs sm:text-sm px-2 py-0.5 rounded-lg ${canBalance ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                {activeCount} / 10 人 {canBalance ? '✅' : `(あと${10 - activeCount}人)`}
              </strong>
            </div>
            {spectatorCount > 0 && (
              <span className="text-[11px] text-stone-500 hidden sm:inline">
                (見学: {spectatorCount}人)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {balanceResult && (
              <button
                onClick={() => setShowResultModal(true)}
                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs border border-stone-300 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-amber-600" /> <span className="hidden sm:inline">結果表示</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleFestivalRandomBalance}
              disabled={balancing || !canBalance}
              className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md border ${
                balancing || !canBalance
                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-purple-400 shadow-purple-500/20'
              }`}
              title="完全ランダムでお祭りチーム分け（MMRなし）"
            >
              <span>🎲 お祭り</span>
            </button>

            <button
              onClick={handleBalance}
              disabled={balancing || !canBalance}
              className={`px-4 sm:px-5 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-lg ${
                balancing || !canBalance
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 shadow-amber-500/30'
              }`}
            >
              {balancing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              <span>{balancing ? 'AI編成中...' : '⚔️ チーム分け実行'}</span>
            </button>
          </div>
        </div>

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}


