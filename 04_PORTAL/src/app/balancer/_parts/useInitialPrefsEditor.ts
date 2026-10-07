import { useState, type Dispatch, type SetStateAction } from "react";

type SetMessage = (m: { type: string; text: string }) => void;

/**
 * 初期MMRの基準レーン（凍結値）編集（管理者パネル）。希望レーンを変えても過去の出発点が変わらないよう
 * initial_prefs を凍結する仕組みに対し、管理者が「本来のメイン/サブ」を手入力する。
 * 2026-10-07: app/balancer/page.tsx から分離（処理は分離前と同じ）。
 */
export function useInitialPrefsEditor(players: any[], setPlayers: Dispatch<SetStateAction<any[]>>, setMessage: SetMessage) {
  const [showInitialPrefs, setShowInitialPrefs] = useState(false);
  const [initialDraft, setInitialDraft] = useState<Record<string, { primary: string; secondary: string }>>({});
  const [savingInitial, setSavingInitial] = useState(false);

  const openInitialPrefs = () => {
    const draft: Record<string, { primary: string; secondary: string }> = {};
    players.forEach((p: any) => {
      const src = p.initial_prefs || p.role_preferences || {};
      draft[p.id] = { primary: src.primary || 'ALL', secondary: src.secondary || '-' };
    });
    setInitialDraft(draft);
    setShowInitialPrefs(true);
  };

  const saveInitialPrefs = async () => {
    setSavingInitial(true);
    try {
      const updates = players.map((p: any) => ({ id: p.id, initial_prefs: initialDraft[p.id] })).filter(u => u.initial_prefs);
      const res = await fetch('/api/admin/players/save', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存に失敗しました');
      setPlayers(prev => prev.map((p: any) => ({ ...p, initial_prefs: initialDraft[p.id] || p.initial_prefs })));
      setMessage({ type: 'success', text: `✅ 初期レーン（凍結値）を${updates.length}人分保存しました。反映にはRebuildを実行してください。` });
      setShowInitialPrefs(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: '❌ ' + e.message });
    } finally {
      setSavingInitial(false);
    }
  };

  return { showInitialPrefs, setShowInitialPrefs, initialDraft, setInitialDraft, savingInitial, openInitialPrefs, saveInitialPrefs };
}
