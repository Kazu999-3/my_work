import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type SetMessage = (m: { type: string; text: string }) => void;

/**
 * 参加者リスト: 取得、Supabase Realtime による他端末の変更の反映、入力の自動保存（1.5秒デバウンス）。
 * 2026-10-07: app/balancer/page.tsx から分離（処理は分離前と同じ）。
 */
export function usePlayerRoster(isAdmin: boolean, setMessage: SetMessage) {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flashingPlayerIds, setFlashingPlayerIds] = useState<number[]>([]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 保存待ち（デバウンス中〜保存完了前）のプレイヤーID。Realtime購読からの更新が
  // 未保存のローカル編集を丸ごと上書きしてしまうのを防ぐためのガード。
  const dirtyPlayerIdsRef = useRef<Set<any>>(new Set());

  const triggerRowFlash = (id: number) => {
    if (!id) return;
    setFlashingPlayerIds(prev => [...prev, id]);
    setTimeout(() => {
      setFlashingPlayerIds(prev => prev.filter(x => x !== id));
    }, 1000);
  };

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      try {
        const res = await fetch('/api/players/list', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.players && Array.isArray(json.players) && json.players.length > 0) {
            data = json.players;
          }
        }
      } catch (apiErr) {
        console.warn('[balancer] /api/players/list fetch failed, falling back to direct supabase:', apiErr);
      }

      if (data.length === 0) {
        const { data: sbData, error } = await supabase
          .from("ktm_players")
          .select("*")
          .order("name", { ascending: true });

        if (error) throw error;
        data = sbData || [];
      }

      // No順にソートして保持。ローカル用フラグ is_fixed も初期化
      const playersWithNo = (data || []).sort((a: any, b: any) => {
        const timeA = a.metadata?.joined_at ? new Date(a.metadata.joined_at).getTime() : Infinity;
        const timeB = b.metadata?.joined_at ? new Date(b.metadata.joined_at).getTime() : Infinity;
        return timeA - timeB;
      }).map((p: any, index: number) => ({
        ...p,
        name: p.name || p.ign || `Player-${index + 1}`,
        no: index + 1,
        is_fixed: false,
        is_spectator_fixed: false
      }));

      setPlayers(playersWithNo);
    } catch (err: any) {
      console.error("fetchPlayers error:", err);
      setMessage({ type: "error", text: "プレイヤーデータ読み込みエラー: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();

    // Supabase Realtime 購読によるプレイヤーロールのリアルタイム同期＆画面上での通知メッセージ
    const channel = supabase
      .channel('realtime-ktm-players')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ktm_players' },
        (payload: any) => {
          const updatedPlayer = payload.new;
          setPlayers(prev => prev.map(p => {
            if (p.id === updatedPlayer.id) {
              // このプレイヤーに未保存のローカル編集がある場合、DB由来のスナップショットで
              // 丸ごと上書きすると入力中のデータが消えてしまうためスキップする
              if (dirtyPlayerIdsRef.current.has(p.id)) return p;

              const oldPref = p.role_preferences || {};
              const newPref = updatedPlayer.role_preferences || {};
              if (oldPref.primary !== newPref.primary || oldPref.secondary !== newPref.secondary) {
                const primaryStr = `${oldPref.primary || 'ALL'} ➜ ${newPref.primary || 'ALL'}`;
                const secondaryStr = `${oldPref.secondary || '-'} ➜ ${newPref.secondary || '-'}`;
                setMessage({
                  type: "success",
                  text: `🔔 [通知] ${updatedPlayer.name} の希望レーンが更新されました！ (メイン: ${primaryStr} / サブ: ${secondaryStr})`
                });
              }
              return { ...p, ...updatedPlayer };
            }
            return p;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (currentPlayers?: any[]) => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const targetPlayers = currentPlayers || players;
      const dirtyIds = dirtyPlayerIdsRef.current;
      // 編集されたプレイヤーのみを対象にする（無関係な他プレイヤーの最新設定上書きを完全防止）
      const existingPlayers = targetPlayers.filter(p => p.id && (dirtyIds.size === 0 || dirtyIds.has(p.id) || dirtyIds.has(p.discord_id)));

      if (existingPlayers.length === 0) {
        setSaving(false);
        return;
      }

      if (isAdmin) {
        // 管理者は weight 等も含めフル書き込み可能。RLSをバイパスするサーバーAPI経由。
        const updates = existingPlayers.map(p => ({
          id: p.id,
          role_preferences: p.role_preferences,
          is_active: p.is_active,
          ng_lane_1: p.ng_lane_1 || null,
          ng_lane_2: p.ng_lane_2 || null,
          weight: p.weight,
          allow_higher: p.allow_higher,
          pity: p.pity,
          off_role_pity: p.off_role_pity,
          metadata: p.metadata,
        }));
        const res = await fetch('/api/admin/players/save', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '保存に失敗しました'); }
      } else {
        // 一般ユーザーは非センシティブ列のみ（名前・weightは書き込まない）。サーバーAPI経由。
        const updates = existingPlayers.map(p => ({
          id: p.id,
          role_preferences: p.role_preferences,
          is_active: p.is_active,
          ng_lane_1: p.ng_lane_1 || null,
          ng_lane_2: p.ng_lane_2 || null,
          allow_higher: p.allow_higher,
          pity: p.pity,
          off_role_pity: p.off_role_pity,
          metadata: { notes: p.metadata?.notes },
        }));
        const res = await fetch('/api/players/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '保存に失敗しました'); }
      }
      // 保存が成功したので、これらのプレイヤーはもうRealtime更新を受け取っても安全
      existingPlayers.forEach(p => dirtyPlayerIdsRef.current.delete(p.id));
      setSaving(false);
      setMessage({ type: "success", text: "✅ プレイヤー情報を更新しました。" });
    } catch (err: any) {
      setMessage({ type: "error", text: "保存エラー: " + err.message });
      setSaving(false);
    }
  };

  const handleInputChange = (uid: string, field: string, value: any) => {
    setPlayers(prevPlayers => {
      const nextPlayers = prevPlayers.map(p => {
        if ((p.id || p.discord_id) === uid) {
          triggerRowFlash(p.id);
          if (field === "primary_role") {
            const nextPrefs = { ...p.role_preferences, primary: value };
            if (value === "ALL") {
              nextPrefs.secondary = "-";
            }
            return { ...p, role_preferences: nextPrefs };
          } else if (field === "secondary_role") {
            return { ...p, role_preferences: { ...p.role_preferences, secondary: value } };
          } else if (field === "ng_lane_1") {
            const ignore_role = value === "" ? "-" : value;
            return {
              ...p,
              ng_lane_1: value,
              role_preferences: { ...p.role_preferences, ignore_role }
            };
          } else if (field === "ng_lane_2") {
            return { ...p, ng_lane_2: value };
          } else if (field === "notes") {
            return { ...p, metadata: { ...p.metadata, notes: value } };
          } else {
            return { ...p, [field]: value };
          }
        }
        return p;
      });

      // is_fixed の変更はDBに保存しない一時フラグなので保存トリガーを引かない
      if (field !== "is_fixed") {
        dirtyPlayerIdsRef.current.add(uid);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          handleSave(nextPlayers);
        }, 1500);
      }

      return nextPlayers;
    });
  };

  return { players, setPlayers, loading, saving, flashingPlayerIds, fetchPlayers, handleInputChange };
}
