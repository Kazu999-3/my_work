import { getPlayerCoins, getPlayerInventory, updatePlayerCoinsAndInventory, findOrCreatePlayer, consumeInventoryItems } from '../playerCoins';
import { sanitizeStoredOdds } from '../betOdds';
import { recordCoinTransaction } from '../coinLedger';
import { claimJackpot } from '../jackpot';
import { sendShopNotification } from '../discordNotify';
import { PlayerSettlementResult } from './types';

/**
 * 参加者10人の戦績を ktm_match_participants にINSERT
 */
export async function insertMatchParticipants(supabase: any, newMatchId: string | number, results: PlayerSettlementResult[]) {
  const participantInserts = results.map(r => ({
    match_id: newMatchId,
    player_name: r.name,
    discord_id: r.dbPlayer?.discord_id || null,
    team: r.team,
    role: r.role,
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    champion_name: r.champion_name || null,
    vision_score: r.vision_score || 0,
    cs: r.cs || 0,
    gold: Number(r.gold) > 0 && Number(r.gold) < 100000 ? Math.round(Number(r.gold)) : null,
    damage_dealt: r.damage_dealt || 0,
    damage_taken: r.damage_taken || 0,
    objective_damage: r.objective_damage || 0,
    heal_shield: r.heal_shield || 0,
    penta_kills: Number(r.penta_kills) || 0,
    kda_score: r.kdaScore,
    mmr_delta: r.mmrDelta,
    mmr_breakdown: r.mmrBreakdown || null,
    player_mmr: r.currentMmr
  }));

  const { error } = await supabase.from('ktm_match_participants').insert(participantInserts);
  if (error) throw new Error(`参加者データの作成に失敗: ${error.message}`);
}

/**
 * 各プレイヤーのMMR、Pity、コイン、試合数をDBへ更新し、コイン台帳に記録する
 */
export async function updatePlayersMmrAndCoins(
  supabase: any,
  newMatchId: string | number,
  results: PlayerSettlementResult[],
  winningTeam: 'BLUE' | 'RED',
  isExhibition: boolean
) {
  for (const r of results) {
    const gamesKey = `games_${r.role.toLowerCase()}`;
    const currentMeta = typeof r.dbPlayer.metadata === 'object' && r.dbPlayer.metadata !== null ? r.dbPlayer.metadata : {};
    const currentRolePrefs = typeof r.dbPlayer.role_preferences === 'object' && r.dbPlayer.role_preferences !== null ? r.dbPlayer.role_preferences : {};

    const baseUpdate: any = {
      mmr_top: r.newLaneMmrs.TOP,
      mmr_jg: r.newLaneMmrs.JG,
      mmr_mid: r.newLaneMmrs.MID,
      mmr_adc: r.newLaneMmrs.ADC,
      mmr_sup: r.newLaneMmrs.SUP,
      [gamesKey]: (r.newGames as any)[r.role],
      mmr: r.newMmr,
      pity: r.newPity,
      off_role_pity: r.newOffRolePity,
      spectator_pity: 0,
      metadata: { ...currentMeta, consecutive_secondary: r.consecutiveSecondary }
    };

    const legacyCoinFields = {
      coins: r.newCoins,
      role_preferences: { ...currentRolePrefs, coins: r.newCoins },
    };

    const { error: uError } = await supabase
      .from('ktm_players')
      .update(baseUpdate)
      .eq('name', r.name);
    if (uError) throw new Error(`Player ${r.name} の更新エラー: ${uError.message}`);

    const coinReward = r.newCoins - (Number(currentRolePrefs.coins ?? r.dbPlayer.coins ?? r.dbPlayer.metadata?.coins) || 1000);
    let appliedCoins = r.newCoins;

    const { data: coinRows, error: coinErr } = await supabase.rpc('apply_player_coin_delta', {
      p_name: r.name,
      p_delta: coinReward,
      p_inventory: null,
      p_prefs_patch: null,
    });

    if (coinErr && (coinErr.code === 'PGRST202' || /apply_player_coin_delta/.test(coinErr.message || ''))) {
      const { error: legacyErr } = await supabase.from('ktm_players').update(legacyCoinFields).eq('name', r.name);
      if (legacyErr) throw new Error(`Player ${r.name} のコイン更新エラー: ${legacyErr.message}`);
    } else if (coinErr) {
      throw new Error(`Player ${r.name} のコイン更新エラー: ${coinErr.message}`);
    } else {
      const row = Array.isArray(coinRows) ? coinRows[0] : coinRows;
      if (row?.new_coins !== undefined) appliedCoins = Number(row.new_coins);
    }

    try {
      await recordCoinTransaction({
        player: {
          id: r.dbPlayer?.id,
          name: r.name,
          discord_id: r.dbPlayer?.discord_id || null,
        },
        delta: coinReward,
        balanceAfter: appliedCoins,
        reason: 'match_settle',
        metadata: {
          matchId: newMatchId,
          role: r.role,
          team: r.team,
          isWin: r.team === winningTeam,
          isExhibition,
          hasVictoryDoubler: r.hasVictoryDoubler,
        },
      });
    } catch (txErr) {
      console.warn(`[settlement] 台帳記録スキップ (${r.name}):`, txErr);
    }
  }
}

/**
 * 勝敗予想（ベット）の精算処理
 */
export async function settleMatchBets(
  supabase: any,
  newMatchId: string | number,
  winningTeam: 'BLUE' | 'RED',
  settledRoundId: string | number | null
): Promise<Array<{ name: string; payout: number; multiplier: number; streak?: number }>> {
  const payoutWinners: Array<{ name: string; payout: number; multiplier: number; streak?: number }> = [];

  try {
    const { data: allOpenBetTasks } = await supabase
      .from('edge_tasks')
      .select('id, payload')
      .eq('task_type', 'custom_bet')
      .eq('status', 'pending');

    let roundFloor: number | null = null;
    if (typeof settledRoundId === 'number') {
      const { data: prevMatched } = await supabase
        .from('balancer_predictions')
        .select('id')
        .not('match_id', 'is', null)
        .lt('id', settledRoundId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      roundFloor = prevMatched?.id ?? 0;
    }

    const openBetTasks = (allOpenBetTasks || []).filter((t: any) => {
      const rid = t?.payload?.round_id ?? null;
      if (settledRoundId === null || rid === null) return true;
      if (roundFloor !== null && typeof rid === 'number' && typeof settledRoundId === 'number') {
        return rid > roundFloor && rid <= settledRoundId;
      }
      return rid === settledRoundId;
    });

    if (openBetTasks && openBetTasks.length > 0) {
      for (const task of openBetTasks) {
        const bet = task.payload || {};
        const won = (bet.team === winningTeam);
        let payout = 0;
        const multiplier = sanitizeStoredOdds(bet.odds);

        const pPlayer = await findOrCreatePlayer({
          discordId: bet.discord_id,
          name: bet.player_name,
          autoCreate: true,
        });

        let streakBonusPercent = 0;
        let currentStreak = 0;

        if (won) {
          currentStreak = (Number(pPlayer?.role_preferences?.betStreak) || 0) + 1;
          const maxStreak = Math.max(currentStreak, Number(pPlayer?.role_preferences?.maxBetStreak) || currentStreak);

          if (currentStreak >= 5) streakBonusPercent = 20;
          else if (currentStreak >= 3) streakBonusPercent = 10;
          else if (currentStreak >= 2) streakBonusPercent = 5;

          const effectiveMultiplier = multiplier * (1 + streakBonusPercent / 100);
          payout = Math.floor((bet.amount || 0) * effectiveMultiplier);
          payoutWinners.push({ name: bet.player_name, payout, multiplier: Number(effectiveMultiplier.toFixed(2)), streak: currentStreak });

          if (pPlayer) {
            const cur = getPlayerCoins(pPlayer);
            await updatePlayerCoinsAndInventory({
              player: pPlayer,
              newCoins: cur + payout,
              reason: 'bet_payout',
              reasonMetadata: { team: bet.team, amount: bet.amount, multiplier, streak: currentStreak },
              rolePreferencesUpdate: { betStreak: currentStreak, maxBetStreak: maxStreak },
            });
          }
        } else {
          if (pPlayer) {
            const hasInsurance = getPlayerInventory(pPlayer).some((it: any) => it.id === 'bet_insurance');
            let insuranceRefund = 0;
            if (hasInsurance && (await consumeInventoryItems(pPlayer, 'bet_insurance', 1)) === 1) {
              insuranceRefund = Math.floor((Number(bet.amount) || 0) * 0.5);
            }

            const cur = getPlayerCoins(pPlayer);
            await updatePlayerCoinsAndInventory({
              player: pPlayer,
              newCoins: cur + insuranceRefund,
              reason: insuranceRefund > 0 ? 'bet_insurance_payout' : undefined,
              reasonMetadata: { betAmount: bet.amount, refund: insuranceRefund },
              rolePreferencesUpdate: { betStreak: 0 },
            });
          }
        }

        await supabase
          .from('edge_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            payload: { ...bet, match_id: newMatchId, won, payout, streak: currentStreak },
          })
          .eq('id', task.id);
      }
    }
  } catch (betErr) {
    console.error('[settlement] ベット精算処理でエラー発生（続行）:', betErr);
  }

  return payoutWinners;
}

/**
 * ペンタキル時のジャックポット判定・総取り付与
 */
export async function checkAndAwardJackpot(
  supabase: any,
  newMatchId: string | number,
  results: PlayerSettlementResult[],
  winningTeam: 'BLUE' | 'RED',
  isExhibition: boolean
): Promise<{ name: string; payout: number } | null> {
  const pentaWinner = results.find(r => (Number(r.penta_kills) || 0) > 0 && r.team === winningTeam);
  if (!pentaWinner || isExhibition) return null;

  try {
    const { data: matchRow } = await supabase
      .from('ktm_matches')
      .select('id, jackpot_claimed')
      .eq('id', newMatchId)
      .maybeSingle();

    if (matchRow && matchRow.jackpot_claimed === false) {
      const jRes = await claimJackpot(pentaWinner.name, pentaWinner.dbPlayer?.discord_id || null);
      if (jRes.success && jRes.payout > 0) {
        await supabase.from('ktm_matches').update({ jackpot_claimed: true }).eq('id', newMatchId);
        await sendShopNotification({
          content: `🎰 **【JACKPOT 炸裂！！】** \`${pentaWinner.name}\` 選手がペンタキルを達成し、そのまま勝利！ ジャックポット金庫 **${jRes.payout.toLocaleString()}コイン** を総取りしました！！！ 🎰`,
        }).catch(() => {});
        return { name: pentaWinner.name, payout: jRes.payout };
      }
    }
  } catch (jpErr) {
    console.warn('[settlement] ジャックポット精算失敗（続行）:', jpErr);
  }

  return null;
}
