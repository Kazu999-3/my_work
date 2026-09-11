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
}

/**
 * 10人以上のプールから次戦のスタメン10人と観戦枠を選出する
 */
export function calculateNextRotation(
  pool: RotationPlayer[],
  roundNumber: number = 1
): RotationResult {
  if (pool.length <= 10) {
    // 10人以下の場合は全員スタメン
    const active = [...pool];
    const { blue, red } = splitIntoTwoTeams(active);
    return {
      activePlayers: active,
      benchedPlayers: [],
      blueTeam: blue,
      redTeam: red,
      roundNumber,
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
  const { blue, red } = splitIntoTwoTeams(active);

  return {
    activePlayers: active,
    benchedPlayers: benched,
    blueTeam: blue,
    redTeam: red,
    roundNumber,
  };
}

/**
 * 10人のスタメンをBLUEチームとREDチームに実力均等に分割
 */
function splitIntoTwoTeams(players: RotationPlayer[]): { blue: RotationPlayer[]; red: RotationPlayer[] } {
  // MMR順にソート (未設定は1200)
  const sorted = [...players].sort((a, b) => (b.mmr || 1200) - (a.mmr || 1200));

  const blue: RotationPlayer[] = [];
  const red: RotationPlayer[] = [];

  let blueMmr = 0;
  let redMmr = 0;

  // スネークドラフト方式で均等に振り分け
  sorted.forEach((p, idx) => {
    const mmr = p.mmr || 1200;
    if (blue.length < 5 && red.length < 5) {
      if (blueMmr <= redMmr) {
        blue.push(p);
        blueMmr += mmr;
      } else {
        red.push(p);
        redMmr += mmr;
      }
    } else if (blue.length < 5) {
      blue.push(p);
      blueMmr += mmr;
    } else {
      red.push(p);
      redMmr += mmr;
    }
  });

  return { blue, red };
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
