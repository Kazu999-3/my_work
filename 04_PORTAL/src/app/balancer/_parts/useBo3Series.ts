import { useState } from "react";
import { toast } from "../../../components/Toaster";

type SetMessage = (m: { type: string; text: string }) => void;

export interface Bo3State {
  isActive: boolean;
  gameNumber: number; // 1, 2, 3
  team1Name: string;
  team2Name: string;
  team1Wins: number;
  team2Wins: number;
  team1IsCurrentlyBlue: boolean;
  isFinished: boolean;
  history: Array<{ game: number; winnerTeamName: string; winnerSide: 'BLUE' | 'RED' }>;
}

/**
 * 🏆 BO3 (Best of 3) シリーズの進行（開始・勝敗記録・サイド交代・リセット）。
 * 2026-10-07: app/balancer/page.tsx から分離（処理は分離前と同じ）。
 */
export function useBo3Series(balanceResult: any, setBalanceResult: (r: any) => void, setMessage: SetMessage) {
  const [bo3State, setBo3State] = useState<Bo3State | null>(null);

  // BO3シリーズ開始
  const handleStartBo3 = () => {
    if (!balanceResult) return;
    const t1Name = `Team ${balanceResult.teamBlue?.[0]?.name || 'Blue'}`;
    const t2Name = `Team ${balanceResult.teamRed?.[0]?.name || 'Red'}`;
    setBo3State({
      isActive: true,
      gameNumber: 1,
      team1Name: t1Name,
      team2Name: t2Name,
      team1Wins: 0,
      team2Wins: 0,
      team1IsCurrentlyBlue: true,
      isFinished: false,
      history: []
    });
    setMessage({ type: 'success', text: `🏆 【BO3シリーズ開始】${t1Name} vs ${t2Name} の2本先取マッチがスタートしました！` });
  };

  // BO3ゲーム勝敗記録
  const handleRecordBo3Win = (side: 'BLUE' | 'RED') => {
    if (!bo3State || bo3State.isFinished) return;

    const isTeam1Winner = (side === 'BLUE' && bo3State.team1IsCurrentlyBlue) || (side === 'RED' && !bo3State.team1IsCurrentlyBlue);
    const winnerName = isTeam1Winner ? bo3State.team1Name : bo3State.team2Name;
    const nextT1Wins = isTeam1Winner ? bo3State.team1Wins + 1 : bo3State.team1Wins;
    const nextT2Wins = !isTeam1Winner ? bo3State.team2Wins + 1 : bo3State.team2Wins;
    const isSeriesFinished = nextT1Wins >= 2 || nextT2Wins >= 2;

    const newHistory = [
      ...bo3State.history,
      { game: bo3State.gameNumber, winnerTeamName: winnerName, winnerSide: side }
    ];

    setBo3State({
      ...bo3State,
      team1Wins: nextT1Wins,
      team2Wins: nextT2Wins,
      isFinished: isSeriesFinished,
      history: newHistory
    });

    if (isSeriesFinished) {
      const champion = nextT1Wins >= 2 ? bo3State.team1Name : bo3State.team2Name;
      const score = `${Math.max(nextT1Wins, nextT2Wins)} - ${Math.min(nextT1Wins, nextT2Wins)}`;
      setMessage({ type: 'success', text: `🎉 【BO3シリーズ決着】${champion} が ${score} でシリーズを制覇しました！🏆` });
      toast.success(`🎉 【BO3シリーズ決着】\n${champion} が ${score} でシリーズを制覇しました！\nDiscordへ総合リザルトを投稿できます。`);
    } else {
      setMessage({ type: 'success', text: `✅ 第${bo3State.gameNumber}戦: ${winnerName} が勝利！「第${bo3State.gameNumber + 1}戦へ（サイド交代）」を押して次戦へ進んでください。` });
    }
  };

  // BO3次戦移行（サイド交代）
  const handleNextBo3Game = () => {
    if (!bo3State || !balanceResult) return;
    if (bo3State.isFinished) return;

    // 陣営を交代
    setBalanceResult({
      ...balanceResult,
      teamBlue: balanceResult.teamRed,
      teamRed: balanceResult.teamBlue,
      teamBlueMMR: balanceResult.teamRedMMR,
      teamRedMMR: balanceResult.teamBlueMMR,
    });

    setBo3State({
      ...bo3State,
      gameNumber: bo3State.gameNumber + 1,
      team1IsCurrentlyBlue: !bo3State.team1IsCurrentlyBlue
    });

    setMessage({
      type: 'success',
      text: `🔄 【BO3 第${bo3State.gameNumber + 1}戦】サイドを交代しました！（${bo3State.gameNumber + 1 === 3 ? '🔥 1-1 運命の最終決戦！' : ''}）`
    });
  };

  // BO3リセット
  const handleResetBo3 = () => {
    if (!confirm('BO3シリーズを終了してリセットしますか？')) return;
    setBo3State(null);
    setMessage({ type: 'success', text: 'BO3シリーズを終了しました。' });
  };

  return { bo3State, handleStartBo3, handleRecordBo3Win, handleNextBo3Game, handleResetBo3 };
}
