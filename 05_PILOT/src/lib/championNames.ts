import { formatChampId } from './ddragonClient';

export function normalizeChampionName(name: string | null | undefined): string {
  if (!name) return '';
  return formatChampId(name);
}
