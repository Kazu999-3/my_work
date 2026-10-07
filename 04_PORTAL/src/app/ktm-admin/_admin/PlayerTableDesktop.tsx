"use client";

import React, { useState } from "react";
import { Info, ChevronDown, Settings } from "lucide-react";
import { HIGHEST_RANK_OPTIONS, getColorFromRankName } from "../../../lib/mmr";
import { RoleIcon, MmrBadgeInput, getColorFromRole, getPlayerExperienceBadge } from "./adminUtils";

// 名簿（デスクトップ用の表: 並び替え・出欠・最高Rank・希望/NGレーン・レーン別MMRの展開編集・Discord ID・Riot ID・備考）
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割。表示内容・動作は分割前と同じ。
type SortConfig = { key: string; direction: string };

/** 並び替えできる列見出し（描画のたびに部品を作り直さないよう、表の外で定義する） */
function SortableHeader({ label, sortKey, sticky = false, sortConfig, requestSort }: {
  label: string; sortKey: string; sticky?: boolean; sortConfig: SortConfig; requestSort: (key: string) => void;
}) {
  return (
    <th
      className={`px-2 py-2 font-medium cursor-pointer hover:bg-black/8 transition whitespace-nowrap ${sticky ? 'sticky left-0 z-20 bg-surface shadow-[2px_0_5px_rgba(0,0,0,0.5)]' : ''}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1 justify-center">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-primary-700 text-xs">{sortConfig.direction === "desc" ? "↓" : "↑"}</span>
        )}
        {sortConfig.key !== sortKey && <span className="text-muted-strong opacity-30 text-xs">↕</span>}
      </div>
    </th>
  );
}

export default function PlayerTableDesktop({ sortedPlayers, playerCount, loading, sortConfig, requestSort, flashingPlayerIds, handleInputChange, handleInputSave, handleBlurSave, setSelectedPlayer }: {
  sortedPlayers: any[];
  playerCount: number;
  loading: boolean;
  sortConfig: SortConfig;
  requestSort: (key: string) => void;
  flashingPlayerIds: Array<string | number>;
  handleInputChange: (uid: string, field: string, value: any) => void;
  handleInputSave: (uid: string, field: string, value: any) => void;
  handleBlurSave: () => void;
  setSelectedPlayer: (p: any) => void;
}) {
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<string[]>([]);
  const togglePlayerDetails = (uid: string) => {
    setExpandedPlayerIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };


  return (
            <div className="hidden md:block bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-black/5 text-faint uppercase text-xs tracking-wider sticky top-0 z-30 shadow-md backdrop-blur-sm">
                    <tr>
                      <SortableHeader label="No." sortKey="no" sortConfig={sortConfig} requestSort={requestSort} />
                      <SortableHeader label="Active" sortKey="is_active" sortConfig={sortConfig} requestSort={requestSort} />
                      <SortableHeader label="名前" sortKey="name" sticky={true} sortConfig={sortConfig} requestSort={requestSort} />
                      <SortableHeader label="最高Rank" sortKey="highest_rank" sortConfig={sortConfig} requestSort={requestSort} />
                      <th className="px-2 py-1.5 text-xs text-faint font-semibold text-center">希望レーン</th>
                      <th className="px-2 py-1.5 text-xs text-faint font-semibold text-center">NG1</th>
                      <th className="px-2 py-1.5 text-xs text-faint font-semibold text-center">NG2</th>
                      <SortableHeader label="平均MMR" sortKey="mmr" sortConfig={sortConfig} requestSort={requestSort} />
                      <SortableHeader label="Discord ID" sortKey="discord_id" sortConfig={sortConfig} requestSort={requestSort} />
                      <SortableHeader label="Riot IGN" sortKey="ign" sortConfig={sortConfig} requestSort={requestSort} />
                      <SortableHeader label="備考" sortKey="notes" sortConfig={sortConfig} requestSort={requestSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {sortedPlayers.map((p) => {
                      const uid = p.id || p.discord_id;
                      const exp = getPlayerExperienceBadge(p);
                      return (
                        <React.Fragment key={uid}>
                          <tr 
                            className={`hover:bg-black/5 transition-all duration-300 ${
                              flashingPlayerIds.includes(uid) 
                                ? 'bg-success-100 text-success-700 font-bold border-y border-success-edge shadow-[inset_0_0_15px_rgba(16,185,129,0.15)]' 
                                : ''
                            }`}
                          >
                        <td className="px-2 py-1.5 text-center font-bold text-muted-strong text-xs">
                          {p.no}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={p.is_active}
                            onChange={(e) => handleInputSave(uid, "is_active", e.target.checked)}
                            className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500 bg-black/5 cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1.5 sticky left-0 z-10 bg-surface shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => setSelectedPlayer(p)}
                              className="text-primary-700 hover:text-foreground p-1 hover:bg-black/5 rounded transition shrink-0"
                              title="プロフィールを表示"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => handleInputChange(uid, "name", e.target.value)}
                              onBlur={handleBlurSave}
                              className="bg-transparent border border-transparent focus:border-border hover:border-border focus:bg-black/5 rounded px-1 py-0.5 outline-none min-w-[70px] max-w-[120px] font-bold text-foreground text-xs"
                            />
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.2 rounded border shadow-2xs shrink-0 whitespace-nowrap ${exp.color}`}
                              title={exp.tip}
                            >
                              {exp.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={p.highest_rank || "UNRANKED"}
                            onChange={(e) => handleInputSave(uid, "highest_rank", e.target.value)}
                            className={`bg-black/5 border border-border rounded px-1 py-0.5 outline-none focus:border-primary-edge-strong w-24 text-xs ${getColorFromRankName(p.highest_rank)}`}
                          >
                            {HIGHEST_RANK_OPTIONS.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 第一希望 */}
                            <div className="flex items-center gap-1 bg-black/5 border border-border rounded px-1.5 py-0.5">
                              <RoleIcon role={p.role_preferences?.primary || "ALL"} />
                              <select
                                value={p.role_preferences?.primary || "ALL"}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  handleInputSave(uid, "primary_role", newVal);
                                  if (newVal === "ALL") {
                                    handleInputSave(uid, "secondary_role", "-");
                                  }
                                }}
                                className={`bg-transparent outline-none cursor-pointer text-xs font-bold ${getColorFromRole(p.role_preferences?.primary)}`}
                              >
                                {["ALL", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                  <option key={role} value={role} className="text-foreground-soft bg-surface">{role}</option>
                                ))}
                              </select>
                            </div>
                            <span className="text-muted-strong">/</span>
                            {/* 第二希望 */}
                            <div className="flex items-center gap-1 bg-black/5 border border-border rounded px-1.5 py-0.5">
                              <RoleIcon role={p.role_preferences?.secondary || "-"} />
                              <select
                                value={p.role_preferences?.secondary || "-"}
                                disabled={p.role_preferences?.primary === "ALL"}
                                onChange={(e) => handleInputSave(uid, "secondary_role", e.target.value)}
                                className={`bg-transparent outline-none cursor-pointer text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed ${getColorFromRole(p.role_preferences?.secondary)}`}
                              >
                                {["-", "ALL", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                  <option key={role} value={role} className="text-foreground-soft bg-surface">{role}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          <div className="flex items-center justify-center gap-1 bg-black/5 border border-border rounded px-1.5 py-0.5 mx-auto w-max">
                            <RoleIcon role={p.ng_lane_1 || "-"} />
                            <select
                              value={p.ng_lane_1 || "-"}
                              onChange={(e) => handleInputSave(uid, "ng_lane_1", e.target.value)}
                              className="bg-transparent text-danger-700 font-bold outline-none cursor-pointer text-xs"
                            >
                              {["-", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                <option key={role} value={role} className="text-danger-700 bg-surface">{role}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          <div className="flex items-center justify-center gap-1 bg-black/5 border border-border rounded px-1.5 py-0.5 mx-auto w-max">
                            <RoleIcon role={p.ng_lane_2 || "-"} />
                            <select
                              value={p.ng_lane_2 || "-"}
                              onChange={(e) => handleInputSave(uid, "ng_lane_2", e.target.value)}
                              className="bg-transparent text-danger-700 font-bold outline-none cursor-pointer text-xs"
                            >
                              {["-", "TOP", "JG", "MID", "ADC", "SUP"].map(role => (
                                <option key={role} value={role} className="text-danger-700 bg-surface">{role}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs font-bold">
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{p.mmr || 1200}</span>
                            <button
                              type="button"
                              onClick={() => togglePlayerDetails(uid)}
                              className={`p-0.5 rounded transition ${expandedPlayerIds.includes(uid) ? 'bg-primary-600 text-white' : 'text-faint hover:text-foreground hover:bg-black/5'}`}
                              title="レーン別MMR詳細"
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transform transition-transform duration-300 ${expandedPlayerIds.includes(uid) ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 opacity-50 hover:opacity-100 transition">
                          <input
                            type="text"
                            value={p.discord_id}
                            onChange={(e) => handleInputChange(uid, "discord_id", e.target.value)}
                            onBlur={handleBlurSave}
                            className="bg-transparent border border-transparent focus:border-border hover:border-border focus:bg-black/5 rounded px-1 py-0.5 outline-none w-24 text-[10px]"
                            title={p.discord_id}
                          />
                        </td>
                        <td className="px-2 py-1.5 opacity-50 hover:opacity-100 transition">
                          <input
                            type="text"
                            value={p.ign || ""}
                            onChange={(e) => handleInputChange(uid, "ign", e.target.value)}
                            onBlur={handleBlurSave}
                            placeholder="Name#TAG"
                            className="bg-transparent border border-transparent focus:border-border hover:border-border focus:bg-black/5 rounded px-1 py-0.5 outline-none w-24 text-[10px] text-primary-700"
                            title={p.ign || "未登録"}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={p.metadata?.notes || ""}
                            onChange={(e) => handleInputChange(uid, "notes", e.target.value)}
                            onBlur={handleBlurSave}
                            placeholder="備考を入力"
                            className="bg-transparent border border-transparent focus:border-border hover:border-border focus:bg-black/5 rounded px-1 py-0.5 outline-none w-32 text-xs text-foreground-soft"
                          />
                        </td>
                      </tr>
                      {expandedPlayerIds.includes(uid) && (
                        <tr key={`${uid}-mmr-details`} className="bg-black/3 border-b border-border">
                          <td colSpan={10} className="p-3">
                            <div className="flex flex-wrap items-center gap-6 pl-12">
                              <div className="text-xs font-bold text-faint flex items-center gap-1.5 border-r border-border pr-4">
                                <Settings className="w-3.5 h-3.5 text-primary-500 animate-pulse" />
                                レーン別 MMR 設定:
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4 text-xs">
                                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => {
                                  const mmrKey = `mmr_${role.toLowerCase()}` as keyof typeof p;
                                  const val = p[mmrKey] as number || 1200;
                                  return (
                                    <div key={role} className="flex items-center gap-2 bg-surface px-2 py-1.5 rounded border border-border hover:border-border transition">
                                      <RoleIcon role={role} />
                                      <span className="font-bold text-foreground-subtle w-8">{role}</span>
                                      <MmrBadgeInput
                                        value={val}
                                        onChange={(v) => handleInputSave(uid, `mmr_${role.toLowerCase()}`, v)}
                                      />
                                    </div>
                                  );
                                })}
                                
                                <div className="flex items-center gap-2 bg-surface px-2 py-1.5 rounded border border-primary-edge-soft ml-4">
                                  <span className="font-bold text-primary-700 w-12 text-center">平均MMR</span>
                                  <MmrBadgeInput
                                    value={p.mmr || 1200}
                                    onChange={(v) => handleInputSave(uid, "mmr", v)}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                      );
                    })}
                    
                    {playerCount === 0 && !loading && (
                      <tr>
                        <td colSpan={13} className="px-6 py-12 text-center text-muted-strong">
                          プレイヤーが登録されていません。Discord & Riot同期を実行して登録してください。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
  );
}
