/**
 * 🤝 師弟マッチング AI仲人（相性分析 ＆ 自動お見合いレコメンド）
 */

import { supabaseAdmin as supabase } from './supabaseAdmin';
import { getPlayerTier, ExperienceTier } from './playerTier';
import { fetchAllRows } from './fetchAll';

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

export interface SecretMatchProposal {
  id: string;
  mentor: {
    profileId: string;
    discordId: string;
    name: string;
    rank: string;
    lanes: string[];
    champions: string[];
    tier?: ExperienceTier;
    tierLabel?: string;
  };
  pupil: {
    profileId?: string | null;
    playerId?: number | null;
    discordId: string;
    name: string;
    rank: string;
    primaryLane: string;
    secondaryLane?: string;
    isRegistered: boolean;
    hasLearnRole: boolean;
    tier?: ExperienceTier;
    tierLabel?: string;
    totalGames?: number;
  };
  matchScore: number;
  reasons: string[];
  offerStatus?: 'NONE' | 'PENDING' | 'PROPOSAL_PENDING' | 'ACCEPTED' | 'DECLINED' | 'MATCHED' | 'ACTIVE';
}

export interface SecretMatchBatchProposal {
  pupil: {
    profileId?: string | null;
    playerId?: number | null;
    discordId: string;
    name: string;
    rank: string;
    primaryLane: string;
    secondaryLane?: string;
    isRegistered: boolean;
    hasLearnRole: boolean;
    tier?: ExperienceTier;
    tierLabel?: string;
    totalGames?: number;
  };
  mentors: Array<{
    profileId: string;
    discordId: string;
    name: string;
    rank: string;
    lanes: string[];
    champions: string[];
    matchScore: number;
    reasons: string[];
    offerStatus?: string;
    matchId?: string;
    tier?: ExperienceTier;
    tierLabel?: string;
  }>;
}

const LEARN_ROLE_ID = '1556976007234330634'; // 📖 教わりたい

export const TIER_ROLE_IDS: Record<string, { tier: ExperienceTier; label: string }> = {
  '1556958870486777976': { tier: 'new', label: '🔰 初参加' },
  '1556958871904583770': { tier: 'light', label: '🌱 ライト' },
  '1556958873150292078': { tier: 'regular', label: '👑 常連' },
  '1556958874618175568': { tier: 'experienced', label: '🎖️ 経験者' },
  '1556958875973066882': { tier: 'returning', label: '⏳ 復帰勢' },
};

export const DECLINE_COOLDOWN_DAYS = 21; // 見送り後の再提案クールダウン日数（3週間）

/**
 * 🔒 シークレットお見合い便の候補ペアを全自動生成（未登録メンバーを含む）
 */
export async function generateSecretMatchmakerPairs(): Promise<SecretMatchProposal[]> {
  try {
    // 1. 登録済み先輩（MENTOR / OPEN）を取得
    const { data: mentors, error: mErr } = await supabase
      .from('mentorship_profiles')
      .select('*')
      .eq('role_type', 'MENTOR')
      .eq('status', 'OPEN');

    if (mErr || !mentors || mentors.length === 0) return [];

    // 2. 登録済み後輩（PUPIL / OPEN）を取得
    const { data: allProfiles } = await supabase
      .from('mentorship_profiles')
      .select('id, discord_id, role_type, status, player_name, current_rank, lanes, champions, player_id');

    const registeredPupils = (allProfiles || []).filter((p: any) => p.role_type === 'PUPIL' && p.status === 'OPEN');
    // すでに成立済み・指導中のDiscord ID一覧
    const busyDiscordIds = new Set<string>(
      (allProfiles || [])
        .filter((p: any) => p.status === 'MATCHED' || p.status === 'CLOSED')
        .map((p: any) => p.discord_id)
        .filter(Boolean)
    );

    // 3. 名簿（ktm_players）から初中級プレイヤーを取得
    const { data: allPlayers, error: pErr } = await supabase
      .from('ktm_players')
      .select('id, name, ign, discord_id, highest_rank, is_active, role_preferences, main_champions');

    if (pErr) {
      console.warn('[mentorshipMatchmaker] Failed to fetch ktm_players:', pErr);
    }

    // 3.5 戦績データ（ktm_match_participants）から通算試合数・ブランクを集計してTierを判定
    const { data: participants } = await fetchAllRows((from, to) =>
      supabase
        .from('ktm_match_participants')
        .select('discord_id, player_name, created_at')
        .range(from, to)
    );

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    interface PlayerHistoryStats {
      total: number;
      recent30d: number;
      lastPlayedAt: number | null;
    }
    const statsByDiscord = new Map<string, PlayerHistoryStats>();
    const statsByNameLower = new Map<string, PlayerHistoryStats>();

    (participants || []).forEach((row: any) => {
      const matchTime = row.created_at ? new Date(row.created_at).getTime() : 0;
      const update = (map: Map<string, PlayerHistoryStats>, key: string) => {
        let stat = map.get(key);
        if (!stat) {
          stat = { total: 0, recent30d: 0, lastPlayedAt: null };
          map.set(key, stat);
        }
        stat.total += 1;
        if (matchTime >= thirtyDaysAgo) stat.recent30d += 1;
        if (!stat.lastPlayedAt || matchTime > stat.lastPlayedAt) {
          stat.lastPlayedAt = matchTime;
        }
      };
      if (row.discord_id) update(statsByDiscord, String(row.discord_id).trim());
      if (row.player_name) update(statsByNameLower, String(row.player_name).trim().toLowerCase());
    });

    // 4. Discordから「📖 教わりたい」およびTierロール所持者の情報を取得
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const learnUserIds = new Set<string>();
    const discordMemberRolesMap = new Map<string, string[]>();

    if (token && guildId) {
      try {
        const mRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
          headers: { Authorization: `Bot ${token}` },
        });
        if (mRes.ok) {
          const mList: any[] = await mRes.json();
          for (const mem of mList) {
            const uid = mem.user?.id;
            if (uid) {
              discordMemberRolesMap.set(uid, mem.roles || []);
            }
            if (Array.isArray(mem.roles) && mem.roles.includes(LEARN_ROLE_ID)) {
              learnUserIds.add(uid);
            }
          }
        }
      } catch (e) {
        console.warn('[mentorshipMatchmaker] Failed to fetch discord members:', e);
      }
    }

    // Tier（ライト/常連/経験者/復帰勢/初参加）判定ヘルパー
    const resolveTier = (discordId?: string | null, playerName?: string | null) => {
      const dId = String(discordId || '').trim();
      const nLow = String(playerName || '').trim().toLowerCase();

      // 1. Discordロールから判定（サーバー上で設定されているロールを最優先）
      if (dId && discordMemberRolesMap.has(dId)) {
        const roles = discordMemberRolesMap.get(dId) || [];
        for (const rId of roles) {
          if (TIER_ROLE_IDS[rId]) {
            const rInfo = TIER_ROLE_IDS[rId];
            const stat = statsByDiscord.get(dId) || (nLow ? statsByNameLower.get(nLow) : null);
            return {
              tier: rInfo.tier,
              tierLabel: rInfo.label,
              totalGames: stat?.total ?? (rInfo.tier === 'new' ? 0 : 1),
            };
          }
        }
      }

      // 2. ktm_match_participants の実戦績から getPlayerTier で算出（SSoT）
      const stat = (dId && statsByDiscord.get(dId)) || (nLow && statsByNameLower.get(nLow)) || { total: 0, recent30d: 0, lastPlayedAt: null };
      const daysAgo = stat.lastPlayedAt ? Math.floor((now - stat.lastPlayedAt) / (24 * 60 * 60 * 1000)) : null;

      const info = getPlayerTier({
        total_games: stat.total,
        recent_games_30d: stat.recent30d,
        days_since_last_match: daysAgo,
      });

      return {
        tier: info.tier,
        tierLabel: info.label,
        totalGames: stat.total,
      };
    };

    // 5. 既存のお見合いオファー状態を取得（見送りクールダウン判定用）
    const { data: existingMatches } = await supabase
      .from('mentorship_matches')
      .select('mentor_discord_id, pupil_discord_id, status, notes, started_at');

    interface ExistingOfferInfo {
      status: string;
      isCooldown: boolean;
      daysRemaining?: number;
    }
    const offerMap = new Map<string, ExistingOfferInfo>();

    (existingMatches || []).forEach((m: any) => {
      const key = `${m.mentor_discord_id}_${m.pupil_discord_id}`;
      let isCooldown = false;
      let daysRemaining = 0;

      if (m.status === 'DISMISSED') {
        let dismissedAtTime: number | null = null;
        try {
          const notes = JSON.parse(m.notes || '{}');
          if (notes.dismissedAt) {
            dismissedAtTime = new Date(notes.dismissedAt).getTime();
          }
        } catch (_) {}
        if (!dismissedAtTime && m.started_at) {
          dismissedAtTime = new Date(m.started_at).getTime();
        }

        if (dismissedAtTime) {
          const elapsedDays = Math.floor((now - dismissedAtTime) / (24 * 60 * 60 * 1000));
          if (elapsedDays < DECLINE_COOLDOWN_DAYS) {
            isCooldown = true;
            daysRemaining = Math.max(DECLINE_COOLDOWN_DAYS - elapsedDays, 1);
          }
        } else {
          isCooldown = true;
          daysRemaining = DECLINE_COOLDOWN_DAYS;
        }
      }

      offerMap.set(key, {
        status: m.status,
        isCooldown,
        daysRemaining,
      });
    });

    // 6. 後輩候補リストを統合（登録済み + 名簿初中級者）
    const pupilCandidates: Array<{
      profileId?: string | null;
      playerId?: number | null;
      discordId: string;
      name: string;
      rank: string;
      primaryLane: string;
      secondaryLane?: string;
      champions: string[];
      isRegistered: boolean;
      hasLearnRole: boolean;
      tier: ExperienceTier;
      tierLabel: string;
      totalGames: number;
    }> = [];

    const addedDiscordIds = new Set<string>(busyDiscordIds);

    // 6-a. 登録済み後輩
    for (const rp of registeredPupils || []) {
      if (!rp.discord_id) continue;
      addedDiscordIds.add(rp.discord_id);
      const tierResult = resolveTier(rp.discord_id, rp.player_name);
      pupilCandidates.push({
        profileId: rp.id,
        playerId: rp.player_id,
        discordId: rp.discord_id,
        name: rp.player_name,
        rank: rp.current_rank || 'SILVER',
        primaryLane: (rp.lanes?.[0] || 'SUPPORT').toUpperCase(),
        secondaryLane: rp.lanes?.[1]?.toUpperCase(),
        champions: rp.champions || [],
        isRegistered: true,
        hasLearnRole: learnUserIds.has(rp.discord_id),
        tier: tierResult.tier,
        tierLabel: tierResult.tierLabel,
        totalGames: tierResult.totalGames,
      });
    }

    // 6-b. 名簿（ktm_players）の未登録初中級者
    const targetRanks = new Set(['IRON', 'BRONZE', 'SILVER', 'UNRANKED']);
    for (const player of allPlayers || []) {
      if (!player.discord_id || addedDiscordIds.has(player.discord_id)) continue;

      // 先輩として登録されている人は除外
      if (mentors.some((m: any) => m.discord_id === player.discord_id)) continue;

      const pRank = (player.highest_rank || 'UNRANKED').toUpperCase().split(' ')[0];
      const hasLearn = learnUserIds.has(player.discord_id);

      // 初中級ランク、または「教わりたい」ロール持ち
      if (targetRanks.has(pRank) || hasLearn) {
        const roles = player.role_preferences || {};
        const primary = (roles.primary || roles.main || 'ALL').toUpperCase();
        const secondary = (roles.secondary || roles.sub || '').toUpperCase();
        const champs = Array.isArray(player.main_champions) ? player.main_champions : [];
        const pName = player.name || player.ign || 'KTMメンバー';
        const tierResult = resolveTier(player.discord_id, pName);

        pupilCandidates.push({
          profileId: null,
          playerId: player.id,
          discordId: player.discord_id,
          name: pName,
          rank: pRank,
          primaryLane: primary,
          secondaryLane: secondary,
          champions: champs,
          isRegistered: false,
          hasLearnRole: hasLearn,
          tier: tierResult.tier,
          tierLabel: tierResult.tierLabel,
          totalGames: tierResult.totalGames,
        });
      }
    }

    // 7. ペアリング評価
    const proposals: SecretMatchProposal[] = [];

    // レーン名の正規化ヘルパー
    const normalizeLane = (l: string) => {
      if (!l) return '';
      const u = l.toUpperCase();
      if (u === 'ADC' || u === 'BOT') return 'BOT';
      if (u === 'JUNGLE' || u === 'JG') return 'JUNGLE';
      if (u === 'SUPPORT' || u === 'SUP') return 'SUPPORT';
      return u;
    };

    for (const mentor of mentors) {
      // 👑 先輩資格判定: 常連（regular）または経験者（experienced）のみをお見合い候補とする
      const mentorTierInfo = resolveTier(mentor.discord_id, mentor.player_name);
      if (mentorTierInfo.tier !== 'regular' && mentorTierInfo.tier !== 'experienced') {
        continue;
      }

      const mentorRankKey = (mentor.current_rank || 'PLATINUM').toUpperCase().split(' ')[0];
      const mentorTier = RANK_ORDER[mentorRankKey] || 5;
      const mentorLanes = (mentor.lanes || []).map(normalizeLane);

      for (const pupil of pupilCandidates) {
        if (mentor.discord_id === pupil.discordId) continue;

        const pupilRankKey = pupil.rank.toUpperCase().split(' ')[0];
        const pupilTier = RANK_ORDER[pupilRankKey] || 3;

        let score = 0;
        const reasons: string[] = [];

        // レーン一致判定
        const pNorm = normalizeLane(pupil.primaryLane);
        const pSecNorm = normalizeLane(pupil.secondaryLane || '');

        const isMainMatch = mentorLanes.some((ml: string) => ml === pNorm || ml === 'ALL' || pNorm === 'ALL');
        const isSubMatch = !isMainMatch && mentorLanes.some((ml: string) => ml === pSecNorm);

        if (isMainMatch) {
          score += 45;
          reasons.push(`同レーン（${pNorm}）完全合致`);
        } else if (isSubMatch) {
          score += 30;
          reasons.push(`サブ担当レーン（${pSecNorm}）合致`);
        } else {
          // DUOシナジー (BOT x SUP, JG x MID)
          const isDuo =
            (mentorLanes.includes('BOT') && pNorm === 'SUPPORT') ||
            (mentorLanes.includes('SUPPORT') && pNorm === 'BOT') ||
            (mentorLanes.includes('JUNGLE') && pNorm === 'MID') ||
            (mentorLanes.includes('MID') && pNorm === 'JUNGLE');
          if (isDuo) {
            score += 25;
            reasons.push('連携レーンシナジー（Botライン/Mid-Jg）');
          } else {
            // レーンがまったく合わない場合は候補から外すか大幅減点
            continue;
          }
        }

        // ランク差（先輩が1〜3ティア上なら最高）
        const tierDiff = mentorTier - pupilTier;
        if (tierDiff >= 1 && tierDiff <= 3) {
          score += 30;
          reasons.push(`教わるのに最適な実力差（${mentor.current_rank} ✕ ${pupil.rank}）`);
        } else if (tierDiff >= 4) {
          score += 20;
          reasons.push(`上位ティアの先輩（+${tierDiff}ティア）`);
        } else if (tierDiff === 0) {
          score += 10;
          reasons.push('同格マッチアップ');
        } else {
          // 先輩よりランクが高い場合は除外
          continue;
        }

        // 「📖 教わりたい」ロール所持ボーナス
        if (pupil.hasLearnRole) {
          score += 20;
          reasons.push('Discordで「📖 教わりたい」表明中');
        }

        // チャンプ合致
        const mChamps = (mentor.champions || []).map((c: string) => c.toLowerCase());
        const pChamps = (pupil.champions || []).map((c: string) => c.toLowerCase());
        const shared = pChamps.filter((c: string) => mChamps.includes(c));
        if (shared.length > 0) {
          score += 15;
          reasons.push(`得意チャンプ一致（${shared.slice(0, 2).join(', ')}）`);
        }

        const finalScore = Math.min(Math.max(score, 0), 98);
        if (finalScore >= 60) {
          const pairKey = `${mentor.discord_id}_${pupil.discordId}`;
          const offerInfo = offerMap.get(pairKey);

          // 【A. クールダウン制 ＆ C. 先輩交代優先】
          // 見送りから21日以内の先輩は候補から除外（クールダウン中）！
          // これにより、この先輩は除外され、別の先輩（相性2番手・3番手）が自動的に繰り上がって候補に選ばれる。
          if (offerInfo?.isCooldown) {
            continue;
          }

          const currentOfferStatus = offerInfo?.status || 'NONE';
          const mentorTierResult = resolveTier(mentor.discord_id, mentor.player_name);

          // 相性理由にプレイヤー属性の補足を自然に追加
          const enrichedReasons = [...reasons];
          if (pupil.tierLabel) {
            enrichedReasons.push(`後輩属性: ${pupil.tierLabel}${pupil.totalGames !== undefined ? ` (通算${pupil.totalGames}戦)` : ''}`);
          }

          proposals.push({
            id: `${mentor.id}_${pupil.discordId}`,
            mentor: {
              profileId: mentor.id,
              discordId: mentor.discord_id,
              name: mentor.player_name,
              rank: mentor.current_rank || 'PLATINUM',
              lanes: mentor.lanes || [],
              champions: mentor.champions || [],
              tier: mentorTierResult.tier,
              tierLabel: mentorTierResult.tierLabel,
            },
            pupil: {
              profileId: pupil.profileId,
              playerId: pupil.playerId,
              discordId: pupil.discordId,
              name: pupil.name,
              rank: pupil.rank,
              primaryLane: pupil.primaryLane,
              secondaryLane: pupil.secondaryLane,
              isRegistered: pupil.isRegistered,
              hasLearnRole: pupil.hasLearnRole,
              tier: pupil.tier,
              tierLabel: pupil.tierLabel,
              totalGames: pupil.totalGames,
            },
            matchScore: finalScore,
            reasons: enrichedReasons,
            offerStatus: (currentOfferStatus as any) || 'NONE',
          });
        }
      }
    }

    // スコア降順（同点なら教わりたいロール優先）
    return proposals.sort((a, b) => {
      if (b.pupil.hasLearnRole !== a.pupil.hasLearnRole) {
        return b.pupil.hasLearnRole ? 1 : -1;
      }
      return b.matchScore - a.matchScore;
    });
  } catch (err) {
    console.error('[mentorshipMatchmaker] generateSecretMatchmakerPairs error:', err);
    return [];
  }
}

/**
 * 📦 後輩（弟子候補）ごとに、相性の良い先輩を最大2〜3名グルーピングした「まとめ便」データを生成
 */
export async function generateSecretMatchmakerBatches(): Promise<SecretMatchBatchProposal[]> {
  const pairs = await generateSecretMatchmakerPairs();
  const pupilMap = new Map<string, SecretMatchBatchProposal>();

  for (const pair of pairs) {
    const pupilId = pair.pupil.discordId;
    if (!pupilMap.has(pupilId)) {
      pupilMap.set(pupilId, {
        pupil: pair.pupil,
        mentors: [],
      });
    }

    const batch = pupilMap.get(pupilId)!;
    // 後輩1人につき最大3名（基本2名）まで紐付け
    if (batch.mentors.length < 3) {
      batch.mentors.push({
        profileId: pair.mentor.profileId,
        discordId: pair.mentor.discordId,
        name: pair.mentor.name,
        rank: pair.mentor.rank,
        lanes: pair.mentor.lanes,
        champions: pair.mentor.champions,
        matchScore: pair.matchScore,
        reasons: pair.reasons,
        offerStatus: pair.offerStatus,
        tier: pair.mentor.tier,
        tierLabel: pair.mentor.tierLabel,
      });
    }
  }

  // 「教わりたい」ロール所持者を最優先、次いで最高スコア順にソート
  const batches = Array.from(pupilMap.values());
  return batches.sort((a, b) => {
    if (b.pupil.hasLearnRole !== a.pupil.hasLearnRole) {
      return b.pupil.hasLearnRole ? 1 : -1;
    }
    const maxScoreA = Math.max(...a.mentors.map((m) => m.matchScore), 0);
    const maxScoreB = Math.max(...b.mentors.map((m) => m.matchScore), 0);
    return maxScoreB - maxScoreA;
  });
}



