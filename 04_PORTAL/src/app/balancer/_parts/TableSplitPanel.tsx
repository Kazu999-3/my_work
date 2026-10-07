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

// 卓分割パネル（20人以上のとき代表MMRで2卓に分けて提示）
// 2026-10-07: app/balancer/page.tsx（3,029行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function TableSplitPanel({ selectedTable, setSelectedTable, tableSplit }: {
  selectedTable: { label: string; ids: any[] } | null;
  setSelectedTable: React.Dispatch<React.SetStateAction<{ label: string; ids: any[] } | null>>;
  tableSplit: { upper: { label: string; members: any[]; ids: any[] }; lower: { label: string; members: any[]; ids: any[] }; total: number };
}) {
  return (
          <div className="bg-surface border border-primary-edge-soft rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-primary-700">🪑 参加者{tableSplit.total}人 — 2卓に分けられます</span>
              <span className="text-[10px] text-muted-strong">代表MMR順に上位卓／下位卓へ自動仕分け（卓を選んでからチーム分けを実行）</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[tableSplit.upper, tableSplit.lower].map((t: any) => (
                <div key={t.label} className={`rounded-xl border p-3 ${selectedTable?.label === t.label ? 'border-primary-edge-strong bg-primary-100' : 'border-border bg-black/[0.03]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-foreground">{t.label}</span>
                    <button
                      onClick={() => setSelectedTable({ label: t.label, ids: t.ids })}
                      className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition ${selectedTable?.label === t.label ? 'bg-primary-600 text-white' : 'bg-surface-subtle text-foreground-subtle hover:bg-surface-hover'}`}>
                      {selectedTable?.label === t.label ? '選択中' : 'この卓を選ぶ'}
                    </button>
                  </div>
                  <div className="text-[10px] text-faint space-y-0.5 max-h-40 overflow-y-auto">
                    {t.members.map((m: any) => (
                      <div key={m.id} className="flex justify-between gap-2">
                        <span className="truncate">{m.name}</span>
                        <span className="font-mono text-muted-strong shrink-0">{m.mmr || 1200}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
  );
}
