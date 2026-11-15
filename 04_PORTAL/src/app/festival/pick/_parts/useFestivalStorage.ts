import { useState, useCallback, useEffect } from 'react';
import { toast } from '../../../../components/Toaster';
import { ALL_METADATA_CHAMPIONS, FESTIVAL_THEMES, FestivalTheme } from '../../../../lib/championMetadata';
import { SundayFestivalTheme } from '../../../../lib/sundayFestivalTheme';
import type { ViewMode, DraftPlayer } from './types';

interface UseFestivalStorageProps {
  excludedIds: Set<string>;
  setExcludedIds: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  draftResults: DraftPlayer[];
  setDraftResults: (results: DraftPlayer[]) => void;
}

export function useFestivalStorage({
  excludedIds,
  setExcludedIds,
  draftResults,
  setDraftResults,
}: UseFestivalStorageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('region');
  const [playerCount, setPlayerCount] = useState<number>(6);
  const [picksPerPlayer, setPicksPerPlayer] = useState<number>(3);
  const [teamMode, setTeamMode] = useState<boolean>(true);
  const [activeTheme, setActiveTheme] = useState<FestivalTheme | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);

  // 💾 一時保存（LocalStorage）
  const [hasSavedData, setHasSavedData] = useState(false);
  const [savedTimeLabel, setSavedTimeLabel] = useState<string | null>(null);

  // 🎪 日曜お祭りお題
  const [sundayTheme, setSundayTheme] = useState<SundayFestivalTheme | null>(null);

  // 特定テーマのみ残して他を全除外（❌）
  const handleKeepOnlyTheme = useCallback((targetChampIds: string[], themeObj?: FestivalTheme) => {
    const keepSet = new Set(targetChampIds);
    const newExcluded = new Set<string>();
    ALL_METADATA_CHAMPIONS.forEach((c) => {
      if (!keepSet.has(c.id)) {
        newExcluded.add(c.id);
      }
    });
    setExcludedIds(newExcluded);
    if (themeObj) {
      setActiveTheme(themeObj);
    }
    toast.success(`このテーマの${targetChampIds.length}体のみを残して他を全除外（❌）しました！`);
  }, [setExcludedIds]);

  // 🔗 初回マウント時: URLクエリパラメータから状態を安全に復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const themeParam = params.get('theme');
      const playersParam = params.get('players');
      const picksParam = params.get('picks');
      const teamParam = params.get('team');
      const viewParam = params.get('view');

      if (playersParam) {
        const p = parseInt(playersParam, 10);
        if (p >= 2 && p <= 10) setPlayerCount(p);
      }
      if (picksParam) {
        const k = parseInt(picksParam, 10);
        if (k >= 1 && k <= 3) setPicksPerPlayer(k);
      }
      if (teamParam !== null) {
        setTeamMode(teamParam === '1' || teamParam === 'true');
      }
      if (viewParam && ['region', 'role', 'class', 'theme', 'all'].includes(viewParam)) {
        setViewMode(viewParam as ViewMode);
      }
      if (themeParam) {
        const targetTheme = FESTIVAL_THEMES.find((t) => t.id === themeParam);
        if (targetTheme) {
          handleKeepOnlyTheme(targetTheme.champIds, targetTheme);
          setViewMode('theme');
        }
      }
    } catch (e) {
      console.warn('[FestivalPick] URL params restore error:', e);
    }
  }, [handleKeepOnlyTheme]);

  // 🔗 現在のお祭り設定をワンクリック共有リンクとしてコピー
  const handleCopyShareLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.origin + window.location.pathname);
      if (activeTheme) url.searchParams.set('theme', activeTheme.id);
      url.searchParams.set('players', playerCount.toString());
      url.searchParams.set('picks', picksPerPlayer.toString());
      url.searchParams.set('team', teamMode ? '1' : '0');
      url.searchParams.set('view', viewMode);

      navigator.clipboard.writeText(url.toString());
      setCopiedShareUrl(true);
      toast.success('🔗 お祭り設定URLをコピーしました！Discord等にそのまま共有できます');
      setTimeout(() => setCopiedShareUrl(false), 2000);
    } catch {
      toast.error('URLのコピーに失敗しました');
    }
  }, [activeTheme, playerCount, picksPerPlayer, teamMode, viewMode]);

  // マウント時に一時保存データの有無をチェック＆今週のお題取得
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('ktm_festival_pick_saved_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        setHasSavedData(true);
        if (parsed.savedAt) {
          const d = new Date(parsed.savedAt);
          setSavedTimeLabel(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`);
        }
      }
    } catch {}

    fetch('/api/festival/theme')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.theme) {
          setSundayTheme(data.theme);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveState = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        excludedIds: Array.from(excludedIds),
        draftResults,
        playerCount,
        picksPerPlayer,
        teamMode,
        viewMode,
        activeThemeId: activeTheme?.id || null,
      };
      localStorage.setItem('ktm_festival_pick_saved_state', JSON.stringify(payload));
      setHasSavedData(true);
      const now = new Date();
      setSavedTimeLabel(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
      toast.success('💾 現在の状態（除外設定＆ドラフト候補・確定状況）を一時保存しました！');
    } catch {
      toast.error('一時保存に失敗しました');
    }
  }, [excludedIds, draftResults, playerCount, picksPerPlayer, teamMode, viewMode, activeTheme]);

  const handleRestoreState = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('ktm_festival_pick_saved_state');
      if (!raw) {
        toast.info('一時保存されたデータはありません');
        return;
      }
      const data = JSON.parse(raw);
      if (Array.isArray(data.excludedIds)) {
        setExcludedIds(new Set(data.excludedIds));
      }
      if (Array.isArray(data.draftResults) && data.draftResults.length > 0) {
        setDraftResults(data.draftResults);
      }
      if (data.playerCount && data.playerCount >= 2 && data.playerCount <= 10) {
        setPlayerCount(data.playerCount);
      }
      if (data.picksPerPlayer && data.picksPerPlayer >= 1 && data.picksPerPlayer <= 3) {
        setPicksPerPlayer(data.picksPerPlayer);
      }
      if (typeof data.teamMode === 'boolean') {
        setTeamMode(data.teamMode);
      }
      if (data.viewMode) {
        setViewMode(data.viewMode);
      }
      if (data.activeThemeId) {
        const targetTheme = FESTIVAL_THEMES.find((t) => t.id === data.activeThemeId);
        if (targetTheme) setActiveTheme(targetTheme);
      }
      toast.success('📂 一時保存されていたお祭りピック状態を復元しました！');
    } catch {
      toast.error('復元に失敗しました');
    }
  }, [setExcludedIds, setDraftResults]);

  return {
    viewMode,
    setViewMode,
    playerCount,
    setPlayerCount,
    picksPerPlayer,
    setPicksPerPlayer,
    teamMode,
    setTeamMode,
    activeTheme,
    setActiveTheme,
    copiedShareUrl,
    hasSavedData,
    savedTimeLabel,
    sundayTheme,
    setSundayTheme,
    handleCopyShareLink,
    handleSaveState,
    handleRestoreState,
    handleKeepOnlyTheme,
  };
}
