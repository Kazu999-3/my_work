import { calculateBlueWinProbability } from "../mmr";

// 内戦バランサーのチーム結果の操作（お祭りランダム分け・手動入れ替え・コピー用テキスト）。
// 2026-10-07 app/balancer/page.tsx から分離（処理は分離前と同じ）。

type TeamKey = 'teamBlue' | 'teamRed' | 'spectators';

/** 🎪 日曜お祭りカスタム: 参加者を完全ランダム（Fisher-Yates）に振り分ける（MMR変動なし） */
export function buildFestivalResult(activePlayers: any[], players: any[]) {
  // Fisher-Yates で完全シャッフル
  const shuffled = [...activePlayers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const teamBlue = shuffled.slice(0, 5).map((p, idx) => ({
    name: p.name,
    currentRole: roles[idx],
    mainLane: p.role_preferences?.primary || 'ALL',
    subLane: p.role_preferences?.secondary || '-',
    mmr: p.mmr || 1200,
  }));
  const teamRed = shuffled.slice(5, 10).map((p, idx) => ({
    name: p.name,
    currentRole: roles[idx],
    mainLane: p.role_preferences?.primary || 'ALL',
    subLane: p.role_preferences?.secondary || '-',
    mmr: p.mmr || 1200,
  }));
  const spectators = [
    ...players.filter((p: any) => p.is_spectator_fixed).map(p => p.name),
    ...shuffled.slice(10).map(p => p.name),
  ];

  const blueMmr = teamBlue.reduce((s, p) => s + p.mmr, 0);
  const redMmr = teamRed.reduce((s, p) => s + p.mmr, 0);

  const festivalResult = {
    teamBlue,
    teamRed,
    spectators,
    teamBlueMMR: blueMmr,
    teamRedMMR: redMmr,
    totalMmrBlue: blueMmr,
    totalMmrRed: redMmr,
    mmrDiff: Math.abs(blueMmr - redMmr),
    diff: Math.abs(blueMmr - redMmr),
    predictedBlueWinProb: 0.5,
    isFestivalMode: true,
    title: '🎪 日曜お祭りカスタム（完全ランダム / MMR変動なし）'
  };

  return festivalResult;
}

/**
 * 結果画面での手動入れ替え。newPlayerName を targetTeam/targetRole の位置へ移し、元の位置にいた人と入れ替える。
 * 入れ替え元が見つからない時は null。
 */
export function applyManualSwap(balanceResult: any, players: any[], targetTeam: TeamKey, targetRole: string, newPlayerName: string): any | null {
  let sourceLocation = { team: '', role: '', index: -1 };
  
  const blueIdx = balanceResult.teamBlue.findIndex((p:any) => p.name === newPlayerName);
  if (blueIdx !== -1) sourceLocation = { team: 'teamBlue', role: balanceResult.teamBlue[blueIdx].currentRole, index: blueIdx };
  
  const redIdx = balanceResult.teamRed.findIndex((p:any) => p.name === newPlayerName);
  if (redIdx !== -1 && sourceLocation.index === -1) sourceLocation = { team: 'teamRed', role: balanceResult.teamRed[redIdx].currentRole, index: redIdx };
  
  const specIdx = balanceResult.spectators?.findIndex((name:string) => name === newPlayerName);
  if (specIdx !== -1 && specIdx !== undefined && sourceLocation.index === -1) sourceLocation = { team: 'spectators', role: '', index: specIdx };

  if (sourceLocation.index === -1) return null;

  const newResult = { ...balanceResult };

  let targetPlayer: any = null;
  let targetIndex = -1;
  if (targetTeam === 'spectators') {
    targetPlayer = balanceResult.spectators[parseInt(targetRole)];
    targetIndex = parseInt(targetRole);
  } else {
    targetIndex = newResult[targetTeam].findIndex((p:any) => p.currentRole === targetRole);
    if (targetIndex !== -1) targetPlayer = newResult[targetTeam][targetIndex];
  }

  let sourcePlayerObj: any = null;
  if (sourceLocation.team === 'spectators') {
    const pData = players.find(p => p.name === newPlayerName);
    sourcePlayerObj = { 
      name: newPlayerName, 
      currentRole: targetRole,
      mmr: pData ? pData.mmr : 1000,
      mainLane: pData?.role_preferences?.primary || 'ALL',
      subLane: pData?.role_preferences?.secondary || 'ALL'
    };
  } else {
    sourcePlayerObj = { ...newResult[sourceLocation.team][sourceLocation.index] };
  }
  
  if (sourceLocation.team === 'spectators') {
    if (targetPlayer) {
      newResult.spectators[sourceLocation.index] = targetPlayer.name; 
    } else {
      newResult.spectators.splice(sourceLocation.index, 1); 
    }
  } else {
    if (targetPlayer) {
      targetPlayer.currentRole = sourceLocation.role;
      newResult[sourceLocation.team][sourceLocation.index] = targetPlayer;
    } else {
      newResult[sourceLocation.team].splice(sourceLocation.index, 1);
    }
  }

  if (targetTeam === 'spectators') {
    if (sourcePlayerObj) {
      newResult.spectators[targetIndex] = sourcePlayerObj.name;
    }
  } else {
    sourcePlayerObj.currentRole = targetRole;
    if (targetIndex !== -1) {
      newResult[targetTeam][targetIndex] = sourcePlayerObj;
    } else {
      newResult[targetTeam].push(sourcePlayerObj);
    }
  }

  // スワップ後の各チームMMRとBlue勝率をリアルタイム再計算
  const totalBlue = (newResult.teamBlue || []).reduce((sum: number, p: any) => sum + (Number(p.mmr) || 1200), 0);
  const totalRed = (newResult.teamRed || []).reduce((sum: number, p: any) => sum + (Number(p.mmr) || 1200), 0);
  newResult.totalMmrBlue = totalBlue;
  newResult.totalMmrRed = totalRed;
  newResult.diff = Math.abs(totalBlue - totalRed);
  newResult.predictedBlueWinProb = calculateBlueWinProbability(totalBlue, totalRed);

  return newResult;
}

/** チーム分け結果のコピー用テキスト */
export function buildResultCopyText(balanceResult: any): string {
  const blueAvg = balanceResult.teamBlue.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamBlue.length || 1);
  const redAvg = balanceResult.teamRed.reduce((s: number, p: any) => s + (p.mmr || 1200), 0) / (balanceResult.teamRed.length || 1);
  const pBlue = calculateBlueWinProbability(blueAvg, redAvg);
  const bluePct = Math.round(pBlue * 100);
  const redPct = 100 - bluePct;

  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const blueLines = roles.map(r => {
    const p = balanceResult.teamBlue.find((x: any) => x.currentRole === r);
    return p ? `  ${r.padEnd(3, ' ')}: ${p.name} (${p.mmr || 1200})` : `  ${r.padEnd(3, ' ')}: -`;
  }).join('\n');

  const redLines = roles.map(r => {
    const p = balanceResult.teamRed.find((x: any) => x.currentRole === r);
    return p ? `  ${r.padEnd(3, ' ')}: ${p.name} (${p.mmr || 1200})` : `  ${r.padEnd(3, ' ')}: -`;
  }).join('\n');

  const specText = (balanceResult.spectators && balanceResult.spectators.length > 0)
    ? `\n👀 観戦/待機: ${balanceResult.spectators.join(', ')}`
    : '';

  const text = `【KTM カスタム チーム分け結果】\n` +
    `🟦 BLUE TEAM (合計: ${balanceResult.teamBlueMMR} / 勝率予測: ${bluePct}%)\n${blueLines}\n\n` +
    `🟥 RED TEAM (合計: ${balanceResult.teamRedMMR} / 勝率予測: ${redPct}%)\n${redLines}\n\n` +
    `⚖️ MMR差: ${balanceResult.mmrDiff}${specText}`;

  return text;
}
