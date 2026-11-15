import { useState, useCallback } from 'react';
import { toast } from '../../../../components/Toaster';
import { REGIONS, ChampionMeta, FestivalTheme } from '../../../../lib/championMetadata';
import type { DraftPlayer } from './types';

interface UseFestivalDraftProps {
  filteredChamps: ChampionMeta[];
  excludedIds: Set<string>;
  playerCount: number;
  picksPerPlayer: number;
  teamMode: boolean;
  activeTheme: FestivalTheme | null;
}

export function useFestivalDraft({
  filteredChamps,
  excludedIds,
  playerCount,
  picksPerPlayer,
  teamMode,
  activeTheme,
}: UseFestivalDraftProps) {
  // 👥 ドラフト機能用
  const [draftResults, setDraftResults] = useState<DraftPlayer[]>([]);
  const [isDraftRolling, setIsDraftRolling] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // 🎲 単体・複数ルーレット選出用
  const [rouletteResults, setRouletteResults] = useState<ChampionMeta[]>([]);
  const [isRouletteRolling, setIsRouletteRolling] = useState(false);
  const [copied, setCopied] = useState(false);

  // 👥 ドラフト抽選（人数 × 候補数を重複なしで各プレイヤーに配布）
  const handleDraftRoulette = useCallback(() => {
    const available = filteredChamps.filter((c) => !excludedIds.has(c.id));
    const totalNeeded = playerCount * picksPerPlayer;
    if (available.length < totalNeeded) {
      toast.error(
        `候補チャンピオンが不足しています（必要: ${totalNeeded}体 / 残り: ${available.length}体）。除外を減らすか人数/候補数を調整してください`
      );
      return;
    }
    setIsDraftRolling(true);

    const isTeamSplit = teamMode && playerCount % 2 === 0;
    const half = playerCount / 2;

    let step = 0;
    const maxSteps = 10;
    const interval = setInterval(() => {
      step++;
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const players: DraftPlayer[] = [];
      for (let i = 0; i < playerCount; i++) {
        const team = isTeamSplit ? (i < half ? 'BLUE' : 'RED') : undefined;
        const matchupPairIndex = isTeamSplit
          ? i < half
            ? i + 1
            : i - half + 1
          : undefined;

        players.push({
          playerNumber: i + 1,
          team,
          matchupPairIndex,
          champions: shuffled.slice(i * picksPerPlayer, (i + 1) * picksPerPlayer),
        });
      }
      setDraftResults(players);
      if (step >= maxSteps) {
        clearInterval(interval);
        setIsDraftRolling(false);
        const modeText = isTeamSplit ? ` (${half}v${half} チーム対戦)` : '';
        toast.success(
          `🎲 ${playerCount}名分${modeText}（各${picksPerPlayer}択・計${totalNeeded}体）のドラフト候補を抽選しました！`
        );
      }
    }, 70);
  }, [filteredChamps, excludedIds, playerCount, picksPerPlayer, teamMode]);

  // 特定プレイヤーのドラフト候補を1人だけリロール
  const handleRerollSinglePlayer = useCallback(
    (playerNum: number) => {
      const available = filteredChamps.filter((c) => !excludedIds.has(c.id));
      const assignedIds = new Set<string>();
      draftResults.forEach((p) => {
        if (p.playerNumber !== playerNum) {
          p.champions.forEach((c) => assignedIds.add(c.id));
        }
      });
      const unassigned = available.filter((c) => !assignedIds.has(c.id));
      if (unassigned.length < picksPerPlayer) {
        toast.error('リロール可能な余りチャンピオンが不足しています');
        return;
      }
      const shuffled = [...unassigned].sort(() => Math.random() - 0.5);
      const newChamps = shuffled.slice(0, picksPerPlayer);

      setDraftResults((prev) =>
        prev.map((p) =>
          p.playerNumber === playerNum
            ? { ...p, champions: newChamps, selectedChampId: undefined }
            : p
        )
      );
      toast.success(`プレイヤー ${playerNum} の候補を再抽選しました！`);
    },
    [filteredChamps, excludedIds, draftResults, picksPerPlayer]
  );

  // プレイヤーが候補の中から1体を選んで確定
  const handleSelectDraftChamp = useCallback((playerNum: number, champId: string) => {
    setDraftResults((prev) =>
      prev.map((p) =>
        p.playerNumber === playerNum
          ? {
              ...p,
              selectedChampId: p.selectedChampId === champId ? undefined : champId,
            }
          : p
      )
    );
  }, []);

  // ドラフト結果をDiscord用フォーマットでコピー
  const handleCopyDraftResults = useCallback(() => {
    if (draftResults.length === 0) return;
    const totalNeeded = draftResults.length * picksPerPlayer;
    const themeNote = activeTheme ? `\n🎭 **テーマ**: ${activeTheme.name}` : '';
    const isTeamSplit = draftResults.some((p) => p.team);

    const formatPlayerLine = (p: DraftPlayer) => {
      const champLines = p.champions
        .map((c) => {
          const isChosen = p.selectedChampId === c.id;
          const reg = REGIONS[c.region]?.name || c.region;
          return `    ${isChosen ? '👉 **' : '・ '}${c.name} (${reg})${
            isChosen ? '** (確定★)' : ''
          }`;
        })
        .join('\n');
      const vsText = p.matchupPairIndex ? ` [対面 ${p.matchupPairIndex}]` : '';
      return `  👤 **プレイヤー ${p.playerNumber}**${vsText}:\n${champLines}`;
    };

    let bodyText = '';
    if (isTeamSplit) {
      const bluePlayers = draftResults.filter((p) => p.team === 'BLUE');
      const redPlayers = draftResults.filter((p) => p.team === 'RED');

      bodyText = `🔵 ════ **BLUE チーム** ════\n${bluePlayers
        .map(formatPlayerLine)
        .join('\n\n')}\n\n🔴 ════ **RED チーム** ════\n${redPlayers
        .map(formatPlayerLine)
        .join('\n\n')}`;
    } else {
      bodyText = draftResults.map(formatPlayerLine).join('\n\n');
    }

    const modeLabel = isTeamSplit
      ? `${draftResults.length / 2}v${draftResults.length / 2} チーム対戦`
      : `${draftResults.length}名 個人戦`;

    const text = `【🎪 KTM お祭りカスタム ドラフト候補】${themeNote}
👥 形式: ${modeLabel}（各${picksPerPlayer}択・計${totalNeeded}体）

${bodyText}

※ 各プレイヤーは自分の候補の中から1体選んでピックしてください！`;

    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    toast.success('ドラフト結果をDiscord用にコピーしました！');
    setTimeout(() => setCopiedDraft(false), 2000);
  }, [draftResults, picksPerPlayer, activeTheme]);

  // ルーレット抽選（未除外から count 体をランダム選出）
  const handleRoulette = useCallback(
    (count: number) => {
      const available = filteredChamps.filter((c) => !excludedIds.has(c.id));
      if (available.length === 0) {
        toast.error('ピック可能なチャンピオンがいません（すべて除外されています）');
        return;
      }
      setIsRouletteRolling(true);

      let steps = 0;
      const maxSteps = 10;
      const interval = setInterval(() => {
        steps++;
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        setRouletteResults(shuffled.slice(0, Math.min(count, available.length)));
        if (steps >= maxSteps) {
          clearInterval(interval);
          setIsRouletteRolling(false);
          toast.success(`🎲 ${Math.min(count, available.length)}体のチャンピオンを抽選しました！`);
        }
      }, 70);
    },
    [filteredChamps, excludedIds]
  );

  // 選出結果をクリップボードにコピー
  const handleCopyResults = useCallback(() => {
    if (rouletteResults.length === 0) return;
    const text = rouletteResults
      .map((c, i) => `${i + 1}. ${c.name} (${c.region})`)
      .join('\n');
    navigator.clipboard.writeText(`【KTM お祭りカスタム選出】\n${text}`);
    setCopied(true);
    toast.success('結果をコピーしました！');
    setTimeout(() => setCopied(false), 2000);
  }, [rouletteResults]);

  return {
    draftResults,
    setDraftResults,
    isDraftRolling,
    copiedDraft,
    rouletteResults,
    setRouletteResults,
    isRouletteRolling,
    copied,
    handleDraftRoulette,
    handleRerollSinglePlayer,
    handleSelectDraftChamp,
    handleCopyDraftResults,
    handleRoulette,
    handleCopyResults,
  };
}
