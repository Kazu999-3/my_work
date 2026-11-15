/**
 * Sovereign OS バランサー 共通型定義 (SSoT)
 * 2026-11-15: 06_code_smells_and_dod.md に基づき any を排除し型安全化
 */

export interface CustomHandicap {
  mmrPenalty?: number;
  rule?: string;
  by?: string;
}

export interface RolePreferences {
  primary?: string;
  secondary?: string;
  ng1?: string;
  ng2?: string;
  championPool?: string;
  playStyle?: string;
  customHandicap?: CustomHandicap;
  inventory?: Array<{ id?: string; name?: string; icon?: string }>;
}

export interface BalancerPlayer {
  id: number | string;
  no?: number;
  name: string;
  is_active: boolean;
  is_fixed?: boolean;
  is_spectator_fixed?: boolean;
  rank?: string;
  mmr: number;
  role_preferences?: RolePreferences;
  customHandicap?: CustomHandicap;
  pity_count?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface BalanceTeamMember {
  name: string;
  role?: string;
  currentRole?: string;
  mainLane?: string;
  subLane?: string;
  mmr: number;
  handicap?: boolean;
  handicapRule?: string | null;
  handicapMmrPenalty?: number;
  handicappedBy?: string | null;
  isFixed?: boolean;
  isSpectatorFixed?: boolean;
  fixedRole?: string | null;
  [key: string]: unknown;
}

export interface BalanceResult {
  teamBlue?: BalanceTeamMember[];
  teamRed?: BalanceTeamMember[];
  blueTeam?: BalanceTeamMember[];
  redTeam?: BalanceTeamMember[];
  spectators?: Array<string | { name: string; [key: string]: unknown }>;
  teamBlueMMR?: number;
  teamRedMMR?: number;
  totalMmrBlue?: number;
  totalMmrRed?: number;
  blueMmr?: number;
  redMmr?: number;
  mmrDiff?: number;
  diff?: number;
  matchType?: string;
  fairnessScore?: number;
  predictedBlueWinProb?: number;
  isFestivalMode?: boolean;
  title?: string;
  rolesSatisfaction?: {
    blue: number;
    red: number;
    overall: number;
  };
  notes?: string;
  [key: string]: unknown;
}

export interface BalancerPayloadParticipant {
  name: string;
  isFixed: boolean;
  isSpectatorFixed: boolean;
  fixedRole: string | null;
  handicap: boolean;
  handicapMmrPenalty: number;
  handicapRule: string | null;
  handicappedBy: string | null;
}

export interface TableSplit {
  label: string;
  ids: (string | number)[];
}

export type SelectionMode = 'fair' | 'low' | 'high';
