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
        // 画像上の10名（上5名=チーム1, 下5名=チーム2）
        const team1 = data.players.filter((p: any) => p.rawTeam === 1 || p.team === 'BLUE').slice(0, 5);
        const team2 = data.players.filter((p: any) => p.rawTeam === 2 || p.team === 'RED').slice(0, 5);

        // 画像上でどちらが勝利側（winner）か判定
        const isTeam1ImageWinner = data.imageWinner === 'TEAM1' || data.winningTeam === 'BLUE';
        const imageWinnerBlock = isTeam1ImageWinner ? team1 : team2;
        const imageLoserBlock = isTeam1ImageWinner ? team2 : team1;

        // ★ 既存のバランサーチーム分け（stats）から勝敗（BLUE or RED）を厳密に判定
        const knownBlueNames = new Set(
          stats.filter((s) => s.team === 'BLUE' && s.name).map((s) => s.name.trim().toLowerCase())
        );
        const knownRedNames = new Set(
          stats.filter((s) => s.team === 'RED' && s.name).map((s) => s.name.trim().toLowerCase())
        );

        let winnerBlueVotes = 0;
        let winnerRedVotes = 0;
        imageWinnerBlock.forEach((p: any) => {
          const matched = matchPlayer(p.name, playersPool);
          const cleanName = (matched || p.name || '').trim().toLowerCase();
          if (knownBlueNames.has(cleanName)) winnerBlueVotes++;
          if (knownRedNames.has(cleanName)) winnerRedVotes++;
        });

        let loserBlueVotes = 0;
        let loserRedVotes = 0;
        imageLoserBlock.forEach((p: any) => {
          const matched = matchPlayer(p.name, playersPool);
          const cleanName = (matched || p.name || '').trim().toLowerCase();
          if (knownBlueNames.has(cleanName)) loserBlueVotes++;
          if (knownRedNames.has(cleanName)) loserRedVotes++;
        });

        // 既存チームの参加者との照合スコアから勝者を決定（ロビーの左右/上下配置が逆でも完全補正）
        let resolvedWinner: 'BLUE' | 'RED' = 'BLUE';
        const blueScore = winnerBlueVotes + loserRedVotes;
        const redScore = winnerRedVotes + loserBlueVotes;

        if (redScore > blueScore) {
          resolvedWinner = 'RED';
        } else if (blueScore > redScore) {
          resolvedWinner = 'BLUE';
        } else if (data.winningTeam === 'RED' || data.winningTeam === 'BLUE') {
          resolvedWinner = data.winningTeam;
        }

        setWinningTeam(resolvedWinner);

        // 試合時間
        const durSec = Number(data.gameDurationSec);
        if (Number.isFinite(durSec) && durSec >= 180 && durSec <= 7200) {
          setDurationText(`${Math.floor(durSec / 60)}:${String(Math.round(durSec % 60)).padStart(2, '0')}`);
        }

        // 画像のチーム1/チーム2を、バランサーのBLUE/REDに正しく対応付ける
        const ocrBluePlayers = isTeam1ImageWinner
          ? (resolvedWinner === 'BLUE' ? team1 : team2)
          : (resolvedWinner === 'BLUE' ? team2 : team1);
        const ocrRedPlayers = isTeam1ImageWinner
          ? (resolvedWinner === 'RED' ? team1 : team2)
          : (resolvedWinner === 'RED' ? team2 : team1);

        let resolvedCount = 0;
        let aliasHitCount = 0;
        let unresolvedCount = 0;
        let preservedBalancerCount = 0;
        const currentAliases = getOcrAliases();

        // ★ 定位置固定ではない問題の解決（名前最優先 ➔ ロール一致 ➔ 空き枠割り当て）
        setStats((prev) => {
          const usedBlueOcr = new Set<number>();
          const usedRedOcr = new Set<number>();

          return prev.map((currentStat) => {
            const isBlue = currentStat.team === 'BLUE';
            const ocrPool = isBlue ? ocrBluePlayers : ocrRedPlayers;
            const usedSet = isBlue ? usedBlueOcr : usedRedOcr;
            const targetRole = currentStat.currentRole;

            let foundIdx = -1;

            // 1. 【最優先】既存スロットの名前（currentStat.name）とOCRの名前が一致
            if (currentStat.name) {
              foundIdx = ocrPool.findIndex(
                (p: any, pIdx: number) => !usedSet.has(pIdx) && matchPlayer(p.name, playersPool) === currentStat.name
              );
              if (foundIdx === -1) {
                const cClean = currentStat.name.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
                foundIdx = ocrPool.findIndex((p: any, pIdx: number) => {
                  if (usedSet.has(pIdx)) return false;
                  const pClean = (p.name || '').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
                  return Boolean(cClean && pClean && (cClean.includes(pClean) || pClean.includes(cClean)));
                });
              }
            }

            // 2. 【第2優先】ロール（TOP/JG/MID/ADC/SUP）が一致する未割り当てプレイヤー
            if (foundIdx === -1 && targetRole) {
              foundIdx = ocrPool.findIndex(
                (p: any, pIdx: number) => !usedSet.has(pIdx) && p.role && p.role.toUpperCase() === targetRole.toUpperCase()
              );
            }

            // 3. 【第3優先】空いているプレイヤーを順次割り当て
            if (foundIdx === -1) {
              foundIdx = ocrPool.findIndex((_: any, pIdx: number) => !usedSet.has(pIdx));
            }

            if (foundIdx !== -1) {
              usedSet.add(foundIdx);
              const found = ocrPool[foundIdx];

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
                name: currentStat.name || matchedName || found.name || '',
                raw_ocr_name: found.name || currentStat.raw_ocr_name,
                champion_name: matchedChamp || currentStat.champion_name,
                kills,
                deaths,
                assists,
                cs,
                damage_dealt: damage,
                currentRole: targetRole || found.role || currentStat.currentRole,
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
