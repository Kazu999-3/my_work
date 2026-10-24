import { Player, Role } from '../balancer';

/**
 * 11人以上の参加者から10名を選出する純粋関数。
 * 優先順位:
 *   1. 手動固定枠 (isFixed)
 *   2. 初参加枠 (games === 0) ★ 100%自動優先選出（2026-10-24）
 *   3. 待機Pity枠 (spectator_pity >= 10, 前回見学者の救済)
 *   4. 一般枠 (selectionMode に応じたソート: fair / low / high)
 */
export function selectMatchParticipants(
  allPlayers: Player[],
  selectionMode: 'fair' | 'low' | 'high' = 'fair'
): { selected: Player[]; spectators: Player[] }[] {
  const forcedSpectators = allPlayers.filter(p => p.isSpectatorFixed);
  const balanceCandidates = allPlayers.filter(p => !p.isSpectatorFixed);

  if (balanceCandidates.length <= 10) {
    return [{ selected: balanceCandidates, spectators: forcedSpectators }];
  }

  // Pity順（固定枠 > 初参加優先枠 > 待機Pity降順 > レーンPity降順 > ランダム）でソート
  const fixedPlayers = balanceCandidates.filter(p => p.isFixed);
  const candidatesPool = balanceCandidates.filter(p => !p.isFixed);

  // ★ 初参加枠（通算0戦）: 募集案内「初参加枠あり！初めて参加される方は優先的に枠を確保します」に基づき、
  // 手動で固定チェックを入れなくても100%自動で最優先選出する（2026-10-24配備）。
  const firstTimeCandidates = candidatesPool.filter(p => (p.games ?? 0) === 0);
  const normalPool = candidatesPool.filter(p => (p.games ?? 0) > 0);

  const candidateInfo = normalPool.map(p => ({
    player: p,
    pity: p.pity || 0,
    spectator_pity: p.spectator_pity || 0,
    rand: Math.random()
  }));

  const repMmr = (p: Player) => {
    const main = p.pref1 as Role;
    return (main && ['TOP', 'JG', 'MID', 'ADC', 'SUP'].includes(main))
      ? p.rates[main]
      : (Object.values(p.rates).reduce((s, v) => s + v, 0) / 5);
  };

  candidateInfo.sort((a, b) => {
    if (selectionMode !== 'fair') {
      const diff = repMmr(a.player) - repMmr(b.player);
      if (diff !== 0) return selectionMode === 'low' ? diff : -diff;
      return b.spectator_pity - a.spectator_pity;
    }

    if (b.spectator_pity !== a.spectator_pity) return b.spectator_pity - a.spectator_pity;
    if (b.pity !== a.pity) return b.pity - a.pity;
    return b.rand - a.rand;
  });

  // 待機Pity（spectator_pity）が高い人を「強制選出」にする
  const highPityCandidates = selectionMode === 'fair' ? candidateInfo.filter(c => c.spectator_pity >= 10).map(c => c.player) : [];
  const otherCandidates = candidateInfo.filter(c => !highPityCandidates.includes(c.player)).map(c => c.player);

  // 最優先選出枠（手動固定枠 + 初参加自動枠 + 待機Pity強制枠）
  const priorityPlayers = [...fixedPlayers, ...firstTimeCandidates, ...highPityCandidates];

  // 対面に必要な残り人数
  const needed = Math.max(0, 10 - priorityPlayers.length);

  const selectedPatterns: { selected: Player[]; spectators: Player[] }[] = [];

  if (needed === 0) {
    const selected = priorityPlayers.slice(0, 10);
    const selectedNames = new Set(selected.map(p => p.name));
    const spectators = [...forcedSpectators, ...balanceCandidates.filter(p => !selectedNames.has(p.name))];
    selectedPatterns.push({ selected, spectators });
  } else {
    // 残り枠を otherCandidates から選ぶ組み合わせを生成する（最大2通りに制限して爆速化）
    const poolToChooseFrom = otherCandidates.slice(0, Math.min(otherCandidates.length, needed + 4));

    const getCombinations = (array: Player[], r: number): Player[][] => {
      const result: Player[][] = [];
      const helper = (start: number, combo: Player[]) => {
        if (combo.length === r) {
          result.push([...combo]);
          return;
        }
        for (let i = start; i < array.length; i++) {
          combo.push(array[i]);
          helper(i + 1, combo);
          combo.pop();
        }
      };
      helper(0, []);
      return result;
    };

    const combos = getCombinations(poolToChooseFrom, needed);

    for (const combo of combos.slice(0, 2)) {
      const selected = [...priorityPlayers, ...combo];
      const selectedNames = new Set(selected.map(p => p.name));
      const spectators = [...forcedSpectators, ...balanceCandidates.filter(p => !selectedNames.has(p.name))];
      selectedPatterns.push({ selected, spectators });
    }
  }

  return selectedPatterns;
}
