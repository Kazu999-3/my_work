import type { ChampionMeta } from '../../../../lib/championMetadata';

export type ViewMode = 'region' | 'role' | 'class' | 'theme' | 'all';

export interface DraftPlayer {
  playerNumber: number;
  team?: 'BLUE' | 'RED';
  matchupPairIndex?: number;
  champions: ChampionMeta[];
  selectedChampId?: string;
}
