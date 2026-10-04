'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Bot, ArrowLeft, Swords, BookOpen, Compass, ShieldAlert, Sparkles, RefreshCw, Zap,
  BarChart3, MessageSquareText, Rewind, TrendingUp
} from 'lucide-react';
import MatchupBlueprintCard from './MatchupBlueprintCard';
import StatsAnalyzerTab from './StatsAnalyzerTab';
import SoloQReflectionTab from './SoloQReflectionTab';
import PostGameTempoTab from './PostGameTempoTab';
import PostGameTab from './PostGameTab';

function CoachPageContent() {
  const searchParams = useSearchParams();

  // タブ管理
  const [activeTab, setActiveTab] = useState<'blueprint' | 'analyzer' | 'postgame' | 'tempo' | 'reflection'>('blueprint');

  // 対面設計図用ステート
  const [myChamp, setMyChamp] = useState('JarvanIV');
  const [enemyChamp, setEnemyChamp] = useState('LeeSin');

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab === 'analyzer') setActiveTab('analyzer');
    // postgame はソロQ試合後の通知（/coach?tab=postgame&matchId=...）のリンク先
    else if (qTab === 'postgame' || qTab === 'matchup-memo') setActiveTab('postgame');
    else if (qTab === 'tempo') setActiveTab('tempo');
    else if (qTab === 'reflection') setActiveTab('reflection');
    else if (qTab === 'blueprint') setActiveTab('blueprint');

    const qMy = searchParams.get('my') || searchParams.get('champion');
    const qEnemy = searchParams.get('enemy');
    if (qMy) setMyChamp(qMy);
    if (qEnemy) setEnemyChamp(qEnemy);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ページタイトル */}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Bot className="w-6 h-6 md:w-7 md:h-7 text-indigo-400" />
            🤖 AI戦術コーチング・コクピット
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            試合前設計図・スタッツ深層分析・試合後反省ノートを1画面に統合したAIコーチです。
          </p>
        </div>

        {/* ナビゲーションタブ（スマホでは横スクロール） */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto [&>button]:shrink-0">
          <button
            onClick={() => setActiveTab('blueprint')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'blueprint'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>⚔️ 試合前（対面設計図）</span>
          </button>

          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'analyzer'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>📊 スタッツ深層分析（直近試合）</span>
          </button>

          <button
            onClick={() => setActiveTab('postgame')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'postgame'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>📈 試合後（詳細分析・メモ）</span>
          </button>

          <button
            onClick={() => setActiveTab('tempo')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tempo'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Rewind className="w-4 h-4" />
            <span>🔁 試合後テンポ解析</span>
          </button>

          <button
            onClick={() => setActiveTab('reflection')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'reflection'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquareText className="w-4 h-4" />
            <span>📝 ソロQ反省ノート</span>
          </button>
        </div>

        {/* タブ 1: 試合前（対面設計図） */}
        {activeTab === 'blueprint' && (
          <div className="space-y-6">
            {/* クイック選択プリセット */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> 定番マッチアップ例:
              </span>
              <button
                onClick={() => { setMyChamp('Darius'); setEnemyChamp('Aatrox'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 font-bold shrink-0 transition-colors"
              >
                Darius vs Aatrox (TOP)
              </button>
              <button
                onClick={() => { setMyChamp('JarvanIV'); setEnemyChamp('LeeSin'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 font-bold shrink-0 transition-colors"
              >
                JarvanIV vs LeeSin (JG)
              </button>
              <button
                onClick={() => { setMyChamp('Zed'); setEnemyChamp('Ahri'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 font-bold shrink-0 transition-colors"
              >
                Zed vs Ahri (MID)
              </button>
              <button
                onClick={() => { setMyChamp('Jinx'); setEnemyChamp('Lucian'); }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 font-bold shrink-0 transition-colors"
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
      <CoachPageContent />
    </Suspense>
  );
}
