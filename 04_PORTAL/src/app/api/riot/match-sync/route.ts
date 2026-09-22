import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchMatchDetails } from '../../../../lib/riot';
import { calculateNewMMRDetailed, calculateKdaScore, MmrCalcContext, computeRepresentativeMmr } from '../../../../lib/mmr';
import { verifyBotSecret } from '../../../../lib/botAuth';
import { fetchAllRows } from '../../../../lib/fetchAll';

export async function POST(req: Request) {
  try {
  // ===== Bot共有シークレット確認 (未設定の間はfail-open) =====
  const authResult = verifyBotSecret(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const { matchId } = await req.json(); // ktm_matches の ID

    if (!matchId) {
      return NextResponse.json({ status: "ERROR", message: "Missing matchId" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // 1. DBから試合と参加者を取得
    const { data: match, error: matchError } = await supabase
      .from('ktm_matches')
      .select('*, ktm_match_participants(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      throw new Error("Match not found in DB.");
    }

    if (!match.riot_match_id) {
      // 本来は participants の puuid から直近のカスタムゲームを引く処理が必要だが、
      // MVPとして match.riot_match_id が入っている前提か、ここでエラーにする
      // （Discordボット側の実装による）
      throw new Error("This match doesn't have a Riot Match ID associated yet.");
    }

    // 2. Riot APIから試合詳細を取得
    const riotDetails = await fetchMatchDetails(match.riot_match_id, apiKey);

    // 3. DBの各プレイヤーに対して再計算
    const participants = match.ktm_match_participants;
    
    // （プレイヤー情報と過去勝率の取得処理は、本来 record/route.ts と同様に行う必要があるが、
    // 　今回は簡易的に参加者の現在のMMRから逆算、または取得し直す）
    const names = participants.map((p: any) => p.player_name);
    const { data: dbPlayers } = await supabase.from('ktm_players').select('*').in('name', names);
    
    // 過去の勝率・試合数を取得（1000件超に備えページネーション）
    const { data: historyData } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('match_id, player_name, role, team, ktm_matches!inner(winning_team)')
        .in('player_name', names)
        .range(from, to)
    );

    const statsMap: Record<string, { roleGames: Record<string, number>, totalGames: number, totalWins: number }> = {};
    names.forEach((name: string) => {
      statsMap[name] = { roleGames: {}, totalGames: 0, totalWins: 0 };
    });

    if (historyData) {
      historyData.forEach((row: any) => {
        const pName = row.player_name;
        const role = row.role;
        const isWin = row.team === row.ktm_matches.winning_team;
        if (!statsMap[pName]) return;
        
        statsMap[pName].totalGames += 1;
        if (isWin) statsMap[pName].totalWins += 1;
        statsMap[pName].roleGames[role] = (statsMap[pName].roleGames[role] || 0) + 1;
      });
    }

    const updates = [];

    for (const p of participants) {
      const dbP = dbPlayers?.find((dp: any) => dp.name === p.player_name);
      if (!dbP) continue;

      // DBのpuuidとRiotのpuuidでマッチング。puuidがなければ簡易マッチング
      const riotP = riotDetails.participants.find((rp: any) => {
        if (dbP.puuid && rp.puuid === dbP.puuid) return true;

        const isRed = rp.teamId === 200;
        const dbIsRed = p.team === 'RED';
        if (isRed !== dbIsRed) return false;

        const dbRole = p.role.toUpperCase();
        const rpLane = rp.lane.toUpperCase();
        if (dbRole === 'TOP' && rpLane.includes('TOP')) return true;
        if (dbRole === 'JG' && rpLane.includes('JUNGLE')) return true;
        if (dbRole === 'MID' && rpLane.includes('MIDDLE')) return true;
        if (dbRole === 'ADC' && rpLane.includes('BOTTOM')) return true;
        if (dbRole === 'SUP' && rpLane.includes('UTILITY')) return true;
        
        return false;
      });

      if (!riotP) continue;

      const currentMmr = Number(dbP[`mmr_${p.role.toLowerCase()}`]) || 1200;
      // 簡易登録されたMMRから、その時の変動値を引いて試合前のベースMMRを復元する（二重加算を防止）
      const baseMmr = currentMmr - (p.mmr_delta || 0);
      const mainRank = dbP.highest_rank ? dbP.highest_rank.split(' ')[0].toUpperCase() : 'UNRANKED';

      // 対面相手の特定とMMRの取得
      const opponent = participants.find((pt: any) => pt.role === p.role && pt.team !== p.team);
      let opponentMmr = 1200;
      let oppBaseMmr = 1200;
      if (opponent) {
        const oppDbP = dbPlayers?.find((dp: any) => dp.name === opponent.player_name);
        if (oppDbP) {
          opponentMmr = Number(oppDbP[`mmr_${opponent.role.toLowerCase()}`]) || 1200;
          oppBaseMmr = opponentMmr - (opponent.mmr_delta || 0);
        }
      }

      // 対面回数の計算
      let matchupCount = 0;
      if (historyData && opponent) {
        const myMatches = historyData.filter((r: any) => r.player_name === p.player_name && r.role === p.role);
        const oppMatches = historyData.filter((r: any) => r.player_name === opponent.player_name && r.role === p.role);
        myMatches.forEach((myM: any) => {
          const matchedOpp = oppMatches.find((oppM: any) => oppM.match_id === myM.match_id && oppM.team !== myM.team);
          if (matchedOpp) {
            matchupCount++;
          }
        });
      }

      const pStats = statsMap[p.player_name] || { roleGames: {}, totalGames: 0, totalWins: 0 };
      const numGames = pStats.roleGames[p.role] || 0;
      const totalWinRate = pStats.totalGames > 0 ? (pStats.totalWins / pStats.totalGames) * 100 : 50;

      const teamRiotParticipants = riotDetails.participants.filter((rp: any) => rp.teamId === riotP.teamId);
      const teamTotalKills = teamRiotParticipants.reduce((acc: number, curr: any) => acc + (curr.kills || 0), 0);
      
      const isDamageMvp = teamRiotParticipants.every((rp: any) => (riotP.damageDealtToChampions || 0) >= (rp.damageDealtToChampions || 0)) && (riotP.damageDealtToChampions || 0) > 0;
      const isObjectiveMvp = teamRiotParticipants.every((rp: any) => (riotP.damageDealtToObjectives || 0) >= (rp.damageDealtToObjectives || 0)) && (riotP.damageDealtToObjectives || 0) > 0;
      const isTankMvp = teamRiotParticipants.every((rp: any) => (riotP.totalDamageTaken || 0) >= (rp.totalDamageTaken || 0)) && (riotP.totalDamageTaken || 0) > 0;
      const isHealMvp = teamRiotParticipants.every((rp: any) => (riotP.totalHeal || 0) >= (rp.totalHeal || 0)) && (riotP.totalHeal || 0) > 0;

      const ctx: MmrCalcContext = {
        currentMmr: baseMmr,
        opponentMmr: oppBaseMmr,
        isWin: p.team === match.winning_team,
        kills: riotP.kills,
        deaths: riotP.deaths,
        assists: riotP.assists,
        mainRank,
        numGames,
        matchupCount,
        totalWinRate,
        visionScore: riotP.visionScore || 0,
        cs: (riotP.totalMinionsKilled || 0) + (riotP.neutralMinionsKilled || 0),
        damageDealt: riotP.damageDealtToChampions || 0,
        damageTaken: riotP.totalDamageTaken || 0,
        objectiveDamage: riotP.damageDealtToObjectives || 0,
        healShield: riotP.totalHeal || 0,
        role: p.role,
        teamTotalKills,
        isDamageMvp,
        isObjectiveMvp,
        isTankMvp,
        isHealMvp,
        csd15: p.csd15
      };

      // ⚠️ 2026-09-23 修正: 以前は calculateNewMMR() を使っており mmr_delta しか作らず、
      // 保存時も mmr_breakdown を更新していなかった。その結果、/api/match/record が
      // 最初に書いた内訳が残り続け、match-sync が delta を再計算するたびに
      // **mmr_delta と mmr_breakdown.final が食い違っていった**（実測133件、最大16ポイント差）。
      // Detailed 版に切り替えて、変動値と内訳を必ずセットで更新する。
      const { delta: mmrDelta, breakdown: mmrBreakdown } = calculateNewMMRDetailed(ctx);
      const kdaScore = calculateKdaScore(riotP.kills, riotP.deaths, riotP.assists);

      // Riot API の実際のレーン情報をマッピング
      let mappedRole = p.role; // デフォルトは元のロール
      const tp = (riotP.lane || "").toUpperCase();
      if (tp.includes("TOP")) mappedRole = "TOP";
      else if (tp.includes("JUNGLE")) mappedRole = "JG";
      else if (tp.includes("MIDDLE") || tp.includes("MID")) mappedRole = "MID";
      else if (tp.includes("BOTTOM")) mappedRole = "ADC";
      else if (tp.includes("UTILITY")) mappedRole = "SUP";

      const pUpdate = {
        id: p.id,
        kills: riotP.kills,
        deaths: riotP.deaths,
        assists: riotP.assists,
        vision_score: riotP.visionScore || 0,
        kda_score: kdaScore,
        mmr_delta: mmrDelta,
        champion_name: riotP.championName,
        mmr_breakdown: mmrBreakdown,
        // ジャックポット総取り判定に使う。Riot Match-V5 の participant.pentaKills。
        // migration 80 で penta_kills 列を追加するまで保存先が無く、判定が動かなかった。
        penta_kills: Number(riotP.pentaKills) || 0,
        player_name: p.player_name,
        discord_id: p.discord_id || null,
        team: p.team, // ジャックポットの勝利条件判定に使う（DBへは書き戻さない）
        role: mappedRole // 実際のレーンで上書き
      };
      
      updates.push(pUpdate);

      const baseUpdate = {
        kills: pUpdate.kills,
        deaths: pUpdate.deaths,
        assists: pUpdate.assists,
        vision_score: pUpdate.vision_score,
        kda_score: pUpdate.kda_score,
        mmr_delta: pUpdate.mmr_delta,
        mmr_breakdown: pUpdate.mmr_breakdown,
        champion_name: pUpdate.champion_name,
        role: pUpdate.role
      };

      // penta_kills は migration 80 で追加した列。未適用の環境で更新全体が失敗し、
      // kills/deaths/assists まで保存されなくなる事故を防ぐため、
      // 列ありで試して失敗したら列なしで再試行する。
      const { error: updErr } = await supabase
        .from('ktm_match_participants')
        .update({ ...baseUpdate, penta_kills: pUpdate.penta_kills })
        .eq('id', p.id);

      if (updErr) {
        console.warn('[match-sync] penta_kills を含む更新に失敗。列なしで再試行します:', updErr.message);
        await supabase
          .from('ktm_match_participants')
          .update(baseUpdate)
          .eq('id', p.id);
      }

      // プレイヤーデータベース (ktm_players) の該当ロールMMRおよび全体平均MMRを更新する
      const roleMmrKey = `mmr_${p.role.toLowerCase()}`;
      const newRoleMmr = baseMmr + mmrDelta;
      
      const top = p.role === 'TOP' ? newRoleMmr : (dbP.mmr_top || 1200);
      const jg = p.role === 'JG' ? newRoleMmr : (dbP.mmr_jg || 1200);
      const mid = p.role === 'MID' ? newRoleMmr : (dbP.mmr_mid || 1200);
      const adc = p.role === 'ADC' ? newRoleMmr : (dbP.mmr_adc || 1200);
      const sup = p.role === 'SUP' ? newRoleMmr : (dbP.mmr_sup || 1200);
      // match/record・performFullMmrRebuildと同じ試合数加重平均に統一(2026-08-05発覚)。
      // 以前はここだけ単純平均だったため、手動記録とbot自動同期のどちらが最後に
      // 触ったかで代表MMRの値が食い違い、後日のMMR再計算で無説明に変動して見えていた。
      const games = { TOP: dbP.games_top || 0, JG: dbP.games_jg || 0, MID: dbP.games_mid || 0, ADC: dbP.games_adc || 0, SUP: dbP.games_sup || 0 };
      const newTotalMmr = computeRepresentativeMmr({ TOP: top, JG: jg, MID: mid, ADC: adc, SUP: sup }, games);

      const playerUpdateData: any = {
        [roleMmrKey]: newRoleMmr,
        mmr: newTotalMmr
      };

      await supabase
        .from('ktm_players')
        .update(playerUpdateData)
        .eq('name', p.player_name);
    }

    // ============================================================
    // 💎 ジャックポット金庫：ペンタキル総取り判定
    //
    // 【条件】ペンタキルを達成し、**かつその試合に勝利していること**。
    // 負け試合のペンタキル（いわゆる敗色濃厚な場面での帳尻キル）で金庫が飛ぶのを避け、
    // 「勝ちに繋がった活躍」だけを報いる。
    //
    // 2026-09-22 新設。元々は /api/match/record 側にあったが、あちらはKTM Botが
    // 試合終了直後に呼ぶもので kills/deaths/assists が全員0埋めの時点で走るため、
    // ペンタキルを検知しようがなかった（かつ penta_kills 列も存在しなかった）。
    // Riot APIの実データが揃うのはこの match-sync なので、判定はここで行う。
    //
    // ⚠️ この経路は同じ試合に対して複数回呼ばれうる（Botが再同期した場合など）。
    // 二重払い出しを防ぐため、この試合で既に払い出し済みかを ktm_matches で確認する。
    // ============================================================
    let jackpotWinner: { name: string; payout: number } | null = null;
    try {
      const pentaWinner = updates.find(
        (u: any) => Number(u.penta_kills) > 0 && u.team === match.winning_team
      );
      if (pentaWinner) {
        const { data: matchRow } = await supabase
          .from('ktm_matches')
          .select('id, jackpot_claimed')
          .eq('id', matchId)
          .maybeSingle();

        // jackpot_claimed 列が未作成の環境では undefined になる。その場合も
        // 「未払い出し」とみなさず、列がある場合のみ払い出す（安全側）。
        if (matchRow && matchRow.jackpot_claimed === false) {
          const { claimJackpot } = await import('../../../../lib/jackpot');
          const jRes = await claimJackpot(pentaWinner.player_name, pentaWinner.discord_id);
          if (jRes.success && jRes.payout > 0) {
            jackpotWinner = { name: pentaWinner.player_name, payout: jRes.payout };
            await supabase.from('ktm_matches').update({ jackpot_claimed: true }).eq('id', matchId);

            const { sendShopNotification } = await import('../../../../lib/discordNotify');
            await sendShopNotification({
              content: `🚨 **【JACKPOT 炸裂！！】** \`${pentaWinner.player_name}\` 選手がペンタキルを達成し、そのまま勝利！ ジャックポット金庫 **${jRes.payout.toLocaleString()}コイン** を総取りしました！！ 🚨`,
            }).catch(() => {});
          }
        }
      }
    } catch (jErr) {
      // 金庫処理の失敗で試合同期そのものを失敗させない
      console.warn('[match-sync] ジャックポット判定エラー（続行）:', jErr);
    }

    return NextResponse.json({ status: "SUCCESS", message: "Match detailed stats synchronized.", updates, jackpotWinner });
  } catch (err: any) {
    console.error("Match Sync Error:", err);
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
