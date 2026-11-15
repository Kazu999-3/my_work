import type { MmrBreakdown } from '../../../lib/mmr';

export interface Participant {
  player_name: string;
  team: 'BLUE' | 'RED' | 'FESTIVAL';
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  kda_score: number;
  mmr_delta: number;
  mmr_breakdown?: MmrBreakdown | null;
  champion_name?: string;
  cs?: number;
  gold?: number | null;
  damage_dealt?: number;
  damage_taken?: number;
  vision_score?: number;
  items?: number[];
  spells?: number[];
  cc_time?: number;
  solo_kills?: number;
  time_dead?: number;
  damage_mitigated?: number;
  building_damage?: number;
}

export interface Match {
  id: string;
  created_at: string;
  winning_team: 'BLUE' | 'RED' | 'DRAW';
  game_duration?: number | null;
  riot_match_id?: string | null;
  match_type?: string | null;
  participants: Participant[];
}
