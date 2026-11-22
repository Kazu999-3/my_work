'use client';

import React from 'react';
import { Compass, Zap, Shield, ArrowRight, CornerDownRight, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EarlyJunglePathingProps {
  myChampion: string;
  enemyChampion: string;
  lane?: 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'COMMON' | string;
  myFastestClearSec?: number | null;
  enemyFastestClearSec?: number | null;
  mySpikeEarly?: number; // 1-5
  enemySpikeEarly?: number; // 1-5
}

export default function EarlyJunglePathingCard({
  myChampion,
  enemyChampion,
  lane = 'JUNGLE',
  myFastestClearSec,
  enemyFastestClearSec,
  mySpikeEarly = 3,
  enemySpikeEarly = 3,
}: EarlyJunglePathingProps) {
  if (!myChampion || !enemyChampion) return null;

  const currentLane = (lane || 'JUNGLE').toUpperCase();

  // レーン別の初動3分プラン構築
  if (currentLane === 'TOP') {
    return (
      <div className="bg-zinc-900/90 text-white rounded-2xl p-4 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wider">
              初動3分のレーンプラン（TOP: {myChampion} vs {enemyChampion}）
            </h4>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-300 border-emerald-700/60">
            🛡️ Lv1〜3 ウェーブ＆被ガンク管理
          </span>
        </div>

        {/* TOP用テンポ・指標ミニバー */}
        <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-950/70 p-2 rounded-xl border border-zinc-800">
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-400 font-bold">Lv2先行分岐</span>
            <span className="font-mono font-black text-emerald-300">第2ウェーブ近接1体</span>
          </div>
          <div className="flex justify-between items-center px-1 border-l border-zinc-800">
            <span className="text-zinc-400 font-bold">敵JGトップ到達警戒</span>
            <span className="font-mono font-black text-rose-300">02:40 〜 03:15</span>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed font-medium">
          💡 <strong className="text-emerald-400">戦術要約:</strong> 第1〜第3ウェーブのプッシュ管理を徹底し、敵JGの初期ガンク（02:50〜）を警戒しながらLv3先行・安全リコールを狙うプラン。
        </p>

        {/* 3ステップ手順 */}
        <div className="space-y-1.5 pt-1 text-xs">
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-emerald-400 text-[11px] shrink-0">STEP 1</span>
            <span className="text-zinc-300">
              <strong>Lv1〜2 (ウェーブ管理):</strong> 第1ウェーブでの無理な被弾を避け、第2ウェーブの近接ミニオン1体でLv2先行を狙う（敵が先行する場合は無理せず手前に引く）。
            </span>
          </div>
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-amber-400 text-[11px] shrink-0">STEP 2</span>
            <span className="text-zinc-300">
              <strong>02:40〜03:00 (被ガンク警戒):</strong> 敵JGのトップ側ガンク警戒タイム。リバーまたはトライブッシュに視界ワードを置き、敵JGの位置が確定するまで深追いを自重。
            </span>
          </div>
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-teal-400 text-[11px] shrink-0">STEP 3</span>
            <span className="text-zinc-300">
              <strong>03:15〜03:30 (クラッシュ＆展開):</strong> 第3ウェーブ（キャノン）を敵タワーへ押し込み切って安全リコール（靴/ロングソード等購入）、または味方JGのトップ側スカトル・ヴォイドグラブ寄りを支援。
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (currentLane === 'MID') {
    return (
      <div className="bg-zinc-900/90 text-white rounded-2xl p-4 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider">
              初動3分のレーンプラン（MID: {myChampion} vs {enemyChampion}）
            </h4>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-cyan-950/80 text-cyan-300 border-cyan-700/60">
            ⚡ レーン主導権 ＆ 視界先行型
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-950/70 p-2 rounded-xl border border-zinc-800">
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-400 font-bold">Lv2先行分岐</span>
            <span className="font-mono font-black text-cyan-300">第2ウェーブ近接1体</span>
          </div>
          <div className="flex justify-between items-center px-1 border-l border-zinc-800">
            <span className="text-zinc-400 font-bold">リバー視界確保推奨</span>
            <span className="font-mono font-black text-amber-300">02:30 〜 02:50</span>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed font-medium">
          💡 <strong className="text-cyan-400">戦術要約:</strong> スキル貫通・射程差を活かしてLv2先行し、両サイドリバーからの奇襲をケアしながら味方JGの初期スカトル争奪に最速で寄れる態勢を作るプラン。
        </p>

        <div className="space-y-1.5 pt-1 text-xs">
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-cyan-400 text-[11px] shrink-0">STEP 1</span>
            <span className="text-zinc-300">
              <strong>Lv1〜2 (トレード＆プッシュ):</strong> ミニオンと敵チャンプを同時に巻き込むスキル発動でウェーブ主導権を奪取。横ステップで敵のスキルハラスを回避。
            </span>
          </div>
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-amber-400 text-[11px] shrink-0">STEP 2</span>
            <span className="text-zinc-300">
              <strong>02:30〜02:50 (リバー視界):</strong> 味方JGが回るサイド（または敵JGが来そうな側）のF6/リバーブッシュにワード設置。中央維持で両サイドからのガンク被弾ラインを消す。
            </span>
          </div>
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-emerald-400 text-[11px] shrink-0">STEP 3</span>
            <span className="text-zinc-300">
              <strong>03:15〜03:30 (スカトル援護):</strong> 第3ウェーブをプッシュして敵をタワー下に釘付けにし、味方JGのスカトル交戦へ一番槍で寄れる主導権を確立。
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (currentLane === 'ADC' || currentLane === 'SUP' || currentLane === 'SUPPORT' || currentLane === 'BOT') {
    return (
      <div className="bg-zinc-900/90 text-white rounded-2xl p-4 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-purple-400 animate-pulse" />
            <h4 className="text-xs font-black text-purple-300 uppercase tracking-wider">
              初動3分のレーンプラン（BOT: {myChampion} vs {enemyChampion}）
            </h4>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-purple-950/80 text-purple-300 border-purple-700/60">
            👑 第2ウェーブLv2先行勝負型
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-950/70 p-2 rounded-xl border border-zinc-800">
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-400 font-bold">Lv2先行分岐</span>
            <span className="font-mono font-black text-purple-300">第2ウェーブ前衛3体</span>
          </div>
          <div className="flex justify-between items-center px-1 border-l border-zinc-800">
            <span className="text-zinc-400 font-bold">敵JGボット到達警戒</span>
            <span className="font-mono font-black text-rose-300">02:45 〜 03:15</span>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed font-medium">
          💡 <strong className="text-purple-400">戦術要約:</strong> 第2ウェーブ近接3体の最速処理でLv2先行を勝ち取り、敵デュオへの有利トレードを押し付けつつ敵JGのLv3ボットガンクに備えるプラン。
        </p>

        <div className="space-y-1.5 pt-1 text-xs">
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-purple-400 text-[11px] shrink-0">STEP 1</span>
            <span className="text-zinc-300">
              <strong>Lv1〜2 (Lv2先行争い):</strong> リーシュ後すぐにレーン着座。第2ウェーブの前衛3体を削り切り、Lv2になった瞬間にエンゲージ／ゾーン制圧。
            </span>
          </div>
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-amber-400 text-[11px] shrink-0">STEP 2</span>
            <span className="text-zinc-300">
              <strong>02:45〜03:15 (視界確保):</strong> 敵JGのボットガンク警戒。川側リバーブッシュおよびトライブッシュの視界をサポートと分担して確保。
            </span>
          </div>
          <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
            <span className="font-mono font-black text-teal-400 text-[11px] shrink-0">STEP 3</span>
            <span className="text-zinc-300">
              <strong>03:15〜03:30 (クラッシュ＆スカトル):</strong> ウェーブをタワーへクラッシュさせてリコール（初手ブーツ/素材）、またはドラゴン側スカトル争奪の味方JGを支援。
            </span>
          </div>
        </div>
      </div>
    );
  }

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

  const fmtSec = (sec?: number | null) => (
    typeof sec === 'number' && sec > 0
      ? `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, '0')}秒`
      : 'データなし（実測未登録）'
  );

  return (
    <div className="bg-zinc-900/90 text-white rounded-2xl p-4 border border-zinc-800 space-y-3 shadow-md">
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400 animate-pulse" />
          <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
            初動3分ルートの方針（{myChampion} vs {enemyChampion}）
          </h4>
        </div>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
          planType === 'contest'
            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
            : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
        }`}>
          {planType === 'contest' ? '⚔️ 2:55 スカトル勝負型' : '🛡️ 逆サイド回避・ファーム型'}
        </span>
      </div>

      {/* テンポ・戦闘力比較ミニバー */}
      <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-950/70 p-2 rounded-xl border border-zinc-800">
        <div className="flex justify-between items-center px-1">
          <span className="text-zinc-400 font-bold">自クリア基準 ({myChampion})</span>
          <span className="font-mono font-black text-amber-300">{fmtSec(myFastestClearSec)}</span>
        </div>
        <div className="flex justify-between items-center px-1 border-l border-zinc-800">
          <span className="text-zinc-400 font-bold">敵クリア基準 ({enemyChampion})</span>
          <span className="font-mono font-black text-rose-300">{fmtSec(enemyFastestClearSec)}</span>
        </div>
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed font-medium">
        💡 <strong className="text-amber-400">戦術要約:</strong> {planSummary}
      </p>

      {/* 3ステップ手順 */}
      <div className="space-y-1.5 pt-1 text-xs">
        <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
          <span className="font-mono font-black text-amber-400 text-[11px] shrink-0">STEP 1</span>
          <span className="text-zinc-300">{step1Text}</span>
        </div>
        <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
          <span className="font-mono font-black text-amber-400 text-[11px] shrink-0">STEP 2</span>
          <span className="text-zinc-300">{step2Text}</span>
        </div>
        <div className="flex items-start gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/80">
          <span className="font-mono font-black text-emerald-400 text-[11px] shrink-0">STEP 3</span>
          <span className="text-zinc-300">{step3Text}</span>
        </div>
      </div>
    </div>
  );
}
