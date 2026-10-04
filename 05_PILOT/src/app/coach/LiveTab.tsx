'use client';

import React, { useState } from 'react';
import ScoutTab, { type LiveRosterEntry } from './ScoutTab';
import FiveVFiveSimTab from './FiveVFiveSimTab';

// 試合中タブ（旧ポータル /coach「2. 試合中」の移植）。2026-10-04
// ライブ偵察で進行中の試合を検出したら、10体を5v5シミュレーターへ自動で渡す。
// 旧版にあった「Sovereign HUD 接続完了」の表示は、HUD(ローカルPC)の起動状態を知る手段が無いのに
// 条件なしで出していたため2026-09-30に説明文へ変更済み。ここでも状態は主張しない。
export default function LiveTab({ onLiveMatchDetected }: {
  onLiveMatchDetected?: (myChampion: string, enemyChampion: string) => void;
}) {
  const [liveRoster, setLiveRoster] = useState<LiveRosterEntry[] | null>(null);

  const handleDetected = (myChampion: string, enemyChampion: string, roster?: LiveRosterEntry[]) => {
    if (roster && roster.length === 10) setLiveRoster(roster);
    onLiveMatchDetected?.(myChampion, enemyChampion);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="text-xs font-black text-amber-400">Sovereign HUD（デスクトップ版）の使い方</div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          HUDを起動していると、<span className="text-amber-300 font-bold">TABキー</span>で対面キルラインが表示され、チャットから敵スペル・Ultを自動検知します。
        </p>
      </div>

      <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="text-sm font-black text-white">🧭 リアルタイム偵察（敵10人スキャン ＆ ガンク優先ターゲット）</h3>
        <ScoutTab onLiveMatchDetected={handleDetected} />
      </section>

      <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="text-sm font-black text-white">⚔️ チーム構成 ＆ 勝ち筋シミュレーター</h3>
        <FiveVFiveSimTab liveRoster={liveRoster} />
      </section>
    </div>
  );
}
