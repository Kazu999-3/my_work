'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Bot, Sparkles, TrendingUp, CheckCircle2, Shield, Eye } from 'lucide-react';
import PostGameDeepAnalyticsDashboard from './PostGameDeepAnalyticsDashboard';
import CoachReviewPanel from './CoachReviewPanel';
import MySoloQDashboard from './MySoloQDashboard';
import MissionCard from './MissionCard';
import LaneDiffCard from './LaneDiffCard';
import TacticScoreCard from './TacticScoreCard';
import { useCoachRiotId } from './riotIdContext';

// 試合後タブ（旧ポータル /coach「3. 試合後」の移植）。2026-10-04
// 詳細分析（対面との実測比較）＋試合メモ・集団戦分析・自動振り返りの履歴と傾向・過去のソロQ記録をまとめる。
// ソロQ試合後の通知（/coach?tab=postgame&matchId=...）は、このタブで該当試合を開く。
// 2026-10-15: 自動振り返りの履歴と過去の振り返りメモは、選んだ試合と関係なく変わらないため
// 「📂 履歴」1つにまとめて最下部で閉じておく（ユーザー判断。10-08の「最初から開く」を上書き）。
// 閉じている間は中身を描画しないので、開くまで取得も走らない。

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
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
  const { riotId, setRiotId } = useCoachRiotId();
  const [matchId, setMatchId] = useState<string>(initialMatchId || '');
  const [inlineInput, setInlineInput] = useState('');
  const [showSample, setShowSample] = useState(false);

  useEffect(() => {
    if (initialMatchId) setMatchId(initialMatchId);
  }, [initialMatchId]);

  const activeRiotId = riotId || (showSample ? 'SampleSummoner#JP1' : '');

  return (
    <div className="space-y-4">
      {!activeRiotId ? (
        <div className="p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-6">
          <div className="space-y-2 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">Riot ID を入力して試合後分析を開始</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              あなたの直近ソロQ試合から、0〜14分のレーン戦勝敗分岐点、攻略バイブル定石遵守スコア、AIコーチの自動振り返りを一括分析します。
            </p>
          </div>

          {/* 各タブから入力できるインラインフォーム */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inlineInput.includes('#')) setRiotId(inlineInput.trim());
            }}
            className="flex flex-col sm:flex-row items-center gap-2 max-w-md mx-auto"
          >
            <input
              type="text"
              value={inlineInput}
              onChange={(e) => setInlineInput(e.target.value)}
              placeholder="例: 名前#JP1"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!inlineInput.includes('#')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shrink-0 transition disabled:opacity-40 cursor-pointer shadow-md"
            >
              分析開始
            </button>
          </form>

          {/* 見本ボタン */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowSample(true)}
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>入力すると何が見える？（見本・サンプル表示）</span>
            </button>
          </div>

          {/* 機能案内見本カード一覧 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-zinc-800/80 text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1.5">
              <span className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
                🎯 次の課題ミッション
              </span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                前回の反省点を踏まえ、次の試合で意識すべき「1つの具体行動」を提示します。
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1.5">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                ⚖️ 0〜14分レーン分岐点
              </span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                対面とのCS差・ゴールド差の推移から、レーン戦の勝敗がどこで決定づけられたかを実測特定。
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-1.5">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-[11px]">
                🤖 AI自動振り返り
              </span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                ミスへのダメ出しではなく、「次はどう動けば勝てたか」の実戦改善アクションを自動抽出。
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Riot ID を変えたら部品ごと作り直して、前の人のデータが残らないようにする
        <div key={activeRiotId} className="space-y-4">
          {showSample && !riotId && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>👀 <strong>サンプル表示中:</strong> 実際のデータを見るには上のフォームに Riot ID を入力してください</span>
              <button
                type="button"
                onClick={() => setShowSample(false)}
                className="text-[11px] font-bold underline cursor-pointer hover:text-white"
              >
                サンプルを閉じる
              </button>
            </div>
          )}
          {/* 2026-10-19: 試合後に開くと、課題の達成を判定して次の課題を出す */}
          <MissionCard riotId={activeRiotId} />
          {/* 2026-10-19: 序盤0〜14分のレーン戦の勝敗分岐点アナライザー */}
          <LaneDiffCard riotId={activeRiotId} matchId={matchId || undefined} />
          {/* 2026-10-19: 攻略バイブル・定石知識の実戦遵守スコア */}
          <TacticScoreCard riotId={activeRiotId} matchId={matchId || undefined} />
          <PostGameDeepAnalyticsDashboard summonerName={activeRiotId} controlledMatchId={matchId || undefined} onSelectMatchId={setMatchId} />
          <Collapsible title="📂 履歴（自動振り返りの傾向・過去の振り返りメモ）">
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-xs font-black text-stone-300">🤖 自動振り返りの履歴 ＆ 傾向分析</h4>
                <CoachReviewPanel summonerName={activeRiotId} />
              </div>
              <div className="space-y-2 border-t border-stone-800 pt-4">
                <h4 className="text-xs font-black text-stone-300">📝 過去の振り返りメモ・対戦ログ</h4>
                <MySoloQDashboard />
              </div>
            </div>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
