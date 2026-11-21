'use client';

import { useState } from 'react';
import { resizeAndCompressImage, matchPlayer, matchChampion, getOcrAliases } from './ocrUtils';
import { ROLES, type PlayerStat, type PlayerPoolItem, type ChampionItem } from './types';

interface UseOcrImageProcessorParams {
  playersPool: PlayerPoolItem[];
  championsList: ChampionItem[];
  stats: PlayerStat[];
  setStats: React.Dispatch<React.SetStateAction<PlayerStat[]>>;
  setWinningTeam: (team: 'BLUE' | 'RED') => void;
  setDurationText: (text: string) => void;
  setMessage: (msg: { type: 'success' | 'error' | ''; text: string }) => void;
}

export function useOcrImageProcessor({
  playersPool,
  championsList,
  stats,
  setStats,
  setWinningTeam,
  setDurationText,
  setMessage,
}: UseOcrImageProcessorParams) {
  const [analyzing, setAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '画像ファイルのみアップロード可能です。' });
      return;
    }

    setAnalyzing(true);
    setMessage({ type: '', text: '' });

    try {
      const compressedBase64 = await resizeAndCompressImage(file);
      const base64Content = compressedBase64.split(',')[1];

      const res = await fetch('/api/match/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Content,
          mimeType: 'image/jpeg',
          champions: championsList,
        }),
      });

      const resData = await res.json();
      if (!res.ok || resData.status !== 'SUCCESS') {
        throw new Error(resData.error || '画像の解析に失敗しました。');
      }

      const data = resData.data;

      if (data.players && Array.isArray(data.players)) {
        const ocrBlue = data.players.filter((p: any) => p.team === 'BLUE');
        const ocrRed = data.players.filter((p: any) => p.team === 'RED');
        const winnerBlock = data.players.slice(0, 5);
        const loserBlock = data.players.slice(5, 10);

        const knownBlue = new Set(stats.filter((s) => s.team === 'BLUE' && s.name).map((s) => s.name));
        const knownRed = new Set(stats.filter((s) => s.team === 'RED' && s.name).map((s) => s.name));

        let winInBlue = 0;
        let winInRed = 0;

        winnerBlock.forEach((p: any) => {
          const m = matchPlayer(p.name, playersPool);
          if (m) {
            if (knownBlue.has(m)) winInBlue++;
            if (knownRed.has(m)) winInRed++;
          }
        });

        let resolvedWinner: 'BLUE' | 'RED' = 'BLUE';
        if (winInRed > winInBlue) {
          resolvedWinner = 'RED';
        } else if (winInBlue > winInRed) {
          resolvedWinner = 'BLUE';
        } else if (data.winningTeam === 'RED' || data.winningTeam === 'BLUE') {
          resolvedWinner = data.winningTeam;
        }

        setWinningTeam(resolvedWinner);

        const durSec = Number(data.gameDurationSec);
        if (Number.isFinite(durSec) && durSec >= 180 && durSec <= 7200) {
          setDurationText(`${Math.floor(durSec / 60)}:${String(Math.round(durSec % 60)).padStart(2, '0')}`);
        }

        const bluePlayers =
          ocrBlue.length === 5 && ocrRed.length === 5
            ? ocrBlue
            : resolvedWinner === 'BLUE'
            ? winnerBlock
            : loserBlock;
        const redPlayers =
          ocrBlue.length === 5 && ocrRed.length === 5
            ? ocrRed
            : resolvedWinner === 'RED'
            ? winnerBlock
            : loserBlock;

        let resolvedCount = 0;
        let aliasHitCount = 0;
        let unresolvedCount = 0;
        let preservedBalancerCount = 0;
        const currentAliases = getOcrAliases();

        setStats((prev) => {
          return prev.map((currentStat, idx) => {
            const isBlue = currentStat.team === 'BLUE';
            const teamPlayers = isBlue ? bluePlayers : redPlayers;
            const playerIdx = isBlue ? idx : idx - 5;
            const targetRole = currentStat.currentRole || ROLES[playerIdx];

            let found: any = null;
            if (currentStat.name) {
              found = teamPlayers.find((p: any) => matchPlayer(p.name, playersPool) === currentStat.name);
              if (!found && Array.isArray(data.players)) {
                found = data.players.find((p: any) => matchPlayer(p.name, playersPool) === currentStat.name);
              }
            }

            if (!found) {
              found = teamPlayers.find((p: any) => p.role && p.role.toUpperCase() === targetRole);
            }

            if (!found && teamPlayers[playerIdx]) {
              found = teamPlayers[playerIdx];
            }

            if (found) {
              const matchedName = matchPlayer(found.name, playersPool);
              const matchedChamp = matchChampion(found.champion_name || found.champion || '', championsList);

              const rawClean = (found.name || '').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
              const isAliasHit = Boolean(rawClean && currentAliases[rawClean]);

              if (matchedName) {
                resolvedCount++;
                if (isAliasHit) aliasHitCount++;
              } else if (currentStat.name) {
                preservedBalancerCount++;
              } else {
                unresolvedCount++;
              }

              const kills = typeof found.kills === 'number' ? found.kills : currentStat.kills;
              const deaths = typeof found.deaths === 'number' ? found.deaths : currentStat.deaths;
              const assists = typeof found.assists === 'number' ? found.assists : currentStat.assists;
              const cs = typeof found.cs === 'number' ? found.cs : currentStat.cs;
              const damage = typeof found.damage === 'number' ? found.damage : currentStat.damage_dealt;

              return {
                ...currentStat,
                name: matchedName || currentStat.name || found.name || '',
                raw_ocr_name: found.name || currentStat.raw_ocr_name,
                champion_name: matchedChamp || currentStat.champion_name,
                kills,
                deaths,
                assists,
                cs,
                damage_dealt: damage,
                currentRole: targetRole,
              };
            }
            return currentStat;
          });
        });

        let summaryMsg = `📸 画像解析完了: 勝者 [${resolvedWinner}] を自動判定！`;
        if (aliasHitCount > 0) {
          summaryMsg += ` (学習済みエイリアス ${aliasHitCount}名適用)`;
        }
        if (preservedBalancerCount > 0) {
          summaryMsg += ` (バランサー登録者 ${preservedBalancerCount}名を優先保護)`;
        }
        if (unresolvedCount > 0) {
          summaryMsg += ` (未特定の枠: ${unresolvedCount}名。手動で選択してください)`;
        }
        setMessage({ type: 'success', text: summaryMsg });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: `画像解析エラー: ${errMsg}` });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  return {
    analyzing,
    isDragging,
    handleImageUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
