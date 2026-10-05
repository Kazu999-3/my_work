import { getLatestPatch, formatChampId } from './ddragonClient';

export interface RosterChampion { id: string; name: string }

let cached: { patch: string; list: RosterChampion[] } | null = null;

/** DDragon の実在チャンピオン一覧（英語ID＋日本語名）。パッチ単位でキャッシュする */
export async function getRoster(): Promise<RosterChampion[]> {
  const patch = await getLatestPatch();
  if (cached && cached.patch === patch) return cached.list;
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/ja_JP/champion.json`);
  if (!res.ok) throw new Error(`DDragon champion.json の取得に失敗しました (HTTP ${res.status})`);
  const data = (await res.json()).data || {};
  const list = Object.values<any>(data)
    .map((c) => ({ id: String(c.id), name: String(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  cached = { patch, list };
  return list;
}

/** 英語ID・表記ゆれ・日本語名のどれでも、実在するチャンピオンIDに解決する（無ければ null） */
export async function resolveRosterChampion(raw: string | null | undefined): Promise<string | null> {
  const s = String(raw || '').trim();
  if (!s) return null;
  const roster = await getRoster();
  const byName = roster.find((c) => c.name === s);
  if (byName) return byName.id;
  const id = formatChampId(s).toLowerCase();
  return roster.find((c) => c.id.toLowerCase() === id)?.id || null;
}

/** カンマ・読点・スラッシュ等で区切られた複数チャンピオン名を全件解決する（実在IDの配列） */
export async function resolveRosterChampions(raw: string | null | undefined): Promise<string[]> {
  const s = String(raw || '').trim();
  if (!s) return [];
  const parts = s.split(/[,、/|]\s*|\s+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const id = await resolveRosterChampion(part);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** チャンピオンIDから日本語表示名を取得する（見つからなければそのままIDを返す） */
export async function getChampionNameJa(id: string | null | undefined): Promise<string> {
  if (!id) return '';
  const roster = await getRoster().catch(() => []);
  const found = roster.find((c) => c.id.toLowerCase() === id.toLowerCase() || c.name === id);
  return found?.name || id;
}

