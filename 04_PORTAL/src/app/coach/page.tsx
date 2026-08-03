'use client';

import { useState, useEffect } from 'react';
import { apiJson } from '../../lib/apiClient';
import ScoutTab from './ScoutTab';
import PushOptIn from '../../components/PushOptIn';
import FiveVFiveSimTab from './FiveVFiveSimTab';
import SoloQReflectionModal from './SoloQReflectionModal';
import PickRecommendationTab from './PickRecommendationTab';
import MatchupWarningCard from './MatchupWarningCard';
import LanePrioritySimulator from './LanePrioritySimulator';
import MySoloQDashboard from './MySoloQDashboard';
import DeepResearchPanel from '../admin/knowledge/DeepResearchPanel';

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
  damage?: number;
  gameDuration?: string;
}

// ============================
// 共通フェッチ
// ============================
async function callCoachAPI(payload: Record<string, any>) {
  // #39: 共通fetchラッパー(apiJson)を使用。credentials付与・タイムアウト・401自動リダイレクトを一元化。
  // 認証はHttpOnly Cookie(admin_session)で自動送信される。
  return apiJson('/api/coach/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 60000, // コーチ分析はLLM生成で時間がかかるため長め
  });
}

// ============================
// パーツコンポーネント
// ============================
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-black/10 bg-black/5 p-4 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function Tag({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-amber-100 text-amber-700 border-amber-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    purple: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 text-foreground/50">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-orange-400" />
      <span className="text-sm">AIコーチが分析中...</span>
    </div>
  );
}

function AdviceBox({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-100 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-orange-700">
        <span>🤖</span> AIコーチアドバイス
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{text}</p>
    </div>
  );
}

// 過去実績データ表示用
function CounterStatsBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-100/60 p-4 text-xs">
      <div className="mb-2 font-bold text-emerald-700 flex items-center gap-1">
        📊 過去の対面実績データ (KTM Match Log)
      </div>
      <pre className="whitespace-pre-wrap font-sans text-stone-700 leading-relaxed">{text}</pre>
    </div>
  );
}

// ============================
// タブ: 試合前コーチング
// ============================
function PreGameTab({ champion, enemyChampion, triggerSignal }: { champion: string; enemyChampion: string; triggerSignal?: number }) {
  const [loading, setLoading] = useState(false);
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

  // 「今日のチェック」からの一括起動シグナル。0/undefinedは初回マウント時なので無視する。
  useEffect(() => {
    if (triggerSignal) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSignal]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/50">
        現在のランク・直近の試合・過去の対敵勝率・ナレッジDBを元に「今日何をすべきか」をGeminiが提案します。
        チャンピオンは上部の共通入力欄と連動しています。
      </p>

      <div>
        <label className="mb-1 block text-xs text-foreground/50">🎯 今日の焦点（この1試合で意識すること・任意）</label>
        <input
          value={focus}
          onChange={(e) => saveFocus(e.target.value)}
          placeholder="例: 序盤の無理なオールインを控える / 10分までにデスしない"
          className="w-full rounded-xl border border-black/10 bg-black/5 px-4 py-2.5 text-sm text-stone-900 placeholder-foreground/30 outline-none focus:border-amber-400"
        />
        <p className="mt-1 text-xs text-foreground/30">設定すると「🔍 試合後」で達成できたかを自動で振り返ります。</p>
      </div>

      <button
        id="pre-analyze-btn"
        onClick={analyze}
        disabled={loading}
        className="w-full rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50"
      >
        {loading ? '分析中' : '⚡ 分析開始'}
      </button>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-600">❌ {error}</p>}

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
                <span key={i} className={`text-lg ${r === 'win' ? 'text-emerald-600' : 'text-red-600'}`}>
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
// タブ: 試合後振り返り (過去数戦のログ表示対応)
// ============================
function PostGameTab({ onOpenReflectionModal }: { onOpenReflectionModal: () => void }) {
  const [reflections, setReflections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReflections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/soloq/reflections');
      const data = await res.json();
      setReflections(data.reflections || (data.reflection ? [data.reflection] : []));
    } catch {
      setReflections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReflections();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50/80 border border-amber-200 rounded-xl p-4">
        <div>
          <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
            <span>⚡</span> 1分ソロQ振り返り
          </h4>
          <p className="text-xs text-stone-600 mt-0.5">
            試合終了直後に Riot API から直近の戦績を自動読込し、メンタル度・勝因敗因・対面メモ・次回テーマを1〜2分で一括記録します。
          </p>
        </div>
        <button
          onClick={onOpenReflectionModal}
          className="shrink-0 px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow transition-colors flex items-center gap-1"
        >
          <span>📝</span> 振り返りを記録する
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && reflections.length === 0 && (
        <p className="text-xs text-stone-500 text-center py-4">まだ振り返り記録がありません。上記のボタンから最初の振り返りを記録してみましょう！</p>
      )}

      {!loading && reflections.length > 0 && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-foreground/60 uppercase tracking-wider">過去のソロQ振り返り履歴 ({reflections.length}件)</h5>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {reflections.map((ref, idx) => (
              <Card key={ref.id || idx} className={idx === 0 ? 'ring-2 ring-amber-500/30' : ''}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Tag color={ref.win ? 'green' : 'red'}>{ref.win ? 'VICTORY' : 'DEFEAT'}</Tag>
                    <span className="font-bold text-stone-900 text-sm">{ref.champion}</span>
                    <span className="text-xs text-stone-400">vs</span>
                    <span className="font-bold text-stone-700 text-sm">{ref.enemy_champion || 'Unknown'}</span>
                    {idx === 0 && <span className="text-[10px] bg-amber-600 text-white font-bold px-1.5 py-0.5 rounded">最新</span>}
                  </div>
                  <div className="text-xs text-stone-500">
                    {new Date(ref.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs mb-3">
                  <div className="bg-black/5 rounded-lg p-2">
                    <div className="text-foreground/40">KDA</div>
                    <div className="font-bold text-stone-800">{ref.kda || '-'}</div>
                  </div>
                  <div className="bg-black/5 rounded-lg p-2">
                    <div className="text-foreground/40">CS</div>
                    <div className="font-bold text-stone-800">{ref.cs ?? '-'}</div>
                  </div>
                  <div className="bg-black/5 rounded-lg p-2">
                    <div className="text-foreground/40">メンタル評価</div>
                    <div className="font-bold text-amber-800">{ref.mental_rating ? `${ref.mental_rating} / 5` : '-'}</div>
                  </div>
                  <div className="bg-black/5 rounded-lg p-2">
                    <div className="text-foreground/40">次回テーマ</div>
                    <div className="font-bold text-emerald-800 truncate">{ref.next_focus_point || '未設定'}</div>
                  </div>
                </div>

                {ref.win_lose_reason_tags && ref.win_lose_reason_tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {ref.win_lose_reason_tags.map((t: string, i: number) => (
                      <Tag key={i} color="blue">{t}</Tag>
                    ))}
                  </div>
                )}

                {ref.reflection_note && (
                  <div className="mt-2 text-xs bg-white/60 rounded border border-black/5 p-2 text-stone-700">
                    <span className="font-bold text-stone-900 block mb-0.5">💬 反省メモ:</span>
                    {ref.reflection_note}
                  </div>
                )}
                {ref.matchup_memo && (
                  <div className="mt-2 text-xs bg-amber-50/80 rounded border border-amber-200/60 p-2 text-stone-800">
                    <span className="font-bold text-amber-900 block mb-0.5">🎯 対面メモ (matchup_sentinel同期済み):</span>
                    {ref.matchup_memo}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================
// タブ: 傾向分析（直近の試合後ログを集計）
// ============================
function TrendsTab() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<any>(null);
  const [menuLoading, setMenuLoading] = useState(false);

  // 週次Cron(soloq-trends)がDiscordへ自動でダイジェストを送るようになったため、
  // ここでも手動ボタンではなく、開いたタイミングで自動集計する（同じ件数ならAPI側の
  // Geminiキャッシュが効くので、ボタン運用より呼び出し回数が増えることはない）。
  useEffect(() => {
    (async () => {
      setLoading(true); setError(''); setResult(null); setMenu(null);
      try {
        const data = await callCoachAPI({ mode: 'trends' });
        setResult(data);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

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
        <div className="mt-1 flex justify-between text-xs text-foreground/50">
          {seg.map((s) => <span key={s.label}>{s.label} {s.v}</span>)}
        </div>
      </div>
    );
  };

  const Trend = ({ label, recent, older, unit = '' }: { label: string; recent: number; older: number; unit?: string }) => {
    const up = recent >= older;
    return (
      <div className="rounded-lg bg-black/5 p-3">
        <div className="text-xs text-foreground/40">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-stone-900">{recent}{unit}</span>
          <span className={`text-xs ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
            {up ? '▲' : '▼'} 以前 {older}{unit}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/50">
        「🔍 試合後」で蓄積した直近の振り返りを集計し、繰り返し現れる課題（デスの時間帯・苦手な相手・再発する弱点）と今週のフォーカスを提示します。
      </p>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-600">❌ {error}</p>}

      {result && !result.enough && (
        <Card><p className="text-sm text-foreground/60">{result.message}（現在 {result.count} 件）</p></Card>
      )}

      {result && result.enough && (
        <div className="space-y-3 animate-in fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black/5 p-3">
              <div className="text-xs text-foreground/40">集計対象</div>
              <div className="text-lg font-bold text-stone-900">{result.count} 試合</div>
            </div>
            <div className="rounded-lg bg-black/5 p-3">
              <div className="text-xs text-foreground/40">勝率</div>
              <div className="text-lg font-bold text-stone-900">{result.winRate}%</div>
            </div>
          </div>

          <Card>
            <div className="mb-2 text-sm font-semibold text-foreground/80">💀 デスの時間帯分布（計 {result.totalDeaths} 回）</div>
            <PhaseBar phases={result.deathPhases} />
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Trend label="CS/min" recent={result.csTrend.recent} older={result.csTrend.older} />
            <Trend label="Vision/min" recent={result.visionTrend.recent} older={result.visionTrend.older} />
          </div>

          {result.topKillers?.length > 0 && (
            <Card>
              <div className="mb-2 text-sm font-semibold text-foreground/80">☠️ 繰り返し狩られている相手</div>
              <div className="flex flex-wrap gap-2">
                {result.topKillers.map((k: any) => (
                  <Tag key={k.champion} color="red">{k.champion} ×{k.count}</Tag>
                ))}
              </div>
            </Card>
          )}

          {result.topWeaknesses?.length > 0 && (
            <Card>
              <div className="mb-2 text-sm font-semibold text-foreground/80">🔁 再発している弱点</div>
              <div className="flex flex-wrap gap-2">
                {result.topWeaknesses.map((w: any) => (
                  <Tag key={w.label} color="yellow">{w.label} ×{w.count}</Tag>
                ))}
              </div>
            </Card>
          )}

          {result.summary && (
            <div>
              <div className="mb-1 text-sm font-semibold text-amber-700">🎯 今週のフォーカス</div>
              <AdviceBox text={result.summary} />
            </div>
          )}

          {/* 今週の練習メニュー生成（構造化） */}
          {!menu && (
            <button
              onClick={generateMenu}
              disabled={menuLoading}
              className="w-full rounded-xl border border-amber-200 bg-amber-100 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50"
            >
              {menuLoading ? '生成中...' : '📝 今週の練習メニューを作成'}
            </button>
          )}

          {menu && menu.enough === false && (
            <Card><p className="text-sm text-foreground/60">{menu.message}</p></Card>
          )}

          {menu && menu.menu?.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold text-amber-700">📝 今週の練習メニュー</div>
              <div className="space-y-2">
                {menu.menu.map((m: any, i: number) => (
                  <div key={i} className="rounded-xl border border-black/10 bg-black/3 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-600">✔</span>
                      <div className="flex-1">
                        <div className="font-bold text-stone-900 text-sm">{m.title}</div>
                        {m.detail && <div className="text-xs text-foreground/60 mt-0.5 leading-relaxed">{m.detail}</div>}
                        {m.target && <div className="inline-block mt-1.5 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-0.5">目標: {m.target}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {menu.note && <p className="text-xs text-foreground/50 mt-2">💬 {menu.note}</p>}
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
function GoalTab({ triggerSignal }: { triggerSignal?: number }) {
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

  useEffect(() => {
    if (triggerSignal) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSignal]);

  const pct = result?.current && result?.target
    ? Math.max(0, Math.min(100, Math.round((result.current.abs / result.target.abs) * 100)))
    : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/50">
        目標ランクを設定すると、これまでのLP推移から到達予測日と必要ペースを算出します。試合前タブを使うほどLP推移が貯まり、予測精度が上がります。
      </p>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="mb-1 block text-xs text-foreground/50">目標ティア</label>
          <select value={tier} onChange={(e) => setTier(e.target.value)}
            className="rounded-xl border border-black/10 bg-black/5 px-4 py-2.5 text-sm text-stone-900 outline-none focus:border-green-400">
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {!isApex && (
          <div>
            <label className="mb-1 block text-xs text-foreground/50">ディビジョン</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)}
              className="rounded-xl border border-black/10 bg-black/5 px-4 py-2.5 text-sm text-stone-900 outline-none focus:border-green-400">
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
      {error && <p className="text-sm text-red-600">❌ {error}</p>}

      {result && result.ranked === false && (
        <Card><p className="text-sm text-foreground/60">{result.message}</p></Card>
      )}

      {result && result.ranked && (
        <div className="space-y-3 animate-in fade-in">
          <Card>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-foreground/60">現在: <strong className="text-stone-900">{result.current.label}</strong></span>
              <span className="text-foreground/60">目標: <strong className="text-green-700">{result.target?.label || '—'}</strong></span>
            </div>
            <div className="h-3 w-full rounded-full bg-black/5 overflow-hidden">
              <div className="h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-xs text-foreground/40 mt-1">{pct}%</div>
          </Card>

          {result.projection?.reached && (
            <div className="rounded-xl border border-green-200 bg-green-100 px-4 py-3 text-sm font-bold text-green-700">
              🎉 目標達成済みです！次の目標を設定しましょう。
            </div>
          )}

          {result.projection && !result.projection.reached && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-black/5 p-3">
                <div className="text-xs text-foreground/40">残りLP</div>
                <div className="text-lg font-black text-stone-900">{result.gap}</div>
              </div>
              <div className="rounded-lg bg-black/5 p-3">
                <div className="text-xs text-foreground/40">ペース</div>
                <div className="text-lg font-black text-stone-900">{result.lpPerDay !== null ? `${result.lpPerDay} LP/日` : '—'}</div>
              </div>
              {result.projection.insufficientTrend ? (
                <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-100 p-3 text-sm text-amber-700">
                  到達予測にはLP推移データが不足しています（現在 {result.snapshots} 日分）。試合前タブを数日使うと予測が出ます。
                  {result.lpPerDay !== null && result.lpPerDay <= 0 && ' 直近はLPが伸びていないため、まずは勝率改善が必要です。'}
                </div>
              ) : (
                <>
                  <div className="rounded-lg bg-black/5 p-3">
                    <div className="text-xs text-foreground/40">到達予測</div>
                    <div className="text-lg font-black text-green-700">{result.projection.reachDate}</div>
                    <div className="text-[10px] text-foreground/40">あと約{result.projection.days}日</div>
                  </div>
                  <div className="rounded-lg bg-black/5 p-3">
                    <div className="text-xs text-foreground/40">必要試合数の目安</div>
                    <div className="text-lg font-black text-stone-900">約{result.projection.gamesNeeded}勝分</div>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="text-[10px] text-foreground/40">※ LP推移は「試合前」または「目標」タブを開くたびに1日1回記録されます。データが増えるほど予測が正確になります。</p>
        </div>
      )}
    </div>
  );
}

// ============================
// タブ: ティルト診断
// ============================
function TiltTab({ triggerSignal }: { triggerSignal?: number }) {
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

  useEffect(() => {
    if (triggerSignal) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSignal]);

  const tilt: TiltResult | null = result?.tilt ?? null;
  const tiltColors: Record<TiltLevel, string> = {
    green: 'border-emerald-200 bg-emerald-100',
    yellow: 'border-yellow-200 bg-yellow-100',
    red: 'border-red-200 bg-red-100',
  };
  const meterColors: Record<TiltLevel, string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/50">
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
      {error && <p className="text-sm text-red-600">❌ {error}</p>}

      {result && tilt && (
        <div className="space-y-3 animate-in fade-in">
          <div className={`rounded-2xl border p-5 ${tiltColors[tilt.level]}`}>
            <div className="mb-2 text-lg font-bold text-stone-900">{tilt.label}</div>
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs text-foreground/50">
                <span>ティルトスコア</span><span>{tilt.score} / 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-black/5">
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
              <div className="mb-2 text-xs font-semibold text-foreground/50">📉 連敗相関</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-black/5 p-2">
                  <div className="text-[10px] text-foreground/40">現在</div>
                  <div className={`text-lg font-black ${result.streakAnalysis.streakType === 'loss' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {result.streakAnalysis.currentStreak}{result.streakAnalysis.streakType === 'loss' ? '連敗' : '連勝'}
                  </div>
                </div>
                <div className="rounded-lg bg-black/5 p-2">
                  <div className="text-[10px] text-foreground/40">全体勝率</div>
                  <div className="text-lg font-black text-stone-900">{result.streakAnalysis.overallWinRate}%</div>
                </div>
                <div className="rounded-lg bg-black/5 p-2">
                  <div className="text-[10px] text-foreground/40">負け直後の勝率</div>
                  <div className={`text-lg font-black ${
                    result.streakAnalysis.afterLossWinRate !== null && result.streakAnalysis.afterLossWinRate < result.streakAnalysis.overallWinRate ? 'text-rose-600' : 'text-stone-900'
                  }`}>
                    {result.streakAnalysis.afterLossWinRate !== null ? `${result.streakAnalysis.afterLossWinRate}%` : '—'}
                  </div>
                </div>
              </div>
              {result.streakAnalysis.stopRecommended && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">
                  🛑 やめどきサイン: {result.streakAnalysis.currentStreak}連敗中です
                  {result.streakAnalysis.afterLossWinRate !== null && result.streakAnalysis.afterLossWinRate < result.streakAnalysis.overallWinRate &&
                    `（あなたは連敗後の勝率が${result.streakAnalysis.overallWinRate - result.streakAnalysis.afterLossWinRate}pt下がる傾向）`}。一度離れる方が期待値が高いかもしれません。
                </div>
              )}
            </Card>
          )}

          {result.recentMatches?.length > 0 && (
            <Card>
              <div className="mb-2 text-xs font-semibold text-foreground/50">直近の試合</div>
              <div className="space-y-1.5">
                {result.recentMatches.map((m: MatchRecord, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{m.win ? '✅' : '❌'}</span>
                    <span className="w-20 font-medium text-foreground/80">{m.champion}</span>
                    <span className="text-foreground/50">{m.kills}/{m.deaths}/{m.assists}</span>
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
function MatchupTab({ champion, enemyChampion, triggerSignal }: { champion: string; enemyChampion: string; triggerSignal?: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!champion || !enemyChampion) { setError('上部の共通入力欄に両方入力してください。'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await callCoachAPI({ mode: 'matchup', champion, enemyChampion });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (triggerSignal) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSignal]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-foreground/50">
          偵察でライブゲームの自分・対面チャンピオンが判明すると自動的に分析します
          （ナレッジDBとチャンピオン辞典の記述をAIが要約）。
        </p>
        <button
          id="matchup-analyze-btn"
          onClick={analyze}
          disabled={loading || !champion || !enemyChampion}
          title="上部の共通入力欄の内容で手動再分析"
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? '分析中...' : '🔄 再分析'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <p className="text-sm text-red-600">❌ {error}</p>}

      {result && (
        <div className="space-y-3 animate-in fade-in">
          <Card>
            <div className="flex items-center gap-3 text-sm">
              <Tag color="blue">{result.myChampion}</Tag>
              <span className="text-foreground/30">vs</span>
              <Tag color="red">{result.enemyChampion}</Tag>
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="text-foreground/40">{result.knowledgeSources}</span>
              <span className="text-foreground/40">{result.sentinelSources}</span>
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
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
  const [lastFocusPoint, setLastFocusPoint] = useState<string | null>(null);
  const [lastKnownMatchId, setLastKnownMatchId] = useState<string>('');

  const fetchLastReflection = async () => {
    try {
      const res = await fetch('/api/soloq/reflections');
      const data = await res.json();
      if (data.reflection?.next_focus_point) {
        setLastFocusPoint(data.reflection.next_focus_point);
      }
      if (data.reflection?.match_id) {
        setLastKnownMatchId(data.reflection.match_id);
      }
    } catch (err) {
      console.error('Failed to fetch last reflection focus point:', err);
    }
  };

  useEffect(() => {
    // HttpOnly Cookie(admin_session)ベースの検証（Discordログイン非依存）
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include' })
      .then(res => {
        setIsAuthenticated(res.ok);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
    
    fetchLastReflection();

    // 試合終了の自動監視（45秒おきにチェック）
    const interval = setInterval(async () => {
      try {
        const savedIgn = localStorage.getItem('soloq_riot_id') || '';
        if (!savedIgn) return;

        const res = await fetch('/api/soloq/check-finished', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ign: savedIgn, lastKnownMatchId }),
        });
        const data = await res.json();

        if (data.isNewMatch) {
          setLastKnownMatchId(data.latestMatchId);
          setIsReflectionModalOpen(true); // 自動ポップアップ！！
        }
      } catch (err) {
        // サイレントエラー
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [lastKnownMatchId]);

  // 「事前分析」と「マッチアップ」で同じチャンピオン名を二度入力させていたのを統合。
  // ここで一度入力すれば両方の分析に使われる。
  const [sharedChampion, setSharedChampion] = useState('');
  const [sharedEnemyChampion, setSharedEnemyChampion] = useState('');

  // 「マッチアップ」タブを廃止し、偵察(ScoutTab)がライブゲームから自分・対面の
  // チャンピオンを検知した瞬間に自動でマッチアップ分析を走らせる(#①)。
  const [scoutMatchupTrigger, setScoutMatchupTrigger] = useState(0);
  const handleLiveMatchDetected = (myChampion: string, enemyChampion: string) => {
    setSharedChampion(myChampion);
    setSharedEnemyChampion(enemyChampion);
    setScoutMatchupTrigger(Date.now());
  };

  // 「今日のチェック」ボタン。試合を始める前に見る3項目(事前分析・目標・ティルト)を
  // まとめて起動する。値をインクリメントするたびに各タブのuseEffectが反応する。
  const [dailyCheckTrigger, setDailyCheckTrigger] = useState(0);
  const runDailyCheck = () => {
    setDailyCheckTrigger(Date.now());
  };

  // 4ステップ統合タブ構造
  const [activeStepTab, setActiveStepTab] = useState<'banpick' | 'pregame' | 'postgame' | 'research'>('banpick');

  const STEP_TABS = [
    { id: 'banpick', label: '1. BAN/PICK中', icon: '🎯' },
    { id: 'pregame', label: '2. 試合直前 (ロード)', icon: '⚡' },
    { id: 'postgame', label: '3. 試合後振り返り', icon: '🔍' },
    { id: 'research', label: '4. 辞典 & バトルリサーチ', icon: '🎯' },
  ] as const;

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/15 border-t-orange-400" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 font-sans text-foreground bg-background"
      >
        <div className="text-center max-w-sm rounded-2xl border border-black/10 bg-white p-8 backdrop-blur shadow-lg">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-lg font-bold mb-2">認証が必要です</h2>
          <p className="text-sm text-foreground/50 mb-6 leading-relaxed">
            このコーチング機能は管理者専用です。管理者パスコードでログインしてから再度アクセスしてください。
          </p>
          <a
            href="/login"
            className="inline-block w-full rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-8 font-sans text-foreground bg-background"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .animate-in { animation: fade-in 0.35s ease forwards; }
      `}</style>

      <div className="mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="mb-2 text-4xl">🏆</div>
          <h1 className="text-2xl font-bold tracking-tight">パーソナルコーチ</h1>
          <p className="mt-1 text-sm text-foreground/40">
            Riot API × ナレッジDB × Gemini AI があなたの勝率を上げる
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <PushOptIn scope="admin" label="ポータル通知" inline />
            <button
              onClick={() => setIsReflectionModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-105 flex items-center gap-1.5"
            >
              <span>⚡</span> 1分ソロQ振り返り
            </button>
          </div>

          {lastFocusPoint && (
            <div className="mt-4 mx-auto max-w-md bg-amber-50 border border-amber-300 rounded-xl p-3 text-left shadow-sm flex items-start gap-2.5">
              <span className="text-base">🔥</span>
              <div>
                <span className="text-[11px] font-bold text-amber-900 block">前回の試合で設定した意識テーマ</span>
                <p className="text-xs text-stone-800 font-medium leading-relaxed">{lastFocusPoint}</p>
              </div>
            </div>
          )}
        </div>

        {/* 共通入力欄: 事前分析とマッチアップで別々に入力させていたのを統合 */}
        <div className="mb-6 rounded-2xl border border-black/10 bg-black/5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-foreground/50">今日使うチャンピオン</label>
              <input
                value={sharedChampion}
                onChange={(e) => setSharedChampion(e.target.value)}
                placeholder="例: Graves"
                className="w-full rounded-xl border border-black/10 bg-black/5 px-4 py-2.5 text-sm text-stone-900 placeholder-foreground/30 outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-foreground/50">対面の敵チャンピオン</label>
              <input
                value={sharedEnemyChampion}
                onChange={(e) => setSharedEnemyChampion(e.target.value)}
                placeholder="例: Lee Sin"
                className="w-full rounded-xl border border-black/10 bg-black/5 px-4 py-2.5 text-sm text-stone-900 placeholder-foreground/30 outline-none focus:border-orange-400"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-foreground/30">「事前分析」「マッチアップ」で共通して使われます（偵察でライブゲームを検知すると自動入力されます）。</p>

          <button
            onClick={runDailyCheck}
            className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-100 px-5 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-200"
          >
            🎯 今日のチェック（事前分析・目標・ティルトを一括実行）
          </button>
        </div>

        {/* 過去の自分からの対面警戒メモ（対面チャンプ決定時に即座にハイライト表示） */}
        <MatchupWarningCard champion={sharedChampion} enemyChampion={sharedEnemyChampion} />

        {/* 4ステップ切り替えナビゲーションバー */}
        <div className="mb-6 flex gap-2 border-b border-black/10 pb-3 overflow-x-auto">
          {STEP_TABS.map((tab) => {
            const isActive = activeStepTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveStepTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white shadow-md'
                    : 'bg-black/5 text-stone-600 hover:bg-black/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* --- 4ステップ別メインコンテンツ --- */}
        {activeStepTab === 'banpick' && (
          <div className="space-y-6 animate-in">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>🎯</span> BAN/PICK推奨ナビゲーター (シナジー ＆ カウンターTop3)
              </h3>
              <PickRecommendationTab />
            </div>
          </div>
        )}

        {activeStepTab === 'pregame' && (
          <div className="space-y-6 animate-in">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>📊</span> 5レーン主導権 ＆ 試合展開シミュレーター
              </h3>
              <LanePrioritySimulator />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>⚡</span> 事前分析 (対面対策ナレッジ)
              </h3>
              <PreGameTab champion={sharedChampion} enemyChampion={sharedEnemyChampion} triggerSignal={dailyCheckTrigger} />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>🧭</span> リアルタイム偵察 ＆ 5v5シミュレータ
              </h3>
              <ScoutTab onLiveMatchDetected={handleLiveMatchDetected} />
              {(sharedChampion && sharedEnemyChampion) && (
                <div className="border-t border-stone-200 pt-5">
                  <h4 className="mb-3 text-xs font-bold text-stone-700">⚔️ マッチアップ分析（自動生成）</h4>
                  <MatchupTab champion={sharedChampion} enemyChampion={sharedEnemyChampion} triggerSignal={scoutMatchupTrigger} />
                </div>
              )}
              <div className="border-t border-stone-200 pt-5">
                <FiveVFiveSimTab />
              </div>
            </div>
          </div>
        )}

        {activeStepTab === 'postgame' && (
          <div className="space-y-6 animate-in">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>📊</span> マイソロQダッシュボード (過去全ログ ＆ 成績一覧)
              </h3>
              <MySoloQDashboard />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>⚡</span> 直近のソロQ振り返り ＆ 実績
              </h3>
              <PostGameTab onOpenReflectionModal={() => setIsReflectionModalOpen(true)} />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>📈</span> 傾向分析・目標管理・ティルト判定
              </h3>
              <TrendsTab />
              <div className="border-t border-stone-200 pt-4">
                <GoalTab triggerSignal={dailyCheckTrigger} />
              </div>
              <div className="border-t border-stone-200 pt-4">
                <TiltTab triggerSignal={dailyCheckTrigger} />
              </div>
            </div>
          </div>
        )}

        {activeStepTab === 'research' && (
          <div className="space-y-6 animate-in">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>🎯</span> バトルリサーチ (特定チャンピオンのAIディープリサーチ)
              </h3>
              <p className="text-xs text-stone-500">
                チャンピオンを指定してAI＋YouTube最新動画から戦術・立ち回りを深掘り検索します。結果は「チャンピオン辞典」へ直接自動蓄積・同期されます。
              </p>
              <DeepResearchPanel />
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="mt-10 text-center text-xs text-foreground/20">
          生成結果はナレッジDBに蓄積され、次回の精度向上に活用されます
        </div>
      </div>

      <SoloQReflectionModal
        isOpen={isReflectionModalOpen}
        onClose={() => setIsReflectionModalOpen(false)}
        onSaved={fetchLastReflection}
      />
    </div>
  );
}
