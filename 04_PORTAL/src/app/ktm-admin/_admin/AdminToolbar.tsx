"use client";

import { Users, RefreshCw, Filter, X, Zap, PartyPopper } from "lucide-react";

// 名簿タブの見出し・検索・自動保存の状態・操作ボタン（お祭り参加+1 / 全員メンテ）
export default function AdminToolbar({
  searchQuery,
  setSearchQuery,
  saving,
  loading,
  syncingMaintenance,
  onForceReset,
  onSyncAllMaintenance,
  onAddFestivalAttendance,
  activeCount = 0,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  saving: boolean;
  loading: boolean;
  syncingMaintenance?: boolean;
  onForceReset: () => void;
  onSyncAllMaintenance?: () => void;
  onAddFestivalAttendance?: () => void;
  activeCount?: number;
}) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-6 gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary-500" />
          KTM 管理ダッシュボード
        </h1>
        <p className="text-faint mt-2 text-sm">
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
            className="w-full bg-surface border border-border rounded-lg px-4 py-2 pl-9 text-xs text-foreground focus:outline-none focus:border-primary-edge-strong transition"
          />
          <Filter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-strong" />
        </div>

        {/* 自動保存ステータス */}
        <div className="flex items-center gap-2 text-xs text-muted-strong font-medium">
          {saving ? (
            <span className="flex items-center gap-1.5 text-primary-700">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              自動保存中...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-success-700">
              <span>✓</span>
              自動保存済み
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-black/5 hidden md:block"></div>

        {/* 🎪 お祭り参加一括付与ボタン */}
        {onAddFestivalAttendance && (
          <button
            onClick={onAddFestivalAttendance}
            disabled={loading || saving || activeCount === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition border text-xs shadow-sm ${
              activeCount > 0 && !loading && !saving
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 border-amber-500/50 hover:border-amber-500 cursor-pointer'
                : 'bg-black/5 text-muted-strong border-border opacity-50 cursor-not-allowed'
            }`}
            title="Activeにチェックが付いているメンバー全員にお祭りカスタム参加回数（+1）を記録します。勝敗やMMRは変動せず、初参加バッジが外れます。"
          >
            <PartyPopper className={`h-4 w-4 ${activeCount > 0 ? 'text-amber-600' : 'text-muted-strong'}`} />
            🎪 Activeに参加+1 {activeCount > 0 ? `(${activeCount}名)` : ''}
          </button>
        )}

        {/* ⚡ 全員メンテボタン */}
        {onSyncAllMaintenance && (
          <button
            onClick={onSyncAllMaintenance}
            disabled={syncingMaintenance || loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition border text-xs shadow-sm ${
              syncingMaintenance
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 cursor-not-allowed'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/40 hover:border-amber-500/60 cursor-pointer'
            }`}
            title="全プレイヤーの最新SoloQランクをRiot APIから取得し、最高ランク更新・Discordロール（ランク＆参加歴）を一括メンテします"
          >
            <Zap className={`h-4 w-4 text-amber-500 ${syncingMaintenance ? 'animate-bounce' : ''}`} />
            {syncingMaintenance ? "メンテ中..." : "⚡ 全員メンテ"}
          </button>
        )}

        {/* ローディング強制解除ボタン（通信中のみ表示される救済策） */}
        {(syncingMaintenance || saving) && (
          <button
            onClick={onForceReset}
            className="flex items-center gap-1.5 bg-surface hover:bg-black/5 text-primary-500 border border-primary-edge-soft px-3 py-2 rounded-lg font-bold transition text-xs animate-pulse cursor-pointer"
            title="通信が詰まってぐるぐるが終わらない場合に、強制的にボタンやローディングを元に戻します"
          >
            <X className="h-4 w-4 text-primary-500" />
            ローディング強制解除
          </button>
        )}
      </div>
    </div>
  );
}
