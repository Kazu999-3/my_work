"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-foreground">運営の状況</h2>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-black/5 hover:bg-black/10 text-xs font-bold disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 更新
        </button>
      </div>

      {error && <div className="p-3 rounded-lg border bg-danger-100 text-danger-700 border-danger-edge-soft text-sm">{error}</div>}
      {loading && !data && <div className="text-sm text-muted-strong">読み込み中…</div>}

      {data && (
        <>
          {/* 週ごとの数字 */}
          <section className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-black text-foreground">週ごとの数字（月曜はじまり）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-strong">
                  <tr className="border-b border-border">
                    <th className="p-1.5 text-left">週</th>
                    <th className="p-1.5 text-right">試合</th>
                    <th className="p-1.5 text-right">参加</th>
                    <th className="p-1.5 text-right">初参加</th>
                    <th className="p-1.5 text-right">2回目</th>
                    <th className="p-1.5 text-right">名簿入り</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.weeks].reverse().map((w) => (
                    <tr key={w.label} className="border-b border-border/60">
                      <td className="p-1.5 font-mono whitespace-nowrap">{w.label}〜</td>
                      <td className="p-1.5 text-right font-mono">{w.matches}</td>
                      <td className="p-1.5 text-right font-mono">{w.people}</td>
                      <td className="p-1.5 text-right font-mono">{w.firstTime}</td>
                      <td className="p-1.5 text-right font-mono">{w.secondTime}</td>
                      <td className="p-1.5 text-right font-mono">{w.joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-strong">参加は、その週に1試合以上出た人数。2回目は、2日目の出場がその週だった人数。</p>
          </section>

          {/* 初参加した人がまた来たか */}
          <section className="bg-surface border border-border rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-black text-foreground">初参加した人が2回目に来たか（初参加の月ごと）</h3>
            <div className="space-y-1">
              {data.monthly.map((m) => (
                <div key={m.month} className="flex items-center justify-between text-xs border-b border-border/60 py-1">
                  <span className="font-mono">{m.month.replace('-', '/')}</span>
                  <span>初参加 <b className="font-mono">{m.firstTime}</b>人 → 2回目 <b className="font-mono">{m.cameBack}</b>人
                    <span className="text-faint ml-1">({m.firstTime ? Math.round((m.cameBack / m.firstTime) * 100) : 0}%)</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-strong">直近の月は、まだ2回目の機会が少ないので低めに出ます。</p>
          </section>

          {/* 分布 */}
          <section className="bg-surface border border-border rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-black text-foreground">最高ランクとメインレーンの分布</h3>
              <div className="flex gap-1 text-xs">
                <button onClick={() => setScope('active')} className={`px-2.5 py-1 rounded-full border ${scope === 'active' ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border'}`}>
                  直近60日に出た人（{data.distribution.active.total}）
                </button>
                <button onClick={() => setScope('all')} className={`px-2.5 py-1 rounded-full border ${scope === 'all' ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border'}`}>
                  名簿全員（{data.distribution.all.total}）
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

          {/* 来なくなった常連 */}
          <section className="bg-surface border border-border rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-black text-foreground">来なくなった常連（3日以上出場・30日以上出ていない）: {data.lapsed.length}人</h3>
            <div className="flex flex-wrap gap-1.5">
              {data.lapsed.map((p) => (
                <span key={p.name} className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-black/5">
                  {p.name} <span className="text-faint">{p.lastDay.slice(5).replace('-', '/')}・{p.days}日</span>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-strong">声をかける時は「個別案内」タブの「来なくなった常連」で絞り込み、定型文「ひさしぶりにどう？」が使えます。</p>
          </section>

          {/* カスタム募集の参加・辞退 */}
          <section className="bg-surface border border-border rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-black text-foreground">カスタム募集の参加・辞退（新しい順・40件）</h3>
            {data.recruitLogs.length === 0 && <div className="text-xs text-muted-strong">記録がありません。</div>}
            <div className="space-y-1.5">
              {data.recruitLogs.map((l) => {
                const a = ACTION_LABELS[l.action] || { text: l.action, cls: 'bg-black/5 text-muted-strong border-border' };
                return (
                  <div key={l.id} className="flex items-center gap-2 text-xs border-b border-border/60 pb-1.5">
                    <span className="font-mono text-muted-strong whitespace-nowrap w-28 shrink-0">{fmtTime(l.created_at)}</span>
                    <span className="flex-1 min-w-0 font-bold text-foreground break-words">
                      {l.user_name || '（名前なし）'}
                      {l.style && <span className="ml-1.5 text-[10px] text-faint font-normal">{l.style}</span>}
                    </span>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${a.cls}`}>{a.text}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bot の定期実行 */}
          <section className="bg-surface border border-border rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-black text-foreground">Bot の定期実行（新しい順）</h3>
            {data.botRunsError && <div className="text-xs text-danger-700">記録の読み込みに失敗: {data.botRunsError}</div>}
            {data.botRuns.length === 0 && !data.botRunsError && <div className="text-xs text-muted-strong">まだ記録がありません（10/20 から記録開始）。</div>}
            <div className="space-y-1.5">
              {data.botRuns.map((r) => {
                const b = statusBadge(r);
                return (
                  <div key={r.id} className="flex items-start gap-2 text-xs border-b border-border/60 pb-1.5">
                    <span className="font-mono text-muted-strong whitespace-nowrap w-28 shrink-0">{fmtTime(r.started_at)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground">
                        {JOB_LABELS[r.job] || r.job}
                        <span className="ml-1.5 text-[10px] text-faint font-normal">{SOURCE_LABELS[r.source] || r.source}</span>
                      </div>
                      {(r.detail?.reason || r.detail?.message) && <div className="text-muted-strong break-words">{r.detail.reason || r.detail.message}</div>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${b.cls}`}>{b.text}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
