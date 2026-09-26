'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { type LiveRosterEntry } from './ScoutTab';
import PushOptIn from '../../components/PushOptIn';


import Collapsible from '../../components/Collapsible';
import PlayerStyleRadarCard from '../../components/coach/PlayerStyleRadarCard';
import VisionAnalyticsCard from '../../components/coach/VisionAnalyticsCard';
import ChampionQuickSelector from '../../components/coach/ChampionQuickSelector';
import MatchupBlueprintCard from './MatchupBlueprintCard';
import OverlayLauncherButton from './OverlayLauncherButton';
import SoloQDeepIntelSyncCard from '../../components/coach/SoloQDeepIntelSyncCard';

function CoachPageContent() {
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // 認証チェック
  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then((res) => {
        setIsAuthenticated(res.ok);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  // チャンピオン選択状態（URLクエリ・localStorageと同期）
  const [sharedChampion, setSharedChampionState] = useState('');
  const [sharedEnemyChampion, setSharedEnemyChampionState] = useState('');

  const setSharedChampion = (val: string) => {
    setSharedChampionState(val);
    try { localStorage.setItem('coach_my_champ', val); } catch {}
  };

  const setSharedEnemyChampion = (val: string) => {
    setSharedEnemyChampionState(val);
    try { localStorage.setItem('coach_enemy_champ', val); } catch {}
  };

  useEffect(() => {
    const queryChamp = searchParams.get('champion');
    const queryEnemy = searchParams.get('enemy');
    if (queryChamp) {
      setSharedChampion(queryChamp);
    } else {
      const savedMy = typeof window !== 'undefined' ? localStorage.getItem('coach_my_champ') || '' : '';
      if (savedMy) setSharedChampionState(savedMy);
    }
    if (queryEnemy) {
      setSharedEnemyChampion(queryEnemy);
    } else {
      const savedEnemy = typeof window !== 'undefined' ? localStorage.getItem('coach_enemy_champ') || '' : '';
      if (savedEnemy) setSharedEnemyChampionState(savedEnemy);
    }
  }, [searchParams]);

  // ライブ偵察検知時のチャンピオン＆ロースター自動連携
  const [liveRoster, setLiveRoster] = useState<LiveRosterEntry[] | null>(null);
  const handleLiveMatchDetected = (myChampion: string, enemyChampion: string, roster?: LiveRosterEntry[]) => {
    if (myChampion) setSharedChampion(myChampion);
    if (enemyChampion) setSharedEnemyChampion(enemyChampion);
    if (roster && roster.length === 10) setLiveRoster(roster);
  };

  // 試合後ディープアナリティクス ＆ 集団戦ディープレビューの同期用選択 matchId
  const [selectedDeepMatchId, setSelectedDeepMatchId] = useState<string>('');

  const [activeStepTab, setActiveStepTab] = useState<'pregame' | 'live' | 'postgame'>('pregame');

  // 一度でも開いたタブだけを記録する。dynamic import と併用して
  // 「まだ開いていないタブのコンポーネントは読み込まない」を実現する。
  // 一度開いたら以降はマウントし続けるので、タブを往復しても状態は失われない。
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['pregame']));
  const openStepTab = (id: 'pregame' | 'live' | 'postgame') => {
    setActiveStepTab(id);
    setVisitedTabs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  // 📝 ソロQ振り返りの入力モーダル。
  // POST /api/soloq/reflections を叩くのはこのモーダルだけで、MySoloQDashboard は
  // 表示専用（GET のみ）。未配線のままだと「書き込み手段のない陳列棚」になるため、
  // 2026-09-22 にここへ配線し直した。
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflectionRefresh, setReflectionRefresh] = useState(0);

  const STEP_TABS = [
    { id: 'pregame', title: '1. 試合前', sub: 'バンピック・5分作戦', icon: '🎯' },
    { id: 'live', title: '2. 試合中', sub: 'ライブ偵察・構成診断', icon: '🧭' },
    { id: 'postgame', title: '3. 試合後', sub: '確定実測ディープ分析', icon: '📈' },
  ] as const;

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-primary" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans text-foreground bg-background">
        <div className="text-center max-w-sm rounded-3xl border border-stone-200/90 bg-white p-8 shadow-xl">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2 text-stone-900">認証が必要です</h2>
          <p className="text-xs text-stone-500 mb-6 leading-relaxed">
            このコーチング機能は管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-primary px-5 py-3 text-xs font-bold text-white transition hover:bg-accent shadow-xs"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 font-sans text-foreground bg-background">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .animate-in { animation: fade-in 0.35s ease forwards; }
      `}</style>

      <div className="mx-auto max-w-[1600px] w-full px-2 md:px-6 space-y-5">
        {/* スリム化されたヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 border border-stone-200/90 rounded-2xl p-4 shadow-xs backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="text-3xl p-2 bg-amber-50 rounded-2xl border border-amber-200/80">🏆</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-stone-900">パーソナルコーチ</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-extrabold shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ライブ連携中</span>
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">
                Riot API × ナレッジDB × Gemini AI による確定データコーチング
              </p>
            </div>
          </div>

          {/* クイックアクション */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <OverlayLauncherButton />
            <PushOptIn scope="admin" label="通知" inline />
          </div>
        </div>

        {/* 3ステップ ナビゲーションバー */}
        <div className="bg-white/95 border border-stone-200/90 p-1.5 rounded-2xl shadow-xs">
          <div className="grid grid-cols-3 gap-1.5">
            {STEP_TABS.map((tab) => {
              const isActive = activeStepTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openStepTab(tab.id as any)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all cursor-pointer min-w-0 overflow-hidden ${
                    isActive
                      ? 'bg-primary text-white shadow-md ring-2 ring-primary/40 scale-[1.01]'
                      : 'bg-stone-100/70 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                  }`}
                >
                  <span className="text-base shrink-0">{tab.icon}</span>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 min-w-0 text-center sm:text-left overflow-hidden">
                    <span className="text-xs font-black truncate">{tab.title}</span>
                    <span className={`text-[10px] truncate hidden lg:inline font-medium ${isActive ? 'text-white/80' : 'text-stone-400'}`}>
                      ({tab.sub})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. 🎯 試合前 (バンピック・対面対策・5分作戦) */}
        {/* ========================================================================= */}
        <div className={activeStepTab === 'pregame' ? 'space-y-4 animate-in' : 'hidden'}>
          {/* 爆速チャンピオン高速セレクター (ワンタップ & 日本語検索 & ライブ連動) */}
          <ChampionQuickSelector
            myChampion={sharedChampion}
            enemyChampion={sharedEnemyChampion}
            onMyChampionChange={setSharedChampion}
            onEnemyChampionChange={setSharedEnemyChampion}
            onLiveMatchDetected={handleLiveMatchDetected}
          />

          {/* 2カラムHUDグリッド: ドラフト1画面集約 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* 左側: 確定対面HUDカルテ（キルライン・手順書・ルーン・敵JG初動・罠・反省遺言を完全統合） */}
            <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-4">
              <MatchupBlueprintCard
                myChampion={sharedChampion}
                enemyChampion={sharedEnemyChampion}
                onMyChampionChange={setSharedChampion}
                onEnemyChampionChange={setSharedEnemyChampion}
              />
            </div>

            {/* 右側: 実測アナライザーSoloQ深層インテル ＆ 勝敗境界線・昇格処方箋 */}
            <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-4 lg:sticky lg:top-4">
              <SoloQDeepIntelSyncCard
                selectedChampion={sharedChampion}
                summonerName="Kazurin#4036"
              />
            </div>
          </div>

          {/* サブカルテ（視界・プレイスタイル詳細）: 折りたたみ */}
          <div className="pt-2">
            <Collapsible title="📊 詳細カルテ ＆ 視界マップ分析を展開" defaultOpen={false}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3 items-start">
                <div className="lg:col-span-7">
                  <VisionAnalyticsCard />
                </div>
                <div className="lg:col-span-5">
                  <PlayerStyleRadarCard />
                </div>
              </div>
            </Collapsible>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. 🧭 試合中 (ライブ偵察・構成勝ち筋診断) */}
        {/* ========================================================================= */}
        {visitedTabs.has('live') && (
        <div className={activeStepTab === 'live' ? 'space-y-4 animate-in' : 'hidden'}>
          {/* インゲームHUD連携ステータスバナー */}
          <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white rounded-2xl p-3.5 shadow-sm border border-stone-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-base shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-amber-400">Sovereign HUD 自動同期中</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold px-1.5 py-0.2 rounded">
                    接続完了
                  </span>
                </div>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  ⌨️ <span className="text-amber-300 font-bold">TABキー</span>で対面キルライン表示 / チャットから敵スペル・Ult自動検知
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* 上段: リアルタイム偵察 */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>🧭</span> リアルタイム偵察 (敵10人スキャン ＆ ガンク優先ターゲット)
              </h3>
              <ScoutTab onLiveMatchDetected={handleLiveMatchDetected} />
            </div>

            {/* 下段: 統合 チーム構成 ＆ 勝ち筋シミュレーター */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>⚔️</span> チーム構成 ＆ 勝ち筋シミュレーター
              </h3>
              <FiveVFiveSimTab liveRoster={liveRoster} />
            </div>
          </div>
        </div>
        )}

        {/* ========================================================================= */}
        {/* 3. 📈 試合後 (確定実測ディープ分析 ＆ 集団戦レビュー ＆ 過去ログ) */}
        {/* ========================================================================= */}
        {visitedTabs.has('postgame') && (
        <div className={activeStepTab === 'postgame' ? 'space-y-4 animate-in' : 'hidden'}>
          {/* 5大ディープアナリティクス (序盤15分メトリクス・リコール逆再生・ビルド監査・後からメモ編集) */}
          <PostGameDeepAnalyticsDashboard
            controlledMatchId={selectedDeepMatchId}
            onSelectMatchId={setSelectedDeepMatchId}
          />

          {/* 集団戦ディープアナリティクス (勝因・敗因・タイムライン実測レビュー) */}
          <MatchFightsAnalyticsCard
            controlledMatchId={selectedDeepMatchId}
            onSelectMatchId={setSelectedDeepMatchId}
          />

          {/* 📝 ソロQ振り返りの記録 */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <div className="min-w-0">
              <div className="text-sm font-black text-stone-900">📝 ソロQの振り返りを記録する</div>
              <p className="text-xs text-stone-600 mt-0.5">
                直近の試合を読み込んで、レーン結果・メンタル・分岐点を残せます。記録は下の履歴に蓄積されます。
              </p>
            </div>
            <button
              onClick={() => setReflectionOpen(true)}
              className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-colors cursor-pointer"
            >
              振り返りを書く
            </button>
          </div>

          {/* 📂 過去の全ソロQログ履歴（折りたたみ） */}
          <div className="pt-2">
            <Collapsible title="📂 過去の全ソロQカルテ・対戦ログ履歴を展開" defaultOpen={false}>
              <div className="pt-3 bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
                <MySoloQDashboard refreshSignal={reflectionRefresh} />
              </div>
            </Collapsible>
          </div>

          <SoloQReflectionModal
            isOpen={reflectionOpen}
            onClose={() => setReflectionOpen(false)}
            onSaved={() => setReflectionRefresh((n) => n + 1)}
          />
        </div>
        )}

        {/* フッター */}
        <div className="mt-8 text-center text-xs text-foreground/30">
          確定実戦データはナレッジDBに蓄積され、次回の試合前インテルへ自動循環されます
        </div>
      </div>
    </div>
  );
}

// ── 遅延読込 ───────────────────────────────────────────────────────
// このページは3つのステップタブを `hidden` で切り替えており、**全タブが同時にマウント**
// される作りだった。そのため初期表示に不要な「試合中」「試合後」のコンポーネントまで
// 最初に読み込まれ、/coach の初回JSが 1,065KB に膨らんでいた（2026-09-22実測）。
//
// ⚠️ 単に dynamic 化しても、常にレンダリングされていればチャンクは即座に取得される。
//    下の visitedTabs と併用して「一度も開いていないタブは描画しない」ことで初めて効く。
//    一度開いたタブはマウントしたままにするので、タブを往復しても入力や取得済みデータは消えない。
const tabLoading = () => (
  <div className="py-10 text-center text-xs text-stone-400">読み込み中…</div>
);

const ScoutTab = dynamic(() => import('./ScoutTab'), { ssr: false, loading: tabLoading });
const FiveVFiveSimTab = dynamic(() => import('./FiveVFiveSimTab'), { ssr: false, loading: tabLoading });
const PostGameDeepAnalyticsDashboard = dynamic(() => import('./PostGameDeepAnalyticsDashboard'), { ssr: false, loading: tabLoading });
const MatchFightsAnalyticsCard = dynamic(() => import('./MatchFightsAnalyticsCard'), { ssr: false, loading: tabLoading });
const MySoloQDashboard = dynamic(() => import('./MySoloQDashboard'), { ssr: false, loading: tabLoading });
// モーダルは「振り返りを書く」を押すまで一切不要なので、開くまで読み込まない
const SoloQReflectionModal = dynamic(() => import('./SoloQReflectionModal'), { ssr: false });


export default function CoachPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-primary" />
      </div>
    }>
      <CoachPageContent />
    </Suspense>
  );
}
