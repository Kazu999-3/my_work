'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import PlayRecommendationCard from './PlayRecommendationCard';
import TimingHeatmapCard from './TimingHeatmapCard';
import RankGoalCard from './RankGoalCard';
import OverlayLauncherButton from './OverlayLauncherButton';
import { useCoachRiotId } from './riotIdContext';

// 試合前タブの補助カード（旧ポータル /coach「1. 試合前」の残り部品の移植）。2026-10-04
// 「次の試合に行くべきか」・時間帯ヒートマップ・ランク目標・HUD起動ボタン。
// Riot ID は他のタブと同じ端末保存の値（coach_riot_id）を使う。

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  // 2026-10-08: ユーザー要望で最初から開いた状態にする（以前は閉じた状態で始まっていた）
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-black text-white cursor-pointer">
        <span>{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export function PreGameTop() {
  const riotId = useSavedRiotId();
  return (
    <div className="space-y-3">
      <OverlayLauncherButton />
      <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="text-sm font-black text-white">🚦 次の試合に行くべきか</h3>
        {riotId ? <PlayRecommendationCard riotId={riotId} /> : <NeedRiotId />}
      </section>
    </div>
  );
}

export function PreGameBottom() {
  const riotId = useSavedRiotId();
  if (!riotId) return null;
  return (
    <div className="space-y-3">
      <Collapsible title="🗓️ 今の時間帯は勝てているか（曜日×時間帯 勝率ヒートマップ）">
        <TimingHeatmapCard riotId={riotId} />
      </Collapsible>
      <Collapsible title="🎯 ランク目標と到達見込み">
        <RankGoalCard riotId={riotId} />
      </Collapsible>
    </div>
  );
}

function NeedRiotId() {
  return (
    <p className="text-xs text-slate-400">
      画面上部の「自分のRiot ID」を入力すると、ここに直近の戦績から判定を表示します。
    </p>
  );
}

function useSavedRiotId(): string {
  return useCoachRiotId().riotId;
}
