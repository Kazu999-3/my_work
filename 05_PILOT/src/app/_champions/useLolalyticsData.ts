"use client";

import { useState, useEffect } from "react";

export interface LolalyticsItemEntry {
  items: Array<{ id: number; name: string }>;
  winRate: number;
  games: number;
}

export interface LolalyticsRuneSet {
  winRate: number;
  games: number;
  primaryPerks: Array<{ id: number; name: string }>;
  subPerks: Array<{ id: number; name: string }>;
}

export interface LolalyticsOpponent {
  id: string;
  name: string;
  winRate: number;
  games: number;
}

export interface LolalyticsData {
  success: boolean;
  source: string;
  period: string;
  champion: {
    id: string;
    name: string;
    lane: string;
  };
  stats?: {
    rank: number;
    winRate: number;
    pickRate: number;
    banRate: number;
    games: number;
    topWr: number;
    pctLane: number;
  };
  runes?: {
    pick: LolalyticsRuneSet | null;
    win: LolalyticsRuneSet | null;
  };
  builds?: {
    core1: LolalyticsItemEntry[];
    core2: LolalyticsItemEntry[];
    boots: LolalyticsItemEntry[];
  };
  matchups?: {
    favorable: LolalyticsOpponent[];
    difficult: LolalyticsOpponent[];
  };
}

const clientCache = new Map<string, LolalyticsData>();

export function useLolalyticsData(championId?: string, lane?: string) {
  const [data, setData] = useState<LolalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!championId) {
      setData(null);
      return;
    }

    const currentLane = (lane || "TOP").toUpperCase();
    const cacheKey = `${championId}:${currentLane}`;

    if (clientCache.has(cacheKey)) {
      setData(clientCache.get(cacheKey)!);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/lolalytics/champion?c=${encodeURIComponent(championId)}&lane=${encodeURIComponent(currentLane)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: LolalyticsData) => {
        if (!isMounted) return;
        if (json.success) {
          clientCache.set(cacheKey, json);
          setData(json);
        } else {
          setData(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Lolalytics fetch failed:", err);
        setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [championId, lane]);

  return { data, loading, error };
}
