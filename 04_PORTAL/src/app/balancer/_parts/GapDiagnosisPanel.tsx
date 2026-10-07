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

// 格差診断（対面が組めない外れ値の警告）
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function GapDiagnosisPanel({ handicapIds, handleInputChange, toggleHandicap, gapDiagnosis, HANDICAP_MMR_PENALTY }: {
  handicapIds: any[];
  handleInputChange: (uid: string, field: string, value: any) => any;
  toggleHandicap: (id: any) => any;
  gapDiagnosis: { orphans: { player: any; gap: number; nearest: number }[]; spread: number };
  HANDICAP_MMR_PENALTY: any;
}) {
  return (
          <div className="bg-surface border border-danger-edge-soft rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-danger-700">⚠️ レート差の警告</span>
              <span className="text-[10px] text-muted-strong">MMR幅 {gapDiagnosis.spread} — 近い実力の相手がいない人がいます</span>
            </div>
            <div className="space-y-2">
              {gapDiagnosis.orphans.map(({ player: p, gap, nearest }) => (
                <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap bg-black/[0.04] rounded-lg px-3 py-2 border border-border">
                  <div className="text-xs text-foreground-subtle min-w-0">
                    <span className="font-black text-foreground">{p.name}</span>
                    <span className="text-muted-strong font-mono ml-2">{p.mmr || 1200}</span>
                    <span className="text-danger-700 ml-2">次点 {nearest}（差 {gap}）</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleInputChange(p.id, 'is_spectator_fixed', true)}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-primary-100 text-primary-700 border border-primary-edge-soft hover:bg-primary-100">
                      観戦に回す
                    </button>
                    <button
                      onClick={() => toggleHandicap(p.id)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${handicapIds.includes(p.id) ? 'bg-primary-600 text-white border-primary-edge-strong' : 'bg-primary-100 text-primary-700 border-primary-edge-soft hover:bg-primary-100'}`}>
                      {handicapIds.includes(p.id) ? '✓ ハンデ参加' : 'ハンデ参加'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-strong">
              観戦に回した人は観戦Pityが溜まり次回は優先出場します。ハンデ参加は<strong className="text-primary-700">チーム分けの計算上のみMMRを{HANDICAP_MMR_PENALTY}下げて</strong>格差を緩和します（実際のMMR・戦績は変わりません）。結果とDiscord通知にも🎗️で明示されます。
            </p>
          </div>
  );
}
