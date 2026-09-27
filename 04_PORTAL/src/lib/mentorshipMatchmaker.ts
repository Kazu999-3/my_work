/**
 * 🤝 師弟マッチング AI仲人（相性分析 ＆ 自動お見合いレコメンド）
 */

import { supabaseAdmin as supabase } from './supabaseAdmin';

export const RANK_ORDER: Record<string, number> = {
  IRON: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5,
  EMERALD: 6,
  DIAMOND: 7,
  MASTER: 8,
  GRANDMASTER: 9,
  CHALLENGER: 10,
  UNRANKED: 2,
};

export interface MatchScoreResult {
  score: number;
  reasons: string[];
}

/**
 * 師匠と弟子の相性スコアを厳格算出（0〜98点）
 */
export function calculateMentorshipCompatibility(mentor: any, pupil: any): MatchScoreResult {
  if (!mentor || !pupil) return { score: 0, reasons: [] };
  if (mentor.discord_id === pupil.discord_id) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  // 1. ランク適性・実力差の厳格判定（最大35点）
  const mentorRankKey = (mentor.current_rank || 'UNRANKED').toUpperCase().split(' ')[0];
  const pupilRankKey = (pupil.current_rank || 'UNRANKED').toUpperCase().split(' ')[0];
  const mentorTier = RANK_ORDER[mentorRankKey] || 3;
  const pupilTier = RANK_ORDER[pupilRankKey] || 3;

  if (mentorTier > pupilTier) {
    const tierDiff = mentorTier - pupilTier;
    if (tierDiff >= 1 && tierDiff <= 3) {
      score += 35;
      reasons.push('最適な実力差（1〜3ティア上）');
    } else if (tierDiff >= 4) {
      score += 20;
      reasons.push('ハイレベル師匠');
    }
  } else if (mentorTier === pupilTier) {
    score += 10;
    reasons.push('同格（切磋琢磨）');
  } else {
    score -= 30; // 弟子の方が高ランクの場合は減点
  }

  // 2. レーン適合度（最大35点）
  const mentorLanes: string[] = Array.isArray(mentor.lanes) ? mentor.lanes : [];
  const pupilLanes: string[] = Array.isArray(pupil.lanes) ? pupil.lanes : [];

  const isAllLane = mentorLanes.includes('ALL') || pupilLanes.includes('ALL');
  const sharedLanes = pupilLanes.filter((l) => mentorLanes.includes(l));

  if (isAllLane || sharedLanes.length > 0) {
    score += 35;
    const laneLabel = isAllLane ? '全レーン対応' : sharedLanes.join('/');
    reasons.push(`同レーン（${laneLabel}）専攻`);
  } else {
    // DUOシナジー（BOT x SUP, MID x JG）
    const isDuoSynergy =
      (pupilLanes.includes('BOT') && mentorLanes.includes('SUPPORT')) ||
      (pupilLanes.includes('SUPPORT') && mentorLanes.includes('BOT')) ||
      (pupilLanes.includes('MID') && mentorLanes.includes('JUNGLE')) ||
      (pupilLanes.includes('JUNGLE') && mentorLanes.includes('MID'));
    if (isDuoSynergy) {
      score += 20;
      reasons.push('連携レーンシナジー（Botライン/Mid-Jgライン）');
    } else {
      score -= 10;
    }
  }

  // 3. 得意・練習中チャンピオンの合致（最大25点）
  const mentorChamps: string[] = Array.isArray(mentor.champions) ? mentor.champions : [];
  const pupilChamps: string[] = Array.isArray(pupil.champions) ? pupil.champions : [];
  const sharedChamps = pupilChamps.filter((c) =>
    mentorChamps.some((mc) => mc.toLowerCase() === c.toLowerCase())
  );

  if (sharedChamps.length >= 2) {
    score += 25;
    reasons.push(`得意チャンプ複数合致（${sharedChamps.slice(0, 2).join(', ')}）`);
  } else if (sharedChamps.length === 1) {
    score += 15;
    reasons.push(`「${sharedChamps[0]}」指導可能`);
  }

  // 4. 活動時間帯の親和性（最大10点）
  if (mentor.active_hours && pupil.active_hours) {
    const mHours = mentor.active_hours.toLowerCase();
    const pHours = pupil.active_hours.toLowerCase();
    const timeMatch =
      (mHours.includes('平日') && pHours.includes('平日')) ||
      (mHours.includes('休日') && pHours.includes('休日')) ||
      (mHours.includes('夜') && pHours.includes('夜')) ||
      (mHours.includes('土日') && pHours.includes('土日'));
    if (timeMatch) {
      score += 10;
      reasons.push('活動時間帯が一致');
    }
  }

  // 最終スコアのクランプ（下限0点、上限98点）
  const finalScore = Math.min(Math.max(score, 0), 98);

  return {
    score: finalScore,
    reasons,
  };
}

/**
 * 特定のプロフィールに対して、最も相性の良い相手（最高スコア）を探索
 */
export async function findBestMentorshipMatch(
  targetProfile: any
): Promise<{ bestPartner: any; matchResult: MatchScoreResult } | null> {
  const isTargetMentor = targetProfile.role_type === 'MENTOR';
  const partnerRoleType = isTargetMentor ? 'PUPIL' : 'MENTOR';

  const { data: candidates, error } = await supabase
    .from('mentorship_profiles')
    .select('*')
    .eq('role_type', partnerRoleType)
    .eq('status', 'OPEN');

  if (error || !candidates || candidates.length === 0) {
    return null;
  }

  let bestPartner: any = null;
  let bestResult: MatchScoreResult = { score: 0, reasons: [] };

  for (const candidate of candidates) {
    const mentor = isTargetMentor ? targetProfile : candidate;
    const pupil = isTargetMentor ? candidate : targetProfile;
    const result = calculateMentorshipCompatibility(mentor, pupil);

    if (result.score > bestResult.score) {
      bestResult = result;
      bestPartner = candidate;
    }
  }

  // 70点以上なら良質な推薦対象
  if (bestPartner && bestResult.score >= 70) {
    return { bestPartner, matchResult: bestResult };
  }

  return null;
}

/**
 * 🌟 弟子がエントリーした際、師匠登録がない場合でも ktm_players から最適な先輩（指導者候補）をスカウト
 */
export async function findBestSeniorMentor(
  pupilProfile: any
): Promise<{ seniorPlayer: any; reasons: string[]; rankDiff: number } | null> {
  try {
    const pupilRankKey = (pupilProfile.current_rank || 'UNRANKED').toUpperCase().split(' ')[0];
    const pupilTier = RANK_ORDER[pupilRankKey] || 3;
    const pupilLanes: string[] = Array.isArray(pupilProfile.lanes) ? pupilProfile.lanes : [];

    // 1. ktm_players からアクティブなプレイヤーを取得
    const { data: players, error } = await supabase
      .from('ktm_players')
      .select('id, name, ign, discord_id, highest_rank, is_active, role_preferences')
      .eq('is_active', true)
      .neq('discord_id', pupilProfile.discord_id);

    if (error || !players || players.length === 0) return null;

    let bestSenior: any = null;
    let bestScore = -1;
    let bestReasons: string[] = [];
    let bestRankDiff = 0;

    for (const player of players) {
      if (!player.discord_id) continue;

      const playerRankKey = (player.highest_rank || 'UNRANKED').toUpperCase().split(' ')[0];
      const playerTier = RANK_ORDER[playerRankKey] || 3;

      // 弟子よりランクが高い先輩（1〜4ティア上）
      const tierDiff = playerTier - pupilTier;
      if (tierDiff < 1) continue;

      let score = 0;
      const reasons: string[] = [];

      // ランク差（1〜3ティア上が最高）
      if (tierDiff >= 1 && tierDiff <= 3) {
        score += 40;
        reasons.push(`実力差最適（${player.highest_rank || '上位ランク'} / +${tierDiff}ティア）`);
      } else {
        score += 25;
        reasons.push(`上位プレイヤー（${player.highest_rank}）`);
      }

      // レーン一致（role_preferences の main/sub チェック）
      const mainLane = (player.role_preferences?.main || '').toUpperCase();
      const subLane = (player.role_preferences?.sub || '').toUpperCase();
      const playerLanes = [mainLane, subLane].filter(Boolean);

      const hasSharedLane = pupilLanes.some((pl) => playerLanes.includes(pl) || pl === 'ALL');
      if (hasSharedLane) {
        score += 35;
        reasons.push(`メイン/得意レーン一致（${mainLane || subLane}）`);
      } else {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSenior = player;
        bestReasons = reasons;
        bestRankDiff = tierDiff;
      }
    }

    if (bestSenior && bestScore >= 45) {
      return {
        seniorPlayer: bestSenior,
        reasons: bestReasons,
        rankDiff: bestRankDiff,
      };
    }

    return null;
  } catch (err) {
    console.error('[mentorshipMatchmaker] findBestSeniorMentor error:', err);
    return null;
  }
}

