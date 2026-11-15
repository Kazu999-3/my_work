export type Role = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';
export const ROLES: Role[] = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

export interface PlayerStat {
  name: string;
  raw_ocr_name?: string; // OCRが抽出した元の名前（学習用）
  team: 'BLUE' | 'RED';
  currentRole: Role;
  kills: number;
  deaths: number;
  assists: number;
  vision: number;
  champion_name: string;
  damage_dealt: number;
  damage_taken: number;
  heal_shield: number;
  objective_damage: number;
  cs: number;
  /** 獲得ゴールド。スコアボード画像（2枚目・任意）か、リザルト画面に数値がある時だけ入る */
  gold?: number;
  /** ペンタキル数。勝利チームの選手が1以上ならジャックポット総取り */
  penta_kills?: number;
}

export interface PlayerPoolItem {
  name: string;
  ign?: string;
}

export interface ChampionItem {
  id: string;
  name: string;
}

export interface ActiveChampSelector {
  team: 'BLUE' | 'RED';
  role: Role;
  slotIndex: number;
}
