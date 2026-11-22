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
          <p>① 参加するメンバーにチェックを入れる（1試合10人〜）</p>
          <p>② 希望レーン（TOP/JG/MID/ADC/SUP）やNGレーンを確認する</p>
          <p>③ 画面下の「⚔️ チーム分け実行」を押すだけ！</p>
          <p className="text-[11px] font-medium text-muted-strong pt-1 border-t border-primary-edge/30">
            💡 <strong>帯分けの仕組み:</strong> 定期カスタムは実力（Portal MMR 1450）を基準に「上位帯」と「中初級帯」に分かれます。上位帯が10人未満の時は、マイページで繰り上げ許可しているメンバーから自動で補充されます。
          </p>
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
  const targetCount = newPlayers.length + lightPlayers.length + returningPlayers.length;
  const newLightRatio = totalActive > 0 ? Math.round((targetCount / totalActive) * 100) : 0;

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
          新規・ライト・復帰層: 参加{totalActive}名中 {targetCount}名 ({newLightRatio}%)
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

/** KTM専用マッチング用語 ＆ レーティング解説（折りたたみ） */
export function MatchingGlossary() {
  return (
    <details className="bg-surface border border-border rounded-2xl text-sm group shadow-2xs">
      <summary className="p-4 cursor-pointer flex items-center gap-2 font-bold text-primary-700 list-none select-none">
        <Info className="h-4 w-4" /> 💡 KTMレーティング・チーム分け用語の解説
        <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1 text-xs">
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-border space-y-1">
          <span className="font-black text-primary-700 block">SoloQランク vs KTMカスタムMMR</span>
          <p className="text-muted leading-relaxed">
            <strong>SoloQランク</strong>はRiot公式のランク戦指標です。一方、<strong>KTMカスタムMMR</strong>は本コミュニティのカスタム対戦結果から算出される独自指標です。チーム分けのバランス調整には「KTMカスタムMMR」が使われます。
          </p>
        </div>
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-border space-y-1">
          <span className="font-black text-primary-700 block">代表MMR vs レーン別MMR</span>
          <p className="text-muted leading-relaxed">
            このバランサーで表示・使用されるのは総合的な「代表MMR」です。リーダーボード（順位表）では、レーンごとの得意・不得意を正確に評価した「レーン別MMR」が表示されます。
          </p>
        </div>
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-border space-y-1">
          <span className="font-black text-amber-700 dark:text-amber-400 block">初参加者のMMR初期値（仮値）</span>
          <p className="text-muted leading-relaxed">
            戦績のない初参加プレイヤーには、SoloQランクから推定した初期値（仮値）が割り当てられ、表内に「仮」バッジが付きます。試合出場を重ねることで正確な実力値へと収束していきます。
          </p>
        </div>
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-border space-y-1">
          <span className="font-black text-danger-700 block">格上との対面（🛡️保護 / ⚔️挑戦）</span>
          <p className="text-muted leading-relaxed">
            MMR差が大きい相手（差200以上、シルバーvsプラチナ等）と対面してよいかの設定。「🛡️保護」の人はチーム分けで格差対面を回避します。「⚔️挑戦」の人は格上との直接対決を許可します。
          </p>
        </div>
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-border space-y-1">
          <span className="font-black text-primary-700 block">希望レーンの強さ（管理者設定）</span>
          <p className="text-muted leading-relaxed">
            「絶対このレーン」「できれば」「どこでもOK」の3段階。公正な配分調整のため、現在は管理者のみ変更可能になっています。
          </p>
        </div>
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-border space-y-1">
          <span className="font-black text-success-700 block">🎯 希望優先度 / 🔄 譲り合い度</span>
          <p className="text-muted leading-relaxed">
            希望外レーンに回された人に貯まり次回優先される「希望優先度」と、希望レーンが連続した際に席を譲り合うための「譲り合い度」で自動調整されます。
          </p>
        </div>
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-border md:col-span-2 space-y-1">
          <span className="font-black text-amber-700 dark:text-amber-400 block">🎟️ 試合出場優先度（待機救済）</span>
          <p className="text-muted leading-relaxed">
            10人以上集まった際に「見学・待機枠」に回った人に貯まるポイント。次回、最優先で10人の出場枠へ選出されます（※初参加の方は0ポイントでも100%最優先で自動選出されます）。
          </p>
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
