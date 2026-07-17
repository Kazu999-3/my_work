import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { calculateNewMMR, calculateKdaScore, MmrCalcContext, calculateInitialMmr } from '../../../../lib/mmr';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export async function POST(req: Request) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
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

    // すべての参加者データを一括ロードして match_id ごとにマッピング (N+1問題の解消)
    const { data: allParticipants, error: pErr } = await supabase.from('ktm_match_participants').select('*');
    if (pErr) throw new Error("Failed to fetch participants");

    const participantsByMatch = new Map<string, any[]>();
    if (allParticipants) {
      for (const part of allParticipants) {
        const list = participantsByMatch.get(part.match_id) || [];
        list.push(part);
        participantsByMatch.set(part.match_id, list);
      }
    }

    let processedMatches = 0;
    const participantUpdates = [];
    const matchupHistoryMap = new Map<string, number>(); // "PlayerA<=>PlayerB:ROLE" -> count

    // 3. 過去の試合から順番に計算
    for (const match of allMatches) {
      const participants = participantsByMatch.get(match.id) || [];

      if (!participants || participants.length === 0) continue;

      const blueTeam = participants.filter((p: any) => p.team === 'BLUE');
      const redTeam = participants.filter((p: any) => p.team === 'RED');

      // 1. このマッチ開始時点での各プレイヤーのMMRや試合数の状態をスナップショットとして保存
      const snapshotMap = new Map<string, any>();
      for (const p of participants) {
        const memPlayer = playersMap.get(p.player_name);
        if (!memPlayer) continue;
        snapshotMap.set(p.player_name, {
          mmr_top: memPlayer.mmr_top,
          mmr_jg: memPlayer.mmr_jg,
          mmr_mid: memPlayer.mmr_mid,
          mmr_adc: memPlayer.mmr_adc,
          mmr_sup: memPlayer.mmr_sup,
          totalGames: memPlayer.totalGames,
          totalWins: memPlayer.totalWins,
          laneGames: { ...memPlayer.laneGames }
        });
      }

      const matchDeltas: {
        playerName: string;
        role: string;
        delta: number;
        kdaScore: number;
        isWin: boolean;
      }[] = [];

      for (const p of participants) {
        const memPlayer = playersMap.get(p.player_name);
        const playerSnapshot = snapshotMap.get(p.player_name);
        if (!memPlayer || !playerSnapshot) continue;

        const role = p.role.toUpperCase();
        const mmrKey = `mmr_${role.toLowerCase()}`;
        
        const opponentList = p.team === 'BLUE' ? redTeam : blueTeam;
        const opponent = opponentList.find((op: any) => op.role.toUpperCase() === role);
        let opponentMmr = 1200;
        if (opponent) {
          const oppSnapshot = snapshotMap.get(opponent.player_name);
          if (oppSnapshot) {
            opponentMmr = oppSnapshot[mmrKey] || 1200;
          }
        } else {
          opponentMmr = opponentList.reduce((acc: number, op: any) => {
            const mopSnapshot = snapshotMap.get(op.player_name);
            return acc + (mopSnapshot ? (mopSnapshot[`mmr_${op.role.toLowerCase()}`] || 1200) : 1200);
          }, 0) / (opponentList.length || 1);
        }

        // 対面相手との対面回数のシミュレーション
        let matchupCount = 0;
        let matchupKey = "";
        if (opponent) {
          matchupKey = [p.player_name, opponent.player_name].sort().join("<=>") + ":" + role;
          matchupCount = matchupHistoryMap.get(matchupKey) || 0;
        }

        const mainRank = memPlayer.highest_rank ? memPlayer.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';
        const isWin = p.team === match.winning_team;

        // 計算に必要な動的データを取得
        const numGames = playerSnapshot.laneGames[role] || 0;
        const totalGames = playerSnapshot.totalGames || 0;
        const totalWinRate = totalGames > 0 ? (playerSnapshot.totalWins / totalGames) * 100 : 50;

        const teamParticipants = participants.filter((pt: any) => pt.team === p.team);
        const teamTotalKills = teamParticipants.reduce((acc: number, curr: any) => acc + (curr.kills || 0), 0);
        
        const isDamageMvp = teamParticipants.every((pt: any) => (p.damage_dealt || 0) >= (pt.damage_dealt || 0)) && (p.damage_dealt || 0) > 0;
        const isObjectiveMvp = teamParticipants.every((pt: any) => (p.objective_damage || 0) >= (pt.objective_damage || 0)) && (p.objective_damage || 0) > 0;
        const isTankMvp = teamParticipants.every((pt: any) => (p.damage_taken || 0) >= (pt.damage_taken || 0)) && (p.damage_taken || 0) > 0;
        const isHealMvp = teamParticipants.every((pt: any) => (p.heal_shield || 0) >= (pt.heal_shield || 0)) && (p.heal_shield || 0) > 0;

        const ctx: MmrCalcContext = {
          currentMmr: playerSnapshot[mmrKey] || 1200,
          opponentMmr,
          isWin,
          kills: p.kills || 0,
          deaths: p.deaths || 0,
          assists: p.assists || 0,
          mainRank,
          numGames,
          matchupCount,
          totalWinRate,
          visionScore: p.vision_score || 0,
          cs: p.cs || 0,
          damageDealt: p.damage_dealt || 0,
          damageTaken: p.damage_taken || 0,
          objectiveDamage: p.objective_damage || 0,
          healShield: p.heal_shield || 0,
          role,
          teamTotalKills,
          isDamageMvp,
          isObjectiveMvp,
          isTankMvp,
          isHealMvp,
          csd15: p.csd15
        };

        const mmrDelta = calculateNewMMR(ctx);
        const kdaScore = calculateKdaScore(p.kills, p.deaths, p.assists);

        matchDeltas.push({
          playerName: p.player_name,
          role,
          delta: mmrDelta,
          kdaScore,
          isWin
        });

        // participants のアップデート配列に追加
        participantUpdates.push({
          id: p.id,
          match_id: p.match_id,
          player_name: p.player_name,
          role: p.role,
          team: p.team,
          champion_name: p.champion_name,
          kda_score: kdaScore,
          mmr_delta: mmrDelta
        });
      }

      // 2. 全員の計算が終わってから MMR 累積値、試合数を一括更新し、対戦数も記録する
      for (const d of matchDeltas) {
        const memPlayer = playersMap.get(d.playerName);
        if (!memPlayer) continue;

        const mmrKey = `mmr_${d.role.toLowerCase()}`;
        memPlayer[mmrKey] += d.delta;
        memPlayer.totalGames += 1;
        if (d.isWin) memPlayer.totalWins += 1;
        if (memPlayer.laneGames[d.role] !== undefined) memPlayer.laneGames[d.role] += 1;

        // 対面相手との対戦履歴カウントを更新
        const opponent = participants.find((op: any) => op.player_name !== d.playerName && op.role.toUpperCase() === d.role);
        if (opponent) {
          const matchupKey = [d.playerName, opponent.player_name].sort().join("<=>") + ":" + d.role;
          const currentCount = matchupHistoryMap.get(matchupKey) || 0;
          matchupHistoryMap.set(matchupKey, currentCount + 1);
        }
      }

      processedMatches++;
    }

    console.log(`[REBUILD] Calculated ${processedMatches} matches.`);

    // 4. 計算結果をDBに反映
    // 4-1. ktm_match_participants の一括更新 (upsertによるバルクアップデート - 100件ずつチャンク処理)
    if (participantUpdates.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < participantUpdates.length; i += chunkSize) {
        const chunk = participantUpdates.slice(i, i + chunkSize);
        const { error: upsertError } = await supabase
          .from('ktm_match_participants')
          .upsert(chunk.map(pu => ({
            id: pu.id,
            match_id: pu.match_id,
            player_name: pu.player_name,
            role: pu.role,
            team: pu.team,
            champion_name: pu.champion_name,
            kda_score: pu.kda_score,
            mmr_delta: pu.mmr_delta
          })));
        if (upsertError) {
          throw new Error(`Failed to bulk update participants at chunk ${i}: ${upsertError.message}`);
        }
      }
    }

    // 4-2. ktm_players の更新 (個別 update の並行処理)
    const playerUpdates = Array.from(playersMap.entries()).map(([name, p]) => {
      const avgMmr = Math.round((p.mmr_top + p.mmr_jg + p.mmr_mid + p.mmr_adc + p.mmr_sup) / 5);
      console.log(`[DEBUG MMR] ${name} | TOP:${p.mmr_top} JG:${p.mmr_jg} MID:${p.mmr_mid} ADC:${p.mmr_adc} SUP:${p.mmr_sup} | AVG:${avgMmr} | WINS:${p.totalWins}/${p.totalGames}`);
      return {
        id: p.id,
        mmr_top: p.mmr_top,
        mmr_jg: p.mmr_jg,
        mmr_mid: p.mmr_mid,
        mmr_adc: p.mmr_adc,
        mmr_sup: p.mmr_sup,
        mmr: avgMmr
      };
    });

    if (playerUpdates.length > 0) {
      const updatePromises = playerUpdates.map(pu =>
        supabase
          .from('ktm_players')
          .update({
            mmr_top: pu.mmr_top,
            mmr_jg: pu.mmr_jg,
            mmr_mid: pu.mmr_mid,
            mmr_adc: pu.mmr_adc,
            mmr_sup: pu.mmr_sup,
            mmr: pu.mmr
          })
          .eq('id', pu.id)
      );
      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error);
      if (firstError) throw new Error(`Failed to update players: ${firstError.error?.message || 'Unknown error'}`);
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
