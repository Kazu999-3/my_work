'use client';

import { useState, useEffect, useRef } from 'react';
import { apiJson } from '../../lib/apiClient';
import ScoutTab, { type LiveRosterEntry } from './ScoutTab';
import PushOptIn from '../../components/PushOptIn';
import FiveVFiveSimTab from './FiveVFiveSimTab';
import SoloQReflectionModal from './SoloQReflectionModal';
import TiltDiagnosisPopup from './TiltDiagnosisPopup';
import MatchupWarningCard from './MatchupWarningCard';
import MySoloQDashboard from './MySoloQDashboard';
import Collapsible from '../../components/Collapsible';
import FocusStickyBar from '../../components/coach/FocusStickyBar';
import JgMatchupPredictor from '../../components/coach/JgMatchupPredictor';
import JgSkillMasteryChecklist from '../../components/coach/JgSkillMasteryChecklist';
import PlayerStyleRadarCard from '../../components/coach/PlayerStyleRadarCard';

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

import Skeleton, { CardSkeleton } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

// ============================
// パーツコンポーネント
// ============================
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200/90 bg-white/90 p-5 shadow-xs transition-all hover:border-stone-300 ${className}`}>
      {children}
    </div>
  );
}

function Tag({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-amber-100/80 text-amber-800 border-amber-200',
    green: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
    red: 'bg-rose-100/80 text-rose-800 border-rose-200',
    yellow: 'bg-yellow-100/80 text-yellow-800 border-yellow-200',
    purple: 'bg-orange-100/80 text-orange-800 border-orange-200',
  };
  return (
    <span className={`inline-block rounded-lg border px-2.5 py-0.5 text-xs font-bold ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3 py-6 text-stone-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-primary" />
      <span className="text-xs font-bold text-stone-600">AIコーチが分析中...</span>
    </div>
  );
}

function AdviceBox({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 shadow-xs">
      <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-amber-900 uppercase tracking-wider">
        <span className="text-base">🤖</span> AIコーチアドバイス
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800 font-medium">{text}</p>
    </div>
  );
}

// ============================
// タブ: 今週のAI練習メニュー (蓄積データから自動生成)
// ============================
function PracticeMenuTab() {
  const [loading, setLoading] = useState(false);
  const [menuData, setMenuData] = useState<any>(null);
  const [error, setError] = useState('');

  const fetchMenu = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callCoachAPI({ mode: 'practice_menu', limit: 20 });
      setMenuData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-stone-900">🏋️‍♂️ 今週のAIカスタム練習メニュー</h3>
          <p className="text-xs text-stone-500">直近のソロQ振り返り蓄積データからAIが課題に合わせた具体的な練習課題を作成します</p>
        </div>
        <button
          onClick={fetchMenu}
          disabled={loading}
          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
        >
          {loading ? '再生成中...' : '🔄 練習メニューを再作成'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <p className="text-xs text-rose-600 font-bold">❌ {error}</p>}

      {menuData && !menuData.enough && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 font-medium">
          ⚠️ {menuData.message || '練習メニュー生成には振り返りログが3件以上必要です。'}
        </div>
      )}

      {menuData && menuData.enough && (
        <div className="space-y-3">
          {menuData.note && (
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs text-amber-900 font-bold flex items-start gap-2">
              <span>💡</span>
              <span>全体方針: {menuData.note}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {menuData.menu?.map((item: any, idx: number) => (
              <div key={idx} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between text-xs font-black text-amber-900">
                  <span>課題 {idx + 1}: {item.title}</span>
                  {item.target && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full">
                      目標: {item.target}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-700 leading-relaxed font-medium">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
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
function PostGameTab({ onOpenReflectionModal, refreshSignal }: { onOpenReflectionModal: () => void; refreshSignal?: number }) {
  const [reflections, setReflections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // AI自動分析(coach_analyses)ログ。日次Cron・「1分ソロQ振り返り」内の手動生成
  // いずれで作られた分析も、通知(ベル)を見返さずここで1試合ずつ確認できるようにする。
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [analysisHistoryLoading, setAnalysisHistoryLoading] = useState(true);
  const [expandedAnalysisId, setExpandedAnalysisId] = useState<string | null>(null);

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

  const fetchAnalysisHistory = async () => {
    setAnalysisHistoryLoading(true);
    try {
      const data = await callCoachAPI({ mode: 'history', limit: 20 });
      setAnalysisHistory(data.analyses || []);
    } catch {
      setAnalysisHistory([]);
    } finally {
      setAnalysisHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchReflections();
    fetchAnalysisHistory();
    // refreshSignalは診断ポップアップ・振り返りモーダル経由の保存完了時にインクリメントされる。
    // このタブは常時マウントのため保存後も再fetchが発火せず「保存したのに反映されない」
    // 状態になっていた(2026-08-05発覚)。
  }, [refreshSignal]);

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

      {loading && <CardSkeleton count={2} />}

      {!loading && reflections.length === 0 && (
        <EmptyState
          icon="📝"
          title="まだ振り返り記録がありません"
          description="試合終了直後にワンクリックで戦績を読み込み、メンタル評価や勝因・敗因を記録しましょう。"
          actionText="最初の振り返りを記録する"
          onAction={onOpenReflectionModal}
        />
      )}

      {!loading && reflections.length > 0 && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-stone-600 uppercase tracking-wider">過去のソロQ振り返り履歴 ({reflections.length}件)</h5>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {reflections.map((ref, idx) => (
              <Card key={ref.id || idx} className={idx === 0 ? 'ring-2 ring-amber-500/40 border-amber-300' : ''}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Tag color={ref.win ? 'green' : 'red'}>{ref.win ? 'VICTORY' : 'DEFEAT'}</Tag>
                    <span className="font-bold text-stone-900 text-sm">{ref.champion}</span>
                    <span className="text-xs text-stone-400">vs</span>
                    <span className="font-bold text-stone-700 text-sm">{ref.enemy_champion || 'Unknown'}</span>
                    {idx === 0 && <span className="text-[10px] bg-primary text-white font-bold px-1.5 py-0.5 rounded">最新</span>}
                  </div>
                  <div className="text-xs text-stone-500 font-medium">
                    {new Date(ref.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs mb-3">
                  <div className="bg-stone-100/80 rounded-xl p-2 border border-stone-200/50">
                    <div className="text-stone-400 text-[10px] font-bold">KDA</div>
                    <div className="font-extrabold text-stone-800">{ref.kda || '-'}</div>
                  </div>
                  <div className="bg-stone-100/80 rounded-xl p-2 border border-stone-200/50">
                    <div className="text-stone-400 text-[10px] font-bold">CS</div>
                    <div className="font-extrabold text-stone-800">{ref.cs ?? '-'}</div>
                  </div>
                  <div className="bg-stone-100/80 rounded-xl p-2 border border-stone-200/50">
                    <div className="text-stone-400 text-[10px] font-bold">メンタル評価</div>
                    <div className="font-extrabold text-amber-800">{ref.mental_rating ? `${ref.mental_rating} / 5` : '-'}</div>
                  </div>
                  <div className="bg-stone-100/80 rounded-xl p-2 border border-stone-200/50">
                    <div className="text-stone-400 text-[10px] font-bold">次回テーマ</div>
                    <div className="font-extrabold text-emerald-800 truncate">{ref.next_focus_point || '未設定'}</div>
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
                  <div className="mt-2 text-xs bg-stone-50 rounded-xl border border-stone-200/80 p-2.5 text-stone-700">
                    <span className="font-bold text-stone-900 block mb-0.5">💬 反省メモ:</span>
                    {ref.reflection_note}
                  </div>
                )}
                {ref.matchup_memo && (
                  <div className="mt-2 text-xs bg-amber-50/90 rounded-xl border border-amber-200/80 p-2.5 text-stone-800">
                    <span className="font-bold text-amber-900 block mb-0.5">🎯 対面メモ (matchup_sentinel同期済み):</span>
                    {ref.matchup_memo}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI自動分析ログ(coach_analyses)。日次Cronの通知(ベル)で流れるKDA/Vision等の
          内容は、これまで見返す画面が無く2行に省略された通知履歴でしか確認できなかった。
          「1分ソロQ振り返り」内の手動生成分も含め、ここで1試合ずつ見返せるようにする。 */}
      <Collapsible
        title={
          <h5 className="text-xs font-bold text-foreground/60 uppercase tracking-wider">
            🤖 AI自動分析ログ {analysisHistory.length > 0 && `(${analysisHistory.length}件)`}
          </h5>
        }
      >
        {analysisHistoryLoading ? (
          <Spinner />
        ) : analysisHistory.length === 0 ? (
          <p className="text-xs text-stone-500 text-center py-4">まだAI分析の記録がありません。日次Cron、または「1分ソロQ振り返り」内の「AI分析を生成する」ボタンで作成されます。</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {analysisHistory.map((a, idx) => {
              const isExpanded = expandedAnalysisId === (a.matchId || String(idx));
              return (
                <Card key={a.matchId || idx} className={idx === 0 ? 'ring-2 ring-indigo-500/30' : ''}>
                  <button
                    type="button"
                    onClick={() => setExpandedAnalysisId(isExpanded ? null : (a.matchId || String(idx)))}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Tag color={a.win ? 'green' : 'red'}>{a.win ? 'VICTORY' : 'DEFEAT'}</Tag>
                        <span className="font-bold text-stone-900 text-sm">{a.champion}</span>
                        <span className="text-xs text-stone-400">vs</span>
                        <span className="font-bold text-stone-700 text-sm">{a.enemyChampion || 'Unknown'}</span>
                        {idx === 0 && <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded">最新</span>}
                      </div>
                      <div className="text-xs text-stone-500 flex items-center gap-2">
                        {new Date(a.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        <span className="text-indigo-700 font-bold">{isExpanded ? '閉じる ▲' : '詳細 ▼'}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-black/5 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-black/5 rounded-lg p-2">
                          <div className="text-foreground/40">KDA</div>
                          <div className="font-bold text-stone-800">{a.kda} ({a.kdaRatio})</div>
                        </div>
                        <div className="bg-black/5 rounded-lg p-2">
                          <div className="text-foreground/40">CS/min</div>
                          <div className="font-bold text-stone-800">{a.csPerMin}</div>
                        </div>
                        <div className="bg-black/5 rounded-lg p-2">
                          <div className="text-foreground/40">Vision/min</div>
                          <div className="font-bold text-stone-800">{a.visionPerMin}</div>
                        </div>
                      </div>

                      {a.weaknesses?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {a.weaknesses.map((w: string, i: number) => (
                            <span key={i} className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">⚠️ {w}</span>
                          ))}
                        </div>
                      )}

                      {a.focus && (
                        <div className="text-xs">
                          <span className="font-bold text-emerald-800">🔥 焦点「{a.focus}」: </span>
                          <span className={a.focusAchieved === true ? 'text-emerald-700 font-bold' : a.focusAchieved === false ? 'text-rose-700 font-bold' : 'text-stone-500'}>
                            {a.focusAchieved === true ? '達成' : a.focusAchieved === false ? '未達成' : '判定なし'}
                          </span>
                        </div>
                      )}

                      {a.advice && (
                        <div className="text-xs bg-white/60 rounded border border-black/5 p-2 text-stone-700 whitespace-pre-wrap leading-relaxed">
                          {a.advice}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Collapsible>
    </div>
  );
}

// ============================
// タブ: 傾向分析（直近の試合後ログを集計）
// ============================
function TrendsTab({ active }: { active: boolean }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<any>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  // postgameセクション全体が常時マウントのため、単純にmount時fetchするとユーザーが
  // このタブを一度も見なくてもページを開いた瞬間にGemini呼び出しが走っていた
  // (2026-08-05発覚)。activeになった最初の1回だけ取得する。
  const fetchedRef = useRef(false);

  // 週次Cron(soloq-trends)がDiscordへ自動でダイジェストを送るようになったため、
  // ここでも手動ボタンではなく、開いたタイミングで自動集計する（同じ件数ならAPI側の
  // Geminiキャッシュが効くので、ボタン運用より呼び出し回数が増えることはない）。
  useEffect(() => {
    if (!active || fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      setLoading(true); setError(''); setResult(null); setMenu(null);
      try {
        const data = await callCoachAPI({ mode: 'trends' });
        setResult(data);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [active]);

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

          {result.coreTimingTrend && (result.coreTimingTrend.avgFirstCoreWinSec || result.coreTimingTrend.recentAvgFirstCoreSec) && (
            <Card>
              <div className="mb-2 text-sm font-semibold text-foreground/80 flex items-center justify-between">
                <span>⏱️ 1stコア完成テンポ（チャンピオン辞典基準比較）</span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded">ファーム健全度</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-emerald-800 font-bold">勝利時の平均</div>
                  <div className="text-sm font-black text-emerald-950 mt-0.5">
                    {result.coreTimingTrend.avgFirstCoreWinSec
                      ? `${Math.floor(result.coreTimingTrend.avgFirstCoreWinSec / 60)}分${String(result.coreTimingTrend.avgFirstCoreWinSec % 60).padStart(2, '0')}秒`
                      : '未計測'}
                  </div>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-rose-800 font-bold">敗北時の平均</div>
                  <div className="text-sm font-black text-rose-950 mt-0.5">
                    {result.coreTimingTrend.avgFirstCoreLossSec
                      ? `${Math.floor(result.coreTimingTrend.avgFirstCoreLossSec / 60)}分${String(result.coreTimingTrend.avgFirstCoreLossSec % 60).padStart(2, '0')}秒`
                      : '未計測'}
                  </div>
                </div>
                <div className="bg-stone-100 border border-stone-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-stone-600 font-bold">直近の平均</div>
                  <div className="text-sm font-black text-stone-900 mt-0.5">
                    {result.coreTimingTrend.recentAvgFirstCoreSec
                      ? `${Math.floor(result.coreTimingTrend.recentAvgFirstCoreSec / 60)}分${String(result.coreTimingTrend.recentAvgFirstCoreSec % 60).padStart(2, '0')}秒`
                      : '未計測'}
                  </div>
                </div>
                <div className="bg-stone-100 border border-stone-200 p-2.5 rounded-xl">
                  <div className="text-[10px] text-stone-600 font-bold">過去の平均</div>
                  <div className="text-sm font-black text-stone-900 mt-0.5">
                    {result.coreTimingTrend.olderAvgFirstCoreSec
                      ? `${Math.floor(result.coreTimingTrend.olderAvgFirstCoreSec / 60)}分${String(result.coreTimingTrend.olderAvgFirstCoreSec % 60).padStart(2, '0')}秒`
                      : '未計測'}
                  </div>
                </div>
              </div>
            </Card>
          )}

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

          {/* 曜日×時間帯の過去勝率を加味した「次の試合に行くべきか」の統合判定 */}
          {result.playRecommendation && (
            <div className={`rounded-2xl px-4 py-3.5 text-white font-bold text-sm shadow ${
              result.playRecommendation.level === 'red' ? 'bg-rose-700' :
              result.playRecommendation.level === 'yellow' ? 'bg-amber-600' : 'bg-emerald-700'
            }`}>
              {result.playRecommendation.label}
              {result.playRecommendation.reasons?.length > 0 && (
                <ul className="mt-1.5 text-xs font-normal opacity-90 list-disc list-inside space-y-0.5">
                  {result.playRecommendation.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* 曜日×時間帯の過去勝率 */}
          {result.timing && (
            <Card>
              <div className="mb-1 text-xs font-semibold text-foreground/50">🗓️ この時間帯の過去成績</div>
              {result.timing.winRate !== null ? (
                <p className="text-sm text-stone-700">
                  {result.timing.dayLabel}曜{result.timing.scope === 'hour' ? `${result.timing.hour}時台` : '全体'}の勝率:{' '}
                  <strong className={result.timing.winRate < 45 ? 'text-rose-600' : 'text-emerald-700'}>{result.timing.winRate}%</strong>
                  {' '}({result.timing.wins}/{result.timing.games}勝)
                </p>
              ) : (
                <p className="text-xs text-foreground/40">この時間帯のサンプルがまだ不足しています。</p>
              )}
            </Card>
          )}

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
// タブ: 曜日×時間帯 勝率ヒートマップ
// ============================
const HEATMAP_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

function TimingHeatmapTab() {
  const [loading, setLoading] = useState(true);
  const [cells, setCells] = useState<{ day: number; hour: number; games: number; wins: number; winRate: number }[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [error, setError] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; synced: number } | null>(null);

  // ブラウザネイティブのtitle属性ツールチップは表示までのディレイが長く、
  // overflow-x-autoのテーブル内では途切れる/出ないことがあり、スマホのタップでは
  // そもそも発火しない。カーソルを合わせる(またはタップする)と即座に見える
  // 専用の詳細表示に置き換える。
  const [activeCell, setActiveCell] = useState<{ day: number; hour: number } | null>(null);

  const fetchHeatmap = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/soloq/heatmap', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');
      setCells(data.cells || []);
      setTotalGames(data.totalGames || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHeatmap(); }, []);

  // 同期の進捗(offset)をlocalStorageに永続化する。以前はブラウザのローカル変数のみで
  // 保持しており、途中でタブを閉じる/離脱すると次回は300件のID一覧取得を毎回最初から
  // やり直し、Riot API呼び出しが無駄になっていた(2026-08-05発覚)。
  const SYNC_OFFSET_KEY = 'soloq_history_sync_offset';

  const runSync = async () => {
    const savedOffset = Number(localStorage.getItem(SYNC_OFFSET_KEY) || 0) || 0;
    const confirmMsg = savedOffset > 0
      ? `前回の続き(${savedOffset}件目)からソロQ履歴の同期を再開しますか？(試合数によっては数分かかります)`
      : '直近300試合のソロQ履歴をRiot APIから取得して同期しますか？(試合数によっては数分かかります)';
    if (!confirm(confirmMsg)) return;
    setSyncing(true);
    setSyncProgress({ processed: savedOffset, synced: 0 });
    try {
      let offset = savedOffset;
      let totalProcessed = savedOffset;
      let totalSynced = 0;
      while (true) {
        const res = await fetch('/api/soloq/history-sync', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '同期エラーが発生しました');

        totalProcessed += data.processed || 0;
        totalSynced += data.synced || 0;
        setSyncProgress({ processed: totalProcessed, synced: totalSynced });

        if (data.done || data.nextOffset === null) {
          localStorage.removeItem(SYNC_OFFSET_KEY);
          break;
        }
        offset = data.nextOffset;
        // 完走前でも直近の到達点を都度保存しておく。ここで保存しないと、この後の
        // チャンクが失敗/中断した場合に今回分の進捗ごと失われてしまう。
        localStorage.setItem(SYNC_OFFSET_KEY, String(offset));
        // レート制限で中断した直後は即リトライしても再度弾かれやすいため、少し待ってから再開する。
        if (data.rateLimited) await new Promise((r) => setTimeout(r, 3000));
      }
      await fetchHeatmap();
    } catch (e: any) {
      // 進捗(localStorage)はここでは消さない。次回起動時に続きから再開できるように残す。
      setError('同期失敗: ' + e.message + '（次回は続きから再開します）');
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const cellMap = new Map<string, { games: number; wins: number; winRate: number }>();
  cells.forEach((c) => cellMap.set(`${c.day}-${c.hour}`, c));

  // 十分な試合数(3件以上)があるセルの中から最良/最悪を判定
  const qualified = cells.filter((c) => c.games >= 3);
  const best = qualified.length > 0 ? [...qualified].sort((a, b) => b.winRate - a.winRate)[0] : null;
  const worst = qualified.length > 0 ? [...qualified].sort((a, b) => a.winRate - b.winRate)[0] : null;

  const cellColor = (winRate: number, games: number) => {
    if (games === 0) return 'bg-black/[0.03]';
    if (games < 3) return 'bg-stone-100';
    if (winRate >= 60) return 'bg-emerald-500';
    if (winRate >= 55) return 'bg-emerald-300';
    if (winRate >= 45) return 'bg-yellow-200';
    if (winRate >= 40) return 'bg-orange-300';
    return 'bg-red-400';
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/50">
        過去に同期したソロQ試合の開始時刻(JST)から、曜日×時間帯ごとの勝率を集計します。
      </p>

      <button
        onClick={runSync}
        disabled={syncing}
        className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {syncing
          ? `同期中... (${syncProgress?.processed || 0}件処理 / ${syncProgress?.synced || 0}件新規保存)`
          : totalGames > 0 ? `🔄 履歴を再同期 (現在${totalGames}試合分)` : '🔄 直近300試合を同期'}
      </button>

      {error && <p className="text-sm text-red-600">❌ {error}</p>}

      {loading ? (
        <Spinner />
      ) : totalGames === 0 ? (
        <p className="text-sm text-foreground/40 py-6 text-center">まだ同期されたデータがありません。上のボタンで同期してください。</p>
      ) : (
        <div className="space-y-3">
          {(best || worst) && (
            <div className="grid grid-cols-2 gap-2">
              {best && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[10px] font-bold text-emerald-700">👍 最も勝率が良い時間帯</div>
                  <div className="text-sm font-bold text-stone-900">{HEATMAP_DAYS[best.day]}曜 {best.hour}時台</div>
                  <div className="text-xs text-stone-500">{best.winRate}% ({best.wins}/{best.games}勝)</div>
                </div>
              )}
              {worst && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="text-[10px] font-bold text-red-700">👎 最も勝率が悪い時間帯</div>
                  <div className="text-sm font-bold text-stone-900">{HEATMAP_DAYS[worst.day]}曜 {worst.hour}時台</div>
                  <div className="text-xs text-stone-500">{worst.winRate}% ({worst.wins}/{worst.games}勝)</div>
                </div>
              )}
            </div>
          )}

          <div className="min-h-[2.5rem] rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs flex items-center justify-between gap-2 shadow-xs">
            {activeCell ? (() => {
              const c = cellMap.get(`${activeCell.day}-${activeCell.hour}`);
              const games = c?.games || 0;
              const isGood = games >= 3 && (c?.winRate || 0) >= 55;
              const isBad = games >= 3 && (c?.winRate || 0) < 45;
              return (
                <div className="flex items-center justify-between w-full flex-wrap gap-2">
                  <span className="font-bold text-stone-900">
                    {HEATMAP_DAYS[activeCell.day]}曜 {activeCell.hour}時台:{' '}
                    {games > 0 ? (
                      <span className="font-extrabold text-stone-700">{c!.winRate}% ({c!.wins}/{games}勝)</span>
                    ) : (
                      <span className="font-normal text-stone-400">データなし</span>
                    )}
                  </span>
                  {isGood && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <span>🌟</span> 勝ち時（推奨時間帯）
                    </span>
                  )}
                  {isBad && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                      <span>⚠️</span> 要警戒（勝率低下傾向）
                    </span>
                  )}
                </div>
              );
            })() : (
              <span className="text-stone-400">マスにカーソルを合わせる（スマホはタップ）と詳細がここに表示されます</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse text-[10px]" onMouseLeave={() => setActiveCell(null)}>
              <thead>
                <tr>
                  <th className="w-8"></th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="px-0.5 font-normal text-foreground/40" style={{ minWidth: '18px' }}>
                      {h % 3 === 0 ? h : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HEATMAP_DAYS.map((dayLabel, day) => (
                  <tr key={day}>
                    <td className="pr-1 text-right font-bold text-foreground/50">{dayLabel}</td>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const c = cellMap.get(`${day}-${hour}`);
                      const games = c?.games || 0;
                      const winRate = c?.winRate ?? 0;
                      const isActive = activeCell?.day === day && activeCell?.hour === hour;
                      return (
                        <td key={hour} className="p-0.5">
                          <div
                            onMouseEnter={() => setActiveCell({ day, hour })}
                            onClick={() => setActiveCell(isActive ? null : { day, hour })}
                            className={`h-4 w-4 rounded-sm cursor-pointer transition-all ${cellColor(winRate, games)} ${
                              isActive ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : ''
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-foreground/30">※ グレーは3試合未満のためサンプル不足のセル。マスにカーソルを合わせる（スマホはタップ）と上に詳細を表示します。</p>
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
  const [isTiltPopupOpen, setIsTiltPopupOpen] = useState(false);
  const [lastMatchWin, setLastMatchWin] = useState<boolean | null>(null);
  const [lastFocusPoint, setLastFocusPoint] = useState<string | null>(null);
  const [lastKnownMatchId, setLastKnownMatchId] = useState<string>('');
  // ポーリングのuseEffectをisAuthenticatedだけに依存させたまま(pollのたびにintervalが
  // 再生成される二重fetchを避けるため)最新のlastKnownMatchIdを参照できるようにするref。
  // stateだけをdepsに入れるとuseEffectがpollのたびに再生成され、そのままだと
  // 「初回は即時実行」ロジックが毎回のpollで発火して二重fetchになってしまう。
  const lastKnownMatchIdRef = useRef('');
  const updateLastKnownMatchId = (id: string) => {
    lastKnownMatchIdRef.current = id;
    setLastKnownMatchId(id);
  };
  // 振り返り保存完了のたびにインクリメントし、常時マウントのMySoloQDashboard/PostGameTabへ
  // 再fetchのトリガーとして渡す(保存後に一覧タブが更新されない問題の修正)。
  const [reflectionRefreshSignal, setReflectionRefreshSignal] = useState(0);
  // 試合終了自動検知が連続して失敗している場合に気づけるようにする(2026-08-05発覚:
  // 以前はcatchが完全にサイレントで、Riot APIキー失効等が起きても自動ポップアップが
  // 永遠に出なくなるだけで、ユーザーには何も表示されなかった)。
  const [matchDetectFailCount, setMatchDetectFailCount] = useState(0);

  const fetchLastReflection = async () => {
    try {
      const res = await fetch('/api/soloq/reflections');
      const data = await res.json();
      if (data.reflection?.next_focus_point) {
        setLastFocusPoint(data.reflection.next_focus_point);
      }
      if (data.reflection?.match_id) {
        updateLastKnownMatchId(data.reflection.match_id);
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
  }, []);

  useEffect(() => {
    // 未認証（未確認含む）の間はAPIを一切叩かない。「認証が必要です」画面表示中も
    // コンポーネント自体はアンマウントされないため、ここでガードしないと
    // ログアウト後の端末でもRiot APIポーリングが裏で動き続けてしまう。
    if (isAuthenticated !== true) return;

    // 試合終了の自動監視（45秒おきにチェック）。
    // 複数タブ・複数端末で同時に開いていると個人用Riot APIキーの消費が線形に増える
    // 問題があった(2026-08-05発覚)。バックグラウンドタブでは意味のあるポーリングにならない
    // (ユーザーが見ていないので自動ポップアップも気づけない)ため、Page Visibility APIで
    // 非表示中は完全にスキップする。
    const checkFinished = async () => {
      try {
        if (document.hidden) return;
        const savedIgn = localStorage.getItem('soloq_riot_id') || '';
        if (!savedIgn) return;

        const res = await fetch('/api/soloq/check-finished', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ign: savedIgn, lastKnownMatchId: lastKnownMatchIdRef.current }),
        });
        const data = await res.json();

        if (data.error) {
          setMatchDetectFailCount((c) => c + 1);
        } else {
          setMatchDetectFailCount(0);
        }

        if (data.isNewMatch) {
          if (sessionStorage.getItem('tilt_popup_snoozed')) {
            // スヌーズは「次の1試合だけ」抑制する意図(TiltDiagnosisPopup.tsxのUI文言)。
            // フラグを消さないままだとタブを閉じるまで恒久的に沈黙してしまっていた
            // (2026-08-05発覚)。今回の1件を消費したら解除し、次の新規試合検知では
            // 通常どおりポップアップする。
            sessionStorage.removeItem('tilt_popup_snoozed');
          } else {
            // 自動ポップアップ！！ まずティルト診断を出し、そこから振り返りへ進めるようにする(#①)
            setLastMatchWin(typeof data.win === 'boolean' ? data.win : null);
            setIsTiltPopupOpen(true);
          }
        }
        // isNewMatchの真偽に関わらず、返ってきたlatestMatchIdを常に基準として更新する。
        // 以前はisNewMatch===trueの時だけ更新していたため、一度も振り返りを保存した
        // ことがないアカウントはlastKnownMatchIdが永久に空文字のままとなり、
        // (!!lastKnownMatchId && ...)の判定が常にfalseになって自動ポップアップが
        // 絶対に発火しなかった(2026-08-05発覚)。ここで毎回基準を同期させることで、
        // 初回ポーリングで「現在地」を記録し、以降の本当に新しい試合を正しく検知できる。
        if (data.latestMatchId) {
          updateLastKnownMatchId(data.latestMatchId);
        }
      } catch (err) {
        setMatchDetectFailCount((c) => c + 1);
      }
    };

    // 既存の振り返り履歴があればそのmatch_idを基準として優先する(既に振り返り済みの
    // 試合を「新着」と誤検知しないため)。無い場合(初回利用アカウント)はcheckFinished内で
    // 現在のライブ最新試合IDが基準としてセットされる。45秒待たずに即座に確立する。
    let cancelled = false;
    (async () => {
      await fetchLastReflection();
      if (!cancelled) checkFinished();
    })();
    const interval = setInterval(checkFinished, 45000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [isAuthenticated]);

  // 「事前分析」と「マッチアップ」で同じチャンピオン名を二度入力させていたのを統合。
  // localStorage と同期し、ページ再読み込み・タブ切り替えでも再入力の手間を完全にゼロ化。
  const [sharedChampion, setSharedChampionState] = useState('');
  const [sharedEnemyChampion, setSharedEnemyChampionState] = useState('');

  useEffect(() => {
    const savedMy = localStorage.getItem('coach_my_champ') || '';
    const savedEnemy = localStorage.getItem('coach_enemy_champ') || '';
    if (savedMy) setSharedChampionState(savedMy);
    if (savedEnemy) setSharedEnemyChampionState(savedEnemy);
  }, []);

  const setSharedChampion = (val: string) => {
    setSharedChampionState(val);
    localStorage.setItem('coach_my_champ', val);
  };

  const setSharedEnemyChampion = (val: string) => {
    setSharedEnemyChampionState(val);
    localStorage.setItem('coach_enemy_champ', val);
  };

  // 「マッチアップ」タブを廃止し、偵察(ScoutTab)がライブゲームから自分・対面の
  // チャンピオンを検知した瞬間に自動でマッチアップ分析を走らせる(#①)。
  const [scoutMatchupTrigger, setScoutMatchupTrigger] = useState(0);
  // 偵察で検出した10人分のロースターを5v5シミュレータへ自動反映する(2026-08-15、
  // 「リアルタイムで取得更新できるようにしたい」という要望への対応)。
  const [liveRoster, setLiveRoster] = useState<LiveRosterEntry[] | null>(null);
  const handleLiveMatchDetected = (myChampion: string, enemyChampion: string, roster?: LiveRosterEntry[]) => {
    setSharedChampion(myChampion);
    setSharedEnemyChampion(enemyChampion);
    setScoutMatchupTrigger(Date.now());
    if (roster && roster.length === 10) setLiveRoster(roster);
  };

  // 「今日のチェック」ボタン。試合を始める前に見る3項目(事前分析・目標・ティルト)を
  // まとめて起動する。値をインクリメントするたびに各タブのuseEffectが反応する。
  const [dailyCheckTrigger, setDailyCheckTrigger] = useState(0);
  const runDailyCheck = () => {
    setDailyCheckTrigger(Date.now());
  };

  // ステップ統合タブ構造。「BAN/PICKナビ」はシナジー/カウンター統計DBが未整備で
  // 完全なハードコードのサンプル値しか返せないダミー実装だったため撤去した(2026-08-15)。
  const [activeStepTab, setActiveStepTab] = useState<'pregame' | 'postgame' | 'menu'>('pregame');

  const STEP_TABS = [
    { id: 'pregame', label: '1. 試合前準備（事前分析・JG予測・偵察）', icon: '⚡' },
    { id: 'postgame', label: '2. 試合後分析（1分振り返り・傾向・ヒートマップ）', icon: '🔍' },
    { id: 'menu', label: '3. 週間強化（AI練習メニュー）', icon: '🏋️‍♂️' },
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
      <div
        className="min-h-screen flex items-center justify-center p-4 font-sans text-foreground bg-background"
      >
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
    <div
      className="min-h-screen px-4 py-8 font-sans text-foreground bg-background"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .animate-in { animation: fade-in 0.35s ease forwards; }
      `}</style>

      <div className="mx-auto max-w-[1600px] w-full px-4 md:px-8">
        {/* ヘッダー */}
        <div className="mb-8 text-center relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-[10px] font-extrabold mb-3 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>🟢 ライブ試合自動検知 稼働中 (Riot API連動)</span>
          </div>
          <div className="mb-2 text-4xl">🏆</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">パーソナルコーチ</h1>
          <p className="mt-1 text-xs text-stone-500 font-medium">
            Riot API × ナレッジDB × Gemini AI があなたの勝率を上げる
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <PushOptIn scope="admin" label="ポータル通知" inline />
            <button
              onClick={() => setIsReflectionModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-105 flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚡</span> 1分ソロQ振り返り
            </button>
          </div>

          {lastFocusPoint && (
            <div className="mt-4 mx-auto max-w-md bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-left shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="text-lg">🔥</span>
                <div>
                  <span className="text-[11px] font-extrabold text-amber-900 block uppercase tracking-wider">前回の試合で設定した意識テーマ</span>
                  <p className="text-xs text-stone-800 font-bold leading-relaxed">{lastFocusPoint}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  alert('🎉 意識テーマの達成おめでとうございます！モチベーションを維持して次の戦いへ！');
                  localStorage.removeItem('soloq_last_focus_point');
                  window.location.reload();
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shrink-0 transition shadow-xs active:scale-95 cursor-pointer"
                title="この目標を達成できたらタップ！"
              >
                ✅ 達成！
              </button>
            </div>
          )}
          {/* 今日の意識テーマ常駐バー */}
          <div className="mt-5 max-w-xl mx-auto">
            <FocusStickyBar />
          </div>
        </div>

        {/* 共通入力欄: 事前分析とマッチアップで別々に入力させていたのを統合 */}
        <div className="mb-6 rounded-2xl border border-stone-200/90 bg-white/90 p-5 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-stone-700">今日使うチャンピオン</label>
              <input
                value={sharedChampion}
                onChange={(e) => setSharedChampion(e.target.value)}
                placeholder="例: Graves"
                className="w-full rounded-xl border border-stone-300/80 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-stone-700">対面の敵チャンピオン</label>
              <input
                value={sharedEnemyChampion}
                onChange={(e) => setSharedEnemyChampion(e.target.value)}
                placeholder="例: Lee Sin"
                className="w-full rounded-xl border border-stone-300/80 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-stone-500 font-medium">※「事前分析」「マッチアップ」で共通して使われます（偵察でライブゲームを検知すると自動入力されます）。</p>

          <button
            onClick={runDailyCheck}
            className="mt-4 w-full rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 px-5 py-3 text-xs font-extrabold text-amber-900 transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🎯</span> 今日のチェック（事前分析・目標・ティルトを一括実行）
          </button>
        </div>

        {/* 過去の自分からの対面警戒メモ（対面チャンプ決定時に即座にハイライト表示） */}
        <MatchupWarningCard champion={sharedChampion} enemyChampion={sharedEnemyChampion} />

        {matchDetectFailCount >= 3 && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 font-medium">
            ⚠️ 試合終了の自動検知が{matchDetectFailCount}回連続で失敗しています。Riot IDの設定やRiot APIキーの有効期限を確認してください（自動ポップアップが出ない間も、下の「振り返りを記録する」から手動で記録できます）。
          </div>
        )}

        {/* 5ステップ切り替えプロ景観ナビゲーションバー（ユーザビリティ改修） */}
        <div className="mb-6 bg-white/90 border border-stone-200/90 p-2 rounded-2xl shadow-xs">
          <div className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-2 pt-1 pb-1.5">
            🎮 試合進行フェーズ（タップして切り替え）
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 touch-manipulation scrollbar-none">
            {STEP_TABS.map((tab) => {
              const isActive = activeStepTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveStepTab(tab.id as any)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 min-h-[44px] cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-md ring-2 ring-primary/40 scale-[1.01]'
                      : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900 active:scale-95'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- ステップ別メインコンテンツ --- */}
        {/*
          「🎯 今日のチェック」ボタン(runDailyCheck)はPreGameTab/GoalTab/TiltTabに
          triggerSignalを渡して一括起動する設計だが、これらは元々activeStepTabに応じて
          JSXごとマウント/アンマウントされていたため、ボタンを押した時点でその子が
          マウントされていないタブでは useEffect(triggerSignal) が発火せず「反応しない」
          バグになっていた(2026-08-04発覚)。PreGameTabは副作用のあるポーリングを
          持たないため、常時マウントしCSSで表示切替する。
          「5レーン主導権＆試合展開シミュレーター」(LanePrioritySimulator)は入力に関わらず
          固定のサンプルテキストしか返さない完全なモックだったため撤去した(2026-08-15)。
          同じ内容(レーン主導権・試合展開の予測)は下部の「5v5シミュレータ」が実データ
          (Gemini分析)で計算済みのため、そちらに一本化する。
        */}
        <div className={activeStepTab === 'pregame' ? 'space-y-6 animate-in' : 'hidden'}>
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <span>⚡</span> 事前分析 (対面対策ナレッジ)
            </h3>
            <PreGameTab champion={sharedChampion} enemyChampion={sharedEnemyChampion} triggerSignal={dailyCheckTrigger} />
          </div>
        </div>

        {activeStepTab === 'pregame' && (
          <div className="space-y-6 animate-in mt-6">
            {/* ⚡ 敵JG初動ルート＆3:30スカトル予測カンペ */}
            <JgMatchupPredictor />

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
                <FiveVFiveSimTab liveRoster={liveRoster} />
              </div>
            </div>
          </div>
        )}

        {/* MySoloQDashboard/PostGameTab/TrendsTab/GoalTab/TiltTabはいずれもマウント時に
            一度きりのfetchのみ(継続ポーリング無し)のため、常時マウントしてCSSで表示切替する。 */}
        <div className={activeStepTab === 'postgame' ? 'space-y-6 animate-in' : 'hidden'}>
            {/* 📊 your.gg連動 プレイスタイル特性カルテ */}
            <PlayerStyleRadarCard />

            {/* 📋 ふつぐ式 JGステップアップ習熟度チェックリスト */}
            <JgSkillMasteryChecklist />

            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
              <Collapsible
                title={
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <span>📊</span> マイソロQダッシュボード (過去全ログ ＆ 成績一覧)
                  </h3>
                }
              >
                <MySoloQDashboard refreshSignal={reflectionRefreshSignal} />
              </Collapsible>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>⚡</span> 直近のソロQ振り返り ＆ 実績
              </h3>
              <PostGameTab onOpenReflectionModal={() => setIsReflectionModalOpen(true)} refreshSignal={reflectionRefreshSignal} />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>📈</span> 傾向分析・目標管理・ティルト判定
              </h3>
              <TrendsTab active={activeStepTab === 'postgame'} />
              <div className="border-t border-stone-200 pt-4">
                <GoalTab triggerSignal={dailyCheckTrigger} />
              </div>
              <div className="border-t border-stone-200 pt-4">
                <TiltTab triggerSignal={dailyCheckTrigger} />
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>🗓️</span> 曜日×時間帯 勝率ヒートマップ
              </h3>
              <TimingHeatmapTab />
            </div>
        </div>

        <div className={activeStepTab === 'menu' ? 'space-y-6 animate-in' : 'hidden'}>
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <PracticeMenuTab />
          </div>
        </div>

        {/* フッター */}
        <div className="mt-10 text-center text-xs text-foreground/20">
          生成結果はナレッジDBに蓄積され、次回の精度向上に活用されます
        </div>
      </div>

      <TiltDiagnosisPopup
        isOpen={isTiltPopupOpen}
        isWin={lastMatchWin}
        onClose={() => setIsTiltPopupOpen(false)}
        onProceedToReflection={() => {
          setIsTiltPopupOpen(false);
          setIsReflectionModalOpen(true);
        }}
        onSnooze={() => {
          sessionStorage.setItem('tilt_popup_snoozed', '1');
          setIsTiltPopupOpen(false);
        }}
      />

      <SoloQReflectionModal
        isOpen={isReflectionModalOpen}
        onClose={() => setIsReflectionModalOpen(false)}
        onSaved={() => { fetchLastReflection(); setReflectionRefreshSignal((s) => s + 1); }}
      />
    </div>
  );
}
