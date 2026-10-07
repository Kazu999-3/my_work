"use client";

import { useEffect, useState, useMemo } from "react";
import { X } from "lucide-react";
import { BalancerVcManager } from "./components/BalancerVcManager";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Spinner } from "../../components/Feedback";
import dynamic from "next/dynamic";
import { diagnoseMmrGaps, splitTables } from "../../lib/balancer/diagnosis";
import { sortPlayers, filterPlayers } from "../../lib/balancer/playerList";
import { buildFestivalResult } from "../../lib/balancer/teams";
import { useBalancerAdminStats } from "./_parts/useBalancerAdminStats";
import { usePlayerRoster } from "./_parts/usePlayerRoster";
import { useBo3Series } from "./_parts/useBo3Series";
import { useResultSwap } from "./_parts/useResultSwap";
import { useResultActions } from "./_parts/useResultActions";
import { useInitialPrefsEditor } from "./_parts/useInitialPrefsEditor";
import { ModeTabBar, UsageGuide, ExperienceSummary, MatchingGlossary, makeSortableHeader, getPlayerExperienceBadge } from "./_parts/PageSections";
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

// 格差診断: 対面を組めない外れ値とみなすMMR差
const GAP_THRESHOLD = 250;
// ハンデ参加時にチーム分けの計算上で差し引くMMR（実際の戦績・MMRは変わらない）
const HANDICAP_MMR_PENALTY = 150;

// 内戦バランサー。状態の大半は _parts/ のフック（参加者リスト・BO3・入れ替え・共有操作・初期レーン編集）が持ち、
// ここはチーム分けの実行と画面の組み立てだけを担う。
// 2026-10-07: 3,029行 → 1,140行（82168c14）→ 本ファイル。使われていなかった状態(selectedHandicaps / showRecordPanel)を削除。
export default function BalancerPage() {
  const { user: currentUser } = useCurrentUser();
  const [modeTab, setModeTab] = useState<'standard' | 'aram_rotation'>('standard');
  const [message, setMessage] = useState({ type: "", text: "" });

  // ★ 管理者パネル (ktm-admin/balancerをページ分割せず、ログイン中の管理者だけに
  // MMR整合性・Rebuildなど「見たいデータ」をこの画面内で見せるための状態群)
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [rebuildingMmr, setRebuildingMmr] = useState(false);
  const {
    integrityData, checkingIntegrity, checkIntegrity,
    predStats, fetchPredStats, sideStats, satStats, tallyingSat, fetchSatStats,
  } = useBalancerAdminStats(isAdmin);

  const { players, setPlayers, loading, saving, flashingPlayerIds, fetchPlayers, handleInputChange } = usePlayerRoster(isAdmin, setMessage);
  const initialPrefs = useInitialPrefsEditor(players, setPlayers, setMessage);

  const [balancing, setBalancing] = useState(false);
  const [balanceResult, setBalanceResult] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposalIdx, setSelectedProposalIdx] = useState<number>(0);
  const [analysis, setAnalysis] = useState<any>(null);
  // ★ チーム分け結果モーダルの表示フラグ
  const [showResultModal, setShowResultModal] = useState(false);

  // フィルター・並び替え
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState({ key: "no", direction: "asc" });
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // BL-02: 探索強度（40=速い/100=標準/200=精密）
  const [searchDepth, setSearchDepth] = useState(100);

  // 格差診断: 参加者をMMR順に2人ずつペアにし、「近い実力の相手がいない人」を検出する。
  // チーム全体のMMR幅より「レーン対面の格差」が体験に効くため、対面を組めない外れ値を警告する。
  const gapDiagnosis = useMemo(() => diagnoseMmrGaps(players, GAP_THRESHOLD), [players]);

  // ハンデ参加(オフロール等)の指定。チーム分け結果とDiscord通知に明示する。
  const [handicapIds, setHandicapIds] = useState<any[]>([]);
  const toggleHandicap = (id: any) => setHandicapIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  // チーム分け結果は名前ベースなので、ハンデ対象の「名前」集合に変換して照合する
  const handicapNames = useMemo(
    () => new Set<string>(players.filter((p: any) => handicapIds.includes(p.id)).map((p: any) => p.name)),
    [players, handicapIds]
  );

  // 卓分割: 参加者が20人以上のとき、代表MMR順で「上位卓/下位卓」に自動分割する。
  // 卓分け=代表MMR(ktm_players.mmr)、卓の中のチーム分け=レーン別MMR、という役割分担。
  const [selectedTable, setSelectedTable] = useState<{ label: string; ids: any[] } | null>(null);
  const tableSplit = useMemo(() => splitTables(players), [players]);

  const bo3 = useBo3Series(balanceResult, setBalanceResult, setMessage);
  const swap = useResultSwap({ balanceResult, setBalanceResult, setProposals, selectedProposalIdx, players });
  const actions = useResultActions({ balanceResult, proposals, players, handicapNames, setMessage });

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

  // ★ ESCキーでモーダルを閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowResultModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

    // 「⏪前回構成を復元」ボタンが参照する保存先。実際にチーム分けを実行するこの時点で、使ったメンバー構成を保存する
    // (以前は「全員参加ON/解除」ボタンでしか書き込まれず、復元が常に「見つかりません」になっていた。2026-08-08)
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

      const hasProposals = Array.isArray(data.proposals) && data.proposals.length > 0;
      const activeResult = hasProposals ? data.proposals[0] : data;
      setProposals(hasProposals ? data.proposals : [data]);
      setBalanceResult(activeResult);
      setSelectedProposalIdx(0);
      setAnalysis(hasProposals ? (data.analysis || null) : null);
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
    const activePlayers = selectedTable ? allActive.filter(p => selectedTable.ids.includes(p.id)) : allActive;
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

  const requestSort = (key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc";
    setSortConfig({ key, direction });
  };
  const SortableHeader = makeSortableHeader(sortConfig, requestSort);

  // ★ グループ優先ソート（固定 > 通常参加 > 見学固定 > 不参加）→ フィルター（名前検索、希望ロール、アクティブ状態）
  const filteredPlayers = filterPlayers(sortPlayers(players, sortConfig), { searchQuery, roleFilter, statusFilter });

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
        <ModeTabBar modeTab={modeTab} setModeTab={setModeTab} />
        <AramRotationPanel availablePlayers={players} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground-soft p-4 md:p-8 lg:p-10 max-w-[1680px] w-full mx-auto space-y-6">
      <ModeTabBar modeTab={modeTab} setModeTab={setModeTab} />
      <UsageGuide />

      {/* 👥 参加者層サマリー ＆ 🔊 Discord VC進行状況のワンクリック更新バー */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <ExperienceSummary players={players} />
        {/* 🔊 Discord VCチャンネル名・進行状況の動的更新（プリセット追加・保存対応） */}
        <BalancerVcManager onMessage={setMessage} />
      </div>

      {/* ★ チーム分け結果モーダル */}
      {balanceResult && showResultModal && (
        <BalanceResultModal
          players={players} savingPending={actions.savingPending} copiedResult={actions.copiedResult} setMessage={setMessage}
          balanceResult={balanceResult} setBalanceResult={setBalanceResult} proposals={proposals}
          selectedProposalIdx={selectedProposalIdx} setSelectedProposalIdx={setSelectedProposalIdx} analysis={analysis}
          swapSource={swap.swapSource} sendingDiscord={actions.sendingDiscord} setShowResultModal={setShowResultModal}
          selectedTable={selectedTable} sendingProposals={actions.sendingProposals} dragOverSlot={swap.dragOverSlot}
          bo3State={bo3.bo3State} handleStartBo3={bo3.handleStartBo3} handleRecordBo3Win={bo3.handleRecordBo3Win}
          handleNextBo3Game={bo3.handleNextBo3Game} handleResetBo3={bo3.handleResetBo3}
          handleRecordNavigate={actions.handleRecordNavigate} handleSendProposals={actions.handleSendProposals}
          handleSendDiscord={actions.handleSendDiscord} handleCopyResultText={actions.handleCopyResultText}
          handleDragStart={swap.handleDragStart} handleDragOver={swap.handleDragOver} handleDragLeave={swap.handleDragLeave}
          handleDropPlayer={swap.handleDropPlayer} handleSelectSwapPlayer={swap.handleSelectSwapPlayer}
          renderSwapSelect={swap.renderSwapSelect} handicapNames={handicapNames}
        />
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

        <BalancerHeader
          players={players} setPlayers={setPlayers} saving={saving} announcingStats={actions.announcingStats} isAdmin={isAdmin}
          setShowAdminPanel={setShowAdminPanel} integrityData={integrityData} balancing={balancing} balanceResult={balanceResult}
          showResultModal={showResultModal} setShowResultModal={setShowResultModal} searchDepth={searchDepth} setSearchDepth={setSearchDepth}
          selectedTable={selectedTable} setSelectedTable={setSelectedTable} bo3State={bo3.bo3State} handleResetBo3={bo3.handleResetBo3}
          handleAnnounceStats={actions.handleAnnounceStats} handleSwitchToMatch2={handleSwitchToMatch2} handleBalance={handleBalance}
          handleFestivalRandomBalance={handleFestivalRandomBalance} activeCount={activeCount} spectatorCount={spectatorCount}
          inactiveCount={inactiveCount} canBalance={canBalance}
        />

        {/* ★ 管理者パネル (isAdmin時のみ・/ktm-adminへ移動せずこの画面内でMMR整合性とRebuildを確認できる) */}
        {isAdmin && showAdminPanel && (
          <AdminPanel
            players={players} integrityData={integrityData} checkingIntegrity={checkingIntegrity} rebuildingMmr={rebuildingMmr}
            predStats={predStats} showInitialPrefs={initialPrefs.showInitialPrefs} setShowInitialPrefs={initialPrefs.setShowInitialPrefs}
            initialDraft={initialPrefs.initialDraft} setInitialDraft={initialPrefs.setInitialDraft} savingInitial={initialPrefs.savingInitial}
            sideStats={sideStats} satStats={satStats} tallyingSat={tallyingSat} checkIntegrity={checkIntegrity} fetchPredStats={fetchPredStats}
            openInitialPrefs={initialPrefs.openInitialPrefs} saveInitialPrefs={initialPrefs.saveInitialPrefs} fetchSatStats={fetchSatStats}
            handleRebuildMmr={handleRebuildMmr}
          />
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
        <PlayerListTable
          isAdmin={isAdmin} searchQuery={searchQuery} setSearchQuery={setSearchQuery} roleFilter={roleFilter} setRoleFilter={setRoleFilter}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter} setSelectedPlayer={setSelectedPlayer} flashingPlayerIds={flashingPlayerIds}
          getPlayerExperienceBadge={getPlayerExperienceBadge} handleInputChange={handleInputChange} SortableHeader={SortableHeader}
          filteredPlayers={filteredPlayers}
        />

        <MatchingGlossary />

        {/* ★ スティッキー下部クイックアクションバー */}
        <QuickActionBar balancing={balancing} balanceResult={balanceResult} setShowResultModal={setShowResultModal} handleBalance={handleBalance} handleFestivalRandomBalance={handleFestivalRandomBalance} activeCount={activeCount} spectatorCount={spectatorCount} canBalance={canBalance} />

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}
