import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export interface RankingPlayer {
  name: string;
  discordId: string;
  rank: string;
  coins: number;
}

export interface BetStats {
  blueAmount: number;
  redAmount: number;
  blueCount: number;
  redCount: number;
  totalAmount: number;
  blueRatio: number;
  redRatio: number;
  jackpot?: {
    amount: number;
    lastWinner: string | null;
    lastPayout: number;
    lastWonAt: string | null;
  };
}

// ⏱️ 勝敗予想締め切りカウントダウン（試合確定から15分 = 900秒）
export const BET_DEADLINE_MINUTES = 15;

/**
 * カジノのデータ: 長者番付・投票状況・ジャックポット・進行中の試合・所持チケット・連勝・送金先候補、
 * 締め切りのカウントダウン、10秒ごとの再取得（タブが表にある時だけ）と Realtime による即時更新。
 * 2026-10-07: app/casino/page.tsx から分離（処理は分離前と同じ。ジャックポットの仮の初期値 12,800 のみ削除）。
 */
export function useCasinoData(user: any) {
  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [inventory, setInventory] = useState<Array<{ id: string; name: string; icon: string; boughtAt: string }>>([]);
  const [lastRescueMonth, setLastRescueMonth] = useState<string | null>(null);
  const [userStreak, setUserStreak] = useState<number>(0);
  const [userMaxStreak, setUserMaxStreak] = useState<number>(0);
  const [allPlayersList, setAllPlayersList] = useState<Array<{ name: string; rank: string }>>([]);
  // ★ 2026-10-07: 以前はジャックポットの初期値に 12,800 を入れており、取得前・取得失敗時に実在しない額が表示されていた
  const [betStats, setBetStats] = useState<BetStats>({
    blueAmount: 0, redAmount: 0, blueCount: 0, redCount: 0, totalAmount: 0, blueRatio: 50, redRatio: 50,
  });
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!activeMatch?.createdAt) {
      setTimeLeftSeconds(null);
      return;
    }
    const calculateRemaining = () => {
      const deadlineMs = new Date(activeMatch.createdAt).getTime() + BET_DEADLINE_MINUTES * 60 * 1000;
      return Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
    };
    setTimeLeftSeconds(calculateRemaining());
    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMatch?.createdAt]);

  const isBetLocked = useMemo(() => {
    if (!activeMatch) return true;
    if (activeMatch.isLocked || activeMatch.status === 'IN_PROGRESS') return true;
    if (timeLeftSeconds !== null && timeLeftSeconds <= 0) return true;
    return false;
  }, [activeMatch, timeLeftSeconds]);

  const fetchInventory = async () => {
    try {
      const params = new URLSearchParams();
      if (user?.discordId) params.append('discordId', user.discordId);
      if (user?.displayName) params.append('name', user.displayName);
      const res = await fetch(`/api/bet/shop?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data.inventory || []);
      }
    } catch (e) {
      console.error('Failed to fetch inventory:', e);
    }
  };

  const fetchActiveMatch = async () => {
    try {
      const res = await fetch('/api/balancer/pending');
      if (res.ok) {
        const data = await res.json();
        setActiveMatch(data.activeMatch || null);
      }
    } catch (e) {
      console.error('Failed to fetch active match:', e);
    }
  };

  const fetchPlayersList = async () => {
    try {
      // 送金先候補には名前とランクしか使わないため、参加履歴の集計を省く軽量版を使う
      const res = await fetch('/api/players/list?lite=1');
      if (res.ok) {
        const data = await res.json();
        setAllPlayersList((data.players || []).map((p: any) => ({ name: p.name, rank: p.highest_rank || p.rank || 'GOLD' })));
      }
    } catch (e) {
      console.error('Failed to fetch players list:', e);
    }
  };

  const fetchBetData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (user?.discordId) params.append('discordId', user.discordId);
      if (user?.displayName) params.append('name', user.displayName);
      const res = await fetch(`/api/bet?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRanking(data.ranking || []);
        if (data.betStats) {
          setBetStats({ ...data.betStats, jackpot: data.jackpot || data.betStats.jackpot });
        }
        if (data.lastRescueMonth) setLastRescueMonth(data.lastRescueMonth);
        if (data.userStreak !== undefined) setUserStreak(Number(data.userStreak) || 0);
        if (data.userMaxStreak !== undefined) setUserMaxStreak(Number(data.userMaxStreak) || 0);
      }
    } catch (e) {
      console.error('Failed to fetch bet data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBetData();
    fetchActiveMatch();
    fetchPlayersList();
    if (user?.discordId || user?.displayName) fetchInventory();

    const refreshLive = () => {
      fetchActiveMatch();
      fetchBetData();
    };

    // 10秒ごとのフォールバックポーリング。各APIは約1秒かかるため、タブが裏にある間は
    // 止め、表に戻った瞬間に1回取り直す（2026-09-29: 非表示タブでも回り続けていた）
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshLive();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshLive();
    };
    document.addEventListener('visibilitychange', onVisible);

    // 🎲 Supabase Realtime による試合確定・ベット受付の即時同期
    // edge_tasksは解析ワーカー等も頻繁に書き込むため、カジノに関係するタスク種別だけを購読する
    let channel: any = null;
    try {
      channel = supabase
        .channel('realtime-casino')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'edge_tasks', filter: 'task_type=eq.balancer_pending' }, refreshLive)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'edge_tasks', filter: 'task_type=eq.custom_bet' }, refreshLive)
        .subscribe();
    } catch (rErr) {
      console.warn('[casino] Realtime subscription warning:', rErr);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    ranking, activeMatch, loading, inventory, lastRescueMonth, userStreak, userMaxStreak, allPlayersList, betStats,
    timeLeftSeconds, isBetLocked, fetchBetData, fetchActiveMatch, fetchInventory,
  };
}
