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

// ★ 管理者パネル（MMR整合性・Rebuild・予測精度など）
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function AdminPanel({ players, integrityData, checkingIntegrity, rebuildingMmr, predStats, showInitialPrefs, setShowInitialPrefs, initialDraft, setInitialDraft, savingInitial, sideStats, satStats, tallyingSat, checkIntegrity, fetchPredStats, openInitialPrefs, saveInitialPrefs, fetchSatStats, handleRebuildMmr }: {
  players: any[];
  integrityData: any;
  checkingIntegrity: boolean;
  rebuildingMmr: boolean;
  predStats: { total: number; correct: number; accuracy: number; avgConfidence: number; avgCloseness: number; recentCloseness: number[] } | null;
  showInitialPrefs: boolean;
  setShowInitialPrefs: React.Dispatch<React.SetStateAction<boolean>>;
  initialDraft: Record<string, { primary: string; secondary: string }>;
  setInitialDraft: React.Dispatch<React.SetStateAction<Record<string, { primary: string; secondary: string }>>>;
  savingInitial: boolean;
  sideStats: { total: number; blueWins: number; blueRate: number } | null;
  satStats: { tallied: number; totalUp: number; totalDown: number; totalNeutral?: number; recent?: { up: number; down: number; neutral: number }[]; satisfactionRate: number | null } | null;
  tallyingSat: boolean;
  checkIntegrity: () => any;
  fetchPredStats: () => any;
  openInitialPrefs: () => any;
  saveInitialPrefs: () => any;
  fetchSatStats: () => any;
  handleRebuildMmr: () => any;
}) {
  return (
          <div className="bg-surface border border-primary-edge-soft rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${integrityData?.hasDiscrepancy ? 'text-danger-700' : 'text-success-700'}`} />
                <span className="text-sm font-bold text-foreground">MMR整合性ステータス</span>
                {checkingIntegrity ? (
                  <span className="text-xs text-muted-strong">確認中...</span>
                ) : integrityData ? (
                  <span className={`text-xs font-bold ${integrityData.hasDiscrepancy ? 'text-danger-700' : 'text-success-700'}`}>
                    {integrityData.hasDiscrepancy ? `${integrityData.discrepancyCount}人にズレがあります` : '全員一致しています'}
                  </span>
                ) : (
                  <span className="text-xs text-muted-strong">未確認</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={checkIntegrity}
                  disabled={checkingIntegrity}
                  className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-foreground-soft px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkingIntegrity ? 'animate-spin' : ''}`} /> 再チェック
                </button>
                <button
                  onClick={handleRebuildMmr}
                  disabled={rebuildingMmr}
                  className="flex items-center gap-1.5 bg-danger-100 hover:bg-danger-200 text-danger-700 border border-danger-edge px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                  title="過去のすべての試合履歴を元にMMRを再計算し、全員のデータを上書きします"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${rebuildingMmr ? 'animate-spin' : ''}`} /> 🔄 Rebuild
                </button>
              </div>
            </div>
            {integrityData?.hasDiscrepancy && (
              <div className="text-xs text-faint">
                名簿の編集・Riot/Discord同期・アフィリエイト管理などの詳細操作は
                <Link href="/ktm-admin" prefetch={false} className="text-primary-700 hover:underline mx-1">KTM管理ダッシュボード</Link>
                で行えます。
              </div>
            )}

            {/* バランサー予測の的中率（課題: 予測勝率の検証） */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-foreground">🎯 バランサー予測の精度</span>
                <button
                  onClick={fetchPredStats}
                  className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-foreground-soft px-3 py-1.5 rounded-lg font-bold transition text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> 更新
                </button>
              </div>
              {predStats ? (
                predStats.total === 0 ? (
                  <p className="text-xs text-muted-strong mt-2">まだ結果と突き合わせ済みの予測がありません（チーム分け→試合結果記録が蓄積されると表示されます）。</p>
                ) : (
                  <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-muted-strong">予測的中率</div>
                      <div className="text-lg font-black text-success-700">{predStats.accuracy}%</div>
                      <div className="text-[10px] text-muted-strong">{predStats.correct}/{predStats.total}戦</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-muted-strong">平均接戦度</div>
                      <div className={`text-lg font-black ${predStats.avgCloseness >= 80 ? 'text-primary-700' : predStats.avgCloseness >= 60 ? 'text-primary-700' : 'text-danger-700'}`}>{predStats.avgCloseness}</div>
                      <div className="text-[10px] text-muted-strong">100=完全拮抗</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-muted-strong">平均の偏り</div>
                      <div className="text-lg font-black text-primary-700">±{predStats.avgConfidence}%</div>
                      <div className="text-[10px] text-muted-strong">低=拮抗</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-muted-strong">サンプル</div>
                      <div className="text-lg font-black text-foreground">{predStats.total}</div>
                      <div className="text-[10px] text-muted-strong">直近200戦</div>
                    </div>
                  </div>
                  {/* 直近10戦の接戦度（#82: 毎試合採点。左が最新） */}
                  {predStats.recentCloseness.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] text-muted-strong mb-1">直近10戦の接戦度（左が最新）</div>
                      <div className="flex gap-1">
                        {predStats.recentCloseness.map((c, i) => (
                          <div key={i} title={`接戦度 ${c}`} className={`flex-1 h-6 rounded flex items-center justify-center text-[9px] font-black ${c >= 80 ? 'bg-primary-100 text-primary-700 border border-primary-edge-soft' : c >= 60 ? 'bg-primary-100 text-primary-700 border border-primary-edge-soft' : 'bg-danger-100 text-danger-700 border border-danger-edge-soft'}`}>
                            {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                )
              ) : (
                <p className="text-xs text-muted-strong mt-2">読み込み中...</p>
              )}
              <p className="text-[10px] text-muted-strong mt-2">
                的中率が50%近い＝実力拮抗、極端に高い＝MMR差が大きいまま組んでいる可能性。平均の偏りが小さいほどバランサーが互角の試合を作れています。
              </p>
            </div>

            {/* サイド偏り検証(#81): Blue/Red勝率 */}
            {sideStats && sideStats.total > 0 && (
              <div className="border-t border-border pt-3">
                <span className="text-sm font-bold text-foreground">🎨 サイド偏り（Blue/Red勝率）</span>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-black text-secondary-700 w-28 text-right">BLUE {sideStats.blueRate}%</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden bg-surface-subtle flex">
                    <div className="bg-secondary-500/80" style={{ width: `${sideStats.blueRate}%` }}></div>
                    <div className="bg-danger-500/80" style={{ width: `${100 - sideStats.blueRate}%` }}></div>
                  </div>
                  <span className="text-xs font-black text-danger-700 w-28">RED {Math.round((100 - sideStats.blueRate) * 10) / 10}%</span>
                </div>
                <p className="text-[10px] text-muted-strong mt-1.5">
                  全{sideStats.total}戦（Blue {sideStats.blueWins}勝）。50%から大きくズレている場合はサイド有利かサイド公平化ロジックの見直し材料になります。
                </p>
              </div>
            )}

            {/* 初期MMRの基準レーン（凍結値）編集 */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-foreground">🧊 初期MMRの基準レーン（凍結値）</span>
                <button
                  onClick={() => showInitialPrefs ? setShowInitialPrefs(false) : openInitialPrefs()}
                  className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-foreground-soft px-3 py-1.5 rounded-lg font-bold transition text-xs"
                >
                  {showInitialPrefs ? '閉じる' : '編集する'}
                </button>
              </div>
              <p className="text-[10px] text-muted-strong mt-1.5">
                初期MMRの計算に使う「本来のメイン/サブレーン」です。希望レーンを後から変えてもここは変わりません（Rebuildの出発点が固定されます）。
                誤って凍結された人はここで直して、保存後にRebuildしてください。
              </p>
              {showInitialPrefs && (
                <div className="mt-3 space-y-3">
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-border divide-y divide-black/5">
                    {players.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-black/[0.03]">
                        <span className="flex-1 text-xs font-bold text-foreground truncate">{p.name}</span>
                        <select
                          value={initialDraft[p.id]?.primary || 'ALL'}
                          onChange={e => setInitialDraft(d => ({ ...d, [p.id]: { ...(d[p.id] || { primary: 'ALL', secondary: '-' }), primary: e.target.value } }))}
                          className="bg-surface border border-border text-foreground text-xs rounded px-1.5 py-1 outline-none w-20"
                        >
                          {['TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          value={initialDraft[p.id]?.secondary || '-'}
                          onChange={e => setInitialDraft(d => ({ ...d, [p.id]: { ...(d[p.id] || { primary: 'ALL', secondary: '-' }), secondary: e.target.value } }))}
                          className="bg-surface border border-border text-foreground-subtle text-xs rounded px-1.5 py-1 outline-none w-20"
                        >
                          {['-', 'TOP', 'JG', 'MID', 'ADC', 'SUP', 'ALL'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowInitialPrefs(false)} className="px-4 py-2 rounded-lg text-xs font-bold bg-surface-subtle text-foreground-subtle hover:bg-surface-hover">キャンセル</button>
                    <button onClick={saveInitialPrefs} disabled={savingInitial}
                      className="px-4 py-2 rounded-lg text-xs font-black bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 flex items-center gap-1.5">
                      {savingInitial && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      保存（要Rebuild）
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* バランス満足度(Discord 👍/👎)（課題#42） */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-bold text-foreground">👍 チーム分け満足度（成績入力時に記録）</span>
                <button
                  onClick={fetchSatStats}
                  disabled={tallyingSat}
                  className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-foreground-soft px-3 py-1.5 rounded-lg font-bold transition text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${tallyingSat ? 'animate-spin' : ''}`} /> 集計
                </button>
              </div>
              {satStats ? (
                satStats.tallied === 0 ? (
                  <p className="text-xs text-muted-strong mt-2">まだ記録がありません（試合成績を入力する画面で「今日のチーム分けは?」を選ぶと貯まります）。</p>
                ) : (
                  <>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-muted-strong">満足度</div>
                      <div className="text-lg font-black text-success-700">{satStats.satisfactionRate !== null ? `${satStats.satisfactionRate}%` : '—'}</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-muted-strong">👍 / 😐 / 👎</div>
                      <div className="text-lg font-black text-foreground">{satStats.totalUp} / {satStats.totalNeutral ?? 0} / {satStats.totalDown}</div>
                    </div>
                    <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                      <div className="text-[10px] text-muted-strong">集計試合</div>
                      <div className="text-lg font-black text-foreground">{satStats.tallied}</div>
                    </div>
                  </div>
                  {/* 直近の試合ごとの内訳（#76: 左が最新） */}
                  {(satStats.recent && satStats.recent.length > 0) && (
                    <div className="mt-2">
                      <div className="text-[10px] text-muted-strong mb-1">直近の試合ごとの投票（左が最新）</div>
                      <div className="flex gap-1 flex-wrap">
                        {satStats.recent.map((r, i) => {
                          const votes = r.up + r.down;
                          const good = votes > 0 && r.up / votes >= 0.6;
                          const bad = votes > 0 && r.up / votes <= 0.4;
                          return (
                            <div key={i} title={`👍${r.up} 😐${r.neutral} 👎${r.down}`}
                              className={`px-2 py-1 rounded text-[9px] font-black border ${votes === 0 ? 'bg-black/[0.04] text-muted-strong border-border' : good ? 'bg-success-100 text-success-700 border-success-edge-soft' : bad ? 'bg-danger-100 text-danger-700 border-danger-edge-soft' : 'bg-primary-100 text-primary-700 border-primary-edge-soft'}`}>
                              {votes === 0 ? '票なし' : `👍${r.up}/👎${r.down}`}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </>
                )
              ) : (
                <p className="text-xs text-muted-strong mt-2">「集計」を押すと、成績入力時に記録された満足度を直近50戦ぶん集計します。</p>
              )}
            </div>
          </div>
  );
}
