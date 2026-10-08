'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Shield, RefreshCw, ShieldAlert, Cloud, Trophy, Coins, Database, ExternalLink } from 'lucide-react';
import WorkerStatusPanel from '../youtube/WorkerStatusPanel';

// 運用ダッシュボード（旧ポータル /admin/dashboard の移植）。2026-10-04
// 旧版の「常に稼働中」と出すカードや固定値のヘルス表示は移さず、DBの実測値だけを出す。

const LEGACY_PORTAL_URL = 'https://my-work-8jbd.vercel.app';

interface FailedTask { id: string; task_type: string; payload: any; error_message: string | null; updated_at: string }
interface CloudWorker { status?: string; summary?: string; details?: string[]; updated_at?: string }
interface Stats {
  needsAttention: { failedTasks: FailedTask[]; youtubeErrorCount: number; dictReviewCount: number };
  tasks24h: { completed: number; failed: number; pending: number; running: number };
  cloudWorkers: Record<string, CloudWorker>;
  bot: { lastRecruitmentAt: string | null };
  ktm: { activePlayers: number; totalMatches: number; recentMatches: number; latestMatchAt: string | null };
  casino: {
    totalCirculatingCoins: number;
    topPlayers: { id: number; name: string; coins: number }[];
    pendingBet: { blueAmount: number; redAmount: number; blueCount: number; redCount: number };
  };
  knowledge: { facts: number; library: number; laneGuides: number; matchupMemos: number; matchupLog: number };
  dictHealth: { verified: number; aiGenerated: number; stale: number };
  generatedAt: string;
}

const TASK_LABELS: Record<string, string> = {
  champion_trend: 'チャンピオントレンド更新',
  resolve_youtube_channel: 'YouTubeチャンネル登録',
  resolve_youtube_playlist: 'YouTubeプレイリスト登録',
  youtube_channel_monitor: 'YouTubeチャンネル監視',
  reddit_scout: 'Redditスカウト',
  lol_trend_collect: 'LoLトレンド収集',
  dict_synthesizer: '辞典シンセサイザー',
  champion_db_bulk_update: 'チャンピオン辞典一括更新',
};

const CLOUD_WORKER_LABELS: Record<string, string> = {
  youtube_worker: 'YouTube解析ワーカー',
  cloud_youtube_monitor: 'YouTube新着検知',
  prospector: '動画自動発掘',
};

function summarizeError(msg: string | null): string {
  const s = String(msg || '').toLowerCase();
  if (!s) return 'エラー詳細なし';
  if (s.includes('404') || s.includes('not found') || s.includes('private') || s.includes('deleted')) return '動画が非公開/削除済み';
  if (s.includes('timeout') || s.includes('econnreset') || s.includes('network')) return 'タイムアウト';
  if (s.includes('syntax') || s.includes('parse')) return 'JSONパース失敗';
  return '処理失敗';
}

function ago(iso: string | null | undefined): string {
  if (!iso) return '記録なし';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`;
  return `${Math.floor(sec / 86400)}日前`;
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/60',
  warn: 'bg-amber-950/30 text-amber-400 border-amber-800/60',
  error: 'bg-rose-950/30 text-rose-400 border-rose-800/60',
};

function Card({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-black text-white flex items-center gap-2">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
      <div className="text-[10px] font-bold text-slate-400">{label}</div>
      <div className="text-lg font-black text-white mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function OpsDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ops-dashboard');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setStats(json);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const retryAll = async () => {
    if (!stats || stats.needsAttention.failedTasks.length === 0) return;
    setRetrying(true);
    setRetryMessage('');
    try {
      const res = await fetch('/api/admin/tasks/retry-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: stats.needsAttention.failedTasks.map((t) => t.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '再実行に失敗しました');
      setRetryMessage(
        `${json.retried}件を再起票しました` +
        (json.skipped ? `（${json.skipped}件は対象外または待機中のため見送り）` : '') +
        (json.retried > 0 ? (json.dispatched ? '。クラウドワーカーを即時起動しました。' : '。次の定期実行で処理されます。') : '') +
        (json.errors?.length ? ` / 失敗: ${json.errors.join(', ')}` : ''),
      );
      load();
    } catch (e: any) {
      setRetryMessage(`❌ ${e.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const na = stats?.needsAttention;
  const hasAttention = !!na && (na.failedTasks.length > 0 || na.youtubeErrorCount > 0 || na.dictReviewCount > 0);
  const bet = stats?.casino.pendingBet;
  const betTotal = bet ? bet.blueAmount + bet.redAmount : 0;
  const bluePct = betTotal > 0 && bet ? Math.round((bet.blueAmount / betTotal) * 100) : 50;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-400" /> 運用ダッシュボード
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              PCワーカー・クラウドワーカー・KTM Botの稼働と、要対応タスクを実測値で一覧します（60秒ごとに自動更新）。
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="shrink-0 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {stats ? `更新（${ago(stats.generatedAt)}）` : '更新'}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/30 text-rose-400 border border-rose-800/60 text-xs font-bold">{error}</div>
        )}

        {/* 要対応 */}
        {stats && (
          hasAttention ? (
            <Card
              title="要対応"
              icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
              action={na!.failedTasks.length > 0 && (
                <button
                  onClick={retryAll}
                  disabled={retrying}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                  失敗タスクを再実行（{na!.failedTasks.length}件）
                </button>
              )}
            >
              {retryMessage && <p className="text-[11px] text-slate-300">{retryMessage}</p>}
              <div className="space-y-2">
                {na!.failedTasks.map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl bg-slate-950 border border-rose-800/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white">
                        {TASK_LABELS[t.task_type] || t.task_type}
                        {t.payload?.champion && <span className="text-slate-400 font-normal">（{t.payload.champion}{t.payload.role ? `/${t.payload.role}` : ''}）</span>}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-950/30 text-rose-400 border-rose-800/60">{summarizeError(t.error_message)}</span>
                      <span className="text-[10px] text-slate-500">{ago(t.updated_at)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1 break-all">{(t.error_message || '').slice(0, 160)}</div>
                  </div>
                ))}
                {na!.youtubeErrorCount > 0 && (
                  <Link href="/admin/youtube" className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-rose-800/40 hover:border-rose-700 text-xs">
                    <span className="font-bold text-white">YouTube動画キューのエラー（{na!.youtubeErrorCount}件）</span>
                    <span className="font-bold text-rose-400">YouTube解析へ →</span>
                  </Link>
                )}
                {na!.dictReviewCount > 0 && (
                  <Link href="/admin/dict-health" className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-rose-800/40 hover:border-rose-700 text-xs">
                    <span className="font-bold text-white">辞典の鮮度レビュー（{na!.dictReviewCount}件）</span>
                    <span className="font-bold text-rose-400">辞典ヘルスへ →</span>
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-950/30 text-emerald-400 border border-emerald-800/60 text-xs font-bold">
              要対応のタスクはありません（Gemini利用枠切れ等、時間で解消する失敗は除外しています）
            </div>
          )
        )}

        {/* PCワーカー */}
        <WorkerStatusPanel />

        {stats && (
          <>
            {/* クラウド側 */}
            <Card title="クラウドワーカー ＆ タスク実績（直近24時間）" icon={<Cloud className="w-4 h-4 text-teal-400" />}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="完了" value={stats.tasks24h.completed} />
                <Stat label="失敗" value={<span className={stats.tasks24h.failed > 0 ? 'text-rose-400' : ''}>{stats.tasks24h.failed}</span>} />
                <Stat label="待機中" value={stats.tasks24h.pending} />
                <Stat label="実行中" value={stats.tasks24h.running} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {Object.keys(stats.cloudWorkers).length === 0 && (
                  <p className="text-[11px] text-slate-500">クラウドワーカーの実行記録がありません。</p>
                )}
                {Object.entries(stats.cloudWorkers).map(([key, w]) => (
                  <div key={key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white">{CLOUD_WORKER_LABELS[key] || key}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[w.status || ''] || 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                        {w.status || '不明'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">最終実行: {ago(w.updated_at)}</div>
                    {w.details && w.details.length > 0 && (
                      <div className="text-[10px] text-slate-400 space-y-0.5 max-h-24 overflow-y-auto">
                        {w.details.slice(0, 5).map((d, i) => <div key={i} className="break-all">{d.replace(/\*\*/g, '')}</div>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* 定期カスタム・カジノ（04側の機能なのでリンクは旧ポータルへ） */}
            <Card
              title="定期カスタム ＆ カジノ"
              icon={<Trophy className="w-4 h-4 text-amber-400" />}
              action={
                <a href={`${LEGACY_PORTAL_URL}/ktm-admin`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  大会管理（旧ポータル） <ExternalLink className="w-3 h-3" />
                </a>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="登録メンバー" value={`${stats.ktm.activePlayers}名`} />
                <Stat
                  label="試合数（直近200件中）"
                  value={stats.ktm.totalMatches}
                  sub={`直近7日 +${stats.ktm.recentMatches} / 最終 ${ago(stats.ktm.latestMatchAt)}`}
                />
                <Stat label="Botの最終書き込み" value={ago(stats.bot.lastRecruitmentAt)} sub="募集(recruitments)の作成時刻" />
                <Stat label="総流通コイン" value={<span className="text-amber-400">🪙 {stats.casino.totalCirculatingCoins.toLocaleString()}</span>} />
              </div>
              {betTotal > 0 && bet && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-300">未精算の勝敗予想: {betTotal.toLocaleString()}pt（{bet.blueCount + bet.redCount}票）</div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div style={{ width: `${bluePct}%` }} className="bg-teal-500 h-full" />
                    <div style={{ width: `${100 - bluePct}%` }} className="bg-rose-500 h-full" />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-teal-400">青 {bluePct}%（{bet.blueCount}票）</span>
                    <span className="text-rose-400">赤 {100 - bluePct}%（{bet.redCount}票）</span>
                  </div>
                </div>
              )}
              {stats.casino.topPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {stats.casino.topPlayers.map((p, i) => (
                    <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                      {i + 1}. {p.name} <Coins className="inline w-3 h-3 text-amber-400" /> {p.coins.toLocaleString()}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* ナレッジ */}
            <Card title="ナレッジ ＆ 辞典" icon={<Database className="w-4 h-4 text-teal-400" />}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Stat label="辞典（統合本文あり）" value={stats.knowledge.facts} />
                <Stat label="ライブラリ記事" value={stats.knowledge.library} />
                <Stat label="レーンガイド" value={stats.knowledge.laneGuides} />
                <Stat label="対面メモ" value={stats.knowledge.matchupMemos} />
                <Stat label="対面ログ" value={stats.knowledge.matchupLog} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="検証済み" value={<span className="text-emerald-400">{stats.dictHealth.verified}</span>} />
                <Stat label="AI生成（最新パッチ）" value={stats.dictHealth.aiGenerated} />
                <Stat label="要更新（旧パッチ・空）" value={<span className={stats.dictHealth.stale > 0 ? 'text-amber-400' : ''}>{stats.dictHealth.stale}</span>} />
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
