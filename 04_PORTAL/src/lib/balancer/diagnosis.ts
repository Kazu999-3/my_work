// 内戦バランサーの参加者診断（格差診断・卓分割）。2026-10-07 app/balancer/page.tsx から分離（処理は分離前と同じ）。

export interface GapDiagnosis {
  orphans: { player: any; gap: number; nearest: number }[];
  spread: number;
}

/**
 * 格差診断: 参加者をMMR順に2人ずつペアにし、「近い実力の相手がいない人」を検出する。
 * チーム全体のMMR幅より「レーン対面の格差」が体験に効くため、対面を組めない外れ値を警告する。
 */
export function diagnoseMmrGaps(players: any[], GAP_THRESHOLD: number): GapDiagnosis | null {
  const act = players.filter((p: any) => p.is_active);
  if (act.length < 10) return null;
  const sorted = [...act].sort((a: any, b: any) => (b.mmr || 1200) - (a.mmr || 1200));
  const orphans: { player: any; gap: number; nearest: number }[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const a = sorted[i], b = sorted[i + 1];
    if (!b) break; // 奇数余りは観戦候補なのでスキップ
    const gap = (a.mmr || 1200) - (b.mmr || 1200);
    if (gap > GAP_THRESHOLD) {
      // ペアの相手と離れすぎ＝この2人のどちらかが浮いている。上側を外れ値として報告
      orphans.push({ player: a, gap, nearest: b.mmr || 1200 });
    }
  }
  return orphans.length > 0 ? { orphans, spread: (sorted[0].mmr || 1200) - (sorted[sorted.length - 1].mmr || 1200) } : null;
}

/**
 * 卓分割: 参加者が20人以上のとき、代表MMR順で「上位卓/下位卓」に自動分割する。
 * 卓分け=代表MMR(ktm_players.mmr)、卓の中のチーム分け=レーン別MMR、という役割分担。
 */
export function splitTables(players: any[]) {
  const act = players.filter((p: any) => p.is_active);
  if (act.length < 20) return null;
  const sorted = [...act].sort((a: any, b: any) => (b.mmr || 1200) - (a.mmr || 1200));
  const half = Math.floor(sorted.length / 2);
  // 10人単位で切り出す（20人なら10/10、24人なら12人ずつではなく上位10/下位10＋残りは待機）
  const upper = sorted.slice(0, 10);
  const lower = sorted.slice(half, half + 10);
  return {
    upper: { label: '上位卓', members: upper, ids: upper.map((p: any) => p.id) },
    lower: { label: '下位卓', members: lower, ids: lower.map((p: any) => p.id) },
    total: act.length,
  };
}
