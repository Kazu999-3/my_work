/**
 * ARAM / 大人数カスタム 公平ローテーション ＆ 観戦シャッフルエンジン
 * =================================================================
 * 10人以上の参加者がいる場合に、全員が均等に試合に参加でき、
 * 観戦枠（待機）のメンバーが次戦で100%スタメン出場できるように自動制御する。
 */

export interface RotationPlayer {
  id: string;
  name: string;
  ign?: string;
  highest_rank?: string;
  mmr?: number;
  assignedRole?: 'TOP' | 'JUNGLE' | 'MID' | 'BOT' | 'SUPPORT';
  // ローテーション用統計
  gamesPlayed: number;       // 出場した総試合数
  benchedCount: number;      // 観戦（待機）した総回数
  consecutivePlayed: number; // 連続で出場した試合数
  wasBenchedLastGame: boolean; // 直前の試合で観戦枠だったか
}

export interface RotationResult {
  activePlayers: RotationPlayer[];  // 次戦のスタメン10人
  benchedPlayers: RotationPlayer[]; // 次戦の観戦・待機枠
  blueTeam: RotationPlayer[];       // BLUEチーム (5人)
  redTeam: RotationPlayer[];        // REDチーム (5人)
  roundNumber: number;              // 試合番号（第1試合、第2試合...）
  blueMmr?: number;
  redMmr?: number;
  mmrDiff?: number;
  hasRoles?: boolean;
}

const ROLES: ('TOP' | 'JUNGLE' | 'MID' | 'BOT' | 'SUPPORT')[] = ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'];

/**
 * 10人以上のプールから次戦のスタメン10人と観戦枠を選出する
 */
export function calculateNextRotation(
  pool: RotationPlayer[],
  roundNumber: number = 1,
  options?: { assignRoles?: boolean }
): RotationResult {
  const assignRoles = options?.assignRoles ?? false;

  if (pool.length <= 10) {
    // 10人以下の場合は全員スタメン
    const active = [...pool];
    const { blue, red, blueMmr, redMmr } = splitIntoBalancedTeams(active, assignRoles);
    return {
      activePlayers: active,
      benchedPlayers: [],
      blueTeam: blue,
      redTeam: red,
      roundNumber,
      blueMmr,
      redMmr,
      mmrDiff: Math.abs(blueMmr - redMmr),
      hasRoles: assignRoles,
    };
  }

  // スコアリングによる公平選出
  // 優先度が高い（スタメンになりやすい）順にソート
  const sorted = [...pool].sort((a, b) => {
    // 1. 直前に観戦していた人は絶対最優先
    if (a.wasBenchedLastGame !== b.wasBenchedLastGame) {
      return a.wasBenchedLastGame ? -1 : 1;
    }

    // 2. 総試合数が少ない人を優先
    if (a.gamesPlayed !== b.gamesPlayed) {
      return a.gamesPlayed - b.gamesPlayed;
    }

    // 3. 連続出場数が少ない人を優先（連戦している人を休憩させる）
    if (a.consecutivePlayed !== b.consecutivePlayed) {
      return a.consecutivePlayed - b.consecutivePlayed;
    }

    // 4. 観戦回数が多い人を優先
    if (a.benchedCount !== b.benchedCount) {
      return b.benchedCount - a.benchedCount;
    }

    // 5. 同点時はランダム
    return Math.random() - 0.5;
  });

  const active = sorted.slice(0, 10);
  const benched = sorted.slice(10);

  // 10人をBLUE/REDに均等分割（MMR考慮）
  const { blue, red, blueMmr, redMmr } = splitIntoBalancedTeams(active, assignRoles);

  return {
    activePlayers: active,
    benchedPlayers: benched,
    blueTeam: blue,
    redTeam: red,
    roundNumber,
    blueMmr,
    redMmr,
    mmrDiff: Math.abs(blueMmr - redMmr),
    hasRoles: assignRoles,
  };
}

/**
 * 10人のスタメンをBLUEチームとREDチームに実力均等に分割
 * 10C5 = 252通りの全探索を行い、チーム合計MMR差が最小になる分け方を特定する。
 * 同点または差が僅差（100以内）の組み合わせからランダムに1つ選定し、偏りを防止。
 * assignRolesがtrueの場合は、各チーム内で5つのロールをランダムに割り当てる。
 */
export function splitIntoBalancedTeams(
  players: RotationPlayer[],
  assignRoles: boolean = false
): { blue: RotationPlayer[]; red: RotationPlayer[]; blueMmr: number; redMmr: number } {
  if (players.length !== 10) {
    // 10人未満のフォールバック
    const half = Math.ceil(players.length / 2);
    const blue = players.slice(0, half);
    const red = players.slice(half);
    const blueMmr = blue.reduce((s, p) => s + (p.mmr || 1200), 0);
    const redMmr = red.reduce((s, p) => s + (p.mmr || 1200), 0);
    return { blue, red, blueMmr, redMmr };
  }

  const n = 10;
  const k = 5;
  const combinations: number[][] = [];

  function getComb(start: number, chosen: number[]) {
    if (chosen.length === k) {
      combinations.push([...chosen]);
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(i);
      getComb(i + 1, chosen);
      chosen.pop();
    }
  }
  getComb(0, []);

  const totalMmr = players.reduce((s, p) => s + (p.mmr || 1200), 0);
  const targetMmr = totalMmr / 2;

  let bestComb: number[] = combinations[0];
  let minDiff = Infinity;
  const goodCandidates: { comb: number[]; diff: number }[] = [];

  for (const comb of combinations) {
    const blueMmr = comb.reduce((s, idx) => s + (players[idx].mmr || 1200), 0);
    const redMmr = totalMmr - blueMmr;
    const diff = Math.abs(blueMmr - redMmr);

    if (diff < minDiff) {
      minDiff = diff;
      bestComb = comb;
    }

    // 差が120以下の良バランス候補を収集
    if (diff <= 120) {
      goodCandidates.push({ comb, diff });
    }
  }

  // 良候補が複数あればその中からランダム選択して毎回同じ分け方になるのを防ぐ
  const chosenIndices = goodCandidates.length > 0
    ? goodCandidates[Math.floor(Math.random() * goodCandidates.length)].comb
    : bestComb;

  const chosenSet = new Set(chosenIndices);
  let blueTeam = players.filter((_, idx) => chosenSet.has(idx));
  let redTeam = players.filter((_, idx) => !chosenSet.has(idx));

  // ロールランダム割り当て
  if (assignRoles) {
    const shuffledRolesBlue = [...ROLES].sort(() => Math.random() - 0.5);
    const shuffledRolesRed = [...ROLES].sort(() => Math.random() - 0.5);

    blueTeam = blueTeam.map((p, idx) => ({
      ...p,
      assignedRole: shuffledRolesBlue[idx],
    }));

    redTeam = redTeam.map((p, idx) => ({
      ...p,
      assignedRole: shuffledRolesRed[idx],
    }));

    // ロール順（TOP, JUNGLE, MID, BOT, SUPPORT）にソートして見やすく配置
    const roleOrder: Record<string, number> = { TOP: 0, JUNGLE: 1, MID: 2, BOT: 3, SUPPORT: 4 };
    blueTeam.sort((a, b) => roleOrder[a.assignedRole!] - roleOrder[b.assignedRole!]);
    redTeam.sort((a, b) => roleOrder[a.assignedRole!] - roleOrder[b.assignedRole!]);
  }

  const blueMmr = blueTeam.reduce((s, p) => s + (p.mmr || 1200), 0);
  const redMmr = redTeam.reduce((s, p) => s + (p.mmr || 1200), 0);

  return { blue: blueTeam, red: redTeam, blueMmr, redMmr };
}

/**
 * 試合終了時にプレイヤー全員のステータスを更新する
 */
export function advanceRotationState(
  pool: RotationPlayer[],
  activePlayerIds: string[]
): RotationPlayer[] {
  const activeSet = new Set(activePlayerIds);

  return pool.map((p) => {
    const isActive = activeSet.has(p.id);
    if (isActive) {
      return {
        ...p,
        gamesPlayed: p.gamesPlayed + 1,
        consecutivePlayed: p.consecutivePlayed + 1,
        wasBenchedLastGame: false,
      };
    } else {
      return {
        ...p,
        benchedCount: p.benchedCount + 1,
        consecutivePlayed: 0,
        wasBenchedLastGame: true,
      };
    }
  });
}
