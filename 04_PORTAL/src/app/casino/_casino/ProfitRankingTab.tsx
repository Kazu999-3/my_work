"use client";

import { useEffect, useState } from 'react';

// 📊 カジノの収支ランキング（全員公開。2026-10-18）。データは /api/casino/profit-ranking。
// 「合計」か各ゲームを選ぶと、その収支の多い順に並べ替える。

interface GameCell { net: number; plays: number }
interface Row { name: string; discordId: string | null; total: number; plays: number; games: Record<string, GameCell | undefined> }
interface Data {
  since: string;
  games: { key: string; label: string }[];
  gameTotals: { key: string; label: string; net: number; plays: number }[];
  players: Row[];
}

const fmt = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString()}`;
const tone = (n: number) => (n > 0 ? 'text-success-700' : n < 0 ? 'text-danger-700' : 'text-muted-strong');

export default function ProfitRankingTab({ myDiscordId }: { myDiscordId?: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('total');

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

  const value = (r: Row) => (sortKey === 'total' ? r.total : r.games[sortKey]?.net ?? null);
  // 選んだゲームを遊んだことがある人だけ、その収支の多い順
  const rows = data.players
    .filter((r) => value(r) !== null)
    .sort((a, b) => (value(b) as number) - (value(a) as number));

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="rounded-2xl border border-border bg-surface/80 p-4 space-y-3">
        <div>
          <h2 className="text-lg font-black text-foreground">📊 カジノ収支ランキング</h2>
          <p className="text-xs text-muted-strong mt-0.5">
            カジノで増やした・減らしたコインの合計です（9/22 以降の記録。おみくじ・試合の報酬・チップは含みません）
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[{ key: 'total', label: '合計' }, ...data.games].map((g) => (
            <button
              key={g.key}
              onClick={() => setSortKey(g.key)}
              className={`px-2.5 py-1 rounded-full border whitespace-nowrap ${sortKey === g.key ? 'bg-primary-500 text-white border-primary-edge-strong font-bold' : 'border-border hover:bg-black/5'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {sortKey !== 'total' && (() => {
          const t = data.gameTotals.find((g) => g.key === sortKey);
          return t ? (
            <p className="text-xs text-muted-strong">
              全員の合計: <span className={`font-bold ${tone(t.net)}`}>{fmt(t.net)}</span>（{t.plays.toLocaleString()}回）
            </p>
          ) : null;
        })()}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface/80">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-xs text-muted-strong bg-black/5">
            <tr>
              <th className="p-2 w-10 text-center">順位</th>
              <th className="p-2 text-left">名前</th>
              <th className={`p-2 text-right ${sortKey === 'total' ? 'text-primary-700' : ''}`}>合計</th>
              {data.games.map((g) => (
                <th key={g.key} className={`p-2 text-right whitespace-nowrap ${sortKey === g.key ? 'text-primary-700' : ''}`}>{g.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = !!myDiscordId && r.discordId === myDiscordId;
              return (
                <tr key={`${r.name}-${i}`} className={`border-t border-border ${isMe ? 'bg-primary-500/10' : ''}`}>
                  <td className="p-2 text-center font-bold text-muted-strong">{i + 1}</td>
                  <td className="p-2 font-bold text-foreground whitespace-nowrap">{r.name}{isMe && <span className="ml-1 text-[10px] text-primary-700">（あなた）</span>}</td>
                  <td className={`p-2 text-right font-mono font-bold ${tone(r.total)}`}>{fmt(r.total)}</td>
                  {data.games.map((g) => {
                    const c = r.games[g.key];
                    return (
                      <td key={g.key} className={`p-2 text-right font-mono text-xs ${c ? tone(c.net) : 'text-faint'}`} title={c ? `${c.plays}回` : ''}>
                        {c ? fmt(c.net) : '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
