import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchAllRows } from '../../../../lib/fetchAll';

interface TeamMember {
  name: string;
  currentRole?: string;
  mmr?: number;
}

export interface LaneClash {
  role: string;
  bluePlayer: string;
  redPlayer: string;
  games: number;
  blueWins: number;
  redWins: number;
  blueWinRate: number;
  headline?: string;
  badge?: string;
}

export interface FeaturedClash {
  bluePlayer: string;
  redPlayer: string;
  blueRole?: string;
  redRole?: string;
  games: number;
  blueWins: number;
  redWins: number;
  headline: string;
  subtext: string;
  type: 'NEMESIS' | 'RIVALRY' | 'LEGENDARY';
}

export interface GoldenDuo {
  teamSide: 'BLUE' | 'RED';
  player1: string;
  player2: string;
  role1?: string;
  role2?: string;
  games: number;
  wins: number;
  winRate: number;
  label: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const teamBlue: TeamMember[] = Array.isArray(body?.teamBlue) ? body.teamBlue : [];
    const teamRed: TeamMember[] = Array.isArray(body?.teamRed) ? body.teamRed : [];

    const bluePlayers = teamBlue.filter(p => p && p.name && p.name.trim());
    const redPlayers = teamRed.filter(p => p && p.name && p.name.trim());

    if (bluePlayers.length === 0 || redPlayers.length === 0) {
      return NextResponse.json({
        success: true,
        laneClashes: [],
        featuredClash: null,
        goldenDuos: [],
      });
    }

    const allNames = Array.from(new Set([...bluePlayers.map(p => p.name.trim()), ...redPlayers.map(p => p.name.trim())]));

    // 1. 10名の参加全試合レコードを取得（fetchAllRows で上限対応）
    const { data: participants, error: pErr } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('match_id, player_name, team')
        .in('player_name', allNames)
        .range(from, to)
    );

    if (pErr) throw pErr;
    if (!participants || participants.length === 0) {
      return NextResponse.json({
        success: true,
        laneClashes: [],
        featuredClash: null,
        goldenDuos: [],
      });
    }

    const matchIds = Array.from(new Set(participants.map((p: any) => p.match_id)));

    // 2. 該当試合の勝敗を一括取得
    const { data: matches, error: mErr } = await supabase
      .from('ktm_matches')
      .select('id, winning_team')
      .in('id', matchIds);

    if (mErr) throw mErr;

    const winMap = new Map<string, string>();
    (matches || []).forEach((m: any) => {
      if (m.winning_team) winMap.set(String(m.id), m.winning_team);
    });

    // 3. 試合ごとの参加マップを構築
    // match_id -> { winningTeam, players: Map<playerName, team> }
    const matchLookup = new Map<string, { winningTeam: string; players: Map<string, string> }>();
    participants.forEach((p: any) => {
      const mId = String(p.match_id);
      if (!winMap.has(mId)) return; // 勝敗未確定はスキップ
      if (!matchLookup.has(mId)) {
        matchLookup.set(mId, {
          winningTeam: winMap.get(mId)!,
          players: new Map<string, string>(),
        });
      }
      matchLookup.get(mId)!.players.set(p.player_name, p.team);
    });

    // 4. レーン対面の直接対決（TOP〜SUP）
    const ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
    const laneClashes: LaneClash[] = [];

    ROLES.forEach(role => {
      const b = bluePlayers.find(p => p.currentRole === role);
      const r = redPlayers.find(p => p.currentRole === role);
      if (!b || !r) return;

      let games = 0;
      let blueWins = 0;
      let redWins = 0;

      matchLookup.forEach(m => {
        const teamB = m.players.get(b.name);
        const teamR = m.players.get(r.name);
        // 敵同士として戦った試合のみ
        if (teamB && teamR && teamB !== teamR) {
          games += 1;
          if (teamB === m.winningTeam) {
            blueWins += 1;
          } else if (teamR === m.winningTeam) {
            redWins += 1;
          }
        }
      });

      if (games > 0) {
        const blueWinRate = Math.round((blueWins / games) * 100);
        let headline = '互角の対決';
        let badge = '⚔️ 直接対決';

        if (games >= 3) {
          if (blueWins === games) {
            headline = `${b.name}が圧倒（${games}戦全勝）`;
            badge = '👑 完全優位';
          } else if (redWins === games) {
            headline = `${r.name}が圧倒（${games}戦全勝）`;
            badge = '👑 完全優位';
          } else if (Math.abs(blueWins - redWins) <= 1) {
            headline = `白熱の好敵手対決（${blueWins}勝 - ${redWins}勝）`;
            badge = '🔥 白熱ライバル';
          } else if (blueWins > redWins) {
            headline = `${b.name}が勝ち越し（勝率${blueWinRate}%）`;
            badge = '⚔️ 勝ち越し';
          } else {
            headline = `${r.name}が勝ち越し（勝率${100 - blueWinRate}%）`;
            badge = '⚔️ 勝ち越し';
          }
        }

        laneClashes.push({
          role,
          bluePlayer: b.name,
          redPlayer: r.name,
          games,
          blueWins,
          redWins,
          blueWinRate,
          headline,
          badge,
        });
      }
    });

    // 5. 全レーン横断の注目因縁（Featured Clash）
    // Blue ✕ Red の全25ペアを計算
    interface ClashPair {
      b: TeamMember;
      r: TeamMember;
      games: number;
      blueWins: number;
      redWins: number;
      imbalance: number; // 偏り度
    }
    const allClashPairs: ClashPair[] = [];

    bluePlayers.forEach(b => {
      redPlayers.forEach(r => {
        let games = 0;
        let bWins = 0;
        let rWins = 0;

        matchLookup.forEach(m => {
          const tB = m.players.get(b.name);
          const tR = m.players.get(r.name);
          if (tB && tR && tB !== tR) {
            games += 1;
            if (tB === m.winningTeam) bWins += 1;
            else if (tR === m.winningTeam) rWins += 1;
          }
        });

        if (games >= 2) {
          allClashPairs.push({
            b,
            r,
            games,
            blueWins: bWins,
            redWins: rWins,
            imbalance: Math.abs(bWins - rWins) / games,
          });
        }
      });
    });

    let featuredClash: FeaturedClash | null = null;
    if (allClashPairs.length > 0) {
      // 優先度1: 3戦以上で極端に負け越している/勝ち越している「天敵（NEMESIS）」
      // 優先度2: 最多対戦数の「好敵手（RIVALRY）」
      const nemesisCandidates = allClashPairs
        .filter(p => p.games >= 3 && (p.blueWins === 0 || p.redWins === 0 || p.imbalance >= 0.6))
        .sort((a, b) => b.games - a.games);

      if (nemesisCandidates.length > 0) {
        const top = nemesisCandidates[0];
        const victimIsBlue = top.blueWins < top.redWins;
        const winner = victimIsBlue ? top.r.name : top.b.name;
        const loser = victimIsBlue ? top.b.name : top.r.name;
        const wWins = victimIsBlue ? top.redWins : top.blueWins;
        const lWins = victimIsBlue ? top.blueWins : top.redWins;

        featuredClash = {
          bluePlayer: top.b.name,
          redPlayer: top.r.name,
          blueRole: top.b.currentRole,
          redRole: top.r.currentRole,
          games: top.games,
          blueWins: top.blueWins,
          redWins: top.redWins,
          headline: `💥 因縁勃発！ ${loser} のリベンジなるか！？`,
          subtext: `${winner} が通算 ${top.games} 戦中 ${wWins} 勝 (${lWins} 敗) で大きく勝ち越し中！`,
          type: 'NEMESIS',
        };
      } else {
        // 最多対戦ペア
        const sortedByGames = [...allClashPairs].sort((a, b) => b.games - a.games);
        const top = sortedByGames[0];
        featuredClash = {
          bluePlayer: top.b.name,
          redPlayer: top.r.name,
          blueRole: top.b.currentRole,
          redRole: top.r.currentRole,
          games: top.games,
          blueWins: top.blueWins,
          redWins: top.redWins,
          headline: `⚔️ 運命のライバル対決（通算 ${top.games} 試合目）`,
          subtext: `BLUE側 ${top.b.name} (${top.blueWins}勝) vs RED側 ${top.r.name} (${top.redWins}勝) の熱い直接対決！`,
          type: 'RIVALRY',
        };
      }
    }

    // 6. チーム内の黄金デュオ（Golden Duo）
    const goldenDuos: GoldenDuo[] = [];

    const findTeamDuos = (teamMembers: TeamMember[], teamSide: 'BLUE' | 'RED') => {
      const candidates: GoldenDuo[] = [];
      for (let i = 0; i < teamMembers.length; i++) {
        for (let j = i + 1; j < teamMembers.length; j++) {
          const p1 = teamMembers[i];
          const p2 = teamMembers[j];
          let games = 0;
          let wins = 0;

          matchLookup.forEach(m => {
            const t1 = m.players.get(p1.name);
            const t2 = m.players.get(p2.name);
            // 同じチームとして戦った試合
            if (t1 && t2 && t1 === t2) {
              games += 1;
              if (t1 === m.winningTeam) wins += 1;
            }
          });

          if (games >= 3) {
            const winRate = Math.round((wins / games) * 100);
            if (winRate >= 60) {
              const isBotDuo = (p1.currentRole === 'ADC' && p2.currentRole === 'SUP') || (p1.currentRole === 'SUP' && p2.currentRole === 'ADC');
              const isMidJg = (p1.currentRole === 'MID' && p2.currentRole === 'JG') || (p1.currentRole === 'JG' && p2.currentRole === 'MID');
              let label = '名コンビ';
              if (isBotDuo) label = '🤝 黄金BOTデュオ';
              else if (isMidJg) label = '⚡ 息ぴったりミッドJG';
              else if (winRate >= 80) label = '👑 無敵のデュオ';

              candidates.push({
                teamSide,
                player1: p1.name,
                player2: p2.name,
                role1: p1.currentRole,
                role2: p2.currentRole,
                games,
                wins,
                winRate,
                label: `${label}（勝率${winRate}%・${wins}勝${games - wins}敗）`,
              });
            }
          }
        }
      }
      // BOTデュオまたは勝率・試合数が高いものを上位1〜2件残す
      return candidates
        .sort((a, b) => {
          if (b.winRate !== a.winRate) return b.winRate - a.winRate;
          return b.games - a.games;
        })
        .slice(0, 2);
    };

    goldenDuos.push(...findTeamDuos(bluePlayers, 'BLUE'));
    goldenDuos.push(...findTeamDuos(redPlayers, 'RED'));

    return NextResponse.json({
      success: true,
      laneClashes,
      featuredClash,
      goldenDuos,
    });
  } catch (error: any) {
    console.error('[balancer/clash] Error:', error);
    return NextResponse.json({ error: error.message || '因縁データの取得に失敗しました。' }, { status: 500 });
  }
}
