/**
 * KTM Bot チームバランスアルゴリズム (Balancer)
 * Supabaseから取得したプレイヤーデータをもとに、MMRが均等になるよう5vs5を組む。
 * 人間関係制約（こんぺいさんとtamiasさんを別にする等）も考慮する。
 */

export function performAutoBalance(players) {
  // 10人未満ならエラー
  if (!players || players.length < 10) {
    throw new Error(`プレイヤーが不足しています（現在: ${players?.length || 0}名）。10名必要です。`);
  }

  // 余剰メンバーはカスタム待機(Spectator)にするための処理
  const activePlayers = players.slice(0, 10);
  const spectators = players.slice(10).map(p => p.name);

  // 全員のMMRと制約チェック用にデータを整形
  const pool = activePlayers.map(p => ({
    name: p.name,
    discord_id: p.discord_id,
    mmr: p.mmr || 1000,
    mainLane: p.role_preferences?.primary || 'FILL',
    subLane: p.role_preferences?.secondary || 'FILL',
    currentRole: 'FILL' // 一時割り当て用
  }));

  let bestDiff = Infinity;
  let bestTeamA = [];
  let bestTeamB = [];

  // 10人から5人を選ぶ組み合わせ（252通り）を総当たり
  const combinations = getCombinations(pool, 5);

  for (const teamA of combinations) {
    // チームBは全体のプールからチームAを除いたもの
    const teamB = pool.filter(p => !teamA.some(a => a.name === p.name));

    // --- 制約チェック (Hard Constraints) ---
    // 例: こんぺいさんとtamiasさんは必ず別のチーム
    const hasKonpeiA = teamA.some(p => p.name.includes("こんぺい"));
    const hasTamiasA = teamA.some(p => p.name.includes("tamias"));
    if (hasKonpeiA && hasTamiasA) continue; // 同じチームにいるパターンは破棄
    
    const hasKonpeiB = teamB.some(p => p.name.includes("こんぺい"));
    const hasTamiasB = teamB.some(p => p.name.includes("tamias"));
    if (hasKonpeiB && hasTamiasB) continue;

    // --- MMR計算 ---
    const mmrA = teamA.reduce((sum, p) => sum + p.mmr, 0);
    const mmrB = teamB.reduce((sum, p) => sum + p.mmr, 0);
    const diff = Math.abs(mmrA - mmrB);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestTeamA = [...teamA];
      bestTeamB = [...teamB];
    }
  }

  if (bestDiff === Infinity) {
    throw new Error("制約（人間関係ルールなど）を満たすチーム分けが見つかりませんでした。");
  }

  // レーン（役割）の割り当て（簡易版: ランダムにTop, Jg, Mid, Adc, Supを振る）
  // 実際は mainLane や subLane を考慮するロジックが必要だが、まずは固定で割り当て
  const roles = ["Top", "Jg", "Mid", "Adc", "Sup"];
  assignRoles(bestTeamA, roles);
  assignRoles(bestTeamB, roles);

  return {
    status: "SUCCESS",
    result: {
      assignA: bestTeamA,
      assignB: bestTeamB,
      diff: bestDiff,
      mmrA: bestTeamA.reduce((sum, p) => sum + p.mmr, 0),
      mmrB: bestTeamB.reduce((sum, p) => sum + p.mmr, 0)
    },
    spectators: spectators
  };
}

// レーン割り当て（簡易実装：希望をなるべく優先しつつ空きに詰める）
function assignRoles(team, rolesConfig) {
  let availableRoles = [...rolesConfig];
  let unassignedPlayers = [...team];

  // 1. メインレーン希望者から埋める
  for (let i = unassignedPlayers.length - 1; i >= 0; i--) {
    const p = unassignedPlayers[i];
    const roleIdx = availableRoles.findIndex(r => r.toUpperCase() === p.mainLane?.toUpperCase());
    if (roleIdx !== -1) {
      p.currentRole = availableRoles[roleIdx];
      availableRoles.splice(roleIdx, 1);
      unassignedPlayers.splice(i, 1);
    }
  }

  // 2. サブレーン希望者を埋める
  for (let i = unassignedPlayers.length - 1; i >= 0; i--) {
    const p = unassignedPlayers[i];
    const roleIdx = availableRoles.findIndex(r => r.toUpperCase() === p.subLane?.toUpperCase());
    if (roleIdx !== -1) {
      p.currentRole = availableRoles[roleIdx];
      availableRoles.splice(roleIdx, 1);
      unassignedPlayers.splice(i, 1);
    }
  }

  // 3. 残った人を空きロールにランダム（順番）に埋める
  for (let p of unassignedPlayers) {
    p.currentRole = availableRoles.shift() || 'FILL';
  }

  // 表示用にロール順にソートする (Top -> Jg -> Mid -> Adc -> Sup)
  team.sort((a, b) => rolesConfig.indexOf(a.currentRole) - rolesConfig.indexOf(b.currentRole));
}

function getCombinations(array, size) {
  const result = [];
  function combine(start, path) {
    if (path.length === size) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      path.push(array[i]);
      combine(i + 1, path);
      path.pop();
    }
  }
  combine(0, []);
  return result;
}
