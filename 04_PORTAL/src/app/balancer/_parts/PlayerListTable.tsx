"use client";

import React, { Fragment, useState } from "react";
import { toast } from '../../../components/Toaster';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { Users, RefreshCw, Swords, X, Activity, Globe, MessageSquare, Info, Crown, Trophy, History, Shield, AlertTriangle, ChevronDown, ChevronUp, Trees, Zap, Target, Heart, Settings, Sparkles, Copy, Check, Shuffle } from "lucide-react";
import { getColorFromRankName, calculateBlueWinProbability, getKtmRank, getRankBadgeStyle, getHighestLaneMmr } from "../../../lib/mmr";
import { getPlayerTier } from "../../../lib/playerTier";
import { BalancerVcManager, updateVcStatus } from "../components/BalancerVcManager";
import { BalancerBo3Manager } from "../components/BalancerBo3Manager";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { Spinner } from "../../../components/Feedback";
import { RoleIcon, getGroup } from "./helpers";
import { getPlayerTierBand, normalizeTierPromotionPref, getDownwardOffroleRule, TIER_BAND_THRESHOLD } from "../../../lib/balancer/tierBand";

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
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<Set<string | number>>(new Set());
  const toggleRowExpand = (id: string | number) => {
    setExpandedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-2xl pb-28 md:pb-32">
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

          {/* 表操作のミニ注記 */}
          <div className="px-3 md:px-4 py-2 bg-surface-subtle/70 border-b border-border text-[11px] text-muted flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-foreground-soft">💡 各行の「設定 ▼」で第2希望・NG・格上挑戦・全レーンMMRを展開できます</span>
            <div className="flex items-center gap-3">
              <span>🔒 <strong>希望の強さ:</strong> 管理者のみ変更可</span>
              <span>⚔️ <strong>格上挑戦:</strong> MMR差200以上対面許可</span>
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
                  <SortableHeader label="KTMカスタムMMR" sortKey="mmr" className="px-2 text-center" />
                  <SortableHeader label="第1希望" sortKey="primary_lane" className="px-2 text-center w-24" />
                  <th className="px-2 py-3 font-medium text-center w-28">詳細設定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredPlayers.map((p, idx) => {
                  const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
                  const isExpanded = expandedPlayerIds.has(p.id);
                  const curGroup = getGroup(p);
                  const prevGroup = idx > 0 ? getGroup(filteredPlayers[idx - 1]) : -1;
                  const isBoundary = idx > 0 && curGroup !== prevGroup;
                  const groupLabelMap: Record<number,string> = { 0:'👑 固定メンバー', 2:'👁 観戦固定', 3:'⚫ 不参加' };
                  const groupColorMap: Record<number,string> = { 0:'text-primary-700 bg-primary-100', 2:'text-primary-700 bg-primary-100', 3:'text-muted-strong bg-black/[0.03]' };
                  return (
                    <Fragment key={`balancer-row-${p.id}`}>
                      {isBoundary && groupLabelMap[curGroup] && (
                        <tr key={`div-${idx}`}>
                          <td colSpan={7} className={`px-4 py-1.5 text-[11px] font-bold border-t border-black/5 ${groupColorMap[curGroup]}`}>
                            {groupLabelMap[curGroup]}
                          </td>
                        </tr>
                      )}
                      <tr key={p.id}
                        className={`hover:bg-black/[0.04] transition-all duration-300 ${
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

                            {/* 🏟️ 帯＆繰り上げ・格下サポートバッジ (SPEC 10) */}
                            {(() => {
                              const band = getPlayerTierBand(p.mmr);
                              if (band === 'UPPER') {
                                const strict = getDownwardOffroleRule(p.mmr) === 'STRICT_OFFROLE';
                                return isAdmin && p.is_active ? (
                                  <div className="inline-flex items-center gap-1">
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary-500/10 text-primary-700 border border-primary-edge/50"
                                      title={`上位帯 (MMR ${TIER_BAND_THRESHOLD}+)`}
                                    >
                                      上位帯
                                    </span>
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={Boolean(p.allow_lower_support)}
                                      onClick={() => handleInputChange(p.id, 'allow_lower_support', !p.allow_lower_support)}
                                      className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border transition cursor-pointer ${
                                        p.allow_lower_support
                                          ? 'bg-secondary-600 text-white border-secondary-edge-strong shadow-xs hover:bg-secondary-500'
                                          : 'bg-surface-subtle text-muted-strong border-border hover:border-secondary-edge hover:text-foreground'
                                      }`}
                                      title={
                                        p.allow_lower_support
                                          ? `格下サポートON (${strict ? 'メイン・サブ除外/完全オフ' : 'メイン除外/オフレーン'})`
                                          : `クリックで下位帯(MMR <${TIER_BAND_THRESHOLD})へのサポート参加を許可`
                                      }
                                    >
                                      {p.allow_lower_support ? '下位帯サポ: 許可中 ✓' : '下位帯サポ: 不可'}
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary-500/10 text-primary-700 border border-primary-edge/50"
                                    title={`上位帯 (MMR ${TIER_BAND_THRESHOLD}+)`}
                                  >
                                    上位帯
                                  </span>
                                );
                              }
                              const tp = normalizeTierPromotionPref(p.tier_promotion_pref);
                              const badge =
                                tp === 'mix_ok'
                                  ? { text: '中初級帯(混成OK)', cls: 'bg-success-500/15 text-success-700 border-success-edge-soft', tip: '上の帯と混ざってもいい' }
                                  : tp === 'never'
                                  ? { text: '中初級帯(帯固定)', cls: 'bg-surface-subtle text-muted-strong border-border', tip: '自分の帯のみ参加（繰り上げNG）' }
                                  : { text: '中初級帯(不足時繰上)', cls: 'bg-primary-500/10 text-primary-700 border-primary-edge/40', tip: '上の帯が人不足なら繰り上げOK' };
                              return (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.cls}`} title={badge.tip}>
                                  {badge.text}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className={`px-2 py-1.5 text-xs font-semibold ${getColorFromRankName(p.highest_rank)}`}>{p.highest_rank ? p.highest_rank.split(' ')[0] : 'UNRANKED'}</td>
                        <td className="px-2 py-1.5 text-center">
                          {(() => {
                            const repMmr = p.mmr || 1200;
                            const isProvisional = !p.total_games && !p.games;
                            const highestLaneMmr = getHighestLaneMmr(p);
                            const ktmTier = getKtmRank(highestLaneMmr);
                            const badgeStyle = getRankBadgeStyle(ktmTier.name);
                            const hasDiff = highestLaneMmr !== repMmr;
                            const tooltip = isProvisional
                              ? `初参加のため初期仮値: ${repMmr} (KTMランク: ${ktmTier.name})。試合出場で変動します`
                              : hasDiff
                              ? `代表MMR: ${repMmr} / 最高レーン基準: ${ktmTier.name} (${highestLaneMmr})`
                              : `KTMランク: ${ktmTier.name} (MMR: ${repMmr})`;
                            return (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap" title={tooltip}>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs font-black text-primary-800 dark:text-primary-300">{repMmr}</span>
                                  {isProvisional && (
                                    <span className="text-[9px] font-black px-1 py-0.2 rounded border bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 shrink-0 cursor-help" title="初参加のため初期仮値です">
                                      仮
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeStyle.bg} ${badgeStyle.color} ${badgeStyle.border}`}>
                                    {ktmTier.name.split(' ')[0]}
                                  </span>
                                </div>
                                {hasDiff && !isProvisional && (
                                  <span className="text-[10px] text-muted-strong font-mono" title={`最高レーンMMR: ${highestLaneMmr}`}>
                                    (最高 {highestLaneMmr})
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded px-1.5 py-0.5 w-24 mx-auto">
                            <RoleIcon role={prefs.primary || 'ALL'} className="w-3 h-3 flex-shrink-0" />
                            <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-foreground outline-none cursor-pointer w-full text-[11px] font-bold">
                              {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle text-foreground-soft">{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 設定済みの小型インジケーター */}
                            <div className="flex items-center gap-1 flex-wrap justify-center">
                              {prefs.secondary && prefs.secondary !== '-' && prefs.secondary !== 'ALL' && (
                                <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-foreground-soft font-mono text-[9px] font-bold" title={`第2希望: ${prefs.secondary}`}>
                                  第2:{prefs.secondary}
                                </span>
                              )}
                              {(p.ng_lane_1 || p.ng_lane_2) && (
                                <span className="px-1.5 py-0.5 rounded bg-danger-100 text-danger-700 border border-danger-edge font-bold text-[9px]" title={`絶対に入りたくない回避レーン: ${[p.ng_lane_1, p.ng_lane_2].filter(Boolean).join(', ')}`}>
                                  回避:{[p.ng_lane_1, p.ng_lane_2].filter(Boolean).join('/')}
                                </span>
                              )}
                              {p.allow_higher && (
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-surface-subtle border border-border" title="同じ試合での格上対面もOK">⚔️対面OK</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleRowExpand(p.id)}
                              className={`px-1.5 py-0.5 rounded-md border text-[11px] font-bold transition flex items-center gap-0.5 cursor-pointer ${
                                isExpanded
                                  ? 'bg-primary-100 border-primary-edge text-primary-800'
                                  : 'bg-surface-subtle hover:bg-surface-hover border-border text-muted-strong hover:text-foreground'
                              }`}
                              title={isExpanded ? '詳細設定を閉じる' : '詳細設定（第2希望・NG・格上挑戦など）を開く'}
                            >
                              <span>設定</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* 案A: アコーディオン展開行（詳細設定・レーン別MMR） */}
                      {isExpanded && (
                        <tr className="bg-surface-subtle/80 border-b border-border/70 animate-fade-in">
                          <td colSpan={7} className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                              {/* レーン設定グループ */}
                              <div className="flex flex-wrap items-center gap-2.5">
                                {/* 第2希望 */}
                                <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-2 py-1 shadow-2xs">
                                  <span className="text-[11px] text-muted-strong font-bold">第2希望:</span>
                                  <RoleIcon role={prefs.secondary || '-'} className="w-3 h-3 flex-shrink-0" />
                                  <select
                                    value={prefs.secondary || '-'}
                                    disabled={prefs.primary === 'ALL'}
                                    onChange={e => handleInputChange(p.id, 'secondary_role', e.target.value)}
                                    className="bg-transparent text-foreground-subtle outline-none cursor-pointer text-[11px] disabled:cursor-not-allowed font-medium"
                                  >
                                    {['-','ALL','TOP','JG','MID','ADC','SUP'].map(r => (
                                      <option key={r} value={r} className="bg-surface text-foreground-soft">{r}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* NG 1 */}
                                <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-2 py-1 shadow-2xs">
                                  <span className="text-[11px] text-danger-700 font-bold">NG 1:</span>
                                  <RoleIcon role={p.ng_lane_1 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                                  <select
                                    value={p.ng_lane_1 || ''}
                                    onChange={e => handleInputChange(p.id, 'ng_lane_1', e.target.value)}
                                    className="bg-transparent text-danger-700 font-bold outline-none cursor-pointer text-[11px]"
                                  >
                                    <option value="" className="bg-surface text-faint">なし</option>
                                    {['TOP','JG','MID','ADC','SUP'].map(r => (
                                      <option key={r} value={r} className="bg-surface text-danger-700">{r}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* NG 2 */}
                                <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-2 py-1 shadow-2xs">
                                  <span className="text-[11px] text-danger-700 font-bold">NG 2:</span>
                                  <RoleIcon role={p.ng_lane_2 || ''} className="w-2.5 h-2.5 flex-shrink-0" />
                                  <select
                                    value={p.ng_lane_2 || ''}
                                    onChange={e => handleInputChange(p.id, 'ng_lane_2', e.target.value)}
                                    className="bg-transparent text-danger-700 font-bold outline-none cursor-pointer text-[11px]"
                                  >
                                    <option value="" className="bg-surface text-faint">なし</option>
                                    {['TOP','JG','MID','ADC','SUP'].map(r => (
                                      <option key={r} value={r} className="bg-surface text-danger-700">{r}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* 希望の強さ */}
                                <div className="flex items-center gap-1.5 bg-surface border border-border rounded px-2 py-1 shadow-2xs">
                                  <span className="text-[11px] text-muted-strong font-bold">強さ{isAdmin ? '' : '🔒'}:</span>
                                  <select
                                    value={p.weight || 2}
                                    disabled={!isAdmin}
                                    onChange={e => handleInputChange(p.id, 'weight', parseInt(e.target.value))}
                                    title={isAdmin ? '希望レーンの強さ（絶対このレーン / できれば / どこでもOK）' : '希望レーンの強さの変更は管理者のみ可能です'}
                                    className="bg-transparent text-primary-700 font-bold outline-none cursor-pointer text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {([[1, '絶対'], [2, 'できれば'], [3, 'どこでも']] as const).map(([n, l]) => (
                                      <option key={n} value={n} className="bg-surface text-foreground-soft">{l}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* 格上対面挑戦 */}
                                <label className="flex items-center gap-1.5 bg-surface border border-border rounded px-2.5 py-1 cursor-pointer hover:bg-surface-hover transition shadow-2xs" title="格上との対面: チェックあり=⚔️挑戦したい（MMR差200以上の相手ともレーンで当たってよい）/ なし=🛡️守ってほしい">
                                  <input
                                    type="checkbox"
                                    checked={!!p.allow_higher}
                                    onChange={e => handleInputChange(p.id, 'allow_higher', e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-border bg-surface text-danger-700 focus:ring-danger-500/50 cursor-pointer"
                                  />
                                  <span className="text-[11px] font-bold text-foreground-soft">⚔️ 格上挑戦</span>
                                </label>
                              </div>

                              {/* レーン別MMR要約（SPEC 05の主要情報要件） */}
                              {p.rates && typeof p.rates === 'object' && (
                                <div className="flex items-center gap-2 text-[10px] bg-surface px-2.5 py-1 rounded border border-border font-mono text-muted-strong shadow-2xs">
                                  <span className="font-bold text-foreground-soft text-[11px]">レーン別MMR:</span>
                                  {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => (
                                    <span key={role} className="flex items-center gap-0.5">
                                      <span className="font-semibold text-muted">{role}:</span>
                                      <span className="font-bold text-foreground">{p.rates[role] ?? '-'}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-strong">
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
                        {/* 格上との対面OKの人だけ印を付ける（保護ありが大多数のため。2026-10-17） */}
                        {p.allow_higher && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded border bg-danger-100 text-danger-700 border-danger-edge-soft" title="格上との対面: ⚔️挑戦したい（保護なし）">⚔️挑戦</span>
                        )}
                        
                        {/* MMR ＆ KTMランクバッジ */}
                        <div className="ml-auto flex items-center gap-1" title={tooltip}>
                          <span className="font-mono text-primary-700 text-xs font-bold">{repMmr}</span>
                          {(!p.total_games && !p.games) && (
                            <span className="text-[9px] font-black px-1 py-0.2 rounded border bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 shrink-0 cursor-help" title="初参加のため初期仮値です">
                              仮
                            </span>
                          )}
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${badgeStyle.bg} ${badgeStyle.color} ${badgeStyle.border}`}>
                            {ktmTier.name.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 第1希望 */}
                        <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded px-1.5 py-0.5">
                          <span className="text-[10px] text-faint font-bold">1st:</span>
                          <RoleIcon role={prefs.primary || 'ALL'} className="w-3.5 h-3.5" />
                          <select value={prefs.primary || 'ALL'} onChange={e => handleInputChange(p.id,'primary_role',e.target.value)} className="bg-transparent text-foreground outline-none cursor-pointer text-[11px] font-bold">
                            {['ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle">{r}</option>)}
                          </select>
                        </div>
                        {/* 第2希望 */}
                        <div className="flex items-center gap-1 bg-surface-subtle border border-border rounded px-1.5 py-0.5">
                          <span className="text-[10px] text-faint font-bold">2nd:</span>
                          <RoleIcon role={prefs.secondary || '-'} className="w-3.5 h-3.5" />
                          <select value={prefs.secondary || '-'} disabled={prefs.primary === 'ALL'} onChange={e => handleInputChange(p.id,'secondary_role',e.target.value)} className="bg-transparent text-foreground outline-none cursor-pointer text-[11px] disabled:opacity-40">
                            {['-','ALL','TOP','JG','MID','ADC','SUP'].map(r => <option key={r} value={r} className="bg-surface-subtle">{r}</option>)}
                          </select>
                        </div>
                        {/* NGレーン */}
                        {(p.ng_lane_1 || p.ng_lane_2) && (
                          <div className="flex items-center gap-1 text-danger-700 text-xs font-bold bg-danger-50 border border-danger-edge-soft/60 px-1.5 py-0.5 rounded">
                            <span className="text-[10px] font-black opacity-70">NG:</span>
                            {p.ng_lane_1 && <span className="flex items-center gap-0.5"><RoleIcon role={p.ng_lane_1} className="w-3 h-3" />{p.ng_lane_1}</span>}
                            {p.ng_lane_2 && <span className="flex items-center gap-0.5"><RoleIcon role={p.ng_lane_2} className="w-3 h-3" />{p.ng_lane_2}</span>}
                          </div>
                        )}
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
