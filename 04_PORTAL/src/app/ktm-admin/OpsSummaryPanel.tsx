"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users, TrendingUp, AlertCircle, ChevronDown, MessageCircle, BarChart2, CheckCircle2 } from "lucide-react";

// 管理画面「運営」タブ（2026-10-20）。Bot の定期実行の記録・週ごとの数字・最高ランクとメインレーンの分布。
// 中身は /api/admin/ops-summary。スマホで見る前提で、表は列を絞り、分布は横棒で出す。

type Run = { id: number; job: string; source: string; status: string; detail: any; started_at: string; finished_at: string | null };
type Week = { label: string; matches: number; people: number; firstTime: number; secondTime: number; joined: number };
type Dist = { total: number; rank: { key: string; count: number }[]; lane: { key: string; count: number }[] };
type RecruitLog = { id: string; recruitment_type: string | null; user_name: string | null; action: string; style: string | null; created_at: string };
type Summary = {
  botRuns: Run[];
  recruitLogs: RecruitLog[];
  botRunsError: string | null;
  weeks: Week[];
  monthly: { month: string; firstTime: number; cameBack: number }[];
  lapsed: { name: string; days: number; lastDay: string }[];
  distribution: { all: Dist; active: Dist };
};

const JOB_LABELS: Record<string, string> = {
  weekly_recruit: '水曜の募集カード',
  event_notify: '残り枠のお知らせ',
  check_2000: '20:00の開催判定',
  weekly_report: '月曜の週報',
};
const ACTION_LABELS: Record<string, { text: string; cls: string }> = {
  JOIN: { text: '参加', cls: 'bg-success-100 text-success-700 border-success-edge' },
  LEAVE: { text: '辞退', cls: 'bg-danger-100 text-danger-700 border-danger-edge-soft' },
  PROXY_ADD: { text: '代理で追加', cls: 'bg-primary-100 text-primary-700 border-primary-edge-soft' },
  STYLE_CHANGE: { text: '参加方法を変更', cls: 'bg-black/5 text-muted-strong border-border' },
};
const SOURCE_LABELS: Record<string, string> = { cloudflare: '本命', pg_cron: '保険', manual: '手動' };
const RANK_LABELS: Record<string, string> = {
  IRON: 'アイアン', BRONZE: 'ブロンズ', SILVER: 'シルバー', GOLD: 'ゴールド', PLATINUM: 'プラチナ', EMERALD: 'エメラルド',
  DIAMOND: 'ダイヤ', MASTER: 'マスター', GRANDMASTER: 'GM', CHALLENGER: 'チャレンジャー', UNRANKED: 'ランクなし',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(r: Run) {
  const action = r.detail?.action;
  if (r.status === 'error') return { text: '失敗', cls: 'bg-danger-100 text-danger-700 border-danger-edge-soft' };
  if (r.status === 'running') return { text: '実行中', cls: 'bg-primary-100 text-primary-700 border-primary-edge-soft' };
  if (action === 'posted') return { text: '投稿', cls: 'bg-success-100 text-success-700 border-success-edge' };
  if (action === 'skipped') return { text: '飛ばした', cls: 'bg-black/5 text-muted-strong border-border' };
  return { text: '完了', cls: 'bg-success-100 text-success-700 border-success-edge' };
}

function Bars({ items, labelOf }: { items: { key: string; count: number }[]; labelOf?: (k: string) => string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.key} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 text-foreground-subtle font-bold">{labelOf ? labelOf(i.key) : i.key}</span>
          <div className="flex-1 min-w-0 h-4 bg-black/5 rounded">
            <div className="h-4 rounded bg-primary-500/70" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-muted-strong">{i.count}人 <span className="text-faint">{Math.round((i.count / total) * 100)}%</span></span>
        </div>
      ))}
    </div>
  );
}

export default function OpsSummaryPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [showDetailSection, setShowDetailSection] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ops-summary', { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '読み込みに失敗しました');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dist = data?.distribution[scope];
  const latestWeek = data?.weeks?.[data.weeks.length - 1];
  const latestMonthly = data?.monthly?.[data.monthly.length - 1];
  const retentionPct = latestMonthly && latestMonthly.firstTime
    ? Math.round((latestMonthly.cameBack / latestMonthly.firstTime) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <span>📊</span> 運営の状況（健康診断ダッシュボード）
          </h2>
          <p className="text-xs text-muted-strong mt-0.5">
            今週のコミュニティ活気、新人の定着率、フォローが必要な常連メンバーの状況を確認できます。
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-black/5 hover:bg-black/10 text-xs font-bold disabled:opacity-50 transition cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 更新
        </button>
      </div>

      {error && <div className="p-3 rounded-xl border bg-danger-100 text-danger-700 border-danger-edge-soft text-sm">{error}</div>}
      {loading && !data && <div className="text-sm text-muted-strong p-6 text-center">データを集計中…</div>}

      {data && (
        <>
          {/* ① 【健康状態サマリー（今週の勢い）】 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* カード1: 今週の活気 */}
            <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-strong font-bold">
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-primary-600" /> 今週のアクティブ</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-500/10 text-primary-700 font-bold">最新週</span>
              </div>
              <div className="text-3xl font-black text-foreground pt-1">
                {latestWeek?.people ?? 0} <span className="text-sm font-normal text-muted-strong">名参加</span>
              </div>
              <div className="text-xs text-muted-strong flex items-center gap-2 pt-1 border-t border-border/40">
                <span>試合数: <b className="text-foreground">{latestWeek?.matches ?? 0}</b> 試合</span>
                <span className="text-faint">|</span>
                <span>直近60日計: <b className="text-foreground">{data.distribution.active.total}</b> 名</span>
              </div>
            </div>

            {/* カード2: 新規リピート定着率 */}
            <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-strong font-bold">
                <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-600" /> 新規定着率（2回目参加）</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${retentionPct >= 50 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-primary-500/10 text-primary-700'}`}>
                  {latestMonthly?.month ? `${latestMonthly.month.replace('-', '/')}月期` : '直近'}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-3xl font-black text-emerald-600">{retentionPct}%</span>
                <span className="text-xs text-muted-strong font-mono">
                  初参加 {latestMonthly?.firstTime ?? 0}名 ➔ 2回目 {latestMonthly?.cameBack ?? 0}名
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/8 overflow-hidden mt-1.5">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(retentionPct, 100)}%` }} />
              </div>
            </div>

            {/* カード3: 声かけ対象（来なくなった常連） */}
            <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-strong font-bold">
                <span className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-amber-600" /> 要フォロー常連</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-bold">30日以上未参加</span>
              </div>
              <div className="text-3xl font-black text-amber-600 pt-1">
                {data.lapsed.length} <span className="text-sm font-normal text-muted-strong">名</span>
              </div>
              <p className="text-[11px] text-muted-strong pt-1 border-t border-border/40 truncate">
                {data.lapsed.length > 0 ? '個別案内で「ひさしぶりにどう？」を送信可能' : '全員定期的に参加しています'}
              </p>
            </div>
          </div>

          {/* ② 【声かけ ＆ 参加者の動き（アクション）】 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 来なくなった常連さんリスト */}
            <section className="bg-surface border border-border rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                  <span className="text-amber-500">⏳</span>
                  <span>最近顔を出していない常連さん（{data.lapsed.length}名）</span>
                </h3>
              </div>
              <p className="text-xs text-muted-strong">
                以前よく出ていたが30日以上空いているメンバーです。「個別案内」タブで定型文「ひさしぶりにどう？」を送って気軽に誘えます。
              </p>
              {data.lapsed.length === 0 ? (
                <div className="text-xs text-muted-strong p-4 text-center border border-dashed border-border rounded-xl">
                  現在、30日以上参加が途絶えている常連はいません。
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {data.lapsed.map((p) => (
                    <span key={p.name} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl border border-border bg-black/3 shadow-2xs">
                      <span className="font-bold text-foreground">{p.name}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-500/10 px-1.5 py-0.2 rounded font-bold">{p.days}日ぶり</span>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* カスタム募集の直近の動き */}
            <section className="bg-surface border border-border rounded-2xl p-4 space-y-3 shadow-xs">
              <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                <span>⚡</span>
                <span>カスタム参加・辞退の動き（最新10件）</span>
              </h3>
              {data.recruitLogs.length === 0 ? (
                <div className="text-xs text-muted-strong p-4 text-center border border-dashed border-border rounded-xl">
                  記録がありません。
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {data.recruitLogs.slice(0, 10).map((l) => {
                    const a = ACTION_LABELS[l.action] || { text: l.action, cls: 'bg-black/5 text-muted-strong border-border' };
                    return (
                      <div key={l.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg border border-border/60 bg-black/2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-foreground truncate">{l.user_name || '名前なし'}</span>
                          {l.style && <span className="text-[10px] text-faint">({l.style})</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${a.cls}`}>{a.text}</span>
                          <span className="font-mono text-[10px] text-muted-strong">{fmtTime(l.created_at).slice(5)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ③ 【詳細データ・分析（アコーディオン折りたたみ）】 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowDetailSection(!showDetailSection)}
              className={`w-full p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between cursor-pointer shadow-2xs ${
                showDetailSection
                  ? 'bg-primary-500/10 border-primary-500 text-primary-800'
                  : 'bg-surface border-border hover:bg-black/5 text-muted-strong hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary-600" />
                <span>過去の週次推移・ランク分布・Bot実行ログを詳細表示</span>
              </div>
              <ChevronDown className={`w-4 h-4 transform transition-transform duration-300 ${showDetailSection ? 'rotate-180' : ''}`} />
            </button>

            {showDetailSection && (
              <div className="space-y-6 pt-4 animate-fade-in">
                {/* 最高ランクとメインレーンの分布 */}
                <section className="bg-surface border border-border rounded-2xl p-4 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-foreground">最高ランクとメインレーンの分布</h3>
                    <div className="flex gap-1 text-xs">
                      <button onClick={() => setScope('active')} className={`px-2.5 py-1 rounded-full border cursor-pointer ${scope === 'active' ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border hover:bg-black/5'}`}>
                        直近60日に出た人（{data.distribution.active.total}名）
                      </button>
                      <button onClick={() => setScope('all')} className={`px-2.5 py-1 rounded-full border cursor-pointer ${scope === 'all' ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border hover:bg-black/5'}`}>
                        名簿全員（{data.distribution.all.total}名）
                      </button>
                    </div>
                  </div>
                  {dist && (
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-strong">最高ランク</div>
                        <Bars items={dist.rank} labelOf={(k) => RANK_LABELS[k] || k} />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-strong">メインレーン（第1希望）</div>
                        <Bars items={dist.lane} labelOf={(k) => (k === 'ALL' ? 'どこでも' : k)} />
                      </div>
                    </div>
                  )}
                </section>

                {/* 週ごとの全履歴テーブル */}
                <section className="bg-surface border border-border rounded-2xl p-4 space-y-3 shadow-xs">
                  <h3 className="text-sm font-black text-foreground">週ごとの詳細数字（月曜はじまり・全期間）</h3>
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead className="text-muted-strong bg-black/5 rounded sticky top-0">
                        <tr className="border-b border-border">
                          <th className="p-2 text-left font-bold">週</th>
                          <th className="p-2 text-right font-bold">試合</th>
                          <th className="p-2 text-right font-bold">参加</th>
                          <th className="p-2 text-right font-bold">初参加</th>
                          <th className="p-2 text-right font-bold">2回目</th>
                          <th className="p-2 text-right font-bold">名簿入り</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {[...data.weeks].reverse().map((w, idx) => (
                          <tr key={w.label} className={`hover:bg-black/5 transition ${idx === 0 ? 'bg-primary-500/5 font-bold' : idx % 2 === 1 ? 'bg-black/2' : ''}`}>
                            <td className="p-2 font-mono whitespace-nowrap">
                              {w.label}〜
                              {idx === 0 && <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-primary-600 text-white font-bold">最新</span>}
                            </td>
                            <td className="p-2 text-right font-mono text-primary-700">{w.matches}</td>
                            <td className="p-2 text-right font-mono">{w.people}</td>
                            <td className="p-2 text-right font-mono text-emerald-600">{w.firstTime}</td>
                            <td className="p-2 text-right font-mono text-primary-600">{w.secondTime}</td>
                            <td className="p-2 text-right font-mono">{w.joined}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Bot の定期実行ログ */}
                <section className="bg-surface border border-border rounded-2xl p-4 space-y-2 shadow-xs">
                  <h3 className="text-sm font-black text-foreground">Bot の定期実行（新しい順）</h3>
                  {data.botRunsError && <div className="text-xs text-danger-700">記録の読み込みに失敗: {data.botRunsError}</div>}
                  {data.botRuns.length === 0 && !data.botRunsError && <div className="text-xs text-muted-strong">まだ記録がありません。</div>}
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {data.botRuns.map((r) => {
                      const b = statusBadge(r);
                      return (
                        <div key={r.id} className="flex items-start gap-2 text-xs border-b border-border/60 pb-1.5">
                          <span className="font-mono text-muted-strong whitespace-nowrap w-24 shrink-0">{fmtTime(r.started_at)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-foreground">
                              {JOB_LABELS[r.job] || r.job}
                              <span className="ml-1.5 text-[10px] text-faint font-normal">{SOURCE_LABELS[r.source] || r.source}</span>
                            </div>
                            {(r.detail?.reason || r.detail?.message) && <div className="text-muted-strong break-words text-[11px]">{r.detail.reason || r.detail.message}</div>}
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${b.cls}`}>{b.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
