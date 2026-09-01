"use client";

import { useState, useEffect } from 'react';

export interface CurrentUser {
  discordId: string;
  username: string;
  displayName: string;
  avatar: string;
  coins: number;
  rank: string;
  isAdmin?: boolean;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUser = async () => {
    try {
      // 1. まずCookie /me APIから取得を試みる
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setLoading(false);
          return;
        }
      }

      // 2. ローカルストレージ（簡易ログイン/フォールバック）をチェック
      const savedUser = localStorage.getItem('ktm_current_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
        } catch {}
      }
    } catch (e) {
      console.warn('[useCurrentUser] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const loginWithDiscord = (returnTo = '/casino') => {
    window.location.href = `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const selectPlayerLocal = async (player: { name: string; coins?: number; highest_rank?: string; discord_id?: string }) => {
    try {
      const res = await fetch('/api/auth/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: player.name, discordId: player.discord_id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('ktm_current_user', JSON.stringify(data.user));
          return;
        }
      }
    } catch {}

    const mockUser: CurrentUser = {
      discordId: player.discord_id || `local_${player.name}`,
      username: player.name,
      displayName: player.name,
      avatar: `https://cdn.discordapp.com/embed/avatars/0.png`,
      coins: player.coins ?? 1000,
      rank: player.highest_rank || 'UNRANKED',
    };
    setUser(mockUser);
    localStorage.setItem('ktm_current_user', JSON.stringify(mockUser));
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('ktm_current_user');
    setUser(null);
  };

  const refreshUser = () => {
    fetchUser();
  };

  return {
    user,
    loading,
    loginWithDiscord,
    selectPlayerLocal,
    logout,
    refreshUser,
  };
}
