"use client";

import { useState } from "react";
import { Swords, Shuffle, Info, ChevronDown } from "lucide-react";
import { getPlayerTier } from "../../../lib/playerTier";

// 内戦バランサー画面の小さな表示部品。
// 2026-10-07: app/balancer/page.tsx から分離（表示内容は分離前と同じ）。

/** 参加者の経験度（新規・ライト・常連・経験者・復帰勢）判定（共通ロジックに集約） */
export function getPlayerExperienceBadge(p: any) {
  const info = getPlayerTier(p);
  return { tier: info.tier, label: info.label, color: info.colorClass, tip: info.tip };
}

/** 🔄 通常5v5 / 大人数ARAMローテーションの切り替えタブ（以前は2か所に同じものがあった） */
export function ModeTabBar({ modeTab, setModeTab }: {
  modeTab: 'standard' | 'aram_rotation';
  setModeTab: (m: 'standard' | 'aram_rotation') => void;
}) {
  const active = "bg-primary-500 text-stone-950 shadow-md shadow-primary-500/20";
  const activeAram = "bg-gradient-to-r from-primary-500 to-primary-600 text-stone-950 shadow-md shadow-primary-500/20";
  const inactive = "text-faint hover:text-stone-200";
  return (
    <div className="flex items-center gap-3 p-1.5 bg-[#2b2620]/90 border border-stone-800 rounded-2xl shadow-md w-full max-w-xl">
      <button
        type="button"
        onClick={() => setModeTab('standard')}
        className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${modeTab === 'standard' ? active : inactive}`}
      >
        <Swords className="w-4 h-4" />
        <span>⚔️ 通常 5v5 バランサー</span>
      </button>

      <button
        type="button"
        onClick={() => setModeTab('aram_rotation')}
        className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${modeTab === 'aram_rotation' ? activeAram : inactive}`}
      >
        <Shuffle className="w-4 h-4" />
        <span>🔄 大人数 ARAM ローテーション</span>
      </button>
    </div>
  );
}

/** 🔰 チーム分けツールの使い方ガイド（折りたたみ） */
export function UsageGuide() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  return (
    <div className="bg-primary-500/10 border border-primary-edge/60 rounded-2xl p-3.5 text-foreground shadow-xs">
      <button
        onClick={() => setIsGuideOpen(!isGuideOpen)}
        className="w-full flex items-center justify-between font-bold text-xs text-primary-900 hover:text-primary-950 transition cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <span className="font-black text-xs sm:text-sm">3秒でわかるチーム分け手順</span>
        </div>
        <span className="text-[10px] bg-primary-200/80 px-2 py-0.5 rounded-full font-black">
          {isGuideOpen ? '閉じる ▲' : '見る ▼'}
        </span>
      </button>

      {isGuideOpen && (
        <div className="mt-2.5 pt-2.5 border-t border-primary-edge/40 text-xs text-foreground-soft space-y-1.5 leading-relaxed animate-fade-in font-bold">
          <p>① 参加するメンバーにチェックを入れる（10人〜）</p>
          <p>② 希望レーン（TOP/JG/MID/ADC/SUP）を選ぶ</p>
          <p>③ 下の「⚔️ チーム分け実行」を押すだけ！</p>
        </div>
      )}
    </div>
  );
}

/** 参加者層（新規・ライト・常連・復帰）集計サマリー */
export function ExperienceSummary({ players }: { players: any[] }) {
  const activePlayers = players.filter(p => p.is_active && !p.is_spectator_fixed);
  const totalActive = activePlayers.length;
  const byTier = (tier: string) => activePlayers.filter(p => getPlayerExperienceBadge(p).tier === tier);
  const newPlayers = byTier('new');
  const lightPlayers = byTier('light');
  const returningPlayers = byTier('returning');
  const regularPlayers = byTier('regular');
  const newLightRatio = totalActive > 0 ? Math.round(((newPlayers.length + lightPlayers.length + returningPlayers.length) / totalActive) * 100) : 0;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-success-500/10 via-secondary-500/5 to-transparent border border-success-edge-strong/30 flex flex-col justify-between gap-2 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔰</span>
          <div>
            <h4 className="text-xs font-black text-success-950">参加メンバーの経験層分析</h4>
            <p className="text-[10px] text-muted">初心者・初参加の方も安心して参加できる環境です</p>
          </div>
        </div>
        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-success-500 text-stone-950">
          新規・ライト・復帰層 {newLightRatio}%
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-success-edge-strong/20">
        <span className="inline-flex items-center gap-1 font-bold text-success-900 bg-success-100/80 px-2 py-0.5 rounded-md text-[11px]">
          🔰 初参加: <strong>{newPlayers.length}名</strong>
        </span>
        <span className="inline-flex items-center gap-1 font-bold text-secondary-900 bg-secondary-100/80 px-2 py-0.5 rounded-md text-[11px]">
          🌱 ライト: <strong>{lightPlayers.length}名</strong>
        </span>
        {returningPlayers.length > 0 && (
          <span className="inline-flex items-center gap-1 font-bold text-primary-900 bg-primary-100/80 px-2 py-0.5 rounded-md text-[11px]">
            ⏳ 復帰勢: <strong>{returningPlayers.length}名</strong>
          </span>
        )}
        <span className="inline-flex items-center gap-1 font-bold text-primary-900 bg-primary-100/80 px-2 py-0.5 rounded-md text-[11px]">
          👑 常連: <strong>{regularPlayers.length}名</strong>
        </span>
      </div>
    </div>
  );
}

/** KTM専用マッチング用語（折りたたみ） */
export function MatchingGlossary() {
  return (
    <details className="bg-surface border border-border rounded-xl text-sm group">
      <summary className="p-4 cursor-pointer flex items-center gap-2 font-bold text-primary-700 list-none select-none">
        <Info className="h-4 w-4" /> KTM専用マッチング用語
        <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="bg-surface-subtle p-4 rounded border border-border">
          <span className="font-bold text-primary-700 mb-1 block">こだわり (1～3)</span>
          <p className="text-faint">メインレーンをどれくらいやりたいかの度合い。1(絶対やりたい) ～ 3(どこでもいい)。</p>
        </div>
        <div className="bg-surface-subtle p-4 rounded border border-border">
          <span className="font-bold text-danger-700 mb-1 block">格上許可 (ON/OFF)</span>
          <p className="text-faint">自分より実力・MMR差が大きい相手（差200以上、シルバーvsプラチナ等）との対面を許容する設定です。OFFの場合は極力対面がブロックされ、11人以上の選抜時は観戦枠へ優先送致されます。</p>
        </div>
        <div className="bg-surface-subtle p-4 rounded border border-border">
          <span className="font-bold text-success-700 mb-1 block">PITY (ピティ)</span>
          <p className="text-faint">「希望外レーン」に飛ばされた人に貯まる同情ポイント。高いほど次回優先的にメインレーンへ。</p>
        </div>
        <div className="bg-surface-subtle p-4 rounded border border-border">
          <span className="font-bold text-primary-700 mb-1 block">OFF PITY (オフピティ)</span>
          <p className="text-faint">「希望レーン」を連続でやっている人に貯まるポイント。一時的に他レーンへ飛ばされる確率が上がります。</p>
        </div>
      </div>
    </details>
  );
}

/** 参加者リストの並び替え見出し（PlayerListTable に部品として渡す） */
export function makeSortableHeader(sortConfig: { key: string; direction: string }, requestSort: (key: string) => void) {
  const SortableHeader = ({ label, sortKey, className = "" }: { label: string; sortKey: string; className?: string }) => (
    <th
      className={`px-4 py-3 font-medium cursor-pointer hover:bg-surface-subtle transition whitespace-nowrap ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1 justify-center">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-primary-700 text-xs">{sortConfig.direction === "desc" ? "↓" : "↑"}</span>
        )}
        {sortConfig.key !== sortKey && <span className="text-muted-strong text-xs">↕</span>}
      </div>
    </th>
  );
  return SortableHeader;
}
