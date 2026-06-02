/**
 * ⚖️ バランサー (チーム分けアルゴリズム)
 */

function uiBalanceTeams() {
  try {
    const result = coreBalanceTeams();
    SpreadsheetApp.getUi().alert('チーム分けが完了しました！');
  } catch (e) {
    SpreadsheetApp.getUi().alert('エラー: ' + e.message);
  }
}

function selectPlayersWithPityInternal(allNames, fixedNames) {
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  const playerData = playerSheet.getDataRange().getValues();
  
  const candidatesPool = allNames.filter(n => !fixedNames.includes(n));
  const candidateInfo = candidatesPool.map(name => {
    const pIdx = playerData.findIndex(r => String(r[0]).trim() === name);
    const pity = pIdx !== -1 ? (Number(playerData[pIdx][12]) || 0) : 0;
    return { name, pity, rand: Math.random() };
  });
  
  candidateInfo.sort((a, b) => (b.pity - a.pity) || (b.rand - a.rand));
  const needed = Math.max(0, 10 - fixedNames.length);
  const selectedFromPool = candidateInfo.slice(0, needed).map(c => c.name);
  const spilled = candidateInfo.slice(needed).map(c => c.name);
  
  return { players: [...fixedNames, ...selectedFromPool].slice(0, 10), spectators: spilled };
}

function coreBalanceTeams() {
  const inputSheet = getSheet(SHEET_NAMES.INPUT);
  const playerSheet = getSheet(SHEET_NAMES.PLAYERS);
  if (!inputSheet || !playerSheet) throw new Error('シートが見つかりません。');

  const dataA = inputSheet.getRange('A2:A11').getValues().flat().map(n => String(n).trim());
  const dataB = inputSheet.getRange('B2:B11').getValues().flat().map(r => String(r).trim().toUpperCase());
  const dataG = inputSheet.getRange('G2:G11').getValues().flat().map(f => !!f);
  
  const names = dataA.filter(n => n && n !== ""); 
  const playersCount = names.length;
  let finalPlayers = names;
  let spectators = [];

  if (playersCount > 10) {
    const fixedIndices = inputSheet.getRange('H2:H21').getValues().flat().map((v, i) => v === true ? i : -1).filter(i => i !== -1);
    const fixedNames = fixedIndices.map(i => names[i]).filter(n => n);
    const selection = selectPlayersWithPityInternal(names, fixedNames);
    finalPlayers = selection.players;
    spectators = selection.spectators;
    
    const playerRows = new Array(10).fill([""]);
    finalPlayers.forEach((n, i) => { playerRows[i] = [n]; });
    inputSheet.getRange('A2:A11').setValues(playerRows);
    inputSheet.getRange('A14:A20').clearContent();
    if (spectators.length > 0) {
      const spectRows = spectators.map(n => [n]);
      inputSheet.getRange(14, 1, spectRows.length, 1).setValues(spectRows);
    }
    SpreadsheetApp.flush();
  }

  const rolesOrder = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const fixedCountPerRole = {};
  rolesOrder.forEach(r => fixedCountPerRole[r] = 0);
  
  const playerData = playerSheet.getDataRange().getValues();
  const players = [];
  for (let i = 0; i < 10; i++) {
    const name = dataA[i];
    const rowIdx = playerData.findIndex(r => String(r[0]).trim() === name);
    if (rowIdx === -1) throw new Error('「' + name + '」が見つかりません。');
    const row = playerData[rowIdx];
    
    const isFixed = dataG[i];
    const fixedRole = rolesOrder.includes(dataB[i]) ? dataB[i] : null;
    if (isFixed && fixedRole) {
      fixedCountPerRole[fixedRole]++;
      if (fixedCountPerRole[fixedRole] > 2) throw new Error(`${fixedRole} に3名以上の固定は不可です。`);
    }

    players.push({
      name: name, pref1: String(row[2]).trim().toUpperCase(), pref2: String(row[3]).trim().toUpperCase(),
      pity: Number(row[12]) || 0, games: 0, 
      ng1: String(row[4] || "").trim().toUpperCase(), ng2: String(row[5] || "").trim().toUpperCase(),
      isFixed: isFixed, fixedRole: fixedRole,
      weight: Number(row[20]) || 2, allowHigher: (String(row[21]).toLowerCase() === "true"),
      rates: { 'TOP': Number(row[7])||1200, 'JG': Number(row[8])||1200, 'MID': Number(row[9])||1200, 'ADC': Number(row[10])||1200, 'SUP': Number(row[11])||1200 }
    });
  }

  // ━━━ 案K：こだわり度1（絶対）の過剰競合を自動調停 ━━━
  // 同一ロールにweight=1が3人以上いる場合、Pity最低（最近メインをプレイできた）の人をweight=2に降格
  rolesOrder.forEach(role => {
    const strictCandidates = players
      .filter(p => p.pref1 === role && p.weight === 1 && !p.isFixed)
      .sort((a, b) => a.pity - b.pity); // Pity低い順
    if (strictCandidates.length > 2) {
      for (let i = 2; i < strictCandidates.length; i++) {
        strictCandidates[i].weight = 2; // 今回だけ「通常」扱いに格下げ
      }
    }
  });

  const statsMap = getGlobalStatsMap();
  players.forEach(p => {
    const s = statsMap[p.name.toUpperCase()];
    p.games = (s ? s.games : 0);
    p.winRate = (s && s.games >= 3) ? (s.wins / s.games * 100) : 50.0;
    
    const rowIdx = playerData.findIndex(r => String(r[0]).trim() === p.name);
    p.rank = rowIdx !== -1 ? String(playerData[rowIdx][1]).toUpperCase().trim() : 'UNRANKED';
    p.isNewbie = (p.rank === 'UNRANKED' && p.games < 3);
  });
  
  const allMMRs = players.map(p => Object.values(p.rates).reduce((s,v)=>s+v,0)/5);
  const globalAvgMMR = allMMRs.reduce((s,v)=>s+v,0)/10;
  
  players.forEach((p, i) => {
    const avgP = allMMRs[i];
    p.avgMMR = avgP;
    p.isOutlierLow = (avgP < globalAvgMMR - 1500); // 平均より1500以上低い
    p.isOutlierHigh = (avgP > globalAvgMMR + 1000); // 平均より1000以上高い
  });

  // ━━━ 案A：ハンデMMR — チーム分け計算専用の補正レートを生成 ━━━
  // 実力MMRは変更せず、チームバランス評価のみに「差の50%を縮めた値」を使用
  // 効果：格下プレイヤーが「弱チームの調整役」に固定されにくくなる
  // 【案3：低勝率救済】勝率が42%を下回るプレイヤーは、チーム分け評価時にレートをさらに低く見積もり（勝率1%下回るごとに -15）、強い味方と組める確率を上げる
  players.forEach(p => {
    p.adjustedRates = {};
    let wrPityPenalty = 0;
    if (p.games >= 5 && p.winRate < 42) {
      wrPityPenalty = Math.round((42 - p.winRate) * 15);
      wrPityPenalty = Math.min(250, wrPityPenalty); // 最大補正幅は250
    }
    rolesOrder.forEach(role => {
      const raw = p.rates[role];
      const adj = Math.round(raw + (globalAvgMMR - raw) * 0.5) - wrPityPenalty;
      p.adjustedRates[role] = Math.max(100, adj); // 最低100は維持
    });
  });

  const sortedByWR = [...players].sort((a, b) => b.winRate - a.winRate);
  const bestWRPlayerName = sortedByWR[0].name;
  const worstWRPlayerName = sortedByWR[9].name;

  const sortedByMMR = [...players].sort((a, b) => b.avgMMR - a.avgMMR);
  const lowestMMRPlayerName = sortedByMMR[9].name;

  const history = getMatchupHistory();
  // 案H: 同チームメイト重複回避
  const teammateHistory = getTeammateHistory();
  // 案I: 直近2連勝チームのセット（連勝なければnull）
  const winStreakTeam = getRecentWinStreakTeams();
  const topResults = [];
  const combinations = getCombinations([0,1,2,3,4,5,6,7,8,9], 5);
  const perms = getPermutations([0,1,2,3,4]);

  // ━━━ Greedy役割割り当て（フェーズ1スクリーニング用） ━━━
  function greedyAssign(team) {
    const assigned = new Array(5).fill(-1);
    const roleUsed = new Array(5).fill(false);
    // 1. 固定ロール優先
    for (let i = 0; i < 5; i++) {
      if (team[i].isFixed && team[i].fixedRole) {
        const ri = rolesOrder.indexOf(team[i].fixedRole);
        if (ri !== -1 && !roleUsed[ri]) { assigned[i] = ri; roleUsed[ri] = true; }
      }
    }
    // 2. メインロール
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      const ri = rolesOrder.indexOf(team[i].pref1);
      if (ri !== -1 && !roleUsed[ri] && rolesOrder[ri] !== team[i].ng1 && rolesOrder[ri] !== team[i].ng2) {
        assigned[i] = ri; roleUsed[ri] = true;
      }
    }
    // 3. サブロール
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      const ri = rolesOrder.indexOf(team[i].pref2);
      if (ri !== -1 && !roleUsed[ri] && rolesOrder[ri] !== team[i].ng1 && rolesOrder[ri] !== team[i].ng2) {
        assigned[i] = ri; roleUsed[ri] = true;
      }
    }
    // 4. NG以外の空きロール
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      for (let r = 0; r < 5; r++) {
        if (!roleUsed[r] && rolesOrder[r] !== team[i].ng1 && rolesOrder[r] !== team[i].ng2) {
          assigned[i] = r; roleUsed[r] = true; break;
        }
      }
    }
    // 5. 最終手段（残り）
    for (let i = 0; i < 5; i++) {
      if (assigned[i] !== -1) continue;
      for (let r = 0; r < 5; r++) {
        if (!roleUsed[r]) { assigned[i] = r; roleUsed[r] = true; break; }
      }
    }
    return assigned;
  }

  // ━━━ フェーズ1：全252通りをGreedyで高速スクリーニング → 上位20件を選抜 ━━━
  const screenResults = [];
  for (const teamAIndices of combinations) {
    const teamBIndices = [0,1,2,3,4,5,6,7,8,9].filter(i => !teamAIndices.includes(i));
    const teamA = teamAIndices.map(i => players[i]);
    const teamB = teamBIndices.map(i => players[i]);

    // 特定の二人（こんぺい、tamias）が同じチームに入らないように制限
    const checkSameTeam = (name1, name2) => {
      const n1 = name1.toLowerCase().trim();
      const n2 = name2.toLowerCase().trim();
      const hasN1A = teamA.some(p => p.name.toLowerCase().trim() === n1);
      const hasN2A = teamA.some(p => p.name.toLowerCase().trim() === n2);
      const hasN1B = teamB.some(p => p.name.toLowerCase().trim() === n1);
      const hasN2B = teamB.some(p => p.name.toLowerCase().trim() === n2);
      return (hasN1A && hasN2A) || (hasN1B && hasN2B);
    };

    if (checkSameTeam("こんぺい", "tamias")) {
      continue;
    }

    const pA = greedyAssign(teamA);
    const pB = greedyAssign(teamB);

    let totalA = 0, totalB = 0;
    for (let i = 0; i < 5; i++) {
      totalA += teamA[i].rates[rolesOrder[pA[i]]];
      totalB += teamB[i].rates[rolesOrder[pB[i]]];
    }
    screenResults.push({ quickScore: Math.abs(totalA - totalB), teamAIndices, teamBIndices });
  }
  screenResults.sort((a, b) => a.quickScore - b.quickScore);
  const topCandidates = screenResults.slice(0, 50); // 上位50件を精密探索（精度向上）

  // ━━━ フェーズ2：上位50件を全順列探索（50 × 14,400 = 720,000回） ━━━
  for (const candidate of topCandidates) {
    const { teamAIndices, teamBIndices } = candidate;
    const teamA = teamAIndices.map(i => players[i]);
    const teamB = teamBIndices.map(i => players[i]);

    // ━━━ チーム構成ペナルティ（ロール割り当て非依存 → 外側で1回だけ計算） ━━━
    let compositionPenalty = 0;

    // 案H: 同チームメイト重複ペナルティ（直近10試合で3回以上同じ味方 → 加算）
    const addTeammatePenalty = (teamIndices) => {
      const names = teamIndices.map(i => players[i].name);
      for (let x = 0; x < names.length; x++) {
        for (let y = x + 1; y < names.length; y++) {
          const key = [names[x], names[y]].sort().join("<=>");
          const count = teammateHistory.get(key) || 0;
          // 3回目から加速的にペナルティを加算（3回目=8000, 4回目=16000, ...）
          if (count >= 3) compositionPenalty += (count - 2) * 8000;
        }
      }
    };
    addTeammatePenalty(teamAIndices);
    addTeammatePenalty(teamBIndices);

    // 案I: 連勝チームの強制シャッフル（同じ5人が2連勝していたら再結成を強く阻止）
    if (winStreakTeam && winStreakTeam.size === 5) {
      const setsEqual = (a, b) => a.size === b.size && [...a].every(v => b.has(v));
      const teamASet = new Set(teamAIndices.map(i => players[i].name));
      const teamBSet = new Set(teamBIndices.map(i => players[i].name));
      if (setsEqual(teamASet, winStreakTeam) || setsEqual(teamBSet, winStreakTeam)) {
        compositionPenalty += 150000; // 連勝チームそのまま再結成はほぼ阻止
      }
    }

    for (const pA of perms) {
      let validA = true;
      for (let i = 0; i < 5; i++) {
        const role = rolesOrder[pA[i]];
        if (teamA[i].isFixed && teamA[i].fixedRole && teamA[i].fixedRole !== role) {
          validA = false; break;
        }
      }
      if (!validA) continue;
      
      for (const pB of perms) {
        let validB = true;
        for (let i = 0; i < 5; i++) {
          const role = rolesOrder[pB[i]];
          if (teamB[i].isFixed && teamB[i].fixedRole && teamB[i].fixedRole !== role) {
            validB = false; break;
          }
        }
        if (!validB) continue;

        // compositionPenaltyを初期値に設定（案H+Iのチーム構成ペナルティを引き継ぐ）
        let penalty = compositionPenalty, totalA = 0, totalB = 0;
        let lanesAdvantagedA = 0, lanesAdvantagedB = 0;
        let highRankCountA = 0, highRankCountB = 0;
        // ★新設：チーム別レーン優位スコア（MMR差の強い側を累積）
        let laneAdvantageScoreA = 0, laneAdvantageScoreB = 0;
        // ★新設：メインレーン充足人数（10人中何人がメインレーンになれたか）
        let mainCount = 0;
        const HIGH_RANKS = ['PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];

        for (let rIdx = 0; rIdx < 5; rIdx++) {
          const role = rolesOrder[rIdx];
          const aIdx = pA.indexOf(rIdx);
          const bIdx = pB.indexOf(rIdx);
          const pLayerA = teamA[aIdx];
          const pLayerB = teamB[bIdx];
          const mmrA = pLayerA.rates[role];    // 生 MMR（checkOpponent等の対面チェックに使用）
          const mmrB = pLayerB.rates[role];    // 生 MMR
          const adjA = pLayerA.adjustedRates[role]; // 案A: 補正MMR（バランス評価に使用）
          const adjB = pLayerB.adjustedRates[role]; // 案A: 補正MMR

          // 案A: レーン単位の格差評価は補正MMRで行う（実力差を縮めた評価）
          penalty += Math.pow(Math.abs(adjA - adjB), 2) / 4;
          totalA += adjA; totalB += adjB;

          // 案A: レーン有利スコアも補正MMRで計算
          laneAdvantageScoreA += Math.max(0, adjA - adjB);
          laneAdvantageScoreB += Math.max(0, adjB - adjA);

          // 案A: レーン有利カウントも補正MMRで
          if (adjA > adjB + 150) lanesAdvantagedA++;
          if (adjB > adjA + 150) lanesAdvantagedB++;

          // 高ランク(プラチナ以上)のカウント
          if (HIGH_RANKS.includes(pLayerA.rank)) highRankCountA++;
          if (HIGH_RANKS.includes(pLayerB.rank)) highRankCountB++;

          // ★修正：ロール込みのキーで対面重複を判定 + ペナルティを200→15,000に引き上げ
          const matchupHistKey = [pLayerA.name, pLayerB.name].sort().join("<=>") + ":" + role;
          if (history.has(matchupHistKey)){penalty += 15000;}

          const checkOpponent = (p, opp, currentRole) => {
             const oppMmr = opp.rates[currentRole];
             const mmrDiff = oppMmr - p.rates[currentRole];
             const isHigherOpp = mmrDiff > 600;
             const isMainLane = (currentRole === p.pref1);
             
             if (isHigherOpp) {
               if (!isMainLane) penalty += Math.pow(mmrDiff, 2) * 2; 
               if (p.allowHigher === false) {
                 penalty += Math.pow(mmrDiff, 2) * 10;
                 penalty += 5000;
               }
             }

             if (p.isOutlierLow && (opp.isOutlierHigh || mmrDiff > 1200)) {
               penalty += 20000; 
             }
          };
          checkOpponent(pLayerA, pLayerB, role);
          checkOpponent(pLayerB, pLayerA, role);

          const checkRolePenalty = (p, currentRole) => {
            const isSpecialist = ['JG', 'SUP', 'ADC'].includes(p.pref1);
            let rolePenalty = 0;
            if (currentRole === p.ng1 || currentRole === p.ng2) {
              rolePenalty = 50000; // NGロールの基本ペナルティ
              // ★修正：こだわり度によってNGレーンのペナルティも強化
              // weight=1（絶対）は10倍(500000)にして、「不得意レーン(100000)」より必ず重くする
              if (p.weight === 1) rolePenalty *= 10;
              else if (p.weight === 2) rolePenalty *= 2; // 通常も強化（100000）
            } else if (p.isFixed || p.pref1 === 'ALL' || p.pref1 === currentRole) {
              rolePenalty = 0;
            } else if (p.pref2 === currentRole) {
              // Pityの影響力を100から10000に大幅強化（MMR差ペナルティ等に押しつぶされないため）
              rolePenalty = 500 + (p.pity * 10000);
              // 天井システム: Pityが4以上ならサブレーン配置ペナルティに100,000を上乗せ
              if (p.pity >= 4) rolePenalty += 100000;
              
              if (isSpecialist) rolePenalty *= 2;
              if (p.weight === 1) rolePenalty *= 10;   
              if (p.weight === 3) rolePenalty *= 0.5; 
            } else {
              // Pityの影響力を500から20000に大幅強化
              rolePenalty = 5000 + (p.pity * 20000);
              // 天井システム: Pityが4以上なら他レーン配置ペナルティに200,000を上乗せ
              if (p.pity >= 4) rolePenalty += 200000;
              
              if (isSpecialist) rolePenalty *= 3;
              if (p.weight === 1) rolePenalty *= 20;  
              if (p.weight === 3) rolePenalty *= 0.2;  
            }
            if ((p.isNewbie || p.isOutlierLow) && (currentRole === 'JG' || currentRole === 'MID')) {
              rolePenalty += 10000; 
            }
            penalty += rolePenalty;
          };
          checkRolePenalty(pLayerA, role);
          checkRolePenalty(pLayerB, role);

          // ★案D：格上当番制 - isOutlierHighのプレイヤーがMMR格差600以上のレーンで
          // メイン以外に配置される場合のペナルティを軽減し、苦手レーンへ回りやすくする
          const applyOutlierRelief = (p, oppMmr, currentRole) => {
            if (p.isOutlierHigh && currentRole !== p.pref1 && currentRole !== p.ng1 && currentRole !== p.ng2) {
              const myMmr = p.rates[currentRole];
              const mmrDiff = myMmr - oppMmr;
              if (mmrDiff > 600) {
                // 格差が大きいほど救済量を増やす（最大30,000）
                penalty -= Math.min(mmrDiff * 5, 30000);
              }
            }
          };
          applyOutlierRelief(pLayerA, mmrB, role);
          applyOutlierRelief(pLayerB, mmrA, role);

          // ★新設：メインレーン充足人数のカウント
          // isFixed / pref1=ALL / pref1=割り当てレーン のいずれかなら「メイン希期が叶わった」とみなす
          if (pLayerA.isFixed || pLayerA.pref1 === 'ALL' || pLayerA.pref1 === role) mainCount++;
          if (pLayerB.isFixed || pLayerB.pref1 === 'ALL' || pLayerB.pref1 === role) mainCount++;
        } // for rIdx ループ終了
        
        const isAssigned = (team, pIndices, name, role) => {
          for (let i = 0; i < 5; i++) {
            if (team[i].name === name && (!role || rolesOrder[pIndices[i]] === role)) return true;
          }
          return false;
        };

        // ★新設：メインレーン充足ペナルティ（「何人メインになれたか」を最優先評価軸に）
        // 1人メインになれないことのペナルティ = 80,000
        // MMR差550のレーン差ペナルティ = 550²/4 = 75,625
        // → MMR差が550以下ならレーン希期が必ず優先される
        const mainShortfall = 10 - mainCount;
        penalty += mainShortfall * 80000;

        // 【既存】レーンごとの有利不利が片方に偏りすぎないようにする
        const advantageGap = Math.abs(lanesAdvantagedA - lanesAdvantagedB);
        if (advantageGap >= 2) penalty += Math.pow(advantageGap, 2) * 2000;

        // ★新設：チーム別レーン優位スコアの均等化ペナルティ
        // 各レーンで「強い側」が同じチームに集まらないようにする
        // laneAdvantageScoreA: Team Aが優位なレーンのMMR差の合計
        // laneAdvantageScoreB: Team Bが優位なレーンのMMR差の合計
        // この差が大きいほど片方チームへの偏りが大きいことを意味する
        const laneAdvantageGap = Math.abs(laneAdvantageScoreA - laneAdvantageScoreB);
        penalty += laneAdvantageGap * 3.0;

        // 【既存】プラチナ以上の人数を均等にする
        const rankGap = Math.abs(highRankCountA - highRankCountB);
        if (rankGap >= 2) penalty += Math.pow(rankGap, 2) * 5000;


        const totalWRA = teamAIndices.reduce((sum, idx) => sum + (players[idx].winRate - 50.0) * Math.min(1.0, players[idx].games / 10), 0);
        const totalWRB = teamBIndices.reduce((sum, idx) => sum + (players[idx].winRate - 50.0) * Math.min(1.0, players[idx].games / 10), 0);
        
        penalty += Math.abs(totalWRA - totalWRB) * 1500;

        if (teamAIndices.some(idx => players[idx].name === bestWRPlayerName) !== teamAIndices.some(idx => players[idx].name === worstWRPlayerName)) {
          penalty += 8000;
        }

        const lowestInA = teamAIndices.some(idx => players[idx].name === lowestMMRPlayerName);
        const worstWRInA = teamAIndices.some(idx => players[idx].name === worstWRPlayerName);

        let handicap = 0;
        if (lowestMMRPlayerName) {
          const pLowest = players.find(p => p.name === lowestMMRPlayerName);
          const baseHandicap = pLowest.isOutlierLow ? 800 : 100;
          handicap += (lowestInA ? baseHandicap : -baseHandicap);
        }
        if (worstWRPlayerName) handicap += (worstWRInA ? 100 : -100);  
        
        const newbieCountA = teamAIndices.filter(idx => players[idx].isNewbie).length;
        const newbieCountB = (players.filter(p => p.isNewbie).length) - newbieCountA;
        handicap += (newbieCountA * 300) - (newbieCountB * 300);

        handicap += (totalWRB - totalWRA) * 30;

        const score = penalty + Math.abs(totalA - totalB - handicap);
        
        topResults.push({ score, pA: [...pA], pB: [...pB], teamAIndices, teamBIndices });
        topResults.sort((a, b) => a.score - b.score);
        if (topResults.length > 3) topResults.pop();
      }
    }
  }

  if (topResults.length === 0) throw new Error('有効なチーム分けが見つかりませんでした。制約が競合しています。');


  // 上位3つのうちからランダムに1つ選ぶ（毎回同じになるのを防ぐ）
  const bestResult = topResults[Math.floor(Math.random() * topResults.length)];

  const { pA: bestPA, pB: bestPB, teamAIndices: bestTAIdx, teamBIndices: bestTBIdx } = bestResult;
  const tA = bestTAIdx.map(i => players[i]);
  const tB = bestTBIdx.map(i => players[i]);

  // pA[i] = roleIdx → player tA[i] が rolesOrder[pA[i]] を担当
  const rawAssignA = bestPA.map((rIdx, i) => {
    const r = rolesOrder[rIdx];
    // 案L： mainLaneを追加し、Discord表示で「なぜこのレーンなのか」を一目でわかるようにする
    return { ...tA[i], currentRole: r, mmr: tA[i].rates[r], mainLane: tA[i].pref1, subLane: tA[i].pref2 };
  });
  const rawAssignB = bestPB.map((rIdx, i) => {
    const r = rolesOrder[rIdx];
    return { ...tB[i], currentRole: r, mmr: tB[i].rates[r], mainLane: tB[i].pref1, subLane: tB[i].pref2 };
  });

  // rolesOrder順にソート
  const sortByRole = (arr) => rolesOrder.map(role => arr.find(p => p.currentRole === role)).filter(Boolean);
  const assignA = sortByRole(rawAssignA);
  const assignB = sortByRole(rawAssignB);

  // --- ⚖️ サイド公平化ロジック (History-based Side Balancing) ---
  const allNames = [...assignA.map(p => p.name), ...assignB.map(p => p.name)];
  const sideHistory = getSideHistoryCounts(allNames);
  
  // パターン1: A=Blue, B=Red の場合の不公平指数
  let scoreNormal = 0;
  assignA.forEach(p => scoreNormal += (sideHistory[p.name]?.BLUE || 0));
  assignB.forEach(p => scoreNormal += (sideHistory[p.name]?.RED || 0));
  
  // パターン2: A=Red, B=Blue の場合の不公平指数
  let scoreSwapped = 0;
  assignB.forEach(p => scoreSwapped += (sideHistory[p.name]?.BLUE || 0));
  assignA.forEach(p => scoreSwapped += (sideHistory[p.name]?.RED || 0));

  // スコアが低い（過去にそのサイドを経験した回数が少ない）方を選択
  let isSwapped = false;
  if (scoreNormal > scoreSwapped) {
    isSwapped = true;
  } else if (scoreNormal === scoreSwapped) {
    isSwapped = Math.random() < 0.5; // 同点ならランダム
  }

  const teamBlue = isSwapped ? assignB : assignA;
  const teamRed = isSwapped ? assignA : assignB;

  // シートをクリアしてから書き込み
  inputSheet.getRange('A2:D11').clearContent();
  const finalRows = [];
  rolesOrder.forEach(role => { const p = teamBlue.find(x => x.currentRole === role); if(p) finalRows.push([p.name, p.currentRole, 'BLUE', p.mmr]); });
  rolesOrder.forEach(role => { const p = teamRed.find(x => x.currentRole === role); if(p) finalRows.push([p.name, p.currentRole, 'RED', p.mmr]); });
  if (finalRows.length === 10) {
    inputSheet.getRange('A2:D11').setValues(finalRows);
  }

  const colors = [ ["#cfe2f3"], ["#cfe2f3"], ["#cfe2f3"], ["#cfe2f3"], ["#cfe2f3"], ["#f4cccc"], ["#f4cccc"], ["#f4cccc"], ["#f4cccc"], ["#f4cccc"] ];
  const fontColors = [ ["#0b5394"], ["#0b5394"], ["#0b5394"], ["#0b5394"], ["#0b5394"], ["#990000"], ["#990000"], ["#990000"], ["#990000"], ["#990000"] ];
  inputSheet.getRange("C2:C11").setBackgrounds(colors).setFontColors(fontColors).setFontWeight("bold").setHorizontalAlignment("center");

  if (inputSheet.getRange('G1').isBlank()) {
    inputSheet.getRange('G1').setValue('<< 転送 ➜ 勝敗入力 ➜ 一括更新 >>').setFontColor('#999999').setFontWeight('normal');
  }
  SpreadsheetApp.flush();

  // 重複チェック
  const uniqueNames = new Set(allNames);
  if (uniqueNames.size !== 10) {
    throw new Error(`チーム分けに重複プレイヤーが発生しました（${allNames.join(', ')}）`);
  }

  return { assignA: teamBlue, assignB: teamRed };
}

/**
 * 過去の対戦履歴から各プレイヤーのサイド回数を取得 (直近20戦)
 */
function getSideHistoryCounts(targetNames) {
  const bulkSheet = getSheet(SHEET_NAMES.BULK);
  if (!bulkSheet) return {};
  
  const lastRow = bulkSheet.getLastRow();
  if (lastRow < 2) return {};
  
  const startRow = Math.max(2, lastRow - 19);
  const data = bulkSheet.getRange(startRow, 1, (lastRow - startRow + 1), 31).getValues();
  const counts = {};
  targetNames.forEach(n => counts[n] = { BLUE: 0, RED: 0 });

  // BULKシートのカラム構造: 
  // Blueメンバー: 3, 9, 15, 21, 27 (C, I, O, U, AA)
  // Redメンバー: 6, 12, 18, 24, 30 (F, L, R, X, AD)
  const blueCols = [2, 8, 14, 20, 26];
  const redCols = [5, 11, 17, 23, 29];

  data.forEach(row => {
    blueCols.forEach(col => {
      const name = String(row[col] || "").trim();
      if (counts[name]) counts[name].BLUE++;
    });
    redCols.forEach(col => {
      const name = String(row[col] || "").trim();
      if (counts[name]) counts[name].RED++;
    });
  });
  
  return counts;
}
