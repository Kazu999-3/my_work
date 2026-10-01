'use client';

import React from 'react';
import { Compass, Zap, Shield, ArrowRight, CornerDownRight, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EarlyJunglePathingProps {
  myChampion: string;
  enemyChampion: string;
  myFastestClearSec?: number | null;
  enemyFastestClearSec?: number | null;
  mySpikeEarly?: number; // 1-5
  enemySpikeEarly?: number; // 1-5
}

export default function EarlyJunglePathingCard({
  myChampion,
  enemyChampion,
  myFastestClearSec,
  enemyFastestClearSec,
  mySpikeEarly = 3,
  enemySpikeEarly = 3,
}: EarlyJunglePathingProps) {
  if (!myChampion || !enemyChampion) return null;

  // 1. スカトル勝率・戦闘力判定 (Lv3時点)
  const isEarlyStronger = mySpikeEarly > enemySpikeEarly;
  const isEarlyWeaker = mySpikeEarly < enemySpikeEarly;
  const hasBothClearTimes = myFastestClearSec != null && enemyFastestClearSec != null;
  const isFasterClear = hasBothClearTimes ? (myFastestClearSec < enemyFastestClearSec) : false;

  // 2. 推奨プラン判定
  let planType: 'contest' | 'avoid' | 'gank_first' = 'contest';
  let planSummary = '';
  let step1Text = '';
  let step2Text = '';
  let step3Text = '';

  if (isEarlyStronger) {
    planType = 'contest';
    planSummary = `Lv3でのタイマンが有利なため、同サイドスカトル（2:55〜）で積極的に敵JGと衝突・キルを狙うプラン。`;
    step1Text = `敵JGと同じサイドで終わるようスタート（敵が赤スタート予想ならボット側からフルクリア）。`;
    step2Text = `2:55スカトルで敵JGと鉢合わせたら、レーン主導権を確認して強気にエンゲージ。`;
    step3Text = `スカトル獲得後、押し込まれている隣接レーンへLv4即時ガンクまたは敵陣インベード。`;
  } else if (isEarlyWeaker) {
    planType = 'avoid';
    planSummary = `序盤タイマンで不利なため、敵JGと逆サイドのスカトルを安全に取得し、ファーム先行でLv6を目指すプラン。`;
    step1Text = `敵JGと逆サイドで終わるルート（敵がボットスタートなら自陣トップスタートまたは逆ルート）。`;
    step2Text = `2:55スカトルは敵と鉢合わない逆側を即座に狩り、無駄な2v2衝突を完全回避。`;
    step3Text = `フルクリア完了後、無理なガンクはせず一度リコール（靴＋素材購入）してテンポ維持。`;
  } else {
    planType = isFasterClear ? 'contest' : 'avoid';
    planSummary = isFasterClear
      ? `クリア速度で先行できるため、2:55スカトルに先着して視界確保・有利トレードを仕掛けるプラン。`
      : `レーナーの初期主導権（プッシュ状況）に合わせてスカトル争奪を判断する柔軟プラン。`;
    step1Text = `味方ボットのリーシュを受けて最速フルクリアを開始。`;
    step2Text = `2:50時点で隣接レーンの主導権（寄れるか）を確認し、寄れない場合は逆スカトルへ反転。`;
    step3Text = `スカトル確保後、HP8割以上ならガンク、削られていれば即リコール。`;
  }

  const fmtSec = (sec?: number | null) => (sec ? `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, '0')}秒` : '約3分15秒（目安推測）');

  return (
    <div className="bg-slate-900/90 text-white rounded-2xl p-4 border border-slate-800 space-y-3 shadow-md">
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider">
            初動3分ルートの方針（{myChampion} vs {enemyChampion}）
          </h4>
        </div>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
          planType === 'contest'
            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
            : 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
        }`}>
          {planType === 'contest' ? '⚔️ 2:55 スカトル勝負型' : '🛡️ 逆サイド回避・ファーム型'}
        </span>
      </div>

      {/* テンポ・戦闘力比較ミニバー */}
      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/70 p-2 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center px-1">
          <span className="text-slate-400 font-bold">自クリア基準 ({myChampion})</span>
          <span className="font-mono font-black text-indigo-300">{fmtSec(myFastestClearSec)}</span>
        </div>
        <div className="flex justify-between items-center px-1 border-l border-slate-800">
          <span className="text-slate-400 font-bold">敵クリア基準 ({enemyChampion})</span>
          <span className="font-mono font-black text-rose-300">{fmtSec(enemyFastestClearSec)}</span>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed font-medium">
        💡 <strong className="text-indigo-400">戦術要約:</strong> {planSummary}
      </p>

      {/* 3ステップ手順 */}
      <div className="space-y-1.5 pt-1 text-xs">
        <div className="flex items-start gap-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
          <span className="font-mono font-black text-indigo-400 text-[11px] shrink-0">STEP 1</span>
          <span className="text-slate-300">{step1Text}</span>
        </div>
        <div className="flex items-start gap-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
          <span className="font-mono font-black text-amber-400 text-[11px] shrink-0">STEP 2</span>
          <span className="text-slate-300">{step2Text}</span>
        </div>
        <div className="flex items-start gap-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
          <span className="font-mono font-black text-emerald-400 text-[11px] shrink-0">STEP 3</span>
          <span className="text-slate-300">{step3Text}</span>
        </div>
      </div>
    </div>
  );
}
