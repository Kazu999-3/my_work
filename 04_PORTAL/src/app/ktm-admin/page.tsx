"use client";

import { useEffect, useState } from "react";
import MatchHistoryPanel from "./MatchHistoryPanel";
import ProfileModal from "./ProfileModal";
import DiscordRoleSyncModal from "./DiscordRoleSyncModal";
import { Users, RefreshCw, AlertCircle, History, Shield } from "lucide-react";
import { useAdminRoster, type AdminMessage } from "./_admin/useAdminRoster";
import { useRosterSync } from "./_admin/useRosterSync";
import AdminToolbar from "./_admin/AdminToolbar";
import SyncPreviewModal from "./_admin/SyncPreviewModal";
import MmrInfoPanel from "./_admin/MmrInfoPanel";
import RiotErrorPanel from "./_admin/RiotErrorPanel";
import IntegrityStatus from "./_admin/IntegrityStatus";
import AdminExperienceSummary from "./_admin/AdminExperienceSummary";
import RosterFilters from "./_admin/RosterFilters";
import PlayerCardsMobile from "./_admin/PlayerCardsMobile";
import PlayerTableDesktop from "./_admin/PlayerTableDesktop";

// KTM管理ダッシュボード（名簿・MMR編集 / 戦績履歴）。状態は _admin/ のフック（名簿・同期）が持ち、ここは画面の組み立てだけ。
// 2026-10-07: 1,885行から分割。あわせて以下を修正:
//  - 管理者以外で開くと「データを読み込み中...」のまま進まず、ログイン案内が出なかった（読み込み判定が認証判定より先だった）
//  - MMR計算ロジックの説明が実装と食い違っていた（_admin/MmrInfoPanel.tsx）
//  - ボタンが外れて呼ばれていなかった一括オート同期・全員のRiot同期の処理を削除
export default function KtmAdminPage() {
  // Discord OAuth(Supabase)依存を廃止し、パスワード認証(HttpOnly Cookie: admin_session)に統一。
  // middleware.ts は /admin/* のみをmatcherにしているため、/ktm-admin はここで明示的に検証する。
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<AdminMessage>({ type: "", text: "" });

  useEffect(() => {
    fetch("/api/auth/verify", { method: "POST", credentials: "include" })
      .then((res) => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false))
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setIsAdmin(false);
    window.location.href = "/login";
  };

  const roster = useAdminRoster(!authLoading && isAdmin, setMessage);
  const { players, loading, saving } = roster;
  const sync = useRosterSync({
    players, fetchPlayers: roster.fetchPlayers, checkIntegrity: roster.checkIntegrity, setMessage, triggerRowFlash: roster.triggerRowFlash,
  });

  const [sortConfig, setSortConfig] = useState({ key: "no", direction: "asc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showMmrInfo, setShowMmrInfo] = useState(false);
  const [showRoleSyncModal, setShowRoleSyncModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // タブ（URLクエリ ?tab=history / ?tab=players と同期）
  const [activeTab, setActiveTab] = useState<'players' | 'history'>('players');
  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'history' || tabParam === 'players') setActiveTab(tabParam);
  }, []);
  const handleTabChange = (tab: 'players' | 'history') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  const requestSort = (key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc";
    setSortConfig({ key, direction });
  };

  // No.（参加日時順）を振ってから、検索・希望ロール・参加状態で絞り込み、並び替える
  const playersWithNo = [...players].sort((a, b) => {
    const timeA = a.metadata?.joined_at ? new Date(a.metadata.joined_at).getTime() : Infinity;
    const timeB = b.metadata?.joined_at ? new Date(b.metadata.joined_at).getTime() : Infinity;
    return timeA - timeB;
  }).map((p, index) => ({ ...p, no: index + 1 }));

  const sortedPlayers = playersWithNo
    .filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.name?.toLowerCase().includes(query);
        const ignMatch = p.ign?.toLowerCase().includes(query);
        const discordMatch = p.discord_id?.toLowerCase().includes(query);
        if (!nameMatch && !ignMatch && !discordMatch) return false;
      }
      const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
      if (roleFilter && prefs.primary !== roleFilter) return false;
      if (statusFilter) {
        if (statusFilter === 'active' && (!p.is_active || p.is_spectator_fixed)) return false;
        if (statusFilter === 'spectator' && !p.is_spectator_fixed) return false;
        if (statusFilter === 'inactive' && p.is_active) return false;
      }
      return true;
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

  // ★ 2026-10-07: 認証の判定を読み込み判定より先にする。以前は loading の初期値 true のまま
  // （管理者でないと名簿を取得しないため）「データを読み込み中...」が出続け、ログイン案内に到達しなかった。
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground-soft flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 text-primary-500 animate-spin mx-auto" />
          <p className="text-sm text-faint font-bold">認証情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground-soft flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-lg p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <Shield className="h-16 w-16 text-primary-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">KTM 管理ダッシュボード</h1>
            <p className="text-sm text-faint font-medium">この画面にアクセスするには、管理者パスコードでのログインが必要です。</p>
          </div>
          <button
            onClick={() => { window.location.href = "/login"; }}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded transition flex items-center justify-center gap-2"
          >
            <Shield className="h-5 w-5" /> ログインページへ
          </button>
        </div>
      </div>
    );
  }

  if (loading && players.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
        <span className="ml-3">データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground-soft p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Auth Bar */}
        <div className="flex justify-between items-center bg-surface border border-border rounded-lg px-6 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-500" />
            <span className="text-xs font-bold text-foreground">KTM 管理モード</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-faint">
              ログイン中: <strong className="text-foreground font-bold">管理者</strong>
            </span>
            <button
              onClick={handleLogout}
              className="bg-black/5 hover:bg-danger-100 hover:text-danger-700 border border-border px-3 py-1.5 rounded text-xs font-bold transition"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => handleTabChange('players')}
            className={`px-6 py-3 font-bold text-sm flex items-center gap-2 transition border-b-2 cursor-pointer ${
              activeTab === 'players'
                ? 'border-primary-edge-strong text-primary-700 bg-primary-500/5'
                : 'border-transparent text-muted-strong hover:text-foreground-subtle hover:bg-black/5'
            }`}
          >
            <Users className="h-4 w-4" /> 👥 プレイヤー名簿・MMR編集 ({players.length}名)
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`px-6 py-3 font-bold text-sm flex items-center gap-2 transition border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-success-edge-strong text-success-700 bg-success-500/5'
                : 'border-transparent text-muted-strong hover:text-foreground-subtle hover:bg-black/5'
            }`}
          >
            <History className="h-4 w-4" /> ⚔️ 戦績履歴・勝敗登録
          </button>
        </div>

        {activeTab === 'history' && <MatchHistoryPanel />}

        {activeTab === 'players' && (
          <div className="space-y-6">
            <AdminToolbar
              searchQuery={searchQuery} setSearchQuery={setSearchQuery} saving={saving} loading={loading}
              syncingDiscord={sync.syncingDiscord} syncData={sync.syncData} showMmrInfo={showMmrInfo} setShowMmrInfo={setShowMmrInfo}
              onDeactivateAll={roster.handleDeactivateAll}
              onForceReset={() => {
                sync.resetSyncFlags();
                roster.setSaving(false);
                roster.setLoading(false);
                setMessage({ type: "info", text: "⚠️ 処理のローディング状態を強制解除しました。" });
              }}
              onSyncCheck={sync.handleSyncCheck}
              onOpenRoleSync={() => setShowRoleSyncModal(true)}
              onRebuild={roster.handleRebuildMmr}
            />

            {showRoleSyncModal && <DiscordRoleSyncModal onClose={() => setShowRoleSyncModal(false)} />}

            {sync.syncData && (
              <SyncPreviewModal
                syncData={sync.syncData} setSyncData={sync.setSyncData} syncingDiscord={sync.syncingDiscord}
                onCancel={sync.cancelSyncPreview} onExecute={sync.executeSync}
              />
            )}

            {showMmrInfo && <MmrInfoPanel onClose={() => setShowMmrInfo(false)} />}

            {/* Message Banner */}
            {message.text && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'error' ? 'bg-danger-100 text-danger-700 border border-danger-edge-soft' : 'bg-success-100 text-success-700 border border-success-edge-soft'}`}>
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium whitespace-pre-wrap">{message.text}</p>
              </div>
            )}

            {sync.riotSyncErrors.length > 0 && (
              <RiotErrorPanel
                riotSyncErrors={sync.riotSyncErrors} reSyncingPlayerId={sync.reSyncingPlayerId}
                onClose={() => sync.setRiotSyncErrors([])} onResolve={sync.handleResolveRiotError}
              />
            )}

            {roster.integrityData && <IntegrityStatus integrityData={roster.integrityData} onRebuild={roster.handleRebuildMmr} />}

            <AdminExperienceSummary players={players} />

            <RosterFilters
              playerCount={players.length} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              roleFilter={roleFilter} setRoleFilter={setRoleFilter}
            />

            <PlayerCardsMobile
              sortedPlayers={sortedPlayers} handleInputChange={roster.handleInputChange} handleInputSave={roster.handleInputSave}
              handleBlurSave={roster.handleBlurSave} setSelectedPlayer={setSelectedPlayer}
            />

            <PlayerTableDesktop
              sortedPlayers={sortedPlayers} playerCount={players.length} loading={loading} sortConfig={sortConfig} requestSort={requestSort}
              flashingPlayerIds={roster.flashingPlayerIds} handleInputChange={roster.handleInputChange} handleInputSave={roster.handleInputSave}
              handleBlurSave={roster.handleBlurSave} setSelectedPlayer={setSelectedPlayer}
            />
          </div>
        )}

        {selectedPlayer && (
          <ProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
        )}
      </div>
    </div>
  );
}
