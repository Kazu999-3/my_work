/**
 * スコアボード画像（2枚目・任意）から読んだ CS・ゴールドを、記録画面の各行に割り当てる（2026-10-17）。
 *
 * スコアボード画面は名前が省略されチャンピオンの顔も小さいので、名前では突き合わせない。
 * 1枚目（リザルト画面）で確定した「チーム＋K/D/A」が一致する行に入れる。
 * チーム1/チーム2 が BLUE/RED のどちらかは画面から決めず、K/D/A が多く一致する向きを採用する。
 */
export interface ScoreboardRow {
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  cs: number | null;
  gold: number | null;
}

export interface MergeTarget {
  team: 'BLUE' | 'RED';
  kills: number;
  deaths: number;
  assists: number;
}

export interface MergeResult {
  /** 対象の各行に対応するスコアボードの行（見つからなければ null） */
  rows: (ScoreboardRow | null)[];
  matched: number;
}

const toRow = (r: any): ScoreboardRow => {
  const n = (v: any) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return { kills: n(r?.kills), deaths: n(r?.deaths), assists: n(r?.assists), cs: n(r?.cs), gold: n(r?.gold) };
};

function assign(targets: MergeTarget[], blue: ScoreboardRow[], red: ScoreboardRow[]): MergeResult {
  const used = { BLUE: new Set<number>(), RED: new Set<number>() };
  const rows: (ScoreboardRow | null)[] = targets.map((t) => {
    const pool = t.team === 'BLUE' ? blue : red;
    const i = pool.findIndex((r, idx) => !used[t.team].has(idx)
      && r.kills === t.kills && r.deaths === t.deaths && r.assists === t.assists);
    if (i < 0) return null;
    used[t.team].add(i);
    return pool[i];
  });
  return { rows, matched: rows.filter(Boolean).length };
}

export function mergeScoreboard(targets: MergeTarget[], team1Raw: any[], team2Raw: any[]): MergeResult {
  const team1 = (Array.isArray(team1Raw) ? team1Raw : []).map(toRow);
  const team2 = (Array.isArray(team2Raw) ? team2Raw : []).map(toRow);
  const a = assign(targets, team1, team2);
  const b = assign(targets, team2, team1);
  return b.matched > a.matched ? b : a;
}
