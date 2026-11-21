"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { X } from "lucide-react";
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
import { ExperienceSummary, makeSortableHeader, getPlayerExperienceBadge, MatchingGlossary } from "./_parts/PageSections";
import BalanceResultModal from "./_parts/BalanceResultModal";
import BalancerHeader from "./_parts/BalancerHeader";
import GapDiagnosisPanel from "./_parts/GapDiagnosisPanel";
import TableSplitPanel from "./_parts/TableSplitPanel";
import PlayerListTable from "./_parts/PlayerListTable";
import QuickActionBar from "./_parts/QuickActionBar";
import { BalancerVcManager } from "./components/BalancerVcManager";
import CustomSubNav from "../../components/CustomSubNav";
import ScrollToTopButton from "../../components/ScrollToTopButton";
import type {
  BalancerPlayer,
  BalanceResult,
  BalancerPayloadParticipant,
  TableSplit,
  SelectionMode,
} from "./_parts/types";

// ── 遅延読込 ───────────────────────────────────────────────────────
// いずれも「常に表示されるわけではない」ものを、必要になるまで読み込まない。
//   ProfileModal        … selectedPlayer が選ばれたときだけ表示するモーダル
//   BalancerStadiumView … balanceResult が確定したあとにだけ表示
// ⚠️ dynamic 化が効くのは「描画されるまでマウントされない」場合だけ。
//    上記2つはいずれも元から条件付き描画なので、そのまま効果が出る。
const ProfileModal = dynamic(() => import("../ktm-admin/ProfileModal"), { ssr: false });
const BalancerStadiumView = dynamic(() => import("./components/BalancerStadiumView"), { ssr: false });

// 格差診断: 対面を組めない外れ値とみなすMMR差
const GAP_THRESHOLD = 250;
// ハンデ参加時にチーム分けの計算上で差し引くMMR（実際の戦績・MMRは変わらない）
const HANDICAP_MMR_PENALTY = 150;

/**
 * 参加者リストからチーム分けAPIリクエスト用のペイロードを構築する純粋関数
 * （06_code_smells_and_dod.md: 引数オブジェクト化 ＆ 責務の分離）
 */
function buildParticipantPayloads({
  activePlayers,
  handicapIds,
  defaultHandicapPenalty,
}: {
  activePlayers: BalancerPlayer[];
  handicapIds: (string | number)[];
  defaultHandicapPenalty: number;
}): BalancerPayloadParticipant[] {
  return activePlayers.map((p) => {
    const pref1 = p.role_preferences?.primary;
    const customH = p.customHandicap || p.role_preferences?.customHandicap;
    const isHandicapped = handicapIds.includes(p.id) || Boolean(customH);
    const fixedRole = p.is_fixed && pref1 && pref1 !== 'ALL' && pref1 !== '-' ? pref1 : null;

    return {
      name: p.name,
      isFixed: Boolean(p.is_fixed),
      isSpectatorFixed: Boolean(p.is_spectator_fixed),
      fixedRole,
      handicap: isHandicapped,
      handicapMmrPenalty: customH?.mmrPenalty ?? (handicapIds.includes(p.id) ? defaultHandicapPenalty : 0),
      handicapRule: customH?.rule ?? (handicapIds.includes(p.id) ? 'ハンデ参加' : null),
      handicappedBy: customH?.by ?? null,
    };
  });
}

// カスタムバランサー。状態の大半は _parts/ のフック（参加者リスト・BO3・入れ替え・共有操作・初期レーン編集）が持ち、
// ここはチーム分けの実行と画面の組み立てだけを担う。
// 2026-10-07: 3,029行 → 1,140行（82168c14）→ 本ファイル。使われていなかった状態(selectedHandicaps / showRecordPanel)を削除。
export default function BalancerPage() {
  const { user: currentUser } = useCurrentUser();

  // 🏆 直前の試合結果とMMR変動サマリー（sessionStorage連携）
  const [lastMatchResult, setLastMatchResult] = useState<{
    matchId?: string;
    winningTeam: 'BLUE' | 'RED';
    updates: Array<{ name: string; team: string; role: string; champion_name?: string; mmrDelta: number; newMmr: number }>;
    recordedAt: number;
  } | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem('ktm_last_match_result');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.recordedAt < 15 * 60 * 1000) {
            setLastMatchResult(parsed);
          }
        }
      }
    } catch {}
  }, []);

  const handleDismissLastMatch = () => {
    setLastMatchResult(null);
    try {
      sessionStorage.removeItem('ktm_last_match_result');
    } catch {}
  };
  const [message, setMessage] = useState({ type: "", text: "" });

  // ★ 管理者向け（整合性チェック・品質統計）
  const [isAdmin, setIsAdmin] = useState(false);
  const [rebuildingMmr, setRebuildingMmr] = useState(false);
  const {
    integrityData, checkingIntegrity, checkIntegrity,
    predStats, fetchPredStats, sideStats, satStats, tallyingSat, fetchSatStats,
  } = useBalancerAdminStats(isAdmin);

  const { players, setPlayers, loading, saving, flashingPlayerIds, fetchPlayers, handleInputChange } = usePlayerRoster(isAdmin, setMessage);

  const [balancing, setBalancing] = useState(false);
  const [balanceResult, setBalanceResult] = useState<BalanceResult | null>(null); // モーダルプレビュー用
  const [confirmedResult, setConfirmedResult] = useState<BalanceResult | null>(null); // 正式に確定されたチーム分け
  const [proposals, setProposals] = useState<BalanceResult[]>([]);
  const [selectedProposalIdx, setSelectedProposalIdx] = useState<number>(0);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  // ★ チーム分け結果モーダルの表示フラグ
  const [showResultModal, setShowResultModal] = useState(false);

  // フィルター・並び替え
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState({ key: "no", direction: "asc" });
  const [selectedPlayer, setSelectedPlayer] = useState<BalancerPlayer | null>(null);

  // BL-02: 探索強度（常に200=精密で固定）
  const [searchDepth, setSearchDepth] = useState(200);
  // 11人以上の時に出る人の選び方（公平 / 低レート優先 / 高レート優先）
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('fair');

  // 格差診断: 参加者をMMR順に2人ずつペアにし、「近い実力の相手がいない人」を検出する。
  // チーム全体のMMR幅より「レーン対面の格差」が体験に効くため、対面を組めない外れ値を警告する。
  const gapDiagnosis = useMemo(() => diagnoseMmrGaps(players, GAP_THRESHOLD), [players]);

  // ハンデ参加(オフロール等)の指定。チーム分け結果とDiscord通知に明示する。
  const [handicapIds, setHandicapIds] = useState<(string | number)[]>([]);
  const toggleHandicap = (id: string | number) =>
    setHandicapIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // チーム分け結果は名前ベースなので、ハンデ対象の「名前」集合に変換して照合する
  const handicapNames = useMemo(
    () => new Set<string>(players.filter((p: BalancerPlayer) => handicapIds.includes(p.id)).map((p: BalancerPlayer) => p.name)),
    [players, handicapIds]
  );

  // 卓分割: 参加者が20人以上のとき、代表MMR順で「上位卓/下位卓」に自動分割する。
  // 卓分け=代表MMR(ktm_players.mmr)、卓の中のチーム分け=レーン別MMR、という役割分担。
  const [selectedTable, setSelectedTable] = useState<TableSplit | null>(null);
  const tableSplit = useMemo(() => splitTables(players), [players]);

  const bo3 = useBo3Series(balanceResult, setBalanceResult, setMessage);
  const swap = useResultSwap({ balanceResult, setBalanceResult, setProposals, selectedProposalIdx, players });
  const actions = useResultActions({
    balanceResult,
    proposals,
    players,
    handicapNames,
    setMessage,
    bo3State: bo3.bo3State,
    onConfirm: (res) => setConfirmedResult(res),
  });

  useEffect(() => {
    fetch("/api/auth/verify", { method: "POST", credentials: "include" })
      .then((res) => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false));

    // 正式に確定された進行中チーム分けのみをロード
    fetch("/api/balancer/pending")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.balanceResult) {
          setConfirmedResult((prev) => prev || data.balanceResult);
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: "❌ Rebuild エラー: " + errMsg });
    } finally {
      setRebuildingMmr(false);
    }
  };

  const handleBalance = async () => {
    // 卓分割: 選択中の卓があればそのメンバーのみ、なければ全員
    const allActive = (players as BalancerPlayer[]).filter((p) => p.is_active);
    const activePlayers = selectedTable
      ? allActive.filter((p) => selectedTable.ids.includes(p.id))
      : allActive;

    // ガード節（06_code_smells_and_dod.md）
    if (activePlayers.length < 10) {
      setMessage({
        type: "error",
        text: `チーム分けには最低10人のActiveプレイヤーが必要です。(現在 ${activePlayers.length}人)`,
      });
      return;
    }

    // 構成復元用のローカルキャッシュ保存
    try {
      localStorage.setItem('balancer_active_ids', JSON.stringify(activePlayers.map((p) => p.id)));
    } catch {}

    // 前回結果が残っている場合の確認
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
      const participants = buildParticipantPayloads({
        activePlayers,
        handicapIds,
        defaultHandicapPenalty: HANDICAP_MMR_PENALTY,
      });

      const res = await fetch('/api/balancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants,
          searchDepth,
          selectionMode,
          handicapPenalty: HANDICAP_MMR_PENALTY,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'チーム分けに失敗しました');

      const hasProposals = Array.isArray(data.proposals) && data.proposals.length > 0;
      const activeResult: BalanceResult = hasProposals ? data.proposals[0] : data;
      setProposals(hasProposals ? data.proposals : [data]);
      setBalanceResult(activeResult);
      setSelectedProposalIdx(0);
      setAnalysis(hasProposals ? (data.analysis || null) : null);
      setShowResultModal(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: "❌ バランス計算エラー: " + errMsg });
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

  // ★ 結果表示モーダルを開くハンドラー（confirmedResult がある場合はそれをセットして確実に開く）
  const handleOpenResultModal = () => {
    if (!balanceResult && confirmedResult) {
      setBalanceResult(confirmedResult);
    }
    setShowResultModal(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground-soft p-4 pb-28 md:p-8 md:pb-28 lg:p-10 lg:pb-28 max-w-[1680px] w-full mx-auto space-y-6">
      <CustomSubNav />

      {/* 🏆 直前の試合結果 ＆ MMR変動サマリーハイライト */}
      {lastMatchResult && (
        <div className="max-w-[1900px] mx-auto p-3 md:p-6 pb-0">
          <div className="bg-gradient-to-r from-surface to-surface-subtle border border-primary-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative animate-in fade-in slide-in-from-top-2">
            <button
              onClick={handleDismissLastMatch}
              className="absolute top-3 right-3 text-muted hover:text-foreground p-1 rounded-lg transition"
              title="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-primary-500 text-white shadow-xs">
                🎉 直前の試合記録完了
              </span>
              <span className="text-xs text-muted font-bold">
                勝利: <strong className={lastMatchResult.winningTeam === 'BLUE' ? 'text-cyan-500' : 'text-rose-500'}>{lastMatchResult.winningTeam === 'BLUE' ? 'BLUEチーム' : 'REDチーム'}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {lastMatchResult.updates.map((u: any, i: number) => (
                <div key={i} className="bg-surface/90 border border-border rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-black text-foreground truncate">{u.name}</span>
                    <span className="text-[10px] text-muted font-mono">{u.role}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-strong font-mono">{u.newMmr}pt</span>
                    <span className={`font-black font-mono text-xs ${u.mmrDelta > 0 ? 'text-emerald-500' : u.mmrDelta < 0 ? 'text-rose-500' : 'text-muted'}`}>
                      {u.mmrDelta > 0 ? `+${u.mmrDelta}` : u.mmrDelta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 👥 参加者層サマリー */}
      <div>
        <ExperienceSummary players={players} />
      </div>

      {/* 💡 KTMレーティング・チーム分け用語の解説 */}
      <div>
        <MatchingGlossary />
      </div>

      {/* ★ チーム分け結果モーダル */}
      {(balanceResult || confirmedResult) && showResultModal && (
        <BalanceResultModal
          players={players} savingPending={actions.savingPending} copiedResult={actions.copiedResult} setMessage={setMessage}
          balanceResult={balanceResult || confirmedResult} setBalanceResult={setBalanceResult} proposals={proposals}
          selectedProposalIdx={selectedProposalIdx} setSelectedProposalIdx={setSelectedProposalIdx} analysis={analysis}
          swapSource={swap.swapSource} sendingDiscord={actions.sendingDiscord} setShowResultModal={setShowResultModal}
          selectedTable={selectedTable} dragOverSlot={swap.dragOverSlot}
          bo3State={bo3.bo3State} handleStartBo3={bo3.handleStartBo3} handleRecordBo3Win={bo3.handleRecordBo3Win}
          handleNextBo3Game={bo3.handleNextBo3Game} handleResetBo3={bo3.handleResetBo3}
          handleRecordNavigate={actions.handleRecordNavigate}
          handleSendDiscord={actions.handleSendDiscord} handleCopyResultText={actions.handleCopyResultText}
          handleDragStart={swap.handleDragStart} handleDragOver={swap.handleDragOver} handleDragLeave={swap.handleDragLeave}
          handleDropPlayer={swap.handleDropPlayer} handleSelectSwapPlayer={swap.handleSelectSwapPlayer}
          renderSwapSelect={swap.renderSwapSelect} handicapNames={handicapNames}
          handleSwapWholeTeams={swap.handleSwapWholeTeams}
        />
      )}

      {/* 参加者リストの表は13列(参加設定/No./名前/ランク/MMR/希望×2/NG×2/こだわり/格上/
          Pity/備考)あり、自然な幅は約1300pxに達する。旧max-w-[1400px]では左サイドバー
          (約256px)や余白を差し引くと1440px前後の画面でも収まりきらず、常に横スクロール
          が発生していた。ワイドモニタでは表がしっかり収まるよう広げる(2026-08-15)。 */}
      <div className="max-w-[1900px] mx-auto p-3 md:p-6 space-y-4">

        {/* 🏟️ 観戦スタジアムビュー (正式に確定した最新マッチがある場合のみ表示) */}
        {confirmedResult && (
          <div className="mb-2">
            <BalancerStadiumView
              result={confirmedResult}
              currentUserName={currentUser?.playerName || currentUser?.displayName}
              isAdmin={isAdmin}
              onOpenAdminModal={() => {
                setBalanceResult(confirmedResult);
                setShowResultModal(true);
              }}
            />
          </div>
        )}

        <BalancerHeader
          players={players} setPlayers={setPlayers} saving={saving} announcingStats={actions.announcingStats} isAdmin={isAdmin}
          predStats={predStats} satStats={satStats} integrityData={integrityData} balancing={balancing} balanceResult={confirmedResult}
          showResultModal={showResultModal} setShowResultModal={setShowResultModal} onOpenResultModal={handleOpenResultModal} searchDepth={searchDepth} setSearchDepth={setSearchDepth} selectionMode={selectionMode} setSelectionMode={setSelectionMode}
          selectedTable={selectedTable} setSelectedTable={setSelectedTable} bo3State={bo3.bo3State} handleResetBo3={bo3.handleResetBo3}
          handleAnnounceStats={actions.handleAnnounceStats} handleBalance={handleBalance}
          handleFestivalRandomBalance={handleFestivalRandomBalance} activeCount={activeCount} spectatorCount={spectatorCount}
          inactiveCount={inactiveCount} canBalance={canBalance}
        />

        {/* 🔊 Discord VCステータス操作バー */}
        <BalancerVcManager onMessage={setMessage} />

        {/* ⚠️ MMR整合性ズレ警告バナー（ズレ検知時のみ自動出現） */}
        {integrityData?.hasDiscrepancy && (
          <div className="p-3 bg-danger-100 border border-danger-edge-strong rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-danger-900 font-bold shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>MMRの整合性にズレが検知されました（{integrityData.discrepancyCount}名）。</span>
            </div>
            <button
              onClick={handleRebuildMmr}
              disabled={rebuildingMmr}
              className="px-3 py-1.5 bg-danger-600 hover:bg-danger-500 text-white rounded-lg font-black transition disabled:opacity-50 cursor-pointer"
            >
              {rebuildingMmr ? '再計算中...' : '🔄 MMRを自動修復（再計算）'}
            </button>
          </div>
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

        {/* ★ スティッキー下部クイックアクションバー */}
        <QuickActionBar balancing={balancing} balanceResult={confirmedResult} setShowResultModal={setShowResultModal} onOpenResultModal={handleOpenResultModal} handleBalance={handleBalance} handleFestivalRandomBalance={handleFestivalRandomBalance} activeCount={activeCount} spectatorCount={spectatorCount} canBalance={canBalance} />

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}

        {/* トップへ戻る */}
        <ScrollToTopButton />
      </div>
    </div>
  );
}
