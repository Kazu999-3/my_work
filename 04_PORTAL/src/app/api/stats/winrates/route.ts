import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';
import { normalizeRole } from '../../../../lib/roleUtils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. プレイヤー一覧を取得（登録されている約60名全員を無条件で対象）
    const { data: rawPlayers, error: pError } = await supabase
      .from('ktm_players')
      .select('name, discord_id, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup, mmr');

    if (pError || !rawPlayers) {
      throw new Error("Failed to fetch players");
    }

    const players = [...rawPlayers];

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

    // ktm_matches.id は uuid なので文字列のままMapにセット
    const matchWinMap = new Map<string, string>();
    matches.forEach((m: any) => {
      matchWinMap.set(String(m.id), m.winning_team);
    });

    // 4. データ集計用のマッピング準備 (discord_id と name_lower の両方で引けるようにする)
    const byDiscord = new Map<string, any>();
    const byNameLower = new Map<string, any>();
    players.forEach((p: any) => {
      if (p.discord_id) byDiscord.set(String(p.discord_id).trim(), p);
      if (p.name) byNameLower.set(String(p.name).trim().toLowerCase(), p);
    });

    // 試合参加者の中で ktm_players に未登録のプレイヤーも補完
    (participants || []).forEach((m: any) => {
      const dId = m.discord_id ? String(m.discord_id).trim() : '';
      const pName = m.player_name ? String(m.player_name).trim() : '';
      const pNameLower = pName.toLowerCase();
      const existing = (dId && byDiscord.get(dId)) || (pNameLower && byNameLower.get(pNameLower));
      if (!existing && pName) {
        const dummyPlayer = {
          name: pName,
          discord_id: dId || null,
          mmr: 1200,
          mmr_top: 1200,
          mmr_jg: 1200,
          mmr_mid: 1200,
          mmr_adc: 1200,
          mmr_sup: 1200,
        };
        players.push(dummyPlayer);
        if (dId) byDiscord.set(dId, dummyPlayer);
        byNameLower.set(pNameLower, dummyPlayer);
      }
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
      const dId = row.discord_id ? String(row.discord_id).trim() : '';
      const pNameLower = row.player_name ? String(row.player_name).trim().toLowerCase() : '';
      const resolved = (dId && byDiscord.get(dId)) || (pNameLower && byNameLower.get(pNameLower));
      if (!resolved) return;

      const pName = resolved.name;
      if (!statsMap[pName]) return;

      const winningTeam = matchWinMap.get(String(row.match_id));
      if (!winningTeam) return;

      const role = normalizeRole(row.role);
      const isWin = row.team === winningTeam;

      statsMap[pName].totalGames += 1;
      if (isWin) statsMap[pName].totalWins += 1;

      if (role && statsMap[pName].lanes[role]) {
        statsMap[pName].lanes[role].games += 1;
        if (isWin) statsMap[pName].lanes[role].wins += 1;
      }
    });

    // 6. 配列に変換し、総試合数が1試合以上のプレイヤーのみに絞り込んでソート（0戦除外）
    const results = Object.values(statsMap)
      .filter((p: any) => p.totalGames > 0)
      .sort((a: any, b: any) => {
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
