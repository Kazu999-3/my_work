import { useState, type Dispatch, type SetStateAction } from "react";
import { applyManualSwap } from "../../../lib/balancer/teams";

type Team = 'teamBlue' | 'teamRed' | 'spectators';

/**
 * チーム分け結果画面での手動入れ替え（ドラッグ＆ドロップ / タップで2人選ぶ / プルダウン）。
 * 入れ替え後のMMR差・勝率の再計算は lib/balancer/teams.ts の applyManualSwap が行う。
 * 2026-10-07: app/balancer/page.tsx から分離（処理は分離前と同じ）。
 */
export function useResultSwap({ balanceResult, setBalanceResult, setProposals, selectedProposalIdx, players }: {
  balanceResult: any;
  setBalanceResult: (r: any) => void;
  setProposals: Dispatch<SetStateAction<any[]>>;
  selectedProposalIdx: number;
  players: any[];
}) {
  // タップスワップ用State
  const [swapSource, setSwapSource] = useState<{ team: string; role: string; name: string } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const handleSwapPlayer = (targetTeam: Team, targetRole: string, newPlayerName: string) => {
    if (!balanceResult) return;
    const newResult = applyManualSwap(balanceResult, players, targetTeam, targetRole, newPlayerName);
    if (!newResult) return;
    setBalanceResult(newResult);
    // proposalsの該当する案も同期
    setProposals(prev => prev.map((p, idx) => idx === selectedProposalIdx ? newResult : p));
  };

  const handleDragStart = (e: React.DragEvent, team: string, role: string, name: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ team, role, name }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    if (dragOverSlot !== slotKey) setDragOverSlot(slotKey);
  };

  const handleDragLeave = () => setDragOverSlot(null);

  const handleDropPlayer = (e: React.DragEvent, targetTeam: Team, targetRole: string) => {
    e.preventDefault();
    setDragOverSlot(null);
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const dragSource = JSON.parse(dataStr);
      if (dragSource.team === targetTeam && dragSource.role === targetRole) return;
      handleSwapPlayer(targetTeam, targetRole, dragSource.name);
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  const handleSelectSwapPlayer = (team: string, role: string, name: string) => {
    if (!name) return;
    if (!swapSource) {
      setSwapSource({ team, role, name });
    } else {
      if (swapSource.name === name) {
        setSwapSource(null);
        return;
      }
      handleSwapPlayer(team as any, role, swapSource.name);
      setSwapSource(null);
    }
  };

  const renderSwapSelect = (team: Team, role: string, currentPlayerName: string) => {
    return (
      <select
        value={currentPlayerName || ""}
        onChange={(e) => {
          if (e.target.value && e.target.value !== currentPlayerName) {
            handleSwapPlayer(team, role, e.target.value);
          }
        }}
        className="w-full bg-transparent border-none text-foreground font-bold outline-none cursor-pointer appearance-none text-center truncate"
        title={currentPlayerName || "選択"}
      >
        {(!currentPlayerName) && <option value="" className="text-foreground">選択</option>}
        {balanceResult && (
          <>
            <optgroup label="Blue Team" className="text-foreground font-bold bg-secondary-100">
              {balanceResult.teamBlue.map((p:any) => (
                <option key={`blue-${p.name}`} value={p.name} className="text-foreground bg-surface">
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Red Team" className="text-foreground font-bold bg-danger-100">
              {balanceResult.teamRed.map((p:any) => (
                <option key={`red-${p.name}`} value={p.name} className="text-foreground bg-surface">
                  {p.name}
                </option>
              ))}
            </optgroup>
            {balanceResult.spectators && balanceResult.spectators.length > 0 && (
              <optgroup label="Spectators" className="text-foreground font-bold bg-surface-hover">
                {balanceResult.spectators.map((name:string) => (
                  <option key={`spec-${name}`} value={name} className="text-foreground bg-surface">
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
          </>
        )}
      </select>
    );
  };

  return {
    swapSource, dragOverSlot,
    handleDragStart, handleDragOver, handleDragLeave, handleDropPlayer, handleSelectSwapPlayer, renderSwapSelect,
  };
}
