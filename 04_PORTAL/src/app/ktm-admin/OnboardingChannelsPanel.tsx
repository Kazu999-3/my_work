"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Send, ExternalLink } from "lucide-react";

// 管理画面「個別案内」タブ: 各メンバーの個別案内チャンネルの発言状況と、一斉連絡（2026-10-17）。
// 本人からの新着は pg_cron の5分おきチェックで管理者のアプリ（ポータルのプッシュ）にも通知される。

interface Row {
  channelId: string;
  channelName: string;
  ownerUserId: string;
  playerName: string | null;
  lastMessageAt: string | null;
  lastAuthorKind: 'member' | 'admin' | 'bot' | 'other' | null;
  needsReply: boolean;
  unread: boolean;
  lastPlayedAt: string | null;
  url: string;
}

const DAY = 86400e3;

interface NextCustom { title: string; startAt: string; messageUrl: string; entryIds: string[]; spectatorIds: string[] }

type FilterKey = 'all' | 'unread' | 'needsReply' | 'nextSpectator' | 'nextEntry' | 'recent60' | 'silent30';
type SortKey = 'status' | 'messageNew' | 'messageOld' | 'played' | 'name';

function ago(iso: string | null): string {
  if (!iso) return '発言なし';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600e3) return `${Math.max(1, Math.round(diff / 60e3))}分前`;
  if (diff < DAY) return `${Math.round(diff / 3600e3)}時間前`;
  return `${Math.round(diff / DAY)}日前`;
}

const KIND_LABEL: Record<string, { text: string; cls: string }> = {
  member: { text: '本人', cls: 'bg-black/5 text-muted-strong border-border' },
  admin: { text: '管理者', cls: 'bg-success-100 text-success-700 border-success-edge' },
  bot: { text: 'Bot', cls: 'bg-black/5 text-muted-strong border-border' },
  other: { text: 'その他', cls: 'bg-black/5 text-muted-strong border-border' },
};

export default function OnboardingChannelsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [mention, setMention] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [nextCustom, setNextCustom] = useState<NextCustom | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/onboarding-channels');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');
      setRows(data.channels || []);
      setNextCustom(data.nextCustom || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // フィルタ（次の定期カスタムは bot の募集カードのエントリー行から）
  const spectatorSet = useMemo(() => new Set(nextCustom?.spectatorIds || []), [nextCustom]);
  const entrySet = useMemo(() => new Set(nextCustom?.entryIds || []), [nextCustom]);
  const FILTERS: { key: FilterKey; label: string; test: (r: Row) => boolean }[] = [
    { key: 'all', label: '全員', test: () => true },
    { key: 'unread', label: '未読', test: (r) => r.unread },
    { key: 'needsReply', label: '要返信', test: (r) => r.needsReply },
    { key: 'nextSpectator', label: '次の定期カスタム: 観戦希望', test: (r) => spectatorSet.has(r.ownerUserId) },
    { key: 'nextEntry', label: '次の定期カスタム: エントリー', test: (r) => entrySet.has(r.ownerUserId) },
    { key: 'recent60', label: '直近60日に試合参加', test: (r) => !!r.lastPlayedAt && Date.now() - new Date(r.lastPlayedAt).getTime() <= 60 * DAY },
    { key: 'silent30', label: '30日以上発言なし', test: (r) => !r.lastMessageAt || Date.now() - new Date(r.lastMessageAt).getTime() > 30 * DAY },
  ];
  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];

  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  // 状態順 = 未読 → 既読・未返信 → それ以外（同じ中では最後の発言が新しい順）
  const rank = (r: Row) => (r.unread ? 0 : r.needsReply ? 1 : 2);
  const q = query.trim().toLowerCase();
  const visible = rows
    .filter((r) => activeFilter.test(r) && (!q || `${r.playerName || ''} ${r.channelName}`.toLowerCase().includes(q)))
    .sort((a, b) => {
      switch (sortKey) {
        case 'messageNew': return time(b.lastMessageAt) - time(a.lastMessageAt);
        case 'messageOld': return time(a.lastMessageAt) - time(b.lastMessageAt);
        case 'played': return time(b.lastPlayedAt) - time(a.lastPlayedAt);
        case 'name': return (a.playerName || a.channelName).localeCompare(b.playerName || b.channelName, 'ja');
        default:
          if (rank(a) !== rank(b)) return rank(a) - rank(b);
          return time(b.lastMessageAt) - time(a.lastMessageAt);
      }
    });

  const unreadCount = rows.filter((r) => r.unread).length;
  const readNoReplyCount = rows.filter((r) => r.needsReply && !r.unread).length;

  // 「返信不要」: この発言には返さなくてよいので要返信から外す（本人が新しく発言すれば戻る）
  const dismissReply = (id: string) => {
    setRows((prev) => prev.map((r) => (r.channelId === id ? { ...r, unread: false, needsReply: false } : r)));
    fetch('/api/admin/onboarding-channels/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: id, dismiss: true }),
    }).catch(() => {});
  };

  // 「開く」で既読にする（Discord の既読は読めないため、ここで開いたことを既読とみなす）
  const markRead = (id: string) => {
    setRows((prev) => prev.map((r) => (r.channelId === id ? { ...r, unread: false } : r)));
    fetch('/api/admin/onboarding-channels/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: id }),
      keepalive: true,
    }).catch(() => {});
  };

  const selectVisible = () => setSelected(new Set(visible.map((r) => r.channelId)));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const send = async () => {
    if (!content.trim() || selected.size === 0) return;
    const preview = content.trim().slice(0, 200);
    if (!window.confirm(`${selected.size}件の個別案内チャンネルに送信します。${mention ? '（本人にメンションあり）' : '（メンションなし）'}\n\n${preview}${content.trim().length > 200 ? '…' : ''}`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/onboarding-channels/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, channelIds: [...selected], mention }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      const failed = data.failed?.length || 0;
      setResult({ ok: failed === 0, text: `${data.sent}件に送信しました${failed ? `（${failed}件は失敗）` : ''}` });
      if (failed === 0) setContent('');
      load();
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">🤝 個別案内（{rows.length}件）</h2>
          <p className="text-xs text-muted-strong mt-0.5">
            未読 <span className="font-bold text-danger-700">{unreadCount}件</span> ／ 既読・未返信 <span className="font-bold text-primary-700">{readNoReplyCount}件</span>。「開く」で既読になります。本人からの新着は5分おきに確認し、アプリにも通知します
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-border bg-black/5 text-foreground hover:bg-black/5 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> 更新
        </button>
      </div>

      {/* 一斉連絡 */}
      <div className="rounded-xl border border-border bg-black/5 p-4 space-y-3">
        <div className="text-sm font-bold text-foreground">📣 一斉連絡</div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-strong">送り先: 下の一覧でチェックした人（{selected.size}件）</span>
          <button onClick={selectVisible} className="px-2.5 py-1 rounded-full border border-border hover:bg-black/5">表示中の{visible.length}件をすべて選択</button>
          <button onClick={() => setSelected(new Set())} className="px-2.5 py-1 rounded-full border border-border hover:bg-black/5">選択解除</button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          maxLength={1900}
          placeholder="各メンバーの個別案内チャンネルに Bot として投稿します"
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground placeholder:text-faint"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-strong">
            <input type="checkbox" checked={mention} onChange={(e) => setMention(e.target.checked)} />
            本人にメンションする（その人に通知が届きます）
          </label>
          <button
            onClick={send}
            disabled={sending || !content.trim() || selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40"
          >
            <Send className="h-4 w-4" /> {sending ? '送信中…' : `選択中の${selected.size}件に送信`}
          </button>
        </div>
        {result && (
          <div className={`text-xs rounded-lg border px-3 py-2 ${result.ok ? 'bg-success-100 text-success-700 border-success-edge' : 'bg-danger-100 text-danger-700 border-danger-edge-soft'}`}>
            {result.text}
          </div>
        )}
      </div>

      {error && <div className="text-sm rounded-lg border px-3 py-2 bg-danger-100 text-danger-700 border-danger-edge-soft">{error}</div>}

      {/* 絞り込み・並べ替え */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full border whitespace-nowrap ${filter === f.key ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border hover:bg-black/5'}`}
            >
              {f.label}（{rows.filter(f.test).length}）
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前で検索"
            className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-faint w-40"
          />
          <label className="flex items-center gap-1.5 text-muted-strong">
            並べ替え:
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="px-2 py-1.5 rounded-lg border border-border bg-surface text-foreground">
              <option value="status">状態順（未読→未返信）</option>
              <option value="messageNew">最後の発言が新しい順</option>
              <option value="messageOld">最後の発言が古い順</option>
              <option value="played">最後の試合が新しい順</option>
              <option value="name">名前順</option>
            </select>
          </label>
          {(filter === 'nextSpectator' || filter === 'nextEntry') && (
            nextCustom ? (
              <a href={nextCustom.messageUrl} target="_blank" rel="noopener noreferrer" className="text-secondary-700 hover:underline">
                対象: {nextCustom.title}（カードを開く）
              </a>
            ) : (
              <span className="text-danger-700">次の定期カスタムの募集カードが見つかりません</span>
            )
          )}
        </div>
      </div>

      {/* 一覧 */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-black/5 text-xs text-muted-strong">
            <tr>
              <th className="p-2 w-8"></th>
              <th className="p-2 text-left">メンバー</th>
              <th className="p-2 text-left">最後の発言</th>
              <th className="p-2 text-left">状態</th>
              <th className="p-2 text-left">話した人</th>
              <th className="p-2 text-left">最後の試合</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-strong">読み込み中…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-strong">該当する人はいません</td></tr>
            ) : visible.map((r) => {
              const kind = r.lastAuthorKind ? KIND_LABEL[r.lastAuthorKind] : null;
              return (
                <tr key={r.channelId} className="border-t border-border hover:bg-black/5">
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={selected.has(r.channelId)} onChange={() => toggle(r.channelId)} />
                  </td>
                  <td className="p-2">
                    <div className="font-bold text-foreground">{r.playerName || r.channelName}</div>
                    {r.playerName && <div className="text-[11px] text-faint">#{r.channelName}</div>}
                  </td>
                  <td className="p-2 text-foreground-subtle whitespace-nowrap">{ago(r.lastMessageAt)}</td>
                  <td className="p-2">
                    {r.unread ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap bg-danger-100 text-danger-700 border-danger-edge-soft">● 未読</span>
                    ) : r.needsReply ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap bg-primary-100 text-primary-700 border-primary-edge-soft">既読・未返信</span>
                    ) : (
                      <span className="text-faint text-xs">-</span>
                    )}
                    {r.needsReply && (
                      <button
                        onClick={() => dismissReply(r.channelId)}
                        className="ml-1.5 text-[11px] text-muted-strong underline hover:text-foreground whitespace-nowrap"
                        title="この発言には返信しなくてよいので、要返信から外します（本人が新しく発言すれば戻ります）"
                      >
                        返信不要
                      </button>
                    )}
                  </td>
                  <td className="p-2">
                    {kind ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${kind.cls}`}>{kind.text}</span> : <span className="text-faint">-</span>}
                  </td>
                  <td className="p-2 text-muted-strong whitespace-nowrap">{r.lastPlayedAt ? ago(r.lastPlayedAt) : '未参加'}</td>
                  <td className="p-2 text-right">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={() => markRead(r.channelId)} className="inline-flex items-center gap-1 text-xs text-secondary-700 hover:underline whitespace-nowrap">
                      開く <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
