import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { 
  Player, 
  Role, 
  BalanceContext, 
  selectPlayersWithPity, 
  coreBalanceProposals 
} from '../../../lib/balancer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participants } = body;
    
    if (!participants || !Array.isArray(participants) || participants.length < 10) {
      return NextResponse.json({ error: '参加者は最低10人必要です。' }, { status: 400 });
    }

    // 1. ktm_players から該当プレイヤーの情報を取得
    const names = participants.map(p => p.name);
    const { data: playersData, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !playersData) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 500 });
    }

    // 各参加者の実際の戦績（試合数・勝率）を Supabase から取得・集計
    const { data: participantsStats, error: statsError } = await supabase
      .from('ktm_match_participants')
      .select('player_name, team, ktm_matches!inner(winning_team)')
      .in('player_name', names);

    // プレイヤー名ごとに 試合数 (games) と 勝利数 (wins) をマップ
    const playerStatsMap: Record<string, { games: number; wins: number }> = {};
    names.forEach(name => {
      playerStatsMap[name] = { games: 0, wins: 0 };
    });

    if (participantsStats && !statsError) {
      participantsStats.forEach((row: any) => {
        const name = row.player_name;
        if (playerStatsMap[name]) {
          playerStatsMap[name].games++;
          if (row.team === row.ktm_matches?.winning_team) {
            playerStatsMap[name].wins++;
          }
        }
      });
    }

    // 2. Player インタフェースへマッピング
    const allPlayers: Player[] = participants.map(input => {
      const dbPlayer = playersData.find((p: any) => p.name === input.name);
      if (!dbPlayer) throw new Error(`プレイヤーが見つかりません: ${input.name}`);
      
      const roleMap: Record<string, Role | 'ALL'> = {
        'JUNGLE': 'JG',
        'SUPPORT': 'SUP',
        'TOP': 'TOP',
        'MID': 'MID',
        'ADC': 'ADC',
        'ALL': 'ALL'
      };

      const rawPref1 = dbPlayer.role_preferences?.primary || 'ALL';
      const rawPref2 = dbPlayer.role_preferences?.secondary || 'ALL';
      const rawNg1 = dbPlayer.ng_lane_1 || '';
      const rawNg2 = dbPlayer.ng_lane_2 || '';

      const pGames = playerStatsMap[dbPlayer.name]?.games || 0;
      const pWinRate = pGames > 0 
        ? Number(((playerStatsMap[dbPlayer.name].wins / pGames) * 100).toFixed(1)) 
        : 50.0;

      return {
        name: dbPlayer.name,
        discordId: dbPlayer.discord_id,
        rank: dbPlayer.highest_rank || 'UNRANKED',
        pref1: roleMap[rawPref1] || rawPref1,
        pref2: roleMap[rawPref2] || rawPref2,
        ng1: roleMap[rawNg1] || rawNg1,
        ng2: roleMap[rawNg2] || rawNg2,
        pity: dbPlayer.pity || 0,
        off_role_pity: dbPlayer.off_role_pity || 0,
        weight: dbPlayer.weight || 2,
        allowHigher: dbPlayer.allow_higher || false,
        rates: {
          TOP: dbPlayer.mmr_top || 1200,
          JG: dbPlayer.mmr_jg || 1200,
          MID: dbPlayer.mmr_mid || 1200,
          ADC: dbPlayer.mmr_adc || 1200,
          SUP: dbPlayer.mmr_sup || 1200
        },
        games: pGames,
        winRate: pWinRate,
        isFixed: input.isFixed,
        fixedRole: input.fixedRole
      };
    });

    // 3. Pity選抜
    const { selected, spectators } = selectPlayersWithPity(allPlayers);

    if (selected.length !== 10) {
      return NextResponse.json({ error: '選抜されたプレイヤーが10人になりませんでした。' }, { status: 500 });
    }

    // 4. コンテキストデータ(履歴)の構築
    const ctx: BalanceContext = {
      history: new Set<string>(),
      teammateHistory: new Map<string, number>(),
      winStreakTeam: null,
      sideHistory: {}
    };

    try {
      // 直近15試合を取得（サイド履歴用には広く、対面履歴用には直近のみ使うため）
      const { data: recentMatches } = await supabase
        .from('ktm_matches')
        .select('id, winning_team, team_red_win')
        .order('created_at', { ascending: false })
        .limit(15);

      if (recentMatches && recentMatches.length > 0) {
        const matchIds = recentMatches.map((m: any) => m.id);
        const recent5MatchIds = recentMatches.slice(0, 5).map((m: any) => m.id);

        const { data: participantsHistory } = await supabase
          .from('ktm_match_participants')
          .select('match_id, player_name, role, team') // discord_id ではなく player_name を取得
          .in('match_id', matchIds);

        if (participantsHistory) {
          const pByMatchId: Record<number, any[]> = {};
          participantsHistory.forEach((ph: any) => {
            if (!pByMatchId[ph.match_id]) pByMatchId[ph.match_id] = [];
            pByMatchId[ph.match_id].push(ph);
          });

          // 直近2連勝した5人を特定するロジック (winStreakTeam)
          if (recentMatches && recentMatches.length >= 2) {
            const m1 = recentMatches[0];
            const m2 = recentMatches[1];
            const wTeam1 = m1.winning_team || (m1.team_red_win ? 'RED' : 'BLUE');
            const wTeam2 = m2.winning_team || (m2.team_red_win ? 'RED' : 'BLUE');

            const parts1 = pByMatchId[m1.id] || [];
            const parts2 = pByMatchId[m2.id] || [];

            const winners1 = parts1.filter((p: any) => p.team === wTeam1).map((p: any) => p.player_name).filter(Boolean);
            const winners2 = parts2.filter((p: any) => p.team === wTeam2).map((p: any) => p.player_name).filter(Boolean);

            if (winners1.length === 5 && winners2.length === 5) {
              const set1 = new Set(winners1);
              const isSame = winners2.every((name: any) => set1.has(name));
              if (isSame) {
                ctx.winStreakTeam = set1;
              }
            }
          }

          for (const matchId of matchIds) {
            const matchParts = pByMatchId[matchId] || [];
            
            // Side History の構築 (直近15試合すべてを使用、player_nameベース)
            matchParts.forEach((p: any) => {
              const pName = p.player_name;
              if (!pName) return;
              if (!ctx.sideHistory[pName]) ctx.sideHistory[pName] = { BLUE: 0, RED: 0 };
              if (p.team === 'BLUE') ctx.sideHistory[pName].BLUE++;
              if (p.team === 'RED') ctx.sideHistory[pName].RED++;
            });

            // Teammate History & Matchup History の構築 (直近5試合のみ使用、player_nameベース)
            if (recent5MatchIds.includes(matchId)) {
              for (let i = 0; i < matchParts.length; i++) {
                const p1 = matchParts[i];
                const p1Name = p1.player_name;
                if (!p1Name) continue;

                for (let j = i + 1; j < matchParts.length; j++) {
                  const p2 = matchParts[j];
                  const p2Name = p2.player_name;
                  if (!p2Name) continue;

                  if (p1.team === p2.team) {
                    const key1 = `${p1Name}<=>${p2Name}`;
                    const key2 = `${p2Name}<=>${p1Name}`;
                    ctx.teammateHistory.set(key1, (ctx.teammateHistory.get(key1) || 0) + 1);
                    ctx.teammateHistory.set(key2, (ctx.teammateHistory.get(key2) || 0) + 1);
                  } else {
                    if (p1.role === p2.role) {
                      ctx.history.add(`${p1Name}<=>${p2Name}:${p1.role}`);
                      ctx.history.add(`${p2Name}<=>${p1Name}:${p1.role}`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("履歴取得エラー:", e);
    }

    // 5. バランス実行 (3案の生成)
    const proposals = coreBalanceProposals(selected, ctx);
    
    // スピルした（選ばれなかった）プレイヤー名を観戦者として追加
    const spectatorNames = spectators.map(p => p.name);
    proposals.forEach(prop => {
      prop.spectators = spectatorNames;
    });

    return NextResponse.json({ proposals });

  } catch (error: any) {
    console.error('Balancer API Error:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
