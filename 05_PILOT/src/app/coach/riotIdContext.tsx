'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// コーチ画面の全タブで共有する「自分のRiot ID」（2026-10-04）。
// 以前は各タブが別々に入力欄を持ち、どのタブで入力しても同じ保存場所(coach_riot_id)を上書きしていた。
// そのため偵察タブで他人のIDを調べると自分のIDが置き換わっていた。
// ここは画面上部の欄だけが書き換え、各タブでの一時的な書き換えはそのタブの中だけで使う。
const STORAGE_KEY = 'coach_riot_id';
const LEGACY_KEYS = ['scout_own_riot_id', 'soloq_riot_id'];

interface Ctx {
  riotId: string;
  setRiotId: (v: string) => void;
  loaded: boolean;
}

const CoachRiotIdContext = createContext<Ctx>({ riotId: '', setRiotId: () => {}, loaded: false });

export function CoachRiotIdProvider({ children }: { children: React.ReactNode }) {
  const [riotId, setRiotIdState] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) || '';
      if (saved.includes('#')) setRiotIdState(saved);
    } catch {}
    setLoaded(true);
  }, []);

  const setRiotId = useCallback((v: string) => {
    const value = v.trim();
    setRiotIdState(value);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return <CoachRiotIdContext.Provider value={{ riotId, setRiotId, loaded }}>{children}</CoachRiotIdContext.Provider>;
}

export function useCoachRiotId() {
  return useContext(CoachRiotIdContext);
}

export function CoachRiotIdBar() {
  const { riotId, setRiotId, loaded } = useCoachRiotId();
  const [draft, setDraft] = useState('');
  useEffect(() => { setDraft(riotId); }, [riotId]);

  const valid = draft.trim().includes('#');
  const changed = draft.trim() !== riotId;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) setRiotId(draft); }}
      className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2"
    >
      <label className="text-[11px] font-bold text-slate-400 shrink-0">自分のRiot ID</label>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="名前#JP1"
        className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
      />
      <button
        type="submit"
        disabled={!valid || !changed}
        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-black cursor-pointer disabled:opacity-40"
      >
        {riotId && !changed ? '保存済み' : '保存'}
      </button>
      {loaded && !riotId && (
        <span className="text-[10px] text-amber-400">全タブの分析にこのIDを使います。最初に一度入力してください。</span>
      )}
    </form>
  );
}
