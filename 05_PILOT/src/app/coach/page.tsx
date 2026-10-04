'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Bot, ArrowLeft, Swords, BookOpen, Compass, ShieldAlert, Sparkles, RefreshCw, Zap,
  BarChart3, MessageSquareText, Rewind, TrendingUp, Radar
} from 'lucide-react';
import MatchupBlueprintCard from './MatchupBlueprintCard';
import StatsAnalyzerTab from './StatsAnalyzerTab';
import SoloQReflectionTab from './SoloQReflectionTab';
import PostGameTempoTab from './PostGameTempoTab';
import PostGameTab from './PostGameTab';
import LiveTab from './LiveTab';
import { PreGameTop, PreGameBottom } from './PreGameExtras';
import { CoachRiotIdProvider, CoachRiotIdBar } from './riotIdContext';

type TabKey = 'blueprint' | 'live' | 'postgame' | 'tempo' | 'reflection' | 'analyzer';

// 試合の流れ（前 → 中 → 後 → 振り返り）の順に並べる。スタッツ分析は試合単位でないので最後
const TABS: { key: TabKey; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'blueprint', label: '⚔️ 試合前', Icon: Swords },
  { key: 'live', label: '🧭 試合中', Icon: Radar },
  { key: 'postgame', label: '📈 試合後: 詳細分析', Icon: TrendingUp },
  { key: 'tempo', label: '🔁 試合後: テンポ', Icon: Rewind },
  { key: 'reflection', label: '📝 振り返りノート', Icon: MessageSquareText },
  { key: 'analyzer', label: '📊 スタッツ分析', Icon: BarChart3 },
];

function CoachPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // タブはURL(?tab=)に持たせる。再読み込み・戻るボタン・リンク共有でも同じタブが開く(2026-10-05)
  const qTab = searchParams.get('tab');
  // matchup-memo は旧ポータルの通知リンク互換
  const activeTab: TabKey =
    qTab === 'matchup-memo' ? 'postgame'
    : TABS.some((t) => t.key === qTab) ? (qTab as TabKey)
    : 'blueprint';
  const setActiveTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'blueprint') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.push(qs ? `/coach?${qs}` : '/coach', { scroll: false });
  };

  // 対面設計図用ステート
  const [myChamp, setMyChamp] = useState('JarvanIV');
  const [enemyChamp, setEnemyChamp] = useState('LeeSin');

  // URLのチャンピオン指定は、その値が変わった時だけ反映する
  // （タブ切替でURLが変わるたびに、画面で選び直したチャンピオンが戻されないように）
  const qMy = searchParams.get('my') || searchParams.get('champion');
  const qEnemy = searchParams.get('enemy');
  useEffect(() => {
    if (qMy) setMyChamp(qMy);
  }, [qMy]);
  useEffect(() => {
    if (qEnemy) setEnemyChamp(qEnemy);
  }, [qEnemy]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ページタイトル */}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Bot className="w-6 h-6 md:w-7 md:h-7 text-amber-400" />
            🤖 AI戦術コーチング・コクピット
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            試合前の対面設計図から、試合中の偵察、試合後の分析・振り返りまでを1画面にまとめたコーチです。
          </p>
        </div>

        <CoachRiotIdBar />

        {/* ナビゲーションタブ（時系列順。スマホでは横スクロール） */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto [&>button]:shrink-0">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === key
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
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
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> 定番マッチアップ例:
              </span>
              <button
                onClick={() => { setMyChamp('Darius'); setEnemyChamp('Aatrox'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 font-bold shrink-0 transition-colors"
              >
                Darius vs Aatrox (TOP)
              </button>
              <button
                onClick={() => { setMyChamp('JarvanIV'); setEnemyChamp('LeeSin'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 font-bold shrink-0 transition-colors"
              >
                JarvanIV vs LeeSin (JG)
              </button>
              <button
                onClick={() => { setMyChamp('Zed'); setEnemyChamp('Ahri'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 font-bold shrink-0 transition-colors"
              >
                Zed vs Ahri (MID)
              </button>
              <button
                onClick={() => { setMyChamp('Jinx'); setEnemyChamp('Lucian'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 font-bold shrink-0 transition-colors"
              >
                Jinx vs Lucian (ADC)
              </button>
            </div>

            {/* 対面設計図カード */}
            <MatchupBlueprintCard
              myChampion={myChamp}
              enemyChampion={enemyChamp}
              onMyChampionChange={setMyChamp}
              onEnemyChampionChange={setEnemyChamp}
            />

            <PreGameBottom />
          </div>
        )}

        {/* タブ: 試合中（ライブ偵察・5v5シミュレーター）。検出した対面は試合前タブの設計図にも反映する */}
        {activeTab === 'live' && (
          <LiveTab onLiveMatchDetected={(my, enemy) => { setMyChamp(my); setEnemyChamp(enemy); }} />
        )}

        {/* タブ 2: スタッツ深層分析 */}
        {activeTab === 'analyzer' && (
          <StatsAnalyzerTab />
        )}

        {/* タブ: 試合後（詳細分析・試合メモ・集団戦・自動振り返り） */}
        {activeTab === 'postgame' && (
          <PostGameTab initialMatchId={searchParams.get('matchId')} />
        )}

        {/* タブ 3: 試合後テンポ逆再生 ＆ ビルド監査 */}
        {activeTab === 'tempo' && (
          <PostGameTempoTab initialMatchId={activeTab === 'tempo' ? searchParams.get('matchId') : null} />
        )}

        {/* タブ 4: ソロQ反省ノート */}
        {activeTab === 'reflection' && (
          <SoloQReflectionTab />
        )}

      </div>
    </div>
  );
}

export default function CoachPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-xs">ロード中...</div>}>
      <CoachRiotIdProvider>
        <CoachPageContent />
      </CoachRiotIdProvider>
    </Suspense>
  );
}
