'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Bot, ArrowLeft, Swords, BookOpen, Compass, ShieldAlert, Sparkles, RefreshCw, Zap,
  BarChart3, TrendingUp
} from 'lucide-react';
import MatchupBlueprintCard from './MatchupBlueprintCard';
import StatsAnalyzerTab from './StatsAnalyzerTab';
import PostGameTab from './PostGameTab';
import { PreGameTop, PreGameBottom } from './PreGameExtras';
import { CoachRiotIdProvider, CoachRiotIdBar } from './riotIdContext';

type TabKey = 'blueprint' | 'postgame' | 'analyzer';

// 試合の流れ（前 → 中 → 後 → 振り返り）の順に並べる。スタッツ分析は試合単位でないので最後
const TABS: { key: TabKey; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'blueprint', label: '⚔️ 試合前', Icon: Swords },
  { key: 'postgame', label: '📈 試合後', Icon: TrendingUp },
  { key: 'analyzer', label: '📊 スタッツ分析', Icon: BarChart3 },
];

const normalizeCoachLane = (raw?: string | null): string => {
  const up = (raw || '').toUpperCase();
  if (up === 'JG') return 'JUNGLE';
  if (up === 'BOT') return 'ADC';
  if (['TOP', 'JUNGLE', 'MID', 'ADC', 'SUP'].includes(up)) return up;
  return 'TOP';
};

const DEFAULT_MATCHUP_BY_LANE: Record<string, { my: string; enemy: string }> = {
  TOP: { my: 'Darius', enemy: 'Aatrox' },
  JUNGLE: { my: 'JarvanIV', enemy: 'LeeSin' },
  MID: { my: 'Zed', enemy: 'Ahri' },
  ADC: { my: 'Jinx', enemy: 'Lucian' },
  SUP: { my: 'Thresh', enemy: 'Nautilus' },
};

function CoachPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // タブはURL(?tab=)に持たせる。再読み込み・戻るボタン・リンク共有でも同じタブが開く(2026-10-05)
  const qTab = searchParams.get('tab');
  // matchup-memo は旧ポータルの通知リンク互換。tempo（テンポ）と reflection（振り返りノート）は
  // 「試合後」へ統合した旧タブ(2026-10-06)
  const activeTab: TabKey =
    qTab === 'matchup-memo' || qTab === 'tempo' || qTab === 'reflection' ? 'postgame'
    : TABS.some((t) => t.key === qTab) ? (qTab as TabKey)
    : 'blueprint';
  const setActiveTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'blueprint') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.push(qs ? `/coach?${qs}` : '/coach', { scroll: false });
  };

  // URLクエリパラメータの取得
  const qMy = searchParams.get('my') || searchParams.get('champion');
  const qEnemy = searchParams.get('enemy');
  const qLane = searchParams.get('lane');
  const initialLane = normalizeCoachLane(qLane);
  const initialPair = DEFAULT_MATCHUP_BY_LANE[initialLane] || DEFAULT_MATCHUP_BY_LANE.TOP;

  // 対面設計図用ステート（URLパラメータを最優先で初期値に採用し、レーン指定時はそのレーンの代表対面と連動）
  const [myChamp, setMyChamp] = useState(() => qMy || initialPair.my);
  const [enemyChamp, setEnemyChamp] = useState(() => qEnemy || initialPair.enemy);
  const [lane, setLane] = useState(() => initialLane);
  const [isSampleView, setIsSampleView] = useState(() => !qMy && !qEnemy);

  // URLのチャンピオン指定・レーン指定が後から変わった時に反映
  useEffect(() => {
    if (qMy && qMy !== myChamp) {
      setMyChamp(qMy);
      setIsSampleView(false);
    }
  }, [qMy]);
  useEffect(() => {
    if (qEnemy && qEnemy !== enemyChamp) {
      setEnemyChamp(qEnemy);
      setIsSampleView(false);
    }
  }, [qEnemy]);
  useEffect(() => {
    if (qLane) {
      const normalized = normalizeCoachLane(qLane);
      if (normalized !== lane) {
        setLane(normalized);
        if (!qMy && !qEnemy) {
          const pair = DEFAULT_MATCHUP_BY_LANE[normalized] || DEFAULT_MATCHUP_BY_LANE.TOP;
          setMyChamp(pair.my);
          setEnemyChamp(pair.enemy);
        }
      }
    }
  }, [qLane]);

  const handleLaneChange = (nextLane: string) => {
    const normalized = normalizeCoachLane(nextLane);
    setLane(normalized);
    if (isSampleView) {
      const pair = DEFAULT_MATCHUP_BY_LANE[normalized] || DEFAULT_MATCHUP_BY_LANE.TOP;
      setMyChamp(pair.my);
      setEnemyChamp(pair.enemy);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ページタイトル */}
        <div className="border-b border-zinc-800 pb-4">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Bot className="w-6 h-6 md:w-7 md:h-7 text-amber-400" />
            🤖 AI戦術コーチング・コクピット
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            試合前の対面設計図から、試合後の深層分析・自動レビュー・振り返りまでを1画面にまとめたAIコーチです（試合中は最前面透過HUD /overlay をご利用ください）。
          </p>
        </div>

        {/* Riot ID バー（スクロール追従 sticky 配置で常に届く） */}
        <div className="sticky top-2 z-30 shadow-xl shadow-zinc-950/80">
          <CoachRiotIdBar />
        </div>

        {/* ナビゲーションタブ（時系列順。スマホでは横スクロール） */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto [&>button]:shrink-0">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === key
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* タブ 1: 試合前（対面設計図） */}
        {activeTab === 'blueprint' && (
          <div className="space-y-6">
            <PreGameTop />

            {/* クイック選択プリセット */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center gap-3 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-zinc-400 shrink-0 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> 定番マッチアップ例:
              </span>
              <button
                onClick={() => { setMyChamp('Zyra'); setEnemyChamp('Vi'); setLane('JUNGLE'); }}
                className={`px-2.5 py-1 rounded-lg border font-bold shrink-0 transition-colors ${
                  myChamp === 'Zyra' && enemyChamp === 'Vi' && lane === 'JUNGLE'
                    ? 'bg-amber-500/20 border-amber-500/70 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 hover:border-amber-500 text-zinc-300'
                }`}
              >
                Zyra vs Vi (JG)
              </button>
              <button
                onClick={() => { setMyChamp('Darius'); setEnemyChamp('Aatrox'); setLane('TOP'); }}
                className={`px-2.5 py-1 rounded-lg border font-bold shrink-0 transition-colors ${
                  myChamp === 'Darius' && enemyChamp === 'Aatrox' && lane === 'TOP'
                    ? 'bg-amber-500/20 border-amber-500/70 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 hover:border-amber-500 text-zinc-300'
                }`}
              >
                Darius vs Aatrox (TOP)
              </button>
              <button
                onClick={() => { setMyChamp('JarvanIV'); setEnemyChamp('LeeSin'); setLane('JUNGLE'); }}
                className={`px-2.5 py-1 rounded-lg border font-bold shrink-0 transition-colors ${
                  myChamp === 'JarvanIV' && enemyChamp === 'LeeSin' && lane === 'JUNGLE'
                    ? 'bg-amber-500/20 border-amber-500/70 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 hover:border-amber-500 text-zinc-300'
                }`}
              >
                JarvanIV vs LeeSin (JG)
              </button>
              <button
                onClick={() => { setMyChamp('Zed'); setEnemyChamp('Ahri'); setLane('MID'); }}
                className={`px-2.5 py-1 rounded-lg border font-bold shrink-0 transition-colors ${
                  myChamp === 'Zed' && enemyChamp === 'Ahri' && lane === 'MID'
                    ? 'bg-amber-500/20 border-amber-500/70 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 hover:border-amber-500 text-zinc-300'
                }`}
              >
                Zed vs Ahri (MID)
              </button>
              <button
                onClick={() => { setMyChamp('Jinx'); setEnemyChamp('Lucian'); setLane('ADC'); }}
                className={`px-2.5 py-1 rounded-lg border font-bold shrink-0 transition-colors ${
                  myChamp === 'Jinx' && enemyChamp === 'Lucian' && lane === 'ADC'
                    ? 'bg-amber-500/20 border-amber-500/70 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 hover:border-amber-500 text-zinc-300'
                }`}
              >
                Jinx vs Lucian (ADC)
              </button>
            </div>

            {isSampleView && (
              <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-2 flex-wrap">
                <span>
                  👀 <strong>サンプル表示中:</strong> 初期例（{myChamp} vs {enemyChamp} / {lane === 'JUNGLE' ? 'JG' : lane}）を表示しています。自分のチャンピオンを選ぶと実戦向けに切り替わります。
                </span>
              </div>
            )}

            {/* 対面設計図カード */}
            <MatchupBlueprintCard
              myChampion={myChamp}
              enemyChampion={enemyChamp}
              lane={lane}
              onMyChampionChange={(v) => { setMyChamp(v); setIsSampleView(false); }}
              onEnemyChampionChange={(v) => { setEnemyChamp(v); setIsSampleView(false); }}
              onLaneChange={handleLaneChange}
            />

            <PreGameBottom />
          </div>
        )}

        {/* タブ 2: スタッツ深層分析 */}
        {activeTab === 'analyzer' && (
          <StatsAnalyzerTab />
        )}

        {/* タブ: 試合後（詳細分析・試合メモ・集団戦・自動振り返り） */}
        {activeTab === 'postgame' && (
          <PostGameTab initialMatchId={searchParams.get('matchId')} />
        )}


      </div>
    </div>
  );
}

export default function CoachPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 text-xs">ロード中...</div>}>
      <CoachRiotIdProvider>
        <CoachPageContent />
      </CoachRiotIdProvider>
    </Suspense>
  );
}
