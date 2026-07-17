'use client';

import { useState, useEffect } from 'react';

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
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // 「今日の焦点」を localStorage に保持し、試合後タブ(達成度判定)へ引き継ぐ（課題C: ループ化）
  useEffect(() => {
    try { setFocus(localStorage.getItem('coach_focus') || ''); } catch {}
  }, []);
  const saveFocus = (v: string) => {
    setFocus(v);
    try { localStorage.setItem('coach_focus', v); } catch {}
  };

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

      <div>
        <label className="mb-1 block text-xs text-white/50">🎯 今日の焦点（この1試合で意識すること・任意）</label>
        <input
          value={focus}
          onChange={(e) => saveFocus(e.target.value)}
          placeholder="例: 序盤の無理なオールインを控える / 10分までにデスしない"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-sky-400"
        />
        <p className="mt-1 text-xs text-white/30">設定すると「🔍 試合後」で達成できたかを自動で振り返ります。</p>
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
  const [focus, setFocus] = useState('');

  // 試合前タブで設定した「今日の焦点」を読み込み、達成度判定のためAPIへ渡す（課題C）
  useEffect(() => {
    try { setFocus(localStorage.getItem('coach_focus') || ''); } catch {}
  }, []);

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callCoachAPI({ mode: 'post', focus: focus || undefined });
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

      {focus && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-2.5 text-sm text-sky-200">
          🎯 今日の焦点: <span className="font-semibold">{focus}</span>
          <span className="block text-xs text-white/40 mt-0.5">この試合で達成できたかを分析に含めます</span>
        </div>
      )}

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

          {result.focus && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              result.focusAchieved === true ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : result.focusAchieved === false ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              : 'border-white/10 bg-white/5 text-white/70'
            }`}>
              <span className="font-semibold">
                {result.focusAchieved === true ? '✅ 今日の焦点: 達成' : result.focusAchieved === false ? '❌ 今日の焦点: 未達成' : '🎯 今日の焦点'}
              </span>
              <span className="block text-xs mt-0.5 opacity-80">{result.focus}</span>
            </div>
          )}

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
// タブ: 傾向分析（直近の試合後ログを集計）
// ============================
function TrendsTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<any>(null);
  const [menuLoading, setMenuLoading] = useState(false);

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null); setMenu(null);
    try {
      const data = await callCoachAPI({ mode: 'trends' });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const generateMenu = async () => {
    setMenuLoading(true);
    try {
      const data = await callCoachAPI({ mode: 'practice_menu' });
      setMenu(data);
    } catch (e: any) { setError(e.message); }
    finally { setMenuLoading(false); }
  };

  const PhaseBar = ({ phases }: { phases: { 序盤: number; 中盤: number; 終盤: number } }) => {
    const total = phases.序盤 + phases.中盤 + phases.終盤 || 1;
    const seg = [
      { label: '序盤', v: phases.序盤, cls: 'bg-emerald-500' },
      { label: '中盤', v: phases.中盤, cls: 'bg-amber-500' },
      { label: '終盤', v: phases.終盤, cls: 'bg-rose-500' },
    ];
    return (
      <div>
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {seg.map((s) => (
            <div key={s.label} className={s.cls} style={{ width: `${(s.v / total) * 100}%` }} title={`${s.label}: ${s.v}回`} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-white/50">
          {seg.map((s) => <span key={s.label}>{s.label} {s.v}</span>)}
        </div>
      </div>
    );
  };

  const Trend = ({ label, recent, older, unit = '' }: { label: string; recent: number; older: number; unit?: string }) => {
    const up = recent >= older;
    return (
      <div className="rounded-lg bg-white/5 p-3">
        <div className="text-xs text-white/40">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-white">{recent}{unit}</span>
          <span className={`text-xs ${up ? 'text-emerald-300' : 'text-rose-300'}`}>
            {up ? '▲' : '▼'} 以前 {older}{unit}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        「🔍 試合後」で蓄積した直近の振り返りを集計し、繰り返し現れる課題（デスの時間帯・苦手な相手・再発する弱点）と今週のフォーカスを提示します。
      </p>

      <button
        onClick={analyze}
        disabled={loading}
        className="w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {loading ? '集計中...' : '📈 直近の傾向を分析'}
      </button>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-400">❌ {error}</p>}

      {result && !result.enough && (
        <Card><p className="text-sm text-white/60">{result.message}（現在 {result.count} 件）</p></Card>
      )}

      {result && result.enough && (
        <div className="space-y-3 animate-in fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/5 p-3">
              <div className="text-xs text-white/40">集計対象</div>
              <div className="text-lg font-bold text-white">{result.count} 試合</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <div className="text-xs text-white/40">勝率</div>
              <div className="text-lg font-bold text-white">{result.winRate}%</div>
            </div>
          </div>

          <Card>
            <div className="mb-2 text-sm font-semibold text-white/80">💀 デスの時間帯分布（計 {result.totalDeaths} 回）</div>
            <PhaseBar phases={result.deathPhases} />
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Trend label="CS/min" recent={result.csTrend.recent} older={result.csTrend.older} />
            <Trend label="Vision/min" recent={result.visionTrend.recent} older={result.visionTrend.older} />
          </div>

          {result.topKillers?.length > 0 && (
            <Card>
              <div className="mb-2 text-sm font-semibold text-white/80">☠️ 繰り返し狩られている相手</div>
              <div className="flex flex-wrap gap-2">
                {result.topKillers.map((k: any) => (
                  <Tag key={k.champion} color="red">{k.champion} ×{k.count}</Tag>
                ))}
              </div>
            </Card>
          )}

          {result.topWeaknesses?.length > 0 && (
            <Card>
              <div className="mb-2 text-sm font-semibold text-white/80">🔁 再発している弱点</div>
              <div className="flex flex-wrap gap-2">
                {result.topWeaknesses.map((w: any) => (
                  <Tag key={w.label} color="yellow">{w.label} ×{w.count}</Tag>
                ))}
              </div>
            </Card>
          )}

          {result.summary && (
            <div>
              <div className="mb-1 text-sm font-semibold text-sky-300">🎯 今週のフォーカス</div>
              <AdviceBox text={result.summary} />
            </div>
          )}

          {/* 今週の練習メニュー生成（構造化） */}
          {!menu && (
            <button
              onClick={generateMenu}
              disabled={menuLoading}
              className="w-full rounded-xl border border-sky-500/40 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-50"
            >
              {menuLoading ? '生成中...' : '📝 今週の練習メニューを作成'}
            </button>
          )}

          {menu && menu.enough === false && (
            <Card><p className="text-sm text-white/60">{menu.message}</p></Card>
          )}

          {menu && menu.menu?.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold text-sky-300">📝 今週の練習メニュー</div>
              <div className="space-y-2">
                {menu.menu.map((m: any, i: number) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sky-400">✔</span>
                      <div className="flex-1">
                        <div className="font-bold text-white text-sm">{m.title}</div>
                        {m.detail && <div className="text-xs text-white/60 mt-0.5 leading-relaxed">{m.detail}</div>}
                        {m.target && <div className="inline-block mt-1.5 text-[11px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-0.5">目標: {m.target}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {menu.note && <p className="text-xs text-white/50 mt-2">💬 {menu.note}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================
// タブ: シーズン目標トラッカー
// ============================
function GoalTab() {
  const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER'];
  const DIVS = ['IV', 'III', 'II', 'I'];
  const [tier, setTier] = useState('GOLD');
  const [division, setDivision] = useState('IV');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const isApex = tier === 'MASTER';

  // 目標をlocalStorageに保持
  useEffect(() => {
    try {
      const saved = localStorage.getItem('coach_goal');
      if (saved) { const g = JSON.parse(saved); if (g.tier) setTier(g.tier); if (g.division) setDivision(g.division); }
    } catch {}
  }, []);

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null);
    try { localStorage.setItem('coach_goal', JSON.stringify({ tier, division })); } catch {}
    try {
      const data = await callCoachAPI({ mode: 'goal', targetTier: tier, targetDivision: isApex ? 'I' : division });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const pct = result?.current && result?.target
    ? Math.max(0, Math.min(100, Math.round((result.current.abs / result.target.abs) * 100)))
    : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        目標ランクを設定すると、これまでのLP推移から到達予測日と必要ペースを算出します。試合前タブを使うほどLP推移が貯まり、予測精度が上がります。
      </p>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="mb-1 block text-xs text-white/50">目標ティア</label>
          <select value={tier} onChange={(e) => setTier(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-green-400">
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {!isApex && (
          <div>
            <label className="mb-1 block text-xs text-white/50">ディビジョン</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-green-400">
              {DIVS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <button onClick={analyze} disabled={loading}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50">
          {loading ? '計算中...' : '🎯 目標を計算'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-400">❌ {error}</p>}

      {result && result.ranked === false && (
        <Card><p className="text-sm text-white/60">{result.message}</p></Card>
      )}

      {result && result.ranked && (
        <div className="space-y-3 animate-in fade-in">
          <Card>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">現在: <strong className="text-white">{result.current.label}</strong></span>
              <span className="text-white/60">目標: <strong className="text-green-300">{result.target?.label || '—'}</strong></span>
            </div>
            <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-xs text-white/40 mt-1">{pct}%</div>
          </Card>

          {result.projection?.reached && (
            <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-bold text-green-200">
              🎉 目標達成済みです！次の目標を設定しましょう。
            </div>
          )}

          {result.projection && !result.projection.reached && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-white/40">残りLP</div>
                <div className="text-lg font-black text-white">{result.gap}</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs text-white/40">ペース</div>
                <div className="text-lg font-black text-white">{result.lpPerDay !== null ? `${result.lpPerDay} LP/日` : '—'}</div>
              </div>
              {result.projection.insufficientTrend ? (
                <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  到達予測にはLP推移データが不足しています（現在 {result.snapshots} 日分）。試合前タブを数日使うと予測が出ます。
                  {result.lpPerDay !== null && result.lpPerDay <= 0 && ' 直近はLPが伸びていないため、まずは勝率改善が必要です。'}
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-xs text-white/40">到達予測</div>
                    <div className="text-lg font-black text-green-300">{result.projection.reachDate}</div>
                    <div className="text-[10px] text-white/40">あと約{result.projection.days}日</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-xs text-white/40">必要試合数の目安</div>
                    <div className="text-lg font-black text-white">約{result.projection.gamesNeeded}勝分</div>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="text-[10px] text-white/40">※ LP推移は「試合前」または「目標」タブを開くたびに1日1回記録されます。データが増えるほど予測が正確になります。</p>
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

          {/* 連敗相関トラッカー */}
          {result.streakAnalysis && (
            <Card>
              <div className="mb-2 text-xs font-semibold text-white/50">📉 連敗相関</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] text-white/40">現在</div>
                  <div className={`text-lg font-black ${result.streakAnalysis.streakType === 'loss' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {result.streakAnalysis.currentStreak}{result.streakAnalysis.streakType === 'loss' ? '連敗' : '連勝'}
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] text-white/40">全体勝率</div>
                  <div className="text-lg font-black text-white">{result.streakAnalysis.overallWinRate}%</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] text-white/40">負け直後の勝率</div>
                  <div className={`text-lg font-black ${
                    result.streakAnalysis.afterLossWinRate !== null && result.streakAnalysis.afterLossWinRate < result.streakAnalysis.overallWinRate ? 'text-rose-400' : 'text-white'
                  }`}>
                    {result.streakAnalysis.afterLossWinRate !== null ? `${result.streakAnalysis.afterLossWinRate}%` : '—'}
                  </div>
                </div>
              </div>
              {result.streakAnalysis.stopRecommended && (
                <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
                  🛑 やめどきサイン: {result.streakAnalysis.currentStreak}連敗中です
                  {result.streakAnalysis.afterLossWinRate !== null && result.streakAnalysis.afterLossWinRate < result.streakAnalysis.overallWinRate &&
                    `（あなたは連敗後の勝率が${result.streakAnalysis.overallWinRate - result.streakAnalysis.afterLossWinRate}pt下がる傾向）`}。一度離れる方が期待値が高いかもしれません。
                </div>
              )}
            </Card>
          )}

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
    { id: 'trends', label: '📈 傾向', color: 'sky' },
    { id: 'goal', label: '🎯 目標', color: 'green' },
    { id: 'tilt', label: '🧠 ティルト', color: 'amber' },
    { id: 'matchup', label: '⚔️ マッチアップ', color: 'emerald' },
  ] as const;

  type TabId = typeof tabs[number]['id'];
  const [activeTab, setActiveTab] = useState<TabId>('pre');

  const tabContent: Record<TabId, React.ReactNode> = {
    pre: <PreGameTab />,
    post: <PostGameTab />,
    trends: <TrendsTab />,
    goal: <GoalTab />,
    tilt: <TiltTab />,
    matchup: <MatchupTab />,
  };

  const tabActiveColors: Record<string, string> = {
    indigo: 'border-indigo-400 text-indigo-300',
    rose: 'border-rose-400 text-rose-300',
    sky: 'border-sky-400 text-sky-300',
    green: 'border-green-400 text-green-300',
    amber: 'border-amber-400 text-amber-300',
    emerald: 'border-emerald-400 text-emerald-300',
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
