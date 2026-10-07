"use client";

import { useState } from "react";
import { Shield, Trees, Zap, Target, Heart } from "lucide-react";
import { getKtmRank, calculateInitialMmr } from "../../../lib/mmr";
import { getPlayerTier } from "../../../lib/playerTier";

// KTM管理画面（/ktm-admin）の共通処理と小さな部品。
// 2026-10-07: app/ktm-admin/page.tsx（1,885行）から分割（処理・表示は分割前と同じ）。

export async function fetchWithTimeout(resource: RequestInfo, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 15000 } = options; // デフォルト15秒でタイムアウト
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    // 管理者APIへの認証はHttpOnly Cookie(admin_session)で自動送信されるため、
    // Bearerトークンの手動付与は不要（旧Discord OAuthアクセストークン付与ロジックを削除）。
    const response = await fetch(resource, {
      ...options,
      credentials: "include",
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    throw error;
  }
}

export function getRankFromMMR(mmr: number): { tier: string, color: string } {
  const badge = getKtmRank(mmr);
  const tierName = badge.name.split(' ')[0];
  return { tier: tierName, color: `${badge.color} ${badge.bg}` };
}

/** 新規メンバーの最高Rank・希望レーンから、レーン別と平均の初期MMRを計算する（Discord同期の2か所で共通） */
export function initialMmrsFor(highestRank: string, prefs: { primary: string; secondary: string }) {
  const mmr_top = calculateInitialMmr(highestRank, 'TOP', prefs);
  const mmr_jg = calculateInitialMmr(highestRank, 'JG', prefs);
  const mmr_mid = calculateInitialMmr(highestRank, 'MID', prefs);
  const mmr_adc = calculateInitialMmr(highestRank, 'ADC', prefs);
  const mmr_sup = calculateInitialMmr(highestRank, 'SUP', prefs);
  const mmr = Math.round((mmr_top + mmr_jg + mmr_mid + mmr_adc + mmr_sup) / 5);
  return { mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, mmr };
}

export function getColorFromRole(role: string): string {
  const r = (role || "").toUpperCase();
  if (r.includes("TOP")) return "text-primary-700 font-bold";
  if (r.includes("JUNGLE") || r.includes("JG")) return "text-success-700 font-bold";
  if (r.includes("MID")) return "text-danger-400 font-bold";
  if (r.includes("ADC")) return "text-primary-700 font-bold";
  if (r.includes("SUPPORT") || r.includes("SUP")) return "text-secondary-700 font-bold";
  if (r === "ALL") return "text-primary-700 font-bold";
  return "text-faint font-medium";
}

/** 参加者の経験度（新規・ライト・常連・経験者・復帰勢）判定（共通ロジックに集約） */
export function getPlayerExperienceBadge(p: any) {
  const info = getPlayerTier(p);
  return { tier: info.tier, label: info.label, color: info.colorClass, tip: info.tip };
}

/** Riot ID が Name#TAG 形式か */
export function isValidRiotId(ign: string | undefined | null) {
  const v = ign || "";
  return v.includes("#") && v.trim().split("#").length === 2;
}

export const RoleIcon = ({ role, className = "w-3.5 h-3.5" }: { role: string; className?: string }) => {
  const r = role.toUpperCase();
  switch (r) {
    case 'TOP': return <Shield className={`${className} text-primary-700`} />;
    case 'JG': return <Trees className={`${className} text-success-700`} />;
    case 'MID': return <Zap className={`${className} text-danger-400`} />;
    case 'ADC': return <Target className={`${className} text-primary-700`} />;
    case 'SUP': return <Heart className={`${className} text-secondary-700`} />;
    default: return null;
  }
};

/** ランク表示のMMRバッジ。クリックで数値を直接編集 */
export const MmrBadgeInput = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => {
  const [editing, setEditing] = useState(false);
  const rank = getRankFromMMR(value);

  if (editing) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        onBlur={() => setEditing(false)}
        autoFocus
        className="bg-background border border-primary-edge-strong rounded px-1 py-0.5 outline-none w-14 text-center font-mono text-xs text-foreground"
      />
    );
  }
  return (
    <div
      onClick={() => setEditing(true)}
      className={`cursor-pointer text-[10px] font-bold ${rank.color} hover:opacity-80 px-1 py-0.5 rounded border border-current/20 text-center w-14 overflow-hidden text-ellipsis`}
      title={`MMR: ${value} (クリックで編集)`}
    >
      {rank.tier}
    </div>
  );
};
