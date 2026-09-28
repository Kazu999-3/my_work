"use client";

import { useState, useEffect } from 'react';

export interface CurrentUser {
  discordId: string;
  username: string;
  displayName: string;
  playerName?: string;
  avatar: string;
  coins: number;
  rank: string;
  isAdmin?: boolean;
  claimedDaily?: boolean;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUser = async () => {
    try {
      // ログイン状態の正本はサーバー側で署名検証する /api/auth/me のみ。
      // 以前はローカルストレージの簡易ログイン情報へフォールバックしていたが、サーバーは
      // それを認めないため「画面上はログイン中なのにAPIは401」になる。旧データも消しておく。
      try { localStorage.removeItem('ktm_current_user'); } catch {}
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
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

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
  };

  const refreshUser = () => {
    fetchUser();
  };

  return {
    user,
    loading,
    loginWithDiscord,
    logout,
    refreshUser,
  };
}
