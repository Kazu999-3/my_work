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
    // 1. ktm_players から登録・未登録・アクティブ有無問わず全プレイヤーを取得
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
        console.error('[leaderboard/coins] fallback query failed:', minErr);
      } else {
        allPlayers = minData || [];
      }
    } else {
      allPlayers = pData || [];
    }

    const playerMap = new Map<string, {
      name: string;
      discordId: string;
      coins: number;
      highestRank: string;
    }>();

    // 登録者・非アクティブ関係なく全行を格納
    for (const p of allPlayers) {
      const name = (p.name || '').trim();
      const discordId = (p.discord_id || '').trim();
      const key = discordId || name.toLowerCase();
      if (!key && !name) continue;

      const coins = getPlayerCoins(p);
      const highestRank = p.highest_rank || 'UNRANKED';

      playerMap.set(key, {
        name: name || `Player_${discordId.slice(-4) || 'User'}`,
        discordId,
        coins,
        highestRank,
      });
    }

    // 2. 過去の試合参加者（ktm_match_participants）にのみ存在するユーザーも名寄せ
    try {
      const { data: participants } = await supabase
        .from('ktm_match_participants')
        .select('player_name, discord_id');

      if (participants) {
        for (const pt of participants) {
          const name = (pt.player_name || '').trim();
          const discordId = (pt.discord_id || '').trim();
          const key = discordId || name.toLowerCase();
          if (!key && !name) continue;

          if (!playerMap.has(key)) {
            playerMap.set(key, {
              name: name || `Player_${discordId.slice(-4) || 'User'}`,
              discordId,
              coins: 1000, // 初期コイン
              highestRank: 'UNRANKED',
            });
          }
        }
      }
    } catch (ptErr) {
      console.warn('[leaderboard/coins] participants fetch warning:', ptErr);
    }

    // ソート（コイン多い順）
    const sortedList = Array.from(playerMap.values()).sort((a, b) => b.coins - a.coins);

    // 順位付け
    const players: CoinRankingPlayer[] = sortedList.map((p, index) => ({
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
    return NextResponse.json(
      {
        error: err.message || 'コインランキングの取得に失敗しました',
        players: [],
        stats: { totalPlayers: 0, totalCoins: 0, avgCoins: 0 },
      },
      { status: 500 }
    );
  }
}
