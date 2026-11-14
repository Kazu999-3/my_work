// 試合記録 API (POST /api/match/record) の型定義

export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
export type Team = 'BLUE' | 'RED';

export interface ParticipantInput {
  name: string;
  team: Team;
  role: Role;
  kills: number;
  deaths: number;
  assists: number;
  champion_name?: string | null;
  vision_score?: number;
  cs?: number;
  gold?: number | null;
  damage_dealt?: number;
  damage_taken?: number;
  objective_damage?: number;
  heal_shield?: number;
  penta_kills?: number;
}

export interface MatchRecordBody {
  winningTeam: Team;
  gameDuration?: number; // 秒
  participants: ParticipantInput[];
  riotMatchId?: string | null;
  balanceSatisfaction?: 'good' | 'normal' | 'bad' | null;
  isExhibition?: boolean;
  isFinalMatch?: boolean;
  dry_run?: boolean;
}

export interface PlayerSettlementResult {
  name: string;
  team: Team;
  role: Role;
  dbPlayer: any;
  kills: number;
  deaths: number;
  assists: number;
  champion_name?: string | null;
  vision_score?: number;
  cs?: number;
  gold?: number | null;
  damage_dealt?: number;
  damage_taken?: number;
  objective_damage?: number;
  heal_shield?: number;
  penta_kills?: number;
  kdaScore: number;
  mmrDelta: number;
  mmrBreakdown: any;
  currentMmr: number;
  newMmr: number;
  newLaneMmrs: { TOP: number; JG: number; MID: number; ADC: number; SUP: number };
  newGames: { TOP: number; JG: number; MID: number; ADC: number; SUP: number };
  newPity: number;
  newOffRolePity: number;
  consecutiveSecondary: number;
  newCoins: number;
  hasVictoryDoubler: boolean;
}
