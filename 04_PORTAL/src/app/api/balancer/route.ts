import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';
import { 
  Player, 
  Role, 
  BalanceContext, 
  selectPlayersWithPity, 
  coreBalanceTeams 
} from '../../../lib/balancer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participants } = body;
    
    if (!participants || !Array.isArray(participants) || participants.length < 10) {
      return NextResponse.json({ error: '参加者は最低10人必要です。' }, { status: 400 });
    }

    // participants: { name: string, isFixed?: boolean, fixedRole?: Role }[]

    // 1. ktm_players から該当プレイヤーの情報を取得
    const names = participants.map(p => p.name);
    const { data: playersData, error: pError } = await supabase
      .from('ktm_players')
      .select('*')
      .in('name', names);

    if (pError || !playersData) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 500 });
    }

    // 2. Player インタフェースへマッピング
    const allPlayers: Player[] = participants.map(input => {
      const dbPlayer = playersData.find(p => p.name === input.name);
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

      return {
        name: dbPlayer.name,
        discordId: dbPlayer.discord_id,
        rank: 'UNRANKED', // 必要に応じてマッピング
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
        games: 0, // 仮 (後で集計またはDBから取得)
        winRate: 50.0, // 仮
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
        .select('id, team_red_win')
        .order('created_at', { ascending: false })
        .limit(15);

      if (recentMatches && recentMatches.length > 0) {
        const matchIds = recentMatches.map(m => m.id);
        // 対面履歴・味方履歴用には、直近5試合のIDのみを抽出する
        const recent5MatchIds = recentMatches.slice(0, 5).map(m => m.id);

        const { data: participantsHistory } = await supabase
          .from('ktm_match_participants')
          .select('match_id, discord_id, role, team')
          .in('match_id', matchIds);

        if (participantsHistory) {
          // 各プレイヤーのdiscord_idからnameを引けるようにする
          const d2n: Record<string, string> = {};
          playersData.forEach(p => { if (p.discord_id) d2n[p.discord_id] = p.name; });

          const pByMatchId: Record<number, any[]> = {};
          participantsHistory.forEach(ph => {
            if (!pByMatchId[ph.match_id]) pByMatchId[ph.match_id] = [];
            pByMatchId[ph.match_id].push(ph);
          });

          for (const matchId of matchIds) {
            const matchParts = pByMatchId[matchId] || [];
            
            // Side History の構築 (直近15試合すべてを使用)
            matchParts.forEach(p => {
              const pName = d2n[p.discord_id];
              if (!pName) return;
              if (!ctx.sideHistory[pName]) ctx.sideHistory[pName] = { BLUE: 0, RED: 0 };
              if (p.team === 'BLUE') ctx.sideHistory[pName].BLUE++;
              if (p.team === 'RED') ctx.sideHistory[pName].RED++;
            });

            // Teammate History & Matchup History の構築 (直近5試合のみ使用)
            if (recent5MatchIds.includes(matchId)) {
              for (let i = 0; i < matchParts.length; i++) {
                const p1 = matchParts[i];
                const p1Name = d2n[p1.discord_id];
                if (!p1Name) continue;

                for (let j = i + 1; j < matchParts.length; j++) {
                  const p2 = matchParts[j];
                  const p2Name = d2n[p2.discord_id];
                  if (!p2Name) continue;

                  if (p1.team === p2.team) {
                    // 同じチームだった場合
                    const key1 = `${p1Name}<=>${p2Name}`;
                    const key2 = `${p2Name}<=>${p1Name}`;
                    ctx.teammateHistory.set(key1, (ctx.teammateHistory.get(key1) || 0) + 1);
                    ctx.teammateHistory.set(key2, (ctx.teammateHistory.get(key2) || 0) + 1);
                  } else {
                    // 敵同士で、かつ同じロールだった場合（対面履歴）
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
      // エラーが起きてもチーム分け自体は進行させるため握りつぶす
    }

    // 5. バランス実行
    const result = coreBalanceTeams(selected, ctx);
    
    // スピルした（選ばれなかった）プレイヤー名を観戦者として追加
    result.spectators = spectators.map(p => p.name);

    const teamBlueMMR = result.teamBlue.reduce((sum, p) => sum + p.mmr, 0);
    const teamRedMMR = result.teamRed.reduce((sum, p) => sum + p.mmr, 0);
    const mmrDiff = Math.abs(teamBlueMMR - teamRedMMR);

    return NextResponse.json({
      ...result,
      teamBlueMMR,
      teamRedMMR,
      mmrDiff
    });

  } catch (error: any) {
    console.error('Balancer API Error:', error);
    return NextResponse.json({ error: error.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
