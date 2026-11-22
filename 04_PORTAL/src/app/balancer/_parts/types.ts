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
  tier_promotion_pref?: 'mix_ok' | 'fill_only' | 'never';
  allow_lower_support?: boolean;
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
  balanceReport?: string | string[];
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
  forceOffroleForLowerBand?: boolean;
}

export interface TableSplit {
  label: string;
  ids: (string | number)[];
  band?: 'UPPER' | 'LOWER';
}

export type SelectionMode = 'fair' | 'low' | 'high';


import type { Bo3State } from "../components/BalancerBo3Manager";

export interface FestivalRestriction {
  level: 'light' | 'medium' | 'heavy';
  levelLabel: string;
  title: string;
  description: string;
}

export interface LaneClashData {
  role: string;
  games: number;
  bluePlayer: string;
  redPlayer: string;
  blueWins: number;
  redWins: number;
  headline?: string;
}

export interface GoldenDuoData {
  teamSide: 'BLUE' | 'RED';
  player1: string;
  player2: string;
  label: string;
  winRate?: number;
  games?: number;
}

export interface FeaturedClashData {
  type: 'NEMESIS' | 'RIVAL';
  headline: string;
  subtext: string;
  bluePlayer: string;
  redPlayer: string;
  blueWins: number;
  redWins: number;
}

export interface ClashResponseData {
  success: boolean;
  featuredClash?: FeaturedClashData;
  goldenDuos?: GoldenDuoData[];
  laneClashes?: LaneClashData[];
}

export interface BalanceResultModalProps {
  players: BalancerPlayer[];
  savingPending: boolean;
  copiedResult: boolean;
  setMessage: React.Dispatch<React.SetStateAction<any>>;
  balanceResult: BalanceResult | null;
  setBalanceResult: React.Dispatch<React.SetStateAction<any>>;
  proposals: BalanceResult[];
  selectedProposalIdx: number;
  setSelectedProposalIdx: React.Dispatch<React.SetStateAction<number>>;
  analysis: {
    level: string;
    message: string;
    averageMMR: number;
    minMMR: number;
    maxMMR: number;
    mmrRange: number;
    [key: string]: unknown;
  } | Record<string, any> | null;
  swapSource: { team: string; role: string; name: string } | null;
  sendingDiscord: boolean;
  setShowResultModal: (show: boolean) => void;
  selectedTable: { label: string; ids: (string | number)[] } | null;
  dragOverSlot: string | null;
  bo3State: Bo3State | null | undefined;
  handleStartBo3: () => void;
  handleRecordBo3Win: (side: 'BLUE' | 'RED') => void;
  handleNextBo3Game: () => void;
  handleResetBo3: () => void;
  handleRecordNavigate: () => void;
  handleSendDiscord: () => void;
  handleCopyResultText: () => void;
  handleDragStart: (e: React.DragEvent, team: string, role: string, name: string) => void;
  handleDragOver: (e: React.DragEvent, slotKey: string) => void;
  handleDragLeave: () => void;
  handleDropPlayer: (e: React.DragEvent, targetTeam: 'teamBlue' | 'teamRed' | 'spectators', targetRole: string) => void;
  handleSelectSwapPlayer: (team: string, role: string, name: string) => void;
  renderSwapSelect: (team: 'teamBlue' | 'teamRed' | 'spectators', role: string, currentPlayerName: string) => React.ReactNode;
  handicapNames: Set<string>;
  handleSwapWholeTeams?: () => void;
}
