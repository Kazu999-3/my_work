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

  // 通知やブックマークからの ?tab= / ?matchId= を受け取る。
  //
  // 2026-09-30: 15分おきのcron(/api/cron/soloq-coach)が新しい試合を検知するたびに
  // `/coach?tab=matchup-memo&champion=..&enemy=..&role=..&result=..&kda=..&matchId=..`
  // というリンクの通知を出していたが、このページは champion / enemy しか読んでおらず、
  // しかも matchup-memo タブ自体が2026-09-17のスリム化で消えていた。
  // そのため通知を押すと常に「試合前」に着地し、対面メモを書くという本来の目的を
  // 果たせないまま role/result/kda/matchId が捨てられていた（直近30日で14件）。
  // メモ編集は現在「試合後」タブの PostGameDeepAnalyticsDashboard にあるので、
  // 旧 matchup-memo はそこへ読み替える。
  useEffect(() => {
    const queryTab = searchParams.get('tab');
    if (queryTab) {
      const mapped =
        queryTab === 'matchup-memo' || queryTab === 'postgame' ? 'postgame' :
        queryTab === 'live' ? 'live' :
        queryTab === 'pregame' ? 'pregame' : null;
      if (mapped) openStepTab(mapped);
    }
    const queryMatchId = searchParams.get('matchId');
    if (queryMatchId) setSelectedDeepMatchId(queryMatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
  // ヘッダーのバッジを実際の検知状態に連動させるための記録（2026-09-30）。
  const [liveDetected, setLiveDetected] = useState<{ mine: string; enemy: string } | null>(null);
  const handleLiveMatchDetected = (myChampion: string, enemyChampion: string, roster?: LiveRosterEntry[]) => {
    if (myChampion) setSharedChampion(myChampion);
    if (enemyChampion) setSharedEnemyChampion(enemyChampion);
    if (roster && roster.length === 10) setLiveRoster(roster);
    if (myChampion || enemyChampion) setLiveDetected({ mine: myChampion, enemy: enemyChampion });
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans text-foreground bg-background">
        <div className="text-center max-w-sm rounded-3xl border border-border/90 bg-surface p-8 shadow-xl">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2 text-foreground">認証が必要です</h2>
          <p className="text-xs text-muted-strong mb-6 leading-relaxed">
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
      {/* 2026-09-30: ここにあった Google Fonts の @import と `* { font-family: 'Inter' }` を外した。
          ①`<style>`内の@importは描画をブロックする書き方で、しかもポータル全体ではこのページ
          だけがInterを取得していた（他のページは globals.css の --font-sans でシステムフォント）。
          ②`*`での上書きはデザイントークンを無視してこのページだけ別フォントにしていた。
          外したことでポータル全体と同じフォントに揃い、余分なフォント取得も無くなる。 */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .animate-in { animation: fade-in 0.35s ease forwards; }
      `}</style>

      <div className="mx-auto max-w-[1600px] w-full px-2 md:px-6 space-y-5">
        {/* スリム化されたヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/80 border border-border/90 rounded-2xl p-4 shadow-xs backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="text-3xl p-2 bg-primary-50 rounded-2xl border border-amber-200/80">🏆</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-foreground">パーソナルコーチ</h1>
                {/* 以前はここに「🟢 ライブ連携中」を条件なしで常時表示していた（点滅ドット付き）。
                    何とも連携していなくても出るため、画面を信じて判断する側に嘘を伝えていた
                    （2026-09-30修正）。ライブ検知は常時ポーリングではなく操作契機の取得なので、
                    実際に検知できた時だけ、検知した対面を添えて表示する。 */}
                {liveDetected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-100 border border-emerald-300 text-success-800 text-[10px] font-extrabold shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                    <span>ライブ試合を検知{liveDetected.enemy ? `（対面: ${liveDetected.enemy}）` : ''}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-strong font-medium">
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
        <div className="bg-surface/95 border border-border/90 p-1.5 rounded-2xl shadow-xs">
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
                      : 'bg-surface-subtle/70 text-muted hover:bg-surface-hover/80 hover:text-foreground'
                  }`}
                >
                  <span className="text-base shrink-0">{tab.icon}</span>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 min-w-0 text-center sm:text-left overflow-hidden">
                    <span className="text-xs font-black truncate">{tab.title}</span>
                    <span className={`text-[10px] truncate hidden lg:inline font-medium ${isActive ? 'text-white/80' : 'text-faint'}`}>
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
          {/* 🚦 次の試合に行くべきか（ティルト・連敗ストッパー・時間帯勝率の統合判定）
              この判定はサーバー側で前から計算されていたが、レスポンスに入るだけで
              どのUIからも参照されていなかった（2026-09-30に配線）。
              表示専用の軽量API(/api/coach/play-recommendation)を使うため、
              ここを開いてもGeminiは呼ばれない。 */}
          <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>🚦</span> 次の試合に行くべきか
            </h3>
            <PlayRecommendationCard />
          </div>

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
              {/* Riot IDは渡さない。サーバー側が RIOT_GAME_NAME / RIOT_TAG_LINE から
                  解決する（以前は "Kazurin#4036" がここに直書きされていた。2026-09-30） */}
              <SoloQDeepIntelSyncCard selectedChampion={sharedChampion} />
            </div>
          </div>

          {/* 🗓️ 曜日×時間帯 勝率ヒートマップ
              2026-09-30に復活（削除の経緯は TimingHeatmapCard の冒頭コメント）。
              過去データの集計だが、使いどころは「今この時間に回すべきか」の判断なので
              「試合後」ではなく「試合前」に置く。 */}
          <div className="pt-2">
            <Collapsible title="🗓️ 今の時間帯は勝てているか（曜日×時間帯 勝率ヒートマップ）" defaultOpen={false}>
              <div className="pt-3 bg-surface border border-border rounded-2xl p-4 shadow-xs">
                <TimingHeatmapCard />
              </div>
            </Collapsible>
          </div>

          {/* 🎯 ランク目標と到達見込み（2026-09-30配線。mode=goal は実装済みだったが
              どの画面からも呼ばれておらず、soloq_lp_history が2026-08-04で止まっていた）。
              開くと当日のLPスナップショットも記録されるので、使うほど推移が貯まる。 */}
          <div className="pt-2">
            <Collapsible title="🎯 ランク目標と到達見込み" defaultOpen={false}>
              <div className="pt-3 bg-surface border border-border rounded-2xl p-4 shadow-xs">
                <RankGoalCard />
              </div>
            </Collapsible>
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
              <div className="w-8 h-8 rounded-xl bg-primary-500/20 border border-amber-500/40 flex items-center justify-center text-base shrink-0">
                👑
              </div>
              {/* 以前はここに「Sovereign HUD 自動同期中」＋「接続完了」を条件なしで表示していた。
                  HUDはローカルPCで動くPyQtアプリで、デプロイ先(Vercel)からは起動状態を
                  原理的に知れないため、HUDを立ち上げていなくても「接続完了」と出ていた
                  （2026-09-30修正）。状態の主張をやめ、使い方の説明だけに変えた。 */}
              <div>
                <div className="font-black text-xs text-primary-400">Sovereign HUD（デスクトップ版）の使い方</div>
                <p className="text-[11px] text-faint mt-0.5">
                  ⌨️ HUDを起動していると、<span className="text-primary-300 font-bold">TABキー</span>で対面キルラインが表示され、チャットから敵スペル・Ultを自動検知します。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* 上段: リアルタイム偵察 */}
            <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>🧭</span> リアルタイム偵察 (敵10人スキャン ＆ ガンク優先ターゲット)
              </h3>
              <ScoutTab onLiveMatchDetected={handleLiveMatchDetected} />
            </div>

            {/* 下段: 統合 チーム構成 ＆ 勝ち筋シミュレーター */}
            <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
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
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs">
            {/* 2026-09-30: 自動振り返り（上の「🤖 自動振り返りの履歴」）を画面に出したので、
                自動と手動の役割が重なって見える。手動側は「自分の言葉で残す」用途だと
                分かるように文言を整えた。なお手動記録(soloq_reflections)は18件で
                最終記録が2026-08-25、一方で自動側は直近30日に14件貯まっている。 */}
            <div className="min-w-0">
              <div className="text-sm font-black text-foreground">📝 自分の言葉で振り返りを残す</div>
              <p className="text-xs text-muted mt-0.5">
                AIの自動振り返りは上の「🤖 自動振り返りの履歴」に貯まります。こちらは手書き用で、
                レーン結果・メンタル・分岐点を自分の言葉で残せます（記録は下の履歴に蓄積されます）。
              </p>
            </div>
            <button
              onClick={() => setReflectionOpen(true)}
              className="shrink-0 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-black transition-colors cursor-pointer"
            >
              振り返りを書く
            </button>
          </div>

          {/* 🤖 自動振り返りの履歴 ＆ 傾向分析（2026-09-30配線）。
              cronが試合ごとに生成して coach_analyses に貯めていた86件が、
              通知本文（500字で切り詰め）以外から読めない状態だったのを解消する。 */}
          <div className="pt-2">
            <Collapsible title="🤖 自動振り返りの履歴 ＆ 傾向分析" defaultOpen={false}>
              <div className="pt-3 bg-surface border border-border rounded-2xl p-4 shadow-xs">
                <CoachReviewPanel />
              </div>
            </Collapsible>
          </div>

          {/* 📂 過去の全ソロQログ履歴（折りたたみ） */}
          <div className="pt-2">
            <Collapsible title="📂 過去の全ソロQカルテ・対戦ログ履歴を展開" defaultOpen={false}>
              <div className="pt-3 bg-surface border border-border rounded-2xl p-4 shadow-xs">
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
  <div className="py-10 text-center text-xs text-faint">読み込み中…</div>
);

const ScoutTab = dynamic(() => import('./ScoutTab'), { ssr: false, loading: tabLoading });
const FiveVFiveSimTab = dynamic(() => import('./FiveVFiveSimTab'), { ssr: false, loading: tabLoading });
const PostGameDeepAnalyticsDashboard = dynamic(() => import('./PostGameDeepAnalyticsDashboard'), { ssr: false, loading: tabLoading });
const MatchFightsAnalyticsCard = dynamic(() => import('./MatchFightsAnalyticsCard'), { ssr: false, loading: tabLoading });
const MySoloQDashboard = dynamic(() => import('./MySoloQDashboard'), { ssr: false, loading: tabLoading });
// 「試合前」タブは常にマウントされるため静的importだと初期バンドルに乗ってしまう。
// Collapsible が初回に開かれるまで子をマウントしない作りなので、遅延読込と併せて
// 「開くまで一切読み込まない」にできる。
const TimingHeatmapCard = dynamic(() => import('./TimingHeatmapCard'), { ssr: false, loading: tabLoading });
// 「次の試合に行くべきか」は試合前タブの先頭に常時表示するため、折りたたみの中とは違い
// 開いた時点で取得が走る。LLMを使わない軽量APIなのでコストは小さい。
const PlayRecommendationCard = dynamic(() => import('./PlayRecommendationCard'), { ssr: false, loading: tabLoading });
// どちらも折りたたみの中なので、Collapsible の「開くまで子をマウントしない」と
// 併せて、開かない限り読み込みも取得も走らない。
const RankGoalCard = dynamic(() => import('./RankGoalCard'), { ssr: false, loading: tabLoading });
const CoachReviewPanel = dynamic(() => import('./CoachReviewPanel'), { ssr: false, loading: tabLoading });
// モーダルは「振り返りを書く」を押すまで一切不要なので、開くまで読み込まない
const SoloQReflectionModal = dynamic(() => import('./SoloQReflectionModal'), { ssr: false });


export default function CoachPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    }>
      <CoachPageContent />
    </Suspense>
  );
}
