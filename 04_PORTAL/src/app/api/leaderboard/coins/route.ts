import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getPlayerCoins } from '../../../../lib/playerCoins';
import { getKtmRank } from '../../../../lib/mmr';

export const dynamic = 'force-dynamic';

export interface CoinRankingPlayer {
  rank: number;
  name: string;
  discordId: string;
  coins: number;
  highestRank: string;
  rankBadge: { name: string; color: string; bg: string };
}

export interface CoinRankingResponse {
  players: CoinRankingPlayer[];
  stats: {
    totalPlayers: number;
    totalCoins: number;
    avgCoins: number;
  };
}

export async function GET() {
  try {
    // coins カラムが未マイグレーションの環境でもエラーにならないよう、
    // select('*') または存在する確実なカラムを指定
    let allPlayers: any[] = [];
    const { data: pData, error: pErr } = await supabase
      .from('ktm_players')
      .select('*');

    if (pErr) {
      console.warn('[leaderboard/coins] select(*) failed, falling back to minimal columns:', pErr);
      const { data: minData, error: minErr } = await supabase
        .from('ktm_players')
        .select('name, discord_id, highest_rank, role_preferences, metadata, is_active');

      if (minErr) {
        console.error('[leaderboard/coins] fallback query also failed:', minErr);
        throw minErr;
      }
      allPlayers = minData || [];
    } else {
      allPlayers = pData || [];
    }

    const activeList = allPlayers.filter((p: any) => p.is_active !== false);

    const sortedList = activeList
      .map((p: any) => {
        const coins = getPlayerCoins(p);
        const highestRank = p.highest_rank || 'UNRANKED';
        return {
          name: p.name || 'Unknown',
          discordId: p.discord_id || '',
          coins,
          highestRank,
          rankBadge: getKtmRank(1200),
        };
      })
      .sort((a: any, b: any) => b.coins - a.coins);

    // 順位付け
    const players: CoinRankingPlayer[] = sortedList.map((p: any, index: number) => ({
      rank: index + 1,
      name: p.name,
      discordId: p.discordId,
      coins: p.coins,
      highestRank: p.highestRank,
      rankBadge: getKtmRank(1200),
    }));

    const totalCoins = players.reduce((sum: number, p: CoinRankingPlayer) => sum + p.coins, 0);
    const totalPlayers = players.length;
    const avgCoins = totalPlayers > 0 ? Math.round(totalCoins / totalPlayers) : 0;

    const response: CoinRankingResponse = {
      players,
      stats: {
        totalPlayers,
        totalCoins,
        avgCoins,
      },
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[leaderboard/coins] Exception:', err);
    return NextResponse.json({ error: err.message || 'コインランキングの取得に失敗しました', players: [], stats: { totalPlayers: 0, totalCoins: 0, avgCoins: 0 } }, { status: 500 });
  }
}
