"use client";

import { useEffect, useState } from 'react';

// 📊 カジノの収支ランキング（全員公開。2026-10-18）。データは /api/casino/profit-ranking。
// 2026-10-18: 差し引きの合計ではなく「得たコイン」「失ったコイン」を表示する形に変更（ユーザー判断）。
// 対象（全ゲーム／各ゲーム）と並び順（得た順／失った順）を選べる。

interface Cell { net: number; gained: number; lost: number; plays: number }
interface Row extends Cell { name: string; discordId: string | null; games: Record<string, Cell | undefined> }
interface Data {
  since: string;
  games: { key: string; label: string }[];
  gameTotals: { key: string; label: string; gained: number; lost: number; plays: number }[];
  players: Row[];
}

export default function ProfitRankingTab({ myDiscordId }: { myDiscordId?: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<string>('all');
  const [order, setOrder] = useState<'gained' | 'lost'>('gained');

  useEffect(() => {
    fetch('/api/casino/profit-ranking')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '取得に失敗しました');
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="max-w-4xl mx-auto text-sm rounded-xl border px-4 py-3 bg-danger-100 text-danger-700 border-danger-edge-soft">{error}</div>;
  if (!data) return <div className="max-w-4xl mx-auto text-center text-sm text-muted-strong py-10">読み込み中…</div>;

  const cellOf = (r: Row): Cell | undefined => (game === 'all' ? r : r.games[game]);
  // 選んだゲームを遊んだことがある人だけ並べる
  const rows = data.players
    .map((r) => ({ r, c: cellOf(r) }))
    .filter((x): x is { r: Row; c: Cell } => !!x.c && x.c.plays > 0)
    .sort((a, b) => b.c[order] - a.c[order]);

  const totals = game === 'all'
    ? data.gameTotals.reduce((t, g) => ({ gained: t.gained + g.gained, lost: t.lost + g.lost, plays: t.plays + g.plays }), { gained: 0, lost: 0, plays: 0 })
    : data.gameTotals.find((g) => g.key === game) || { gained: 0, lost: 0, plays: 0 };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="rounded-2xl border border-border bg-surface/80 p-4 space-y-3">
        <div>
          <h2 className="text-lg font-black text-foreground">📊 カジノ収支ランキング</h2>
          <p className="text-xs text-muted-strong mt-0.5">
            カジノで得たコイン・失ったコインの合計です（9/22 以降の記録。おみくじ・試合の報酬・チップは含みません）
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[{ key: 'all', label: '全ゲーム' }, ...data.games].map((g) => (
            <button
              key={g.key}
              onClick={() => setGame(g.key)}
              className={`px-2.5 py-1 rounded-full border whitespace-nowrap ${game === g.key ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border hover:bg-black/5'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([['gained', '得たコインが多い順'], ['lost', '失ったコインが多い順']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setOrder(k)}
                className={`px-3 py-1.5 ${order === k ? (k === 'gained' ? 'bg-success-100 text-success-700 font-bold' : 'bg-danger-100 text-danger-700 font-bold') : 'hover:bg-black/5 text-muted-strong'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="text-muted-strong">
            全員の合計: <span className="font-bold text-success-700">+{totals.gained.toLocaleString()}</span> ／ <span className="font-bold text-danger-700">−{totals.lost.toLocaleString()}</span>（{totals.plays.toLocaleString()}回）
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface/80">
        <table className="w-full text-sm min-w-[420px]">
          <thead className="text-xs text-muted-strong bg-black/5">
            <tr>
              <th className="p-2 w-10 text-center">順位</th>
              <th className="p-2 text-left">名前</th>
              <th className={`p-2 text-right ${order === 'gained' ? 'text-success-700' : ''}`}>得たコイン</th>
              <th className={`p-2 text-right ${order === 'lost' ? 'text-danger-700' : ''}`}>失ったコイン</th>
              <th className="p-2 text-right">回数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, c }, i) => {
              const isMe = !!myDiscordId && r.discordId === myDiscordId;
              return (
                <tr key={`${r.name}-${i}`} className={`border-t border-border ${isMe ? 'bg-primary-500/10' : ''}`}>
                  <td className="p-2 text-center font-bold text-muted-strong">{i + 1}</td>
                  <td className="p-2 font-bold text-foreground whitespace-nowrap">{r.name}{isMe && <span className="ml-1 text-[10px] text-primary-700">（あなた）</span>}</td>
                  <td className="p-2 text-right font-mono font-bold text-success-700">+{c.gained.toLocaleString()}</td>
                  <td className="p-2 text-right font-mono font-bold text-danger-700">−{c.lost.toLocaleString()}</td>
                  <td className="p-2 text-right font-mono text-xs text-muted-strong">{c.plays.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
