"use client";

import { Info, RefreshCw } from "lucide-react";
import { HIGHEST_RANK_OPTIONS, getColorFromRankName } from "../../../lib/mmr";
import { getColorFromRole, getPlayerExperienceBadge } from "./adminUtils";

// 名簿（スマホ用カード: 片手で出欠・ロール・最高Rankを編集）
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
export default function PlayerCardsMobile({ sortedPlayers, handleInputChange, handleInputSave, handleBlurSave, setSelectedPlayer, onSyncSinglePlayer, reSyncingPlayerId }: {
  sortedPlayers: any[];
  handleInputChange: (uid: string, field: string, value: any) => void;
  handleInputSave: (uid: string, field: string, value: any) => void;
  handleBlurSave: () => void;
  setSelectedPlayer: (p: any) => void;
  onSyncSinglePlayer?: (playerId: number, playerName?: string) => void;
  reSyncingPlayerId?: number | null;
}) {
  return (
            <div className="md:hidden space-y-2.5">
              {sortedPlayers.map((p) => {
                const uid = p.id || p.discord_id;
                const exp = getPlayerExperienceBadge(p);
                return (
                  <div key={uid} className={`bg-surface border rounded-2xl p-3.5 transition shadow-2xs space-y-2.5 ${
                    p.is_active ? 'border-primary-edge bg-primary-50/30' : 'border-border'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        {/* Active チェックボックス（スマホで押しやすいサイズ） */}
                        <label className="flex items-center cursor-pointer p-0.5 -m-0.5" title="Active（参加）の切り替え">
                          <input
                            type="checkbox"
                            checked={!!p.is_active}
                            onChange={(e) => handleInputSave(uid, "is_active", e.target.checked)}
                            className="h-5 w-5 rounded border-border text-primary-600 focus:ring-primary-500 bg-black/5 cursor-pointer accent-primary-600"
                          />
                        </label>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => handleInputChange(uid, "name", e.target.value)}
                          onBlur={handleBlurSave}
                          className="bg-transparent font-black text-foreground text-sm outline-none max-w-[120px]"
                        />
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded border shadow-2xs whitespace-nowrap ${exp.color}`}
                          title={exp.tip}
                        >
                          {exp.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setSelectedPlayer(p)} className="text-primary-700 p-1 hover:bg-black/5 rounded">
                          <Info className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono font-black text-primary-900 bg-primary-100 px-2 py-0.5 rounded-lg border border-primary-edge-soft">
                          MMR {p.mmr || 1200}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-faint font-bold">最高Rank</span>
                        <select
                          value={p.highest_rank || "UNRANKED"}
                          onChange={(e) => handleInputSave(uid, "highest_rank", e.target.value)}
                          className={`bg-black/5 border border-border rounded-lg px-2 py-1 outline-none font-bold text-xs ${getColorFromRankName(p.highest_rank)}`}
                        >
                          {HIGHEST_RANK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </label>

                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-faint font-bold">希望ロール (主/副)</span>
                        <div className="flex items-center gap-1">
                          <select
                            value={p.role_preferences?.primary || "ALL"}
                            onChange={(e) => { const v = e.target.value; handleInputSave(uid, "primary_role", v); if (v === "ALL") handleInputSave(uid, "secondary_role", "-"); }}
                            className={`flex-1 bg-black/5 border border-border rounded-lg px-1.5 py-1 outline-none font-bold text-xs ${getColorFromRole(p.role_preferences?.primary)}`}
                          >
                            {["ALL","TOP","JG","MID","ADC","SUP"].map(role => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <span className="text-faint">/</span>
                          <select
                            value={p.role_preferences?.secondary || "-"}
                            disabled={p.role_preferences?.primary === "ALL"}
                            onChange={(e) => handleInputSave(uid, "secondary_role", e.target.value)}
                            className={`flex-1 bg-black/5 border border-border rounded-lg px-1.5 py-1 outline-none font-bold text-xs disabled:opacity-40 ${getColorFromRole(p.role_preferences?.secondary)}`}
                          >
                            {["-","ALL","TOP","JG","MID","ADC","SUP"].map(role => <option key={role} value={role}>{role}</option>)}
                          </select>
                        </div>
                      </label>
                    </div>

                    {/* IGN & 単体再同期 */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-faint font-bold shrink-0">Riot:</span>
                        <input
                          type="text"
                          value={p.ign || ""}
                          onChange={(e) => handleInputChange(uid, "ign", e.target.value)}
                          onBlur={handleBlurSave}
                          placeholder="Name#TAG"
                          className="bg-transparent border border-transparent focus:border-border rounded px-1 py-0.5 outline-none font-mono text-primary-700 text-[11px] truncate"
                        />
                      </div>
                      {onSyncSinglePlayer && p.ign && p.ign.includes('#') && (
                        <button
                          type="button"
                          onClick={() => onSyncSinglePlayer(p.id, p.name)}
                          disabled={reSyncingPlayerId === p.id}
                          className="px-2 py-0.5 bg-black/5 hover:bg-black/10 border border-border rounded text-[10px] font-bold text-muted-strong hover:text-primary-600 transition flex items-center gap-1 shrink-0 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${reSyncingPlayerId === p.id ? 'animate-spin text-primary-600' : ''}`} />
                          <span>{reSyncingPlayerId === p.id ? '同期中' : '同期'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {sortedPlayers.length === 0 && <p className="text-center text-muted-strong text-sm py-8 bg-surface rounded-2xl border border-border">該当プレイヤーなし</p>}
            </div>
  );
}
