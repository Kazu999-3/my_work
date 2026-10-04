'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import PostGameDeepAnalyticsDashboard from './PostGameDeepAnalyticsDashboard';
import MatchFightsAnalyticsCard from './MatchFightsAnalyticsCard';
import CoachReviewPanel from './CoachReviewPanel';
import MySoloQDashboard from './MySoloQDashboard';

// 試合後タブ（旧ポータル /coach「3. 試合後」の移植）。2026-10-04
// 詳細分析＋試合メモ・集団戦分析・自動振り返りの履歴と傾向・過去のソロQ記録をまとめる。
// ソロQ試合後の通知（/coach?tab=postgame&matchId=...）は、このタブで該当試合を開く。
// 手動の振り返りフォームは05では「📝 ソロQ反省ノート」タブが担当するため移していない。

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-black text-white cursor-pointer"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export default function PostGameTab({ initialMatchId }: { initialMatchId?: string | null }) {
  const [riotId, setRiotId] = useState('');
  const [input, setInput] = useState('');
  const [matchId, setMatchId] = useState<string>(initialMatchId || '');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('coach_riot_id');
      if (saved) { setRiotId(saved); setInput(saved); }
    } catch {}
  }, []);

  useEffect(() => {
    if (initialMatchId) setMatchId(initialMatchId);
  }, [initialMatchId]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v.includes('#')) return;
    try { localStorage.setItem('coach_riot_id', v); } catch {}
    setRiotId(v);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={apply} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-[11px] font-bold text-slate-400 shrink-0">分析するRiot ID</label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="名前#JP1"
          className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
        />
        <button
          type="submit"
          disabled={!input.trim().includes('#') || input.trim() === riotId}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-black cursor-pointer disabled:opacity-40"
        >
          表示
        </button>
      </form>

      {!riotId ? (
        <p className="text-xs text-slate-400 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          Riot ID（名前#タグ）を入力すると、直近のソロQ試合の詳細分析・集団戦レビュー・自動振り返りの履歴を表示します。
        </p>
      ) : (
        // Riot ID を変えたら部品ごと作り直して、前の人のデータが残らないようにする
        <div key={riotId} className="space-y-4">
          <PostGameDeepAnalyticsDashboard summonerName={riotId} controlledMatchId={matchId || undefined} onSelectMatchId={setMatchId} />
          <MatchFightsAnalyticsCard summonerName={riotId} controlledMatchId={matchId || undefined} onSelectMatchId={setMatchId} />
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
