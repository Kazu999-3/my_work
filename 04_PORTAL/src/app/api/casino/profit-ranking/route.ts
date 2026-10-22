import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';

// カジノの収支ランキング（全員公開。2026-10-18 ユーザー判断）。
// coin_transactions（2026-09-22 12:45 以降の記録しか無い）を、プレイヤー×ゲームで合計する。
export const dynamic = 'force-dynamic';

const PROFIT_GAMES = [
  { key: 'plinko', label: '💣 Plinko', reasons: ['plinko'] },
  { key: 'mines', label: '🌿 ブッシュ・スカウト', reasons: ['mines'] },
  { key: 'baccarat', label: '🃏 バカラ', reasons: ['baccarat'] },
  { key: 'slot', label: '🎰 スロット', reasons: ['slot'] },

  { key: 'scratch', label: '🎟️ スクラッチ', reasons: ['scratch_card'] },
  { key: 'bet', label: '🎯 勝敗予想', reasons: ['bet_place', 'bet_win', 'bet_payout'] },
] as const;

export type ProfitGameKey = typeof PROFIT_GAMES[number]['key'];

// gained = 払い戻しで増えた分の合計 / lost = 賭けで減った分の合計（どちらも正の数）。2026-10-18 追加
export interface ProfitCell { net: number; gained: number; lost: number; plays: number }

export interface ProfitRow extends ProfitCell {
  name: string;
  discordId: string | null;
  /** 互換用（net と同じ） */
  total: number;
  games: Partial<Record<ProfitGameKey, ProfitCell>>;
}

export async function GET() {
  try {
    const reasonToGame = new Map<string, ProfitGameKey>();
    for (const g of PROFIT_GAMES) for (const r of g.reasons) reasonToGame.set(r, g.key);

    const [{ data: tx, error }, { data: players }] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from('coin_transactions')
          .select('player_id, player_name, discord_id, reason, delta')
          .in('reason', [...reasonToGame.keys()])
          .order('id', { ascending: true })
          .range(from, to)
      ),
      supabase.from('ktm_players').select('id, name, discord_id'),
    ]);
    if (error) throw error;

    // 名前は今の名簿の名前を使う（改名しても1人にまとまるように player_id → discord_id → 記録時の名前の順で寄せる）
    const byId = new Map((players || []).map((p: any) => [p.id, p]));
    const byDiscord = new Map((players || []).filter((p: any) => p.discord_id).map((p: any) => [p.discord_id, p]));
    const rows = new Map<string, ProfitRow>();
    for (const t of tx || []) {
      const p: any = byId.get(t.player_id) || (t.discord_id && byDiscord.get(t.discord_id));
      const key = p ? `p:${p.id}` : `n:${t.player_name}`;
      const game = reasonToGame.get(t.reason)!;
      const row: ProfitRow = rows.get(key) || { name: p?.name || t.player_name || '不明', discordId: p?.discord_id || t.discord_id || null, total: 0, net: 0, gained: 0, lost: 0, plays: 0, games: {} };
      const cell: ProfitCell = row.games[game] || { net: 0, gained: 0, lost: 0, plays: 0 };
      const d = Number(t.delta) || 0;
      // 勝敗予想は「賭け」と「払い戻し」の2行になるので、回数は賭けた時だけ数える
      const isPlay = t.reason !== 'bet_win' && t.reason !== 'bet_payout';
      for (const c of [cell, row]) {
        c.net += d;
        if (d > 0) c.gained += d; else c.lost += -d;
        if (isPlay) c.plays += 1;
      }
      row.total = row.net;
      row.games[game] = cell;
      rows.set(key, row);
    }

    const list = [...rows.values()].sort((a, b) => b.total - a.total);
    const gameTotals = PROFIT_GAMES.map((g) => ({
      key: g.key,
      label: g.label,
      net: list.reduce((s, r) => s + (r.games[g.key]?.net || 0), 0),
      gained: list.reduce((s, r) => s + (r.games[g.key]?.gained || 0), 0),
      lost: list.reduce((s, r) => s + (r.games[g.key]?.lost || 0), 0),
      plays: list.reduce((s, r) => s + (r.games[g.key]?.plays || 0), 0),
    }));

    return NextResponse.json(
      { since: '2026-09-22', games: PROFIT_GAMES.map(({ key, label }) => ({ key, label })), gameTotals, players: list },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (err: any) {
    console.error('[casino/profit-ranking] error:', err);
    return NextResponse.json({ error: '収支ランキングの取得に失敗しました。' }, { status: 500 });
  }
}
