import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 全てのプレイヤー一覧を取得
    const { data: players, error: pError } = await supabase
      .from('ktm_players')
      .select('name, discord_id, is_active, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, mmr');

    if (pError || !players) {
      throw new Error("Failed to fetch players");
    }

    // 2. 過去の全試合の参加者を取得（1000件超に備えページネーション）
    const { data: participants, error: hError } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('player_name, discord_id, role, team, match_id')
        .range(from, to)
    );

    if (hError || !participants) {
      console.error("Failed to fetch match participants:", hError);
      throw new Error("Failed to fetch match history participants");
    }

    // 3. 試合の勝敗情報を取得
    const { data: matches, error: mError } = await supabase
      .from('ktm_matches')
      .select('id, winning_team');

    if (mError || !matches) {
      console.error("Failed to fetch matches:", mError);
      throw new Error("Failed to fetch matches");
    }

    // ktm_matches.id は uuid なので Number() に通すと全件 NaN になり、Mapのキーが
    // 事実上1つに潰れて全参加者が同じ1試合の勝敗と比較されてしまっていた。文字列のまま使う。
    const matchWinMap = new Map<string, string>();
    matches.forEach((m: any) => {
      matchWinMap.set(String(m.id), m.winning_team);
    });

    // 4. データ集計用のマッピング準備 (discord_id と name の両方で引けるようにする)
    const byDiscord = new Map<string, any>();
    const byName = new Map<string, any>();
    players.forEach((p: any) => {
      if (p.discord_id) byDiscord.set(p.discord_id, p);
      byName.set(p.name, p);
    });

    const statsMap: Record<string, any> = {};
    players.forEach((p: any) => {
      statsMap[p.name] = {
        name: p.name,
        discordId: p.discord_id,
        totalGames: 0,
        totalWins: 0,
        overallMmr: p.mmr || 1200,
        lanes: {
          TOP: { games: 0, wins: 0, mmr: p.mmr_top || 1200 },
          JG: { games: 0, wins: 0, mmr: p.mmr_jg || 1200 },
          MID: { games: 0, wins: 0, mmr: p.mmr_mid || 1200 },
          ADC: { games: 0, wins: 0, mmr: p.mmr_adc || 1200 },
          SUP: { games: 0, wins: 0, mmr: p.mmr_sup || 1200 },
        }
      };
    });

    // 5. 勝敗の集計
    participants.forEach((row: any) => {
      const resolved = (row.discord_id && byDiscord.get(row.discord_id)) || byName.get(row.player_name);
      if (!resolved) return;

      const pName = resolved.name;
      if (!statsMap[pName]) return;

      const winningTeam = matchWinMap.get(String(row.match_id));
      if (!winningTeam) return;

      let role = (row.role || '').toUpperCase();
      if (role === 'JUG' || role === 'JUNGLE') role = 'JG';
      if (role === 'BOT' || role === 'UTILITY') role = 'ADC';
      if (role === 'SUPPORT') role = 'SUP';

      const isWin = row.team === winningTeam;

      statsMap[pName].totalGames += 1;
      if (isWin) statsMap[pName].totalWins += 1;

      if (statsMap[pName].lanes[role]) {
        statsMap[pName].lanes[role].games += 1;
        if (isWin) statsMap[pName].lanes[role].wins += 1;
      }
    });

    // 6. 配列に変換し、総試合数が多い順にソート
    const results = Object.values(statsMap).sort((a, b) => {
      if (b.totalGames !== a.totalGames) {
        return b.totalGames - a.totalGames;
      }
      const aWr = a.totalGames > 0 ? a.totalWins / a.totalGames : 0;
      const bWr = b.totalGames > 0 ? b.totalWins / b.totalGames : 0;
      return bWr - aWr;
    });

    return NextResponse.json({ status: "SUCCESS", data: results });

  } catch (error: any) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ status: "ERROR", message: error.message }, { status: 500 });
  }
}
