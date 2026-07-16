'use client';

import { useState, useEffect } from 'react';
import ScoutTab from './ScoutTab';

// ============================
// 型定義
// ============================
type TiltLevel = 'green' | 'yellow' | 'red';

interface TiltResult {
  level: TiltLevel;
  label: string;
  score: number;
  reasons: string[];
}

interface MatchRecord {
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  champion: string;
}

interface PostResult {
  win: boolean;
  champion: string;
  kda: string;
  kdaRatio: string;
  csPerMin: string;
  visionPerMin: string;
  damage: number;
  gameDuration: string;
}

// ============================
// 共通フェッチ
// ============================
async function callCoachAPI(payload: Record<string, any>) {
  // 認証はHttpOnly Cookie(admin_session)で自動送信されるため、Discordアクセストークンの
  // 手動付与は不要（旧Supabase OAuth依存を撤去）。
  const res = await fetch('/api/coach/analyze', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API Error ${res.status}`);
  }
  return res.json();
}

// ============================
// パーツコンポーネント
// ============================
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function Tag({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 text-white/50">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
      <span className="text-sm">AIコーチが分析中...</span>
    </div>
  );
}

function AdviceBox({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-indigo-300">
        <span>🤖</span> AIコーチアドバイス
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{text}</p>
    </div>
  );
}

// 過去実績データ表示用
function CounterStatsBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs">
      <div className="mb-2 font-bold text-emerald-300 flex items-center gap-1">
        📊 過去の対面実績データ (KTM Match Log)
      </div>
      <pre className="whitespace-pre-wrap font-sans text-white/70 leading-relaxed">{text}</pre>
    </div>
  );
}

// ============================
// タブ: 試合前コーチング
// ============================
function PreGameTab() {
  const [loading, setLoading] = useState(false);
  const [champion, setChampion] = useState('');
  const [enemyChampion, setEnemyChampion] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callCoachAPI({ mode: 'pre', champion, enemyChampion });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        現在のランク・直近の試合・過去の対敵勝率・ナレッジDBを元に「今日何をすべきか」をGeminiが提案します。
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">今日使いたいチャンピオン</label>
          <input
            value={champion}
            onChange={(e) => setChampion(e.target.value)}
            placeholder="例: Graves"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">対面の敵チャンピオン（過去勝率算出用）</label>
          <input
            value={enemyChampion}
            onChange={(e) => setEnemyChampion(e.target.value)}
            placeholder="例: Lee Sin"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <button
        id="pre-analyze-btn"
        onClick={analyze}
        disabled={loading}
        className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? '分析中' : '⚡ 分析開始'}
      </button>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-400">❌ {error}</p>}

      {result && (
        <div className="space-y-3 animate-in fade-in">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Tag color="purple">🏆 {result.rank}</Tag>
              {result.recentWinRate !== null && (
                <Tag color={result.recentWinRate >= 50 ? 'green' : 'red'}>
                  直近5試合 {result.recentWinRate}%
                </Tag>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.recentResults?.map((r: string, i: number) => (
                <span key={i} className={`text-lg ${r === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r === 'win' ? '✅' : '❌'}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {result.recentChampions?.map((c: string, i: number) => (
                <Tag key={i} color="blue">{c}</Tag>
              ))}
            </div>
          </Card>

          {result.counterStats && <CounterStatsBox text={result.counterStats} />}

          <AdviceBox text={result.advice} />
        </div>
      )}
    </div>
  );
}

// ============================
// タブ: 試合後振り返り
// ============================
function PostGameTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callCoachAPI({ mode: 'post' });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const r: PostResult | null = result?.result ?? null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        直近1試合のデータを取得し、レーンごとの弱点と改善アドバイスを表示します。同一日の同じチャンピオンの振り返りは自動的に統合マージしてナレッジDBへ保存されます。
      </p>

      <button
        id="post-analyze-btn"
        onClick={analyze}
        disabled={loading}
        className="w-full rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
      >
        {loading ? '分析中...' : '🔍 最新試合を振り返る'}
      </button>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-400">❌ {error}</p>}

      {result && r && (
        <div className="space-y-3 animate-in fade-in">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-2xl">{r.win ? '✅' : '❌'}</span>
              <div>
                <div className="font-bold text-white">{r.champion}</div>
                <div className="text-xs text-white/50">{r.gameDuration}</div>
              </div>
              <Tag color={r.win ? 'green' : 'red'}>{r.win ? '勝利' : '敗北'}</Tag>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: 'KDA', value: r.kda, sub: `× ${r.kdaRatio}` },
                { label: 'CS/min', value: r.csPerMin, sub: 'レーン別基準' },
                { label: 'Vision/m', value: r.visionPerMin, sub: 'レーン別基準' },
                { label: 'Damage', value: (r.damage / 1000).toFixed(1) + 'k', sub: '' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-lg bg-white/5 p-2">
                  <div className="text-xs text-white/40">{label}</div>
                  <div className="font-bold text-white">{value}</div>
                  <div className="text-xs text-white/50">{sub}</div>
                </div>
              ))}
            </div>

            {result.weaknesses?.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold text-orange-300">⚠️ 改善ポイント</div>
                <div className="flex flex-col gap-1">
                  {result.weaknesses.map((w: string, i: number) => (
                    <span key={i} className="text-xs text-yellow-300/80">・{w}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <AdviceBox text={result.advice} />

          {result.saved && (
            <p className="text-xs text-white/30">💾 ナレッジDBに自動マージ保存されました: {result.saved}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================
// タブ: ティルト診断
// ============================
function TiltTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callCoachAPI({ mode: 'tilt' });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const tilt: TiltResult | null = result?.tilt ?? null;
  const tiltColors: Record<TiltLevel, string> = {
    green: 'border-emerald-500/50 bg-emerald-500/10',
    yellow: 'border-yellow-500/50 bg-yellow-500/10',
    red: 'border-red-500/50 bg-red-500/10',
  };
  const meterColors: Record<TiltLevel, string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        直近10試合の連敗・デス数・KDAを分析し、今ランクを続けるべきか診断します。
      </p>

      <button
        id="tilt-analyze-btn"
        onClick={analyze}
        disabled={loading}
        className="w-full rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? '診断中...' : '🧠 ティルト診断を実行'}
      </button>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-400">❌ {error}</p>}

      {result && tilt && (
        <div className="space-y-3 animate-in fade-in">
          <div className={`rounded-2xl border p-5 ${tiltColors[tilt.level]}`}>
            <div className="mb-2 text-lg font-bold text-white">{tilt.label}</div>
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-white/50">
                <span>ティルトスコア</span><span>{tilt.score} / 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className={`h-2 rounded-full transition-all ${meterColors[tilt.level]}`}
                  style={{ width: `${Math.min(tilt.score, 100)}%` }}
                />
              </div>
            </div>
            {tilt.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tilt.reasons.map((r, i) => <Tag key={i} color="yellow">{r}</Tag>)}
              </div>
            )}
          </div>

          {result.recentMatches?.length > 0 && (
            <Card>
              <div className="mb-2 text-xs font-semibold text-white/50">直近の試合</div>
              <div className="space-y-1.5">
                {result.recentMatches.map((m: MatchRecord, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{m.win ? '✅' : '❌'}</span>
                    <span className="w-20 font-medium text-white/80">{m.champion}</span>
                    <span className="text-white/50">{m.kills}/{m.deaths}/{m.assists}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <AdviceBox text={result.advice} />
        </div>
      )}
    </div>
  );
}

// ============================
// タブ: マッチアップ分析
// ============================
function MatchupTab() {
  const [loading, setLoading] = useState(false);
  const [myChamp, setMyChamp] = useState('');
  const [enemy, setEnemy] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!myChamp || !enemy) { setError('両方入力してください。'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callCoachAPI({ mode: 'matchup', champion: myChamp, enemyChampion: enemy });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        ナレッジDB（アーカイブ含む）とチャンピオン辞典の記述をAIが要約・重複クリーンアップした上でアドバイスを提示します。
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">自分のチャンピオン</label>
          <input
            value={myChamp}
            onChange={(e) => setMyChamp(e.target.value)}
            placeholder="例: Graves"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">対面の敵チャンピオン</label>
          <input
            value={enemy}
            onChange={(e) => setEnemy(e.target.value)}
            placeholder="例: Lee Sin"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <button
        id="matchup-analyze-btn"
        onClick={analyze}
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? '検索中...' : '⚔️ マッチアップを分析'}
      </button>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-400">❌ {error}</p>}

      {result && (
        <div className="space-y-3 animate-in fade-in">
          <Card>
            <div className="flex items-center gap-3 text-sm">
              <Tag color="blue">{result.myChampion}</Tag>
              <span className="text-white/30">vs</span>
              <Tag color="red">{result.enemyChampion}</Tag>
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="text-white/40">{result.knowledgeSources}</span>
              <span className="text-white/40">{result.sentinelSources}</span>
            </div>
          </Card>

          {result.counterStats && <CounterStatsBox text={result.counterStats} />}

          <AdviceBox text={result.advice} />
        </div>
      )}
    </div>
  );
}

// ============================
// メインページ
// ============================
export default function CoachPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // HttpOnly Cookie(admin_session)ベースの検証（Discordログイン非依存）
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then(res => {
        setIsAuthenticated(res.ok);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  const tabs = [
    { id: 'pre', label: '⚡ 試合前', color: 'indigo' },
    { id: 'post', label: '🔍 試合後', color: 'rose' },
    { id: 'tilt', label: '🧠 ティルト', color: 'amber' },
    { id: 'matchup', label: '⚔️ マッチアップ', color: 'emerald' },
    // 課題③: /admin/soloq（任意プレイヤーのライブ偵察）を統合。
    // 対象が「固定の自分」ではなく「任意のRiot ID」である点だけが他タブと異なる。
    { id: 'scout', label: '🎯 スカウト', color: 'cyan' },
  ] as const;

  type TabId = typeof tabs[number]['id'];
  const [activeTab, setActiveTab] = useState<TabId>('pre');

  // /admin/soloq からのリダイレクト(?tab=scout)等、クエリパラメータでタブを指定できるようにする
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && tabs.some((t) => t.id === requested)) {
      setActiveTab(requested as TabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabContent: Record<TabId, React.ReactNode> = {
    pre: <PreGameTab />,
    post: <PostGameTab />,
    tilt: <TiltTab />,
    matchup: <MatchupTab />,
    scout: <ScoutTab />,
  };

  const tabActiveColors: Record<string, string> = {
    indigo: 'border-indigo-400 text-indigo-300',
    rose: 'border-rose-400 text-rose-300',
    amber: 'border-amber-400 text-amber-300',
    emerald: 'border-emerald-400 text-emerald-300',
    cyan: 'border-cyan-400 text-cyan-300',
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a14' }} className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-indigo-400" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div
        style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a14 0%, #111827 60%, #0a0a14 100%)' }}
        className="flex items-center justify-center p-4 font-sans text-white"
      >
        <div className="text-center max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2">認証が必要です</h2>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            このコーチング機能は管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login?next=/coach"
            className="inline-block w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a14 0%, #111827 60%, #0a0a14 100%)' }}
      className="px-4 py-8 font-sans text-white"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .animate-in { animation: fade-in 0.35s ease forwards; }
      `}</style>

      <div className="mx-auto max-w-2xl">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🏆</div>
          <h1 className="text-2xl font-bold tracking-tight">パーソナルコーチ</h1>
          <p className="mt-1 text-sm text-white/40">
            Riot API × ナレッジDB × Gemini AI があなたの勝率を上げる
          </p>
        </div>

        {/* タブ */}
        <div className="mb-6 flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? `${tabActiveColors[tab.color]} bg-white/5`
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* コンテンツ */}
        <div key={activeTab} className="animate-in">
          {tabContent[activeTab]}
        </div>

        {/* フッター */}
        <div className="mt-10 text-center text-xs text-white/20">
          生成結果はナレッジDBに蓄積され、次回の精度向上に活用されます
        </div>
      </div>
    </div>
  );
}
