"use client";

import { Users, RefreshCw, Plus, AlertCircle, X } from "lucide-react";
import { HIGHEST_RANK_OPTIONS } from "../../../lib/mmr";

// Discordメンバー同期の確認モーダル（新規メンバーの最高Rank・希望レーン・NG・Riot IDの入力、削除・改名の確認）
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
export default function SyncPreviewModal({ syncData, setSyncData, syncingDiscord, onCancel, onExecute }: {
  syncData: any;
  setSyncData: (d: any) => void;
  syncingDiscord: boolean;
  onCancel: () => void;
  onExecute: () => void;
}) {
  return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-surface border border-border rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-border flex justify-between items-center bg-black/5">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                      <Users className="h-6 w-6 text-[#5865F2]" />
                      Discordメンバー同期の確認
                    </h2>
                    <button 
                      onClick={onCancel} 
                      disabled={syncingDiscord}
                      className="text-muted-strong hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    <p className="text-foreground-subtle text-sm">
                      現在のDiscordサーバーには <strong>{syncData.totalDiscordMembers}</strong> 人のメンバーがいます（Botを除く）。<br />
                      以下の差分が見つかりました。同期を実行すると、データベースが自動的に更新されます。
                    </p>

                    {syncData.toAdd.length > 0 && (
                      <div className="bg-success-100 border border-success-edge-soft rounded-lg p-4 space-y-3">
                        <h3 className="text-success-700 font-bold mb-1 flex items-center gap-2">
                          <Plus className="h-4 w-4" /> 新規追加されるメンバー ({syncData.toAdd.length}人)
                        </h3>
                        <p className="text-faint text-xs mb-3">
                          新メンバーの最高Rankおよび希望レーンを選択してください。同期時に初期MMRが自動計算されて登録されます。
                        </p>
                        <div className="space-y-3">
                          {syncData.toAdd.map((p: any, idx: number) => (
                            <div key={p.discord_id} className="bg-success-100 border border-success-edge-soft rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <span className="font-bold text-success-700 text-sm flex items-center gap-1.5">
                                {p.name}
                              </span>
                              <div className="flex flex-wrap items-center gap-4">
                                {/* 最高Rank選択 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-faint">最高Rank:</span>
                                  <select
                                    value={p.highest_rank || "UNRANKED"}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      updatedAdd[idx].highest_rank = e.target.value;
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-surface border border-border text-foreground rounded px-2 py-1 outline-none focus:border-success-edge-strong cursor-pointer"
                                  >
                                    {HIGHEST_RANK_OPTIONS.map(r => (
                                      <option key={r} value={r}>{r}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* メインロール選択 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-faint">メイン:</span>
                                  <select
                                    value={p.role_preferences?.primary || "ALL"}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      if (!updatedAdd[idx].role_preferences) updatedAdd[idx].role_preferences = { primary: "ALL", secondary: "-" };
                                      const newVal = e.target.value;
                                      updatedAdd[idx].role_preferences.primary = newVal;
                                      if (newVal === "ALL") {
                                        updatedAdd[idx].role_preferences.secondary = "-";
                                      }
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-surface border border-border text-foreground rounded px-2 py-1 outline-none focus:border-success-edge-strong cursor-pointer"
                                  >
                                    {["ALL", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* サブロール選択 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-faint">サブ:</span>
                                  <select
                                    value={p.role_preferences?.secondary || "-"}
                                    disabled={p.role_preferences?.primary === "ALL"}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      if (!updatedAdd[idx].role_preferences) updatedAdd[idx].role_preferences = { primary: "ALL", secondary: "-" };
                                      updatedAdd[idx].role_preferences.secondary = e.target.value;
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-surface border border-border text-foreground rounded px-2 py-1 outline-none focus:border-success-edge-strong cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {["-", "ALL", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* NGロール選択 */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-danger-700 font-semibold">NG:</span>
                                  <select
                                    value={p.role_preferences?.ignore_role || "-"}
                                    onChange={(e) => {
                                      const updatedAdd = [...syncData.toAdd];
                                      if (!updatedAdd[idx].role_preferences) updatedAdd[idx].role_preferences = { primary: "ALL", secondary: "-", ignore_role: "-" };
                                      updatedAdd[idx].role_preferences.ignore_role = e.target.value;
                                      setSyncData({ ...syncData, toAdd: updatedAdd });
                                    }}
                                    className="bg-surface border border-border text-danger-700 rounded px-2 py-1 outline-none focus:border-success-edge-strong cursor-pointer"
                                  >
                                    {["-", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Riot ID (ign) 入力 */}
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-faint">Riot ID:</span>
                                    <input
                                      type="text"
                                      placeholder="Name#TAG"
                                      value={p.ign || ""}
                                      onChange={(e) => {
                                        const updatedAdd = [...syncData.toAdd];
                                        updatedAdd[idx].ign = e.target.value;
                                        setSyncData({ ...syncData, toAdd: updatedAdd });
                                      }}
                                      className={`bg-surface border rounded px-2 py-1 outline-none w-36 placeholder-stone-600 font-mono ${
                                        !p.ign || !p.ign.includes('#') || p.ign.trim().split('#').length !== 2
                                          ? 'border-danger-edge-strong focus:border-danger-edge text-danger-700 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                                          : 'border-border focus:border-success-edge-strong text-foreground'
                                      }`}
                                    />
                                  </div>
                                  {(!p.ign || !p.ign.includes('#') || p.ign.trim().split('#').length !== 2) && (
                                    <span className="text-[10px] text-danger-700 font-semibold text-right">Name#TAG形式必須</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncData.toDeactivate.length > 0 && (
                      <div className="bg-danger-100 border border-danger-edge-soft rounded-lg p-4">
                        <h3 className="text-danger-700 font-bold mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" /> 削除 (名簿から完全消去) されるメンバー ({syncData.toDeactivate.length}人)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {syncData.toDeactivate.map((p: any) => (
                            <span key={p.id} className="bg-danger-100 text-danger-700 px-2 py-1 rounded text-xs border border-danger-edge-soft line-through">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncData.toUpdateName && syncData.toUpdateName.length > 0 && (
                      <div className="bg-primary-100 border border-primary-edge-soft rounded-lg p-4">
                        <h3 className="text-primary-700 font-bold mb-3 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" /> Discord名に修正されるメンバー ({syncData.toUpdateName.length}人)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {syncData.toUpdateName.map((p: any) => (
                            <div key={p.id} className="bg-primary-100 text-primary-700 px-3 py-1.5 rounded text-xs border border-primary-edge-soft flex items-center justify-between">
                              <span className="text-faint truncate max-w-[45%]">{p.oldName}</span>
                              <span className="text-muted-strong font-bold">→</span>
                              <span className="font-semibold text-primary-700 truncate max-w-[45%]">{p.newName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {syncData.toAdd.length === 0 && syncData.toDeactivate.length === 0 && (!syncData.toUpdateName || syncData.toUpdateName.length === 0) && (
                      <div className="bg-primary-100 border border-primary-edge-soft rounded-lg p-6 text-center text-primary-700">
                        メンバーの増減や名前の変更はありませんが、参加日時などの隠しデータ（メタデータ）を最新に更新するため「同期を実行する」を押してください。
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t border-border bg-black/5 flex justify-end gap-3">
                    {syncData.toAdd.some((p: any) => {
                      const ign = p.ign || "";
                      return !ign.includes("#") || ign.trim().split("#").length !== 2;
                    }) && (
                      <span className="text-xs text-danger-700 font-bold flex items-center mr-auto">
                        ⚠️ すべての新規メンバーに Riot ID (サモナー名#JP1 等) を入力してください
                      </span>
                    )}
                    <button 
                      onClick={onCancel}
                      disabled={syncingDiscord}
                      className="px-4 py-2 rounded-lg font-bold text-faint hover:bg-black/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      キャンセル
                    </button>
                    <button 
                      onClick={onExecute}
                      disabled={syncingDiscord || syncData.toAdd.some((p: any) => {
                        const ign = p.ign || "";
                        return !ign.includes("#") || ign.trim().split("#").length !== 2;
                      })}
                      className="px-6 py-2 rounded-lg font-bold bg-[#5865F2] hover:bg-[#4752C4] text-white transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {syncingDiscord ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          同期を実行中...
                        </>
                      ) : (
                        "同期を実行する"
                      )}
                    </button>
                  </div>
                </div>
              </div>
  );
}
