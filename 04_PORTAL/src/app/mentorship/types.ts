import type { MentorshipProfile } from '../api/mentorship/profiles/route';

export interface MentorshipMatchMeta {
  durationKey?: string;
  durationLabel?: string;
  durationDays?: number;
  commStyle?: string;
  autoRenew?: boolean;
  message?: string;
  fromDiscordId?: string;
  cancelReason?: string;
  progressNotes?: string;
  targetRank?: string;
  threadId?: string;
  threadUrl?: string;
  [key: string]: any;
}

export interface MentorshipMatch {
  id: string;
  pupil_discord_id: string;
  mentor_discord_id: string;
  status: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  started_at?: string;
  expires_at?: string;
  meta?: MentorshipMatchMeta;
  pupil?: MentorshipProfile;
  mentor?: MentorshipProfile;
  pupil_profile?: MentorshipProfile;
  mentor_profile?: MentorshipProfile;
  thread_url?: string;
  thread_id?: string;
  [key: string]: any;
}

export interface SecretProposal {
  matchId: string;
  isMentor?: boolean;
  offeredAt?: string;
  proposalId?: string;
  partnerProfile?: MentorshipProfile;
  partnerName?: string;
  partnerDiscordId?: string;
  status?: string;
  [key: string]: any;
}

export interface UserTierInfo {
  tier: string;
  label: string;
  totalGames: number;
  canBeMentor?: boolean;
  [key: string]: any;
}
