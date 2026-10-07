"use client";

import { Info, Users, RefreshCw, Filter, X, Sparkles } from "lucide-react";

// 名簿タブの見出し・検索・自動保存の状態・各種操作ボタン（全員非アクティブ / Discord & Riot同期 / ロール連携 / Rebuild / MMR説明）
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
export default function AdminToolbar({ searchQuery, setSearchQuery, saving, loading, syncingDiscord, syncData, showMmrInfo, setShowMmrInfo, onDeactivateAll, onForceReset, onSyncCheck, onOpenRoleSync, onRebuild }: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  saving: boolean;
  loading: boolean;
  syncingDiscord: boolean;
  syncData: any;
  showMmrInfo: boolean;
  setShowMmrInfo: (v: boolean) => void;
  onDeactivateAll: () => void;
  onForceReset: () => void;
  onSyncCheck: () => void;
  onOpenRoleSync: () => void;
  onRebuild: () => void;
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

                <button
                  onClick={onDeactivateAll}
                  disabled={loading || saving}
                  className="flex items-center gap-2 bg-danger-100 hover:bg-danger-200 border border-danger-edge-soft hover:border-danger-edge text-danger-700 px-4 py-2 rounded-lg font-bold transition text-xs"
                >
                  <X className="h-4 w-4" />
                  全員非アクティブ
                </button>



                {(syncingDiscord || saving) && (
                  <button
                    onClick={onForceReset}
                    className="flex items-center gap-1.5 bg-surface hover:bg-black/5 text-primary-500 border border-primary-edge-soft px-3 py-2 rounded-lg font-bold transition text-xs animate-pulse"
                    title="通信が詰まってぐるぐるが終わらない場合に、強制的にボタンやローディングを元に戻します"
                  >
                    <X className="h-4 w-4 text-primary-500" />
                    ローディング強制解除
                  </button>
                )}
                
                <button
                  onClick={onSyncCheck}
                  disabled={syncingDiscord}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition border text-xs ${
                    syncingDiscord ? 'bg-[#404eed]/50 border-[#404eed]/50 text-faint cursor-not-allowed' : 'bg-[#5865F2]/20 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white'
                  }`}
                >
                  <Users className={`h-4 w-4 ${syncingDiscord && !syncData ? 'animate-spin' : ''}`} /> 
                  {syncingDiscord && !syncData ? "同期確認中..." : "👤 Discord & Riot同期"}
                </button>

                <button
                  onClick={onOpenRoleSync}
                  className="flex items-center gap-2 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40 px-3 py-2 rounded-lg font-bold transition text-xs shadow-sm"
                  title="内戦の通算試合数に応じた5種類のDiscordロール（初参加/ライト/常連/経験者/復帰勢）を作成・同期します"
                >
                  <Sparkles className="h-4 w-4 text-[#5865F2]" />
                  🎭 ロール連携
                </button>

                <button
                  onClick={onRebuild}
                  className="flex items-center gap-2 bg-danger-100 hover:bg-danger-200 text-danger-700 border border-danger-edge-soft px-4 py-2 rounded-lg font-bold transition text-xs"
                  title="過去のすべての試合履歴を元にMMRを再計算し、全員のデータを上書きします"
                >
                  <RefreshCw className="h-4 w-4" /> 🔄 Rebuild
                </button>

                <button
                  onClick={() => setShowMmrInfo(!showMmrInfo)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition border text-xs ${showMmrInfo ? 'bg-primary-100 border-primary-edge-strong text-primary-700' : 'bg-black/5 border-border text-faint hover:text-foreground'}`}
                  title="MMR計算ロジックを見る"
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
            </div>
  );
}
