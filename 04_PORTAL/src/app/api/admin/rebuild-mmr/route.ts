import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { calculateNewMMR, calculateKdaScore, MmrCalcContext, calculateInitialMmr } from '../../../../lib/mmr';

export async function POST(req: Request) {
  try {
    const { adminCode } = await req.json();

    // 簡易的な管理者バリデーション
    if (adminCode !== process.env.ADMIN_CODE && adminCode !== 'rebuild-force') {
      return NextResponse.json({ status: "ERROR", message: "Unauthorized" }, { status: 401 });
    }

    console.log("[REBUILD] Starting Full MMR Rebuild Process...");

    // 1. 全プレイヤーのフェッチとMMR初期化 (メモリ上)
    const { data: allPlayers, error: pError } = await supabase.from('ktm_players').select('*');
    if (pError || !allPlayers) throw new Error("Failed to fetch players");

    const playersMap = new Map();
    for (const p of allPlayers) {
      const prefs = p.role_preferences || { primary: 'ALL', secondary: 'ALL' };
      playersMap.set(p.name, {
        id: p.id,
        name: p.name,
        highest_rank: p.highest_rank,
        role_preferences: prefs,
        mmr_top: calculateInitialMmr(p.highest_rank, 'TOP', prefs),
        mmr_jg: calculateInitialMmr(p.highest_rank, 'JG', prefs),
        mmr_mid: calculateInitialMmr(p.highest_rank, 'MID', prefs),
        mmr_adc: calculateInitialMmr(p.highest_rank, 'ADC', prefs),
        mmr_sup: calculateInitialMmr(p.highest_rank, 'SUP', prefs),
        totalGames: 0,
        totalWins: 0,
        laneGames: { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 }
      });
    }

    // 2. 全試合の取得 (作成日時昇順 = 古い順)
    const { data: allMatches, error: mError } = await supabase
      .from('ktm_matches')
      .select('id, winning_team, created_at')
      .order('created_at', { ascending: true });
    
    if (mError || !allMatches) throw new Error("Failed to fetch matches");

    let processedMatches = 0;
    const participantUpdates = [];

    // 3. 過去の試合から順番に計算
    for (const match of allMatches) {
      // 該当試合の参加者を取得
      const { data: participants, error: partError } = await supabase
        .from('ktm_match_participants')
        .select('*')
        .eq('match_id', match.id);

      if (partError || !participants || participants.length === 0) continue;

      const blueTeam = participants.filter(p => p.team === 'BLUE');
      const redTeam = participants.filter(p => p.team === 'RED');

      for (const p of participants) {
        const memPlayer = playersMap.get(p.player_name);
        if (!memPlayer) continue;

        const role = p.role.toUpperCase();
        const mmrKey = `mmr_${role.toLowerCase()}`;
        const currentMmr = memPlayer[mmrKey] || 1200;
        
        const opponentList = p.team === 'BLUE' ? redTeam : blueTeam;
        const opponent = opponentList.find(op => op.role.toUpperCase() === role);
        let opponentMmr = 1200;
        if (opponent) {
          const memOpponent = playersMap.get(opponent.player_name);
          if (memOpponent) {
            opponentMmr = memOpponent[`mmr_${opponent.role.toLowerCase()}`] || 1200;
          }
        } else {
          opponentMmr = opponentList.reduce((acc, op) => {
            const mop = playersMap.get(op.player_name);
            return acc + (mop ? (mop[`mmr_${op.role.toLowerCase()}`] || 1200) : 1200);
          }, 0) / (opponentList.length || 1);
        }

        const mainRank = memPlayer.highest_rank ? memPlayer.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';
        const isWin = p.team === match.winning_team;

        // 計算に必要な動的データを取得
        const numGames = memPlayer.laneGames[role] || 0;
        const totalGames = memPlayer.totalGames || 0;
        const totalWinRate = totalGames > 0 ? (memPlayer.totalWins / totalGames) * 100 : 50;

        const ctx: MmrCalcContext = {
          currentMmr,
          opponentMmr,
          isWin,
          kills: p.kills || 0,
          deaths: p.deaths || 0,
          assists: p.assists || 0,
          mainRank,
          numGames,
          matchupCount: 0,
          totalWinRate,
          visionScore: p.vision_score || 0,
          cs: 0,
          role
        };

        const mmrDelta = calculateNewMMR(ctx);
        const kdaScore = calculateKdaScore(p.kills, p.deaths, p.assists);

        // メモリ上のMMRを更新
        memPlayer[mmrKey] += mmrDelta;

        // 次の試合の計算のために戦績を更新
        memPlayer.totalGames += 1;
        if (isWin) memPlayer.totalWins += 1;
        if (memPlayer.laneGames[role] !== undefined) {
          memPlayer.laneGames[role] += 1;
        }

        // participants のアップデート配列に追加
        participantUpdates.push({
          id: p.id,
          kda_score: kdaScore,
          mmr_delta: mmrDelta
        });
      }

      processedMatches++;
    }

    console.log(`[REBUILD] Calculated ${processedMatches} matches.`);

    // 4. 計算結果をDBに反映
    // 4-1. ktm_match_participants の更新 (一括更新できない場合は分割)
    for (const pu of participantUpdates) {
      await supabase
        .from('ktm_match_participants')
        .update({ kda_score: pu.kda_score, mmr_delta: pu.mmr_delta })
        .eq('id', pu.id);
    }

    // 4-2. ktm_players の更新
    for (const [name, p] of playersMap.entries()) {
      const avgMmr = Math.round((p.mmr_top + p.mmr_jg + p.mmr_mid + p.mmr_adc + p.mmr_sup) / 5);
      console.log(`[DEBUG MMR] ${name} | TOP:${p.mmr_top} JG:${p.mmr_jg} MID:${p.mmr_mid} ADC:${p.mmr_adc} SUP:${p.mmr_sup} | AVG:${avgMmr} | WINS:${p.totalWins}/${p.totalGames}`);
      
      await supabase
        .from('ktm_players')
        .update({
          mmr_top: p.mmr_top,
          mmr_jg: p.mmr_jg,
          mmr_mid: p.mmr_mid,
          mmr_adc: p.mmr_adc,
          mmr_sup: p.mmr_sup,
          mmr: avgMmr
        })
        .eq('id', p.id);
    }

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: `Rebuild complete. Processed ${processedMatches} matches for ${playersMap.size} players.` 
    });

  } catch (err: any) {
    console.error("[REBUILD] Error:", err.message);
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
