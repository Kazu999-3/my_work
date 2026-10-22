"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Send, ExternalLink } from "lucide-react";

// 管理画面「個別案内」タブ: 各メンバーの個別案内チャンネルの発言状況と、一斉連絡（2026-10-17）。
// 本人からの新着は pg_cron の1時間おきチェック（migration 107）で管理者のアプリ（ポータルのプッシュ）にも通知される。

interface CustomEntryDetail {
  discordId: string;
  lanes: string[];
  isLate: boolean;
  isSingle: boolean;
}

interface NextCustom {
  title: string;
  startAt: string;
  messageUrl: string;
  entryIds: string[];
  spectatorIds: string[];
  entries?: CustomEntryDetail[];
  laneCounts?: Record<string, number>;
  neededLanes?: string[];
}

interface Row {
  channelId: string;
  channelName: string;
  ownerUserId: string;
  playerName: string | null;
  primaryLane?: string | null;
  secondaryLane?: string | null;
  rank?: string | null;
  lastMessageAt: string | null;
  lastAuthorKind: 'member' | 'admin' | 'bot' | 'other' | null;
  needsReply: boolean;
  unread: boolean;
  lastPlayedAt: string | null;
  /** 名簿に入った日 */
  joinedAt: string | null;
  /** これまでの出場回数 */
  playCount: number;
  /** 出場した夜の数（1晩に何試合出ても1） */
  playNights: number;
  firstPlayedAt: string | null;
  url: string;
  isActive?: boolean;
}

const DAY = 86400e3;

type FilterKey =
  | 'all'
  | 'unread'
  | 'needsReply'
  | 'newNoPlay'
  | 'firstTimeOnly'
  | 'lapsedRegular'
  | 'nextSpectator'
  | 'nextEntry'
  | 'neededOpponents'
  | 'recent60'
  | 'silent30'
  | string;

/** 定期カスタムの開始日時を「10/25（土）21:00」の形にする（日本時間） */
function formatCustomStart(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${wd}）${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// 一斉連絡の定型文（2026-10-20）。押すと入力欄に入り、必要なら一覧の絞り込みも切り替える。
// 本人へのメンションは「本人にメンションする」で付くので、文面には入れない。定型文を増やす時はここに足す
const MESSAGE_TEMPLATES: { key: string; label: string; hint: string; filter?: FilterKey; build: (next: NextCustom | null) => string }[] = [
  {
    key: 'firstCustomNudge',
    label: '未出場の人への声かけ',
    hint: '入って間もない・まだカスタムに出ていない人向け。押すと一覧が「未出場の新しい人」に切り替わる',
    filter: 'newNoPlay',
    build: (next) => [
      next
        ? `👋 **${formatCustomStart(next.startAt)}から週末の定期カスタムです！**`
        : '👋 **週末の定期カスタム（毎週土日 21:00〜）のお誘いです！**',
      '観戦だけ・1戦だけでも大歓迎です。気が向いたら、募集カードの「フル参加」「⏱️ 1戦のみ」「👀 観戦希望」のどれかを押してください👍',
      next ? `👉 ${next.messageUrl}` : '👉 <#1528646515533287497> の募集カードからエントリーできます',
      '当日の流れが分からなければ、ここに書き込んでくださいね🤝',
    ].join('\n'),
  },
  {
    key: 'secondVisitNudge',
    label: '初参加のお礼と次回の案内',
    hint: '初めてカスタムに出て、まだ2回目に来ていない人向け。押すと一覧が「初参加して2回目がまだ」に切り替わる',
    filter: 'firstTimeOnly',
    build: (next) => [
      '🙌 この前はカスタムに来てくれてありがとうございました！',
      next
        ? `次は **${formatCustomStart(next.startAt)}から週末の定期カスタム**があります。予定が合えば、また来てもらえると嬉しいです`
        : '週末の定期カスタム（毎週土日 21:00〜）に、また来てもらえると嬉しいです',
      next ? `👉 ${next.messageUrl}` : '👉 <#1528646515533287497> の募集カードからエントリーできます',
      '試合の結果やMMRは、ポータルの「過去の試合」で見られます: https://my-work-8jbd.vercel.app/history',
      '分からなかったこと・やりにくかったことがあれば、ここに一言もらえると助かります🤝',
    ].join('\n'),
  },
  {
    key: 'lapsedRegularNudge',
    label: 'ひさしぶりにどう？',
    hint: '以前よく出ていたのに最近来ていない人向け。押すと一覧が「来なくなった常連」に切り替わる',
    filter: 'lapsedRegular',
    build: (next) => [
      next
        ? `👋 おひさしぶりです！ **${formatCustomStart(next.startAt)}から週末の定期カスタム**があります`
        : '👋 おひさしぶりです！ 週末の定期カスタム（毎週土日 21:00〜）、また一緒にどうですか？',
      '最近は1戦だけ・途中からの参加もできるようになりました。予定が合えば、募集カードのボタンを押してもらえると嬉しいです🙌',
      next ? `👉 ${next.messageUrl}` : '👉 <#1528646515533287497> の募集カードからエントリーできます',
      '「最近こういうところが参加しにくい」などあれば、ここに一言もらえると助かります🤝',
    ].join('\n'),
  },
  {
    key: 'laneOpponentNudge',
    label: '⚔️ 対面募集のお誘い',
    hint: '今週末のエントリー状況に合わせて、不足している対面枠を募集するお誘い。押すと一覧が「不足対面の候補」に切り替わる',
    filter: 'neededOpponents',
    build: (next) => {
      const needed = next?.neededLanes || [];
      const laneStr = needed.length > 0 ? needed.join('・') : '各レーン';
      return [
        next
          ? `👋 **${formatCustomStart(next.startAt)}から週末の定期カスタムです！**`
          : '👋 **週末の定期カスタム（毎週土日 21:00〜）のお誘いです！**',
        `現在【${laneStr}】の対面枠を特に募集中です！⚔️`,
        '1戦のみや途中参加も大歓迎ですので、予定が合えばぜひ一緒にやりましょう🙌',
        next ? `👉 ${next.messageUrl}` : '👉 <#1528646515533287497> の募集カードからエントリーできます',
        '当日の流れやレーン調整など質問があれば、ここに気軽に書き込んでくださいね🤝',
      ].join('\n');
    },
  },
];
type SortKey = 'status' | 'messageNew' | 'messageOld' | 'played' | 'joined' | 'name';

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
  // 「直近60日」などの判定の基準時刻。描画中に Date.now() を呼ばないよう、読み込んだ時点の時刻を使う
  const [loadedAt, setLoadedAt] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/onboarding-channels');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');
      setRows(data.channels || []);
      setNextCustom(data.nextCustom || null);
      setLoadedAt(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // 基準時刻: loadedAt が 0 の場合でも現在時刻で評価し判定狂いを防止
  const now = loadedAt || Date.now();
  const spectatorSet = useMemo(() => new Set(nextCustom?.spectatorIds || []), [nextCustom]);
  const entrySet = useMemo(() => new Set(nextCustom?.entryIds || []), [nextCustom]);

  // レーンの一致判定（BOTとADCを同一視、ALL/FILLは全マッチ）
  const matchesLane = (rowLane: string | null | undefined, targetLane: string) => {
    if (!rowLane) return false;
    const u = rowLane.toUpperCase();
    const t = targetLane.toUpperCase();
    if (u === 'ALL' || u === 'FILL') return true;
    if ((u === 'ADC' || u === 'BOT') && (t === 'ADC' || t === 'BOT')) return true;
    return u === t;
  };

  // 未エントリーかつアクティブな候補者
  const isCandidate = (r: Row) => {
    if (r.isActive === false) return false;
    if (entrySet.has(r.ownerUserId)) return false;
    if (spectatorSet.has(r.ownerUserId)) return false;
    return true;
  };

  // 指定レーンの対面候補判定
  const isLaneOpponent = (r: Row, lane: string) => {
    if (!isCandidate(r)) return false;
    return matchesLane(r.primaryLane, lane) || matchesLane(r.secondaryLane, lane);
  };

  // 不足対面（2人未満のレーン）の候補判定
  const isNeededOpponent = (r: Row) => {
    if (!isCandidate(r)) return false;
    const needed = nextCustom?.neededLanes || [];
    return needed.some((lane) => matchesLane(r.primaryLane, lane) || matchesLane(r.secondaryLane, lane));
  };

  // 選択 ＆ フィルター連動ヘルパー
  const selectNeededOpponents = () => {
    setFilter('neededOpponents');
    const matched = rows.filter(isNeededOpponent);
    setSelected(new Set(matched.map((r) => r.channelId)));
    if (nextCustom) {
      setContent(MESSAGE_TEMPLATES.find((t) => t.key === 'laneOpponentNudge')?.build(nextCustom) || '');
    }
  };

  const selectLaneOpponents = (lane: string) => {
    const key = `laneOpponent_${lane}`;
    setFilter(key);
    const matched = rows.filter((r) => isLaneOpponent(r, lane));
    setSelected(new Set(matched.map((r) => r.channelId)));
    if (nextCustom) {
      setContent([
        `👋 **${formatCustomStart(nextCustom.startAt)}から週末の定期カスタムです！**`,
        `現在【${lane}】の対面枠を特に募集中です！⚔️`,
        '1戦のみや途中参加も大歓迎ですので、予定が合えばぜひ一緒にやりましょう🙌',
        `👉 ${nextCustom.messageUrl}`,
        '当日の流れやレーン調整など質問があれば、ここに気軽に書き込んでくださいね🤝',
      ].join('\n'));
    }
  };

  const selectPlayerOpponents = (entry: CustomEntryDetail) => {
    const key = `playerOpponent_${entry.discordId}`;
    setFilter(key);
    const primary = entry.lanes?.[0] || 'TOP';
    const matched = rows.filter((r) => isLaneOpponent(r, primary));
    setSelected(new Set(matched.map((r) => r.channelId)));
    if (nextCustom) {
      const entryRow = rows.find((r) => r.ownerUserId === entry.discordId);
      const name = entryRow?.playerName || entryRow?.channelName?.replace(/^🔒・|-案内$/g, '') || 'メンバー';
      setContent([
        `👋 **${formatCustomStart(nextCustom.startAt)}から週末の定期カスタムです！**`,
        `今週末、${name}さんが【${primary}】でエントリーしてくれています！対面で勝負してみませんか？⚔️`,
        '1戦のみや途中参加も大歓迎ですので、予定が合えばぜひ一緒にやりましょう🙌',
        `👉 ${nextCustom.messageUrl}`,
        '当日の流れなど気になることがあれば、ここに気軽に書き込んでくださいね🤝',
      ].join('\n'));
    }
  };

  const FILTERS: { key: FilterKey; label: string; test: (r: Row) => boolean }[] = [
    { key: 'all', label: '全員', test: () => true },
    { key: 'unread', label: '未読', test: (r) => !!r.unread },
    { key: 'needsReply', label: '要返信', test: (r) => !!r.needsReply },
    // 今週末のカスタムで対面が不足しているレーンの希望者（未エントリー）
    { key: 'neededOpponents', label: '⚔️ 不足対面の候補（未エントリー）', test: isNeededOpponent },
    // 入って60日以内で、まだ一度もカスタムに出ていない人（通算試合数0または最終出場なし）
    { key: 'newNoPlay', label: '未出場の新しい人（入って60日以内）', test: (r) => (!r.playCount || r.playCount === 0 || !r.lastPlayedAt) && !!r.joinedAt && now - new Date(r.joinedAt).getTime() <= 60 * DAY },
    // 初めて出た夜から60日以内で、まだ2晩目に来ていない人
    { key: 'firstTimeOnly', label: '初参加して2回目がまだ（初参加から60日以内）', test: (r) => r.playNights === 1 && !!r.firstPlayedAt && now - new Date(r.firstPlayedAt).getTime() <= 60 * DAY },
    // 以前は3晩以上出ていたのに、直近30日は出ていない人（現在アクティブな人に限定）
    { key: 'lapsedRegular', label: '来なくなった常連（3晩以上出場・30日以上出ていない）', test: (r) => r.isActive !== false && (r.playNights || 0) >= 3 && !!r.lastPlayedAt && now - new Date(r.lastPlayedAt).getTime() > 30 * DAY },
    { key: 'nextSpectator', label: '次の定期カスタム: 観戦希望', test: (r) => spectatorSet.has(r.ownerUserId) },
    { key: 'nextEntry', label: '次の定期カスタム: エントリー', test: (r) => entrySet.has(r.ownerUserId) },
    { key: 'recent60', label: '直近60日に試合参加', test: (r) => !!r.lastPlayedAt && now - new Date(r.lastPlayedAt).getTime() <= 60 * DAY },
    { key: 'silent30', label: '30日以上発言なし', test: (r) => !r.lastMessageAt || now - new Date(r.lastMessageAt).getTime() > 30 * DAY },
  ];

  // 動的対面フィルターを含む判定
  const getFilterTest = (fKey: string): { label: string; test: (r: Row) => boolean } => {
    if (fKey.startsWith('laneOpponent_')) {
      const lane = fKey.replace('laneOpponent_', '');
      return {
        label: `⚔️ ${lane}対面候補（未エントリー）`,
        test: (r) => isLaneOpponent(r, lane),
      };
    }
    if (fKey.startsWith('playerOpponent_')) {
      const dId = fKey.replace('playerOpponent_', '');
      const entry = nextCustom?.entries?.find((e) => e.discordId === dId);
      const primary = entry?.lanes?.[0] || 'TOP';
      const entryRow = rows.find((r) => r.ownerUserId === dId);
      const name = entryRow?.playerName || entryRow?.channelName?.replace(/^🔒・|-案内$/g, '') || `ID:${dId.slice(-4)}`;
      return {
        label: `⚔️ ${name}さん【${primary}】の対面候補`,
        test: (r) => isLaneOpponent(r, primary),
      };
    }
    const found = FILTERS.find((f) => f.key === fKey);
    return found ? { label: found.label, test: found.test } : { label: '全員', test: () => true };
  };

  const activeFilterInfo = getFilterTest(filter);

  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  // 状態順 = 未読 → 既読・未返信 → それ以外（同じ中では最後の発言が新しい順）
  const rank = (r: Row) => (r.unread ? 0 : r.needsReply ? 1 : 2);
  const q = query.trim().toLowerCase();
  const visible = rows
    .filter((r) => activeFilterInfo.test(r) && (!q || `${r.playerName || ''} ${r.channelName}`.toLowerCase().includes(q)))
    .sort((a, b) => {
      switch (sortKey) {
        case 'messageNew': return time(b.lastMessageAt) - time(a.lastMessageAt);
        case 'messageOld': return time(a.lastMessageAt) - time(b.lastMessageAt);
        case 'played': return time(b.lastPlayedAt) - time(a.lastPlayedAt);
        case 'joined': return time(b.joinedAt) - time(a.joinedAt);
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
            未読 <span className="font-bold text-danger-700">{unreadCount}件</span> ／ 既読・未返信 <span className="font-bold text-primary-700">{readNoReplyCount}件</span>。「開く」で既読になります。本人からの新着は1時間おきに確認し、アプリにも通知します（タブを開いた時点でも最新に更新します）
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

        {/* ⚔️ 定期カスタム対面抽出バー */}
        {nextCustom && (
          <div className="rounded-lg border border-primary-500/30 bg-primary-500/5 p-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <span>⚔️</span>
                <span>定期カスタム対面抽出（{nextCustom.title}）:</span>
              </div>
              <div className="text-muted-strong">
                エントリー済: <strong className="text-foreground">{nextCustom.entryIds?.length || 0}名</strong>
                {nextCustom.neededLanes && nextCustom.neededLanes.length > 0 && (
                  <span className="ml-2 text-amber-600 font-bold">
                    不足対面: {nextCustom.neededLanes.join('・')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-strong">一発抽出:</span>
              <button
                type="button"
                onClick={selectNeededOpponents}
                className={`px-2.5 py-1 rounded-md transition ${
                  filter === 'neededOpponents'
                    ? 'bg-amber-600 text-white font-black shadow-sm ring-2 ring-amber-400 ring-offset-1'
                    : 'bg-amber-700/80 hover:bg-amber-700 text-white font-bold shadow-2xs'
                }`}
                title="現在2名揃っていない（対面相手が不足している）レーンが得意な未エントリー者をすべて選択し、一覧を絞り込みます"
              >
                ⚔️ 不足対面をまとめて抽出（{rows.filter(isNeededOpponent).length}件）
              </button>

              {['TOP', 'JG', 'MID', 'BOT', 'SUP'].map((lane) => {
                const count = rows.filter((r) => isLaneOpponent(r, lane)).length;
                const currentCount = nextCustom.laneCounts?.[lane] || 0;
                const isActive = filter === `laneOpponent_${lane}`;
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => selectLaneOpponents(lane)}
                    className={`px-2 py-1 rounded-md transition ${
                      isActive
                        ? 'bg-primary-600 text-white font-black border-primary-600 shadow-sm ring-2 ring-primary-400 ring-offset-1'
                        : 'border border-border bg-surface hover:bg-surface-subtle text-foreground font-medium'
                    }`}
                    title={`${lane}希望（第1または第2）の未エントリー者を選択し一覧を絞り込み（現在エントリー: ${currentCount}名）`}
                  >
                    {lane}対面 ({count}件)
                  </button>
                );
              })}
            </div>

            {/* エントリー中の人ごとの指名対面抽出 */}
            {nextCustom.entries && nextCustom.entries.length > 0 && (
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                <span className="text-muted-strong">指名対面:</span>
                {nextCustom.entries.map((entry) => {
                  const entryRow = rows.find((r) => r.ownerUserId === entry.discordId);
                  const name = entryRow?.playerName || entryRow?.channelName?.replace(/^🔒・|-案内$/g, '') || `ID:${entry.discordId.slice(-4)}`;
                  const primary = entry.lanes?.[0] || 'TOP';
                  const matchCount = rows.filter((r) => isLaneOpponent(r, primary)).length;
                  const isActive = filter === `playerOpponent_${entry.discordId}`;

                  return (
                    <button
                      key={entry.discordId}
                      type="button"
                      onClick={() => selectPlayerOpponents(entry)}
                      className={`px-2 py-0.5 rounded-full transition flex items-center gap-1 ${
                        isActive
                          ? 'bg-primary-600 text-white font-black border border-primary-600 shadow-xs ring-2 ring-primary-400 ring-offset-1'
                          : 'border border-border bg-surface hover:bg-surface-subtle text-[11px] text-muted-strong hover:text-foreground'
                      }`}
                      title={`${name}さん (${primary}) と同じレーンができる未エントリー者（${matchCount}名）を選択し一覧を絞り込み`}
                    >
                      <span>{name}</span>
                      <span className={`font-bold text-[10px] ${isActive ? 'text-white' : 'text-primary-600'}`}>【{primary}】</span>
                      <span className={isActive ? 'text-white/80' : 'text-faint'}>({matchCount})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-strong">📝 定型文:</span>
          {MESSAGE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setContent(t.build(nextCustom));
                if (t.filter) setFilter(t.filter);
              }}
              title={t.hint}
              className="px-2.5 py-1 rounded-full border border-border hover:bg-black/5"
            >
              {t.label}
            </button>
          ))}
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
          {(filter.startsWith('laneOpponent_') || filter.startsWith('playerOpponent_')) && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-600 text-white font-bold border border-primary-700 shadow-xs">
              <span>{activeFilterInfo.label}（{visible.length}）</span>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="ml-1 px-1.5 py-0.2 rounded-full bg-black/20 hover:bg-black/30 text-white text-[10px]"
                title="対面フィルターを解除して全員表示に戻す"
              >
                ✕ 解除
              </button>
            </div>
          )}
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full border text-left max-w-full ${filter === f.key ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border hover:bg-black/5'}`}
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
              <option value="joined">入った日が新しい順</option>
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
        <table className="w-full text-sm sm:min-w-[720px]">
          <thead className="bg-black/5 text-xs text-muted-strong">
            <tr>
              <th className="p-2 w-8"></th>
              <th className="p-2 text-left">メンバー</th>
              <th className="p-2 text-left">最後の発言</th>
              <th className="p-2 text-left">状態</th>
              <th className="p-2 text-left hidden sm:table-cell">話した人</th>
              <th className="p-2 text-left hidden sm:table-cell">最後の試合</th>
              <th className="p-2 text-left hidden sm:table-cell">入った日</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-strong">読み込み中…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-strong">該当する人はいません</td></tr>
            ) : visible.map((r) => {
              const kind = r.lastAuthorKind ? KIND_LABEL[r.lastAuthorKind] : null;
              return (
                <tr key={r.channelId} className="border-t border-border hover:bg-black/5">
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={selected.has(r.channelId)} onChange={() => toggle(r.channelId)} />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-foreground">{r.playerName || r.channelName}</span>
                      {r.primaryLane && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-500/10 text-primary-700 border border-primary-500/20">
                          {r.primaryLane}{r.secondaryLane && r.secondaryLane !== r.primaryLane ? `/${r.secondaryLane}` : ''}
                        </span>
                      )}
                      {r.rank && (
                        <span className="text-[10px] text-faint">
                          {r.rank}
                        </span>
                      )}
                    </div>
                    {r.playerName && <div className="text-[11px] text-faint">#{r.channelName}</div>}
                    {/* スマホでは「最後の試合・入った日」の列を隠すので、名前の下にまとめて出す */}
                    <div className="sm:hidden text-[11px] text-muted-strong">試合: {r.lastPlayedAt ? ago(r.lastPlayedAt) : '未参加'} ／ 入: {r.joinedAt ? ago(r.joinedAt) : '-'}</div>
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
                  <td className="p-2 hidden sm:table-cell">
                    {kind ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${kind.cls}`}>{kind.text}</span> : <span className="text-faint">-</span>}
                  </td>
                  <td className="p-2 text-muted-strong whitespace-nowrap hidden sm:table-cell">{r.lastPlayedAt ? ago(r.lastPlayedAt) : '未参加'}</td>
                  <td className="p-2 text-muted-strong whitespace-nowrap hidden sm:table-cell">{r.joinedAt ? ago(r.joinedAt) : '-'}</td>
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
