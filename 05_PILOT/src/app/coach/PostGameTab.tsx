'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import PostGameDeepAnalyticsDashboard from './PostGameDeepAnalyticsDashboard';
import CoachReviewPanel from './CoachReviewPanel';
import MySoloQDashboard from './MySoloQDashboard';
import { useCoachRiotId } from './riotIdContext';

// 試合後タブ（旧ポータル /coach「3. 試合後」の移植）。2026-10-04
// 詳細分析（対面との実測比較）＋試合メモ・集団戦分析・自動振り返りの履歴と傾向・過去のソロQ記録をまとめる。
// ソロQ試合後の通知（/coach?tab=postgame&matchId=...）は、このタブで該当試合を開く。
// 手動の振り返りフォームは05では「📝 ソロQ反省ノート」タブが担当するため移していない。

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  // 2026-10-08: ユーザー要望で最初から開いた状態にする（以前は閉じた状態で始まっていた）
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-2xl border border-stone-800 bg-stone-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-black text-white cursor-pointer"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export default function PostGameTab({ initialMatchId }: { initialMatchId?: string | null }) {
  const { riotId } = useCoachRiotId();
  const [matchId, setMatchId] = useState<string>(initialMatchId || '');

  useEffect(() => {
    if (initialMatchId) setMatchId(initialMatchId);
  }, [initialMatchId]);

  return (
    <div className="space-y-4">

      {!riotId ? (
        <p className="text-xs text-stone-400 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          画面上部の「自分のRiot ID」を入力すると、直近のソロQ試合の詳細分析・自動振り返りの履歴を表示します。
        </p>
      ) : (
        // Riot ID を変えたら部品ごと作り直して、前の人のデータが残らないようにする
        <div key={riotId} className="space-y-4">
          <PostGameDeepAnalyticsDashboard summonerName={riotId} controlledMatchId={matchId || undefined} onSelectMatchId={setMatchId} />
          <Collapsible title="🤖 自動振り返りの履歴 ＆ 傾向分析">
            <CoachReviewPanel summonerName={riotId} />
          </Collapsible>
          <Collapsible title="📂 過去のソロQ記録・対戦ログ">
            <MySoloQDashboard />
          </Collapsible>
        </div>
      )}
    </div>
  );
}
