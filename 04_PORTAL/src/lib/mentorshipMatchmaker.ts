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
