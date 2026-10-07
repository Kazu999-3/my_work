"use client";

import { Trophy } from "lucide-react";
import { RoleIcon } from "./adminUtils";

// ステータス絞り込み・バランサーへの導線・希望ロール絞り込み
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
export default function RosterFilters({ playerCount, statusFilter, setStatusFilter, roleFilter, setRoleFilter }: {
  playerCount: number;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  roleFilter: string | null;
  setRoleFilter: (v: string | null) => void;
}) {
  return (
            <div className="space-y-3 bg-surface/70 p-4 rounded-2xl border border-border shadow-xs mb-4">
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                {/* 左：ステータス絞り込み */}
                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                  <span className="text-xs text-muted-strong font-bold mr-1">絞り込み:</span>
                  {[
                    { key: null, label: `全員 (${playerCount})` },
                    { key: 'active', label: '参加予定' },
                    { key: 'spectator', label: '見学のみ' },
                    { key: 'inactive', label: '不参加' }
                  ].map(tab => (
                    <button
                      key={tab.label}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === tab.key
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-black/5 text-muted hover:text-foreground hover:bg-black/8'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 右：大会当日バランサー連携 */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <a
                    href="/balancer"
                    className="px-3.5 py-1.5 bg-gradient-to-r from-success-600 to-secondary-600 hover:from-success-700 hover:to-secondary-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>バランサーを開く →</span>
                  </a>
                </div>
              </div>

              {/* 希望ロール絞り込み */}
              <div className="pt-2 border-t border-border flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-strong font-bold mr-1">希望ロール:</span>
                <button
                  onClick={() => setRoleFilter(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    roleFilter === null
                      ? 'bg-primary-500 text-black shadow-xs'
                      : 'bg-black/5 text-muted-strong hover:text-foreground hover:bg-black/8'
                  }`}
                >
                  ALL
                </button>
                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      roleFilter === role
                        ? 'bg-surface border-primary-edge-strong text-primary-700 font-black shadow-xs'
                        : 'bg-black/5 border-transparent text-muted-strong hover:text-foreground hover:bg-black/8'
                    }`}
                  >
                    <RoleIcon role={role} className="w-3 h-3" />
                    <span>{role}</span>
                  </button>
                ))}
              </div>
            </div>
  );
}
