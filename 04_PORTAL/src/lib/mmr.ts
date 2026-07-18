/**
 * KTM MMR計算ロジック (match.gs の TypeScript移植)
 */

import type { Role } from './balancer';
import type { SupabaseClient } from '@supabase/supabase-js';


export const RANKS: Record<string, number> = {
  'UNRANKED': 1200, 'IRON': 1100, 'BRONZE': 1200, 'SILVER': 1350, 'GOLD': 1500,
  'PLATINUM': 1650, 'EMERALD': 1800, 'DIAMOND': 2000, 'MASTER': 2200, 
  'GRANDMASTER': 2400, 'CHALLENGER': 2600
};

export interface KtmTier {
  name: string;
  min: number;
  color: string;
  bg: string;
}

export const KTM_TIERS: KtmTier[] = [
  { name: 'CHALLENGER', min: 2000, color: 'text-sky-300', bg: 'bg-sky-300/10' },
  { name: 'GRANDMASTER', min: 1900, color: 'text-red-500', bg: 'bg-red-500/10' },
  { name: 'MASTER', min: 1850, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'DIAMOND I', min: 1840, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND II', min: 1825, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND III', min: 1810, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'DIAMOND IV', min: 1800, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'EMERALD I', min: 1760, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD II', min: 1720, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD III', min: 1680, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'EMERALD IV', min: 1650, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'PLATINUM I', min: 1600, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM II', min: 1560, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM III', min: 1530, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'PLATINUM IV', min: 1500, color: 'text-teal-400', bg: 'bg-teal-400/10' },
  { name: 'GOLD I', min: 1460, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD II', min: 1420, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD III', min: 1380, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'GOLD IV', min: 1350, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { name: 'SILVER I', min: 1310, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER II', min: 1270, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER III', min: 1230, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'SILVER IV', min: 1200, color: 'text-slate-300', bg: 'bg-slate-300/10' },
  { name: 'BRONZE I', min: 1160, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE II', min: 1120, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE III', min: 1080, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'BRONZE IV', min: 1050, color: 'text-amber-700', bg: 'bg-amber-700/10' },
  { name: 'IRON I', min: 1010, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON II', min: 970, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON III', min: 930, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'IRON IV', min: 900, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { name: 'UNRANKED', min: 0, color: 'text-gray-400', bg: 'bg-gray-800' }
];

export function getKtmRank(mmr: number): { name: string; color: string; bg: string } {
  const tier = KTM_TIERS.find(t => mmr >= t.min);
  return tier ? { name: tier.name, color: tier.color, bg: tier.bg } : { name: 'UNRANKED', color: 'text-gray-400', bg: 'bg-gray-800' };
}

export function getMultiplierByAffinity(pref1: string, pref2: string, targetRole: string): number {
  const isAllMain = (pref1 === 'ALL' || pref1 === 'FILL' || pref1 === '-');
  const isAllSub  = (pref2 === 'ALL' || pref2 === 'FILL' || pref2 === '-');

  if (targetRole === pref1 || isAllMain) return 1.0;
  
  const soloLanes = ['TOP', 'MID'];
  const isSoloPref1 = soloLanes.includes(pref1);
  const isTargetSolo = soloLanes.includes(targetRole);

  if (targetRole === pref2 || isAllSub) {
    return (isSoloPref1 && isTargetSolo) ? 0.85 : 0.80;
  } else {
    return (isSoloPref1 && isTargetSolo) ? 0.75 : 0.65;
  }
}

export interface RolePreferences {
  primary?: string;
  secondary?: string;
}

/**
 * プレイヤーの最高ランクとレーン習熟度から、各レーンの初期MMRを算出する
 */
export function calculateInitialMmr(highestRank: string | null, role: string, prefs: RolePreferences | null): number {
  const rankStr = highestRank ? highestRank.split(' ')[0].toUpperCase() : 'UNRANKED';
  const originalRankMmr = RANKS[rankStr] || 1200;
  
  // 初期レートの圧縮 (Soft Reset)
  const COMPRESSION_RATE = 0.8;
  const baseMmr = Math.round(1200 + (originalRankMmr - 1200) * COMPRESSION_RATE);

  if (!prefs) return baseMmr - 200;

  // 表記揺れ吸収
  const norm = (r: string) => {
    if (!r) return '';
    const upper = r.toUpperCase();
    if (upper === 'JUNGLE') return 'JG';
    if (upper === 'SUPPORT') return 'SUP';
    return upper;
  };

  const p = norm(prefs.primary as string);
  const s = norm(prefs.secondary as string);
  const r = norm(role);

  if (p === r) {
    return baseMmr; // メインレーンは減衰なし
  }
  // ALL/FILL/- の場合はすべてサブレーン扱いとする（メインほど上手くない）
  if (p === 'ALL' || p === 'FILL' || p === '-') {
    return baseMmr - 100;
  }
  if (s === r || s === 'ALL' || s === 'FILL' || s === '-') {
    return baseMmr - 100; // サブレーン
  }
  
  return baseMmr - 200; // それ以外のレーン
}

export interface MmrCalcContext {
  // --- calculateNewMMR が実際に使う項目 ---
  currentMmr: number;
  opponentMmr: number;
  isWin: boolean;
  kills: number;
  deaths: number;
  assists: number;
  matchupCount: number; // 相手との対面回数
  totalWinRate: number; // 全体勝率 (0~100)
  role: string;
  // --- 以下は現行の計算では未使用（将来のスタッツ加点用に型だけ残す / M1で任意化）。
  //     未使用の項目を毎試合計算する無駄を避けるため optional にした。 ---
  mainRank?: string;
  numGames?: number;
  visionScore?: number;
  cs?: number;
  damageDealt?: number;
  damageTaken?: number;
  objectiveDamage?: number;
  healShield?: number;
  teamTotalKills?: number;
  isDamageMvp?: boolean;
  isObjectiveMvp?: boolean;
  isTankMvp?: boolean;
  isHealMvp?: boolean;
  csd15?: number; // 15分時点での対面とのCS差
}

export function calculateNewMMR(ctx: MmrCalcContext): number {
  const { currentMmr, opponentMmr, isWin, kills, deaths, assists, role, matchupCount } = ctx;

  const isPlacement = false;

  // ① 勝敗のベースポイント (スタッツ加点がなくなった分、ベースを少し底上げ)
  let baseDelta = isWin ? 18 : -20;

  // ② 格差補正 (Elo Gravity)
  // 相手チームの同ロールとのMMR差分を計算
  const mmrDiff = opponentMmr - currentMmr;
  let eloBonus = 0;
  if (mmrDiff > 0) {
    // 相手が格上: 最大+15程度の補正
    eloBonus = Math.min(15, mmrDiff / 15);
  } else if (mmrDiff < 0) {
    // 相手が格下: 最大-10程度の補正
    eloBonus = Math.max(-10, mmrDiff / 20);
  }

  if (isWin) {
    baseDelta += eloBonus; // 格上に勝てば爆上がり、格下に勝っても少し上がり幅が減る程度
  } else {
    // 負けた場合、格上相手ならマイナスが軽減されるが、最低でも -2 は下がるようにする
    baseDelta = Math.min(-2, baseDelta + eloBonus);

    // ★ 追加: 高勝率プレイヤー(60%以上)のインフレ抑制ペナルティ
    if (ctx.totalWinRate > 60) {
      const winRatePenalty = Math.min(8, (ctx.totalWinRate - 60) * 0.5);
      baseDelta -= winRatePenalty;
    }
  }

  // ③ KDAボーナス (手動入力パラメータのキル・デス・アシストから実力を正しく評価)
  let kdaScore = deaths === 0 ? (kills + assists) * 1.2 : (kills + assists) / deaths;
  if (role === 'SUP') {
    kdaScore += 0.8; // サポート補正
  }
  
  // 基準KDA 2.0から加点 (最大+15点のボーナス)
  const kdaBonus = Math.max(0, Math.min(15, (kdaScore - 2.0) * 5));

  // ④ 対面回数補正 (身内戦でのブレ防止)
  // 以前は 0.8/0.6/0.4 と強く減衰させていたため、全員が頻繁に対面する身内では
  // MMRがほとんど動かず収束が遅かった(M3)。ブレ防止は残しつつ緩める。
  let matchupDampener = 1.0;
  if (!isPlacement && matchupCount) {
    if (matchupCount >= 3) matchupDampener = 0.9;
    if (matchupCount >= 5) matchupDampener = 0.8;
    if (matchupCount >= 8) matchupDampener = 0.7;
  }

  // ボーナスを合算
  let delta = (baseDelta + kdaBonus) * matchupDampener;
  delta = Math.round(delta);

  // ⑤ 上限・下限のセーフティ
  if (isWin) {
    delta = Math.max(0, Math.min(50, delta)); // 最大+50
  } else {
    // 敗北は必ず最低3ポイント減点する(M2)。以前は高KDA×格上相手だと加点で相殺され
    // delta が0になり「負けても下がらない」ことがあり、レートの上振れ(インフレ)要因だった。
    delta = Math.max(-40, Math.min(-3, delta)); // -40 〜 -3
  }

  return delta;
}

export function calculateKdaScore(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return (kills + assists) * 1.2;
  return Number(((kills + assists) / deaths).toFixed(2));
}

export async function performFullMmrRebuild(supabase: SupabaseClient) {
  const { data: allPlayers, error: pError } = await supabase.from('ktm_players').select('*');
  if (pError || !allPlayers) throw pError;

  const playersMap = new Map();
  for (const p of allPlayers) {
    const prefs = p.role_preferences || { primary: 'ALL', secondary: '-' };
    playersMap.set(p.name, {
      id: p.id, name: p.name, highest_rank: p.highest_rank, role_preferences: prefs,
      mmr_top: calculateInitialMmr(p.highest_rank, 'TOP', prefs),
      mmr_jg: calculateInitialMmr(p.highest_rank, 'JG', prefs),
      mmr_mid: calculateInitialMmr(p.highest_rank, 'MID', prefs),
      mmr_adc: calculateInitialMmr(p.highest_rank, 'ADC', prefs),
      mmr_sup: calculateInitialMmr(p.highest_rank, 'SUP', prefs),
      totalGames: 0, totalWins: 0, laneGames: { TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0 }
    });
  }

  const { data: allMatches, error: mError } = await supabase.from('ktm_matches').select('id, winning_team').order('created_at', { ascending: true });
  if (mError || !allMatches) throw mError;

  // すべての参加者データを一括ロードして match_id ごとにマッピング (N+1問題の解消)
  const { data: allParticipants, error: pErr } = await supabase.from('ktm_match_participants').select('*');
  if (pErr) throw pErr;

  const participantsByMatch = new Map<string, any[]>();
  if (allParticipants) {
    for (const part of allParticipants) {
      const list = participantsByMatch.get(part.match_id) || [];
      list.push(part);
      participantsByMatch.set(part.match_id, list);
    }
  }

  const participantUpdates: any[] = [];
  const matchupHistoryMap = new Map<string, number>(); // "PlayerA<=>PlayerB:ROLE" -> count

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

      const isWin = p.team === match.winning_team;

      // calculateNewMMR が実際に使う項目のみ渡す（未使用スタッツの無駄計算を廃止 M1）
      const ctx: MmrCalcContext = {
        currentMmr: playerSnapshot[mmrKey] || 1200, opponentMmr, isWin,
        kills: p.kills || 0, deaths: p.deaths || 0, assists: p.assists || 0,
        matchupCount,
        totalWinRate: playerSnapshot.totalGames > 0 ? (playerSnapshot.totalWins / playerSnapshot.totalGames) * 100 : 50,
        role,
      };

      const delta = calculateNewMMR(ctx);
      const kdaScore = calculateKdaScore(p.kills || 0, p.deaths || 0, p.assists || 0);

      matchDeltas.push({
        playerName: p.player_name,
        role,
        delta,
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
        mmr_delta: delta 
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
  }

  // 参加者テーブルのKDA等一括更新 (タイムアウトを回避するためupsertを用いたバルク更新に変更)
  if (participantUpdates.length > 0) {
    const chunkSize = 100; // 100件ずつまとめてupsertを実行
    for (let i = 0; i < participantUpdates.length; i += chunkSize) {
      const chunk = participantUpdates.slice(i, i + chunkSize);
      
      const { error: updateError } = await supabase
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

      if (updateError) {
        throw new Error(`Failed to upsert participants at chunk ${i}: ${updateError.message}`);
      }
    }
  }

  // プレイヤーテーブルのMMR一括更新 (件数が少ないため、Identity制意エラーを避けるべく個別 update で並列処理)
  const playerUpdates = Array.from(playersMap.values()).map(p => {
    // 代表MMRは「実際にプレイしたレーンの試合数」で重み付け平均する(M4)。
    // やらないレーンのランク由来初期値に薄まる問題を解消。試合が無い人だけ従来の単純平均。
    const lanes: [string, number][] = [
      ['TOP', p.mmr_top], ['JG', p.mmr_jg], ['MID', p.mmr_mid], ['ADC', p.mmr_adc], ['SUP', p.mmr_sup],
    ];
    let wSum = 0, gSum = 0;
    for (const [lk, m] of lanes) { const g = p.laneGames[lk] || 0; wSum += m * g; gSum += g; }
    const avgMmr = gSum > 0
      ? Math.round(wSum / gSum)
      : Math.round((p.mmr_top + p.mmr_jg + p.mmr_mid + p.mmr_adc + p.mmr_sup) / 5);
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
    if (firstError) {
      throw new Error(`Failed to update players: ${firstError.error?.message || 'Unknown error'}`);
    }
  }

  return { success: true, message: `Rebuild completed for ${playersMap.size} players over ${allMatches.length} matches.` };
}
