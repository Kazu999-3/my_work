"use client";

import React, { Fragment } from "react";
import { toast } from '../../../components/Toaster';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, Trees, Zap, Target, Heart, Settings, Sparkles, Coins, Copy, Check, Shuffle } from "lucide-react";
import { getColorFromRankName, calculateBlueWinProbability, getKtmRank, getRankBadgeStyle, getHighestLaneMmr } from "../../../lib/mmr";
import { getPlayerTier } from "../../../lib/playerTier";
import { BalancerVcManager, updateVcStatus } from "../components/BalancerVcManager";
import { BalancerBo3Manager } from "../components/BalancerBo3Manager";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { Spinner } from "../../../components/Feedback";
import { RoleIcon, getPlayerCasinoBadges, MAX_VISIBLE_BADGES, CasinoBadges, getGroup } from "./helpers";

// 参加者リスト（フィルター・表・行ごとの設定）
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function PlayerListTable({ isAdmin, searchQuery, setSearchQuery, roleFilter, setRoleFilter, statusFilter, setStatusFilter, setSelectedPlayer, flashingPlayerIds, getPlayerExperienceBadge, handleInputChange, SortableHeader, filteredPlayers }: {
  isAdmin: boolean;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  roleFilter: string | null;
  setRoleFilter: React.Dispatch<React.SetStateAction<string | null>>;
  statusFilter: string | null;
  setStatusFilter: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedPlayer: React.Dispatch<React.SetStateAction<any>>;
  flashingPlayerIds: number[];
  getPlayerExperienceBadge: (p: any) => any;
  handleInputChange: (uid: string, field: string, value: any) => any;
  SortableHeader: React.FC<{ label: string; sortKey: string; className?: string }>;
  filteredPlayers: any[];
}) {
  return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-2xl">
          <div className="p-3 md:p-4 border-b border-border flex items-center gap-2 bg-surface">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-primary-700" />
            <h2 className="text-base md:text-xl font-bold text-foreground">参加者リスト</h2>
            <span className="text-xs text-muted-strong font-normal hidden md:inline ml-1">
              ｜ <Crown className="inline w-3 h-3 text-primary-700" /> = 第1希望固定、<X className="inline w-3 h-3 text-primary-700" /> = 見学固定
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
                className="w-full bg-surface border border-border rounded-lg pl-3 pr-16 py-2 text-xs text-foreground placeholder-stone-500 focus:outline-none focus:border-primary-edge-strong transition"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-faint hover:text-foreground-subtle text-xs font-bold"
                    title="検索クリア"
                  >
                    ✕
                  </button>
                )}
                <span className="text-[10px] font-mono font-bold text-faint bg-surface-subtle px-1.5 py-0.5 rounded">
                  {filteredPlayers.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
              {/* ステータスフィルター */}
              <div className="flex bg-surface rounded-lg p-0.5 border border-border text-xs">
                <button
                  onClick={() => setStatusFilter(null)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${!statusFilter ? 'bg-primary-600 text-white' : 'text-faint hover:text-foreground'}`}
                >
                  全員
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'active' ? 'bg-primary-600 text-white' : 'text-faint hover:text-foreground'}`}
                >
                  参加予定
                </button>
                <button
                  onClick={() => setStatusFilter('spectator')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'spectator' ? 'bg-primary-600 text-white' : 'text-faint hover:text-foreground'}`}
                >
                  見学のみ
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${statusFilter === 'inactive' ? 'bg-primary-600 text-white' : 'text-faint hover:text-foreground'}`}
                >
                  不参加
                </button>
              </div>

              {/* 希望ロールフィルター */}
              <div className="flex bg-surface rounded-lg p-0.5 border border-border text-xs">
                <button
                  onClick={() => setRoleFilter(null)}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${!roleFilter ? 'bg-primary-600 text-white' : 'text-faint hover:text-foreground'}`}
                >
                  すべてのロール
                </button>
                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                    className={`px-2.5 py-1.5 rounded-md font-bold transition flex items-center gap-1 ${roleFilter === role ? 'bg-primary-600 text-white' : 'text-faint hover:text-foreground'}`}
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
              <thead className="text-xs text-faint bg-surface-subtle border-b border-border">
                <tr>
                  <th className="px-2 py-3 font-medium text-center w-28">参加設定</th>
                  <SortableHeader label="No." sortKey="no" className="w-10 text-center" />
                  <SortableHeader label="プレイヤー名" sortKey="name" className="px-2" />
                  <SortableHeader label="SoloQランク" sortKey="highest_rank" className="px-2" />
                  <SortableHeader label="KTMカスタムMMR" sortKey="mmr" className="px-2" />
                  <th className="px-2 py-3 font-medium text-center">第1希望</th>
                  <th className="px-2 py-3 font-medium text-center">第2希望</th>
                  <th className="px-1.5 py-3 font-medium text-center text-danger-700">NG 1</th>
                  <th className="px-1.5 py-3 font-medium text-center text-danger-700">NG 2</th>
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
                  const groupColorMap: Record<number,string> = { 0:'text-primary-700 bg-primary-100', 2:'text-primary-700 bg-primary-100', 3:'text-muted-strong bg-black/[0.03]' };
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
                          flashingPlayerIds.includes(p.id) ? 'bg-success-100 border-y border-success-edge-strong/50' :
                          p.is_fixed ? 'bg-primary-100 border-l-2 border-primary-edge-strong/70' :
                          p.is_spectator_fixed ? 'bg-primary-100 border-l-2 border-primary-edge-strong/60 opacity-70' :
                          p.is_active ? 'bg-primary-100 border-l-2 border-primary-edge-strong text-foreground-soft' :
                          'opacity-40 hover:opacity-100'
                        }`}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 min-w-[76px] h-7 mx-auto">
                            <input type="checkbox" checked={p.is_active}
                              onChange={e => { const a = e.target.checked; handleInputChange(p.id,'is_active',a); if(!a){handleInputChange(p.id,'is_fixed',false);handleInputChange(p.id,'is_spectator_fixed',false);} }}
                              className="w-4 h-4 rounded border-border bg-surface-subtle text-primary-700 focus:ring-primary-500/50 cursor-pointer transition-transform hover:scale-110 flex-shrink-0" title="参加/不参加" />
                            <div className={`flex items-center gap-1 transition-all duration-300 overflow-hidden ${p.is_active?'opacity-100 max-w-[50px]':'opacity-0 max-w-0 pointer-events-none'}`}>
                              <button onClick={() => { if(p.is_spectator_fixed) handleInputChange(p.id,'is_spectator_fixed',false); handleInputChange(p.id,'is_fixed',!p.is_fixed); }}
                                className={`p-0.5 rounded border transition-all ${p.is_fixed?'bg-primary-100 border-primary-edge-soft text-primary-700':'border-border text-muted-strong hover:text-primary-700 hover:bg-primary-100'}`}
                                title="第1希望レーンで固定する"><Crown className="w-3 h-3" /></button>
                              <button onClick={() => { if(p.is_fixed) handleInputChange(p.id,'is_fixed',false); handleInputChange(p.id,'is_spectator_fixed',!p.is_spectator_fixed); }}
                                className={`p-0.5 rounded border transition-all ${p.is_spectator_fixed?'bg-primary-100 border-primary-edge-soft text-primary-700':'border-border text-muted-strong hover:text-primary-700 hover:bg-primary-100'}`}
                                title="見学固定にする"><X className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold text-muted-strong text-xs">{p.no}</td>
                        <td className="px-2 py-1.5 font-bold text-foreground text-xs max-w-[240px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => setSelectedPlayer(p)} className="text-primary-700 hover:text-foreground p-0.5 hover:bg-surface-subtle rounded transition flex-shrink-0" title="プロフィール">
                              <Info className="w-3.5 h-3.5" /></button>
                            <span className="font-extrabold text-foreground truncate max-w-[130px]" title={p.name}>{p.name}</span>
                            
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


                            {/* 🪙 所持コイン */}
                            {(p.coins > 0 || (p.metadata?.coins && p.metadata.coins > 0)) && (
                              <span className="text-[10px] font-mono font-black bg-primary-100 text-primary-900 border border-primary-edge px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shadow-2xs" title={`所持コイン: ${p.coins || p.metadata?.coins}枚`}>
                                <Coins className="w-2.5 h-2.5 text-primary-600" />
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
                                    <span key={idx} className="text-[9px] font-black bg-primary-100 text-primary-900 border border-primary-edge px-1 py-0.2 rounded flex items-center gap-0.5 shadow-2xs" title={`カジノ特典: ${badge.label}`}>
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
                                <span className="font-mono text-xs font-black text-primary-800 dark:text-primary-300">{repMmr}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeStyle.bg} ${badgeStyle.color} ${badgeStyle.border}`}>
                                  {ktmTier.name.split(' ')[0]}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded px-1 py-0.5 w-20">
                            <RoleIcon role={prefs.primary || 'ALL'} className="w-3 h-3 flex-shrink-0" />
                            <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-foreground outline-none cursor-pointer w-full text-[11px] font-bold">
                              {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle text-foreground-soft">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded px-1 py-0.5 w-20">
                            <RoleIcon role={prefs.secondary || '-'} className="w-3 h-3 flex-shrink-0" />
                            <select value={prefs.secondary || '-'} disabled={prefs.primary === 'ALL'} onChange={e => handleInputChange(p.id,'secondary_role',e.target.value)} className="bg-transparent text-foreground-subtle outline-none cursor-pointer w-full text-[11px] disabled:cursor-not-allowed">
                              {['-','ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle text-foreground-soft">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded px-1 py-0.5 w-16 mx-auto">
                            <RoleIcon role={p.ng_lane_1 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                            <select value={p.ng_lane_1 || ''} onChange={e => handleInputChange(p.id,'ng_lane_1',e.target.value)} className="bg-transparent text-danger-700 font-bold outline-none cursor-pointer w-full text-[10px]">
                              <option value="" className="bg-surface-subtle text-faint">なし</option>
                              {['TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle text-danger-700">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded px-1 py-0.5 w-16 mx-auto">
                            <RoleIcon role={p.ng_lane_2 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                            <select value={p.ng_lane_2 || ''} onChange={e => handleInputChange(p.id,'ng_lane_2',e.target.value)} className="bg-transparent text-danger-700 font-bold outline-none cursor-pointer w-full text-[10px]">
                              <option value="" className="bg-surface-subtle text-faint">なし</option>
                              {['TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle text-danger-700">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <select value={p.weight || 2} disabled={!isAdmin} onChange={e => handleInputChange(p.id,'weight',parseInt(e.target.value))} title={isAdmin ? '' : 'こだわり度の変更は管理者のみ可能です'} className="bg-surface-subtle border border-border rounded px-1.5 py-0.5 text-primary-700 font-bold outline-none focus:border-primary-edge-strong w-12 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                            {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <input type="checkbox" checked={!!p.allow_higher} onChange={e => handleInputChange(p.id,'allow_higher',e.target.checked)} className="w-4 h-4 rounded border-border bg-surface-subtle text-danger-700 focus:ring-danger-500/50 cursor-pointer transition-transform hover:scale-110" />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1 w-24 mx-auto">
                            <span className="px-1.5 py-0.5 rounded bg-success-100 border border-success-edge-soft text-success-700 text-[10px] font-mono font-bold" title="Pity">{p.pity || 0}</span>
                            <span className="px-1.5 py-0.5 rounded bg-primary-100 border border-primary-edge-soft text-primary-700 text-[10px] font-mono font-bold" title="OffPity">{p.off_role_pity || 0}</span>
                            <span className="px-1.5 py-0.5 rounded bg-primary-100 border border-primary-edge-soft text-primary-700 text-[10px] font-mono font-bold" title="観戦Pity">{p.spectator_pity || 0}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={p.metadata?.notes || ''} onChange={e => handleInputChange(p.id,'notes',e.target.value)} placeholder="備考"
                            className="bg-transparent border border-transparent hover:border-border focus:border-border hover:bg-black/[0.04] focus:bg-surface focus:ring-1 focus:ring-primary-500/30 rounded px-2 py-0.5 outline-none text-xs text-foreground-subtle w-20 transition-all" />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-muted-strong">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl">🔍</span>
                        <span className="text-sm font-bold text-foreground-subtle">条件に一致するプレイヤーが見つかりません</span>
                        <p className="text-xs text-faint">検索文字やフィルター条件を変更してください。</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter(null);
                            setRoleFilter(null);
                          }}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground-subtle font-bold text-xs transition cursor-pointer"
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
              const groupBgMap: Record<number,string> = { 0:'bg-primary-100 text-primary-700', 2:'bg-primary-100 text-primary-700', 3:'bg-surface-subtle text-muted-strong' };
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
                    p.is_fixed ? 'bg-primary-100 border-l-2 border-primary-edge-strong/70' :
                    p.is_spectator_fixed ? 'bg-primary-100 border-l-2 border-primary-edge-strong/60 opacity-70' :
                    p.is_active ? 'bg-primary-100 border-l-2 border-primary-edge-strong' : 'opacity-40'
                  }`}>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-1">
                      <input type="checkbox" checked={p.is_active}
                        onChange={e => { const a = e.target.checked; handleInputChange(p.id,'is_active',a); if(!a){handleInputChange(p.id,'is_fixed',false);handleInputChange(p.id,'is_spectator_fixed',false);} }}
                        className="w-5 h-5 rounded border-border bg-surface-subtle text-primary-700 cursor-pointer" />
                      {p.is_active && (
                        <div className="flex gap-0.5">
                          <button onClick={() => { if(p.is_spectator_fixed) handleInputChange(p.id,'is_spectator_fixed',false); handleInputChange(p.id,'is_fixed',!p.is_fixed); }}
                            className={`p-0.5 rounded border ${p.is_fixed?'bg-primary-100 border-primary-edge-soft text-primary-700':'border-border text-muted-strong'}`}><Crown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(p.is_fixed) handleInputChange(p.id,'is_fixed',false); handleInputChange(p.id,'is_spectator_fixed',!p.is_spectator_fixed); }}
                            className={`p-0.5 rounded border ${p.is_spectator_fixed?'bg-primary-100 border-primary-edge-soft text-primary-700':'border-border text-muted-strong'}`}><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground text-sm">{p.name}</span>
                        {/* 🔰/🌱/👑 参加者層バッジ */}
                        {(() => {
                          const exp = getPlayerExperienceBadge(p);
                          return (
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border shadow-2xs ${exp.color}`}>
                              {exp.label}
                            </span>
                          );
                        })()}
                        <span className={`text-xs font-semibold ${getColorFromRankName(p.highest_rank)}`}>{p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNR'}</span>
                        
                        {/* MMR ＆ KTMランクバッジ */}
                        <div className="ml-auto flex items-center gap-1" title={tooltip}>
                          <span className="font-mono text-primary-700 text-xs font-bold">{repMmr}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${badgeStyle.bg} ${badgeStyle.color} ${badgeStyle.border}`}>
                            {ktmTier.name.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-0.5 bg-surface-subtle border border-border rounded px-1.5 py-0.5">
                          <RoleIcon role={prefs.primary || 'ALL'} className="w-3 h-3" />
                          <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-foreground outline-none cursor-pointer text-[11px] font-bold">
                            {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle">{r}</option>)}
                          </select>
                        </div>
                        {(p.ng_lane_1 || p.ng_lane_2) && (
                          <div className="flex items-center gap-1 text-danger-700 text-xs font-bold">
                            <span className="opacity-60">NG:</span>
                            {p.ng_lane_1 && <span className="bg-danger-50 border border-danger-edge-soft px-1.5 rounded">{p.ng_lane_1}</span>}
                            {p.ng_lane_2 && <span className="bg-danger-50 border border-danger-edge-soft px-1.5 rounded">{p.ng_lane_2}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-0.5 ml-auto">
                          <span className="px-1 py-0.5 rounded bg-success-100 text-success-700 text-[9px] font-mono" title="Pity">{p.pity || 0}</span>
                          <span className="px-1 py-0.5 rounded bg-primary-100 text-primary-700 text-[9px] font-mono" title="OffPity">{p.off_role_pity || 0}</span>
                          <span className="px-1 py-0.5 rounded bg-primary-100 text-primary-700 text-[9px] font-mono" title="観戦Pity">{p.spectator_pity || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredPlayers.length === 0 && (
              <div className="p-8 text-center text-muted-strong space-y-2">
                <div className="text-xl">🔍</div>
                <div className="text-sm font-bold text-foreground-subtle">条件に一致するプレイヤーが見つかりません</div>
                <p className="text-xs text-faint">検索文字やフィルターを変更してください。</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter(null);
                    setRoleFilter(null);
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground-subtle font-bold text-xs transition cursor-pointer"
                >
                  条件をリセット
                </button>
              </div>
            )}
          </div>
        </div>
  );
}
