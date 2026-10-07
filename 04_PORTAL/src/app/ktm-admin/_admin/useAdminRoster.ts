import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { fetchWithTimeout } from "./adminUtils";

export type AdminMessage = { type: string; text: string };

/**
 * 管理画面の名簿: 取得、Realtime で他端末の変更を反映、編集の保存、MMR整合性チェック、Rebuild。
 * 2026-10-07: app/ktm-admin/page.tsx から分離（処理は分離前と同じ）。
 */
export function useAdminRoster(enabled: boolean, setMessage: (m: AdminMessage) => void) {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flashingPlayerIds, setFlashingPlayerIds] = useState<Array<string | number>>([]);
  const [integrityData, setIntegrityData] = useState<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // ★ 2026-10-07: 変更したプレイヤーだけを保存する。以前は1項目変えるたびに名簿の全員分を送っており、
  // その間に別の端末（メンバーがバランサーで希望レーンを変える等）が保存した値を、管理画面の古い値で上書きしうる状態だった。
  const dirtyIdsRef = useRef<Set<string | number>>(new Set());

  const triggerRowFlash = (uid: string | number) => {
    setFlashingPlayerIds(prev => [...prev, uid]);
    setTimeout(() => {
      setFlashingPlayerIds(prev => prev.filter(id => id !== uid));
    }, 1000);
  };

  const checkIntegrity = async () => {
    try {
      const res = await fetch('/api/mmr/check-integrity');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntegrityData(data);
    } catch (err: any) {
      console.error("Integrity check failed:", err);
    }
  };

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/players/list', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');
      setPlayers(data.players || []);
      // 名簿リフレッシュ時に整合性も再確認
      checkIntegrity();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 管理者セッション確認が終わり、実際に管理者と判定されるまではデータ取得しない
    if (!enabled) return;

    fetchPlayers();
    checkIntegrity();

    // ktm_playersテーブルのリアルタイム購読をセットアップ
    const channel = supabase
      .channel('ktm_players_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ktm_players' },
        () => {
          // 他ユーザーによる追加・編集・削除が発生した際に自動で再読み込み
          fetchPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const handleSave = async (currentPlayers?: any[]) => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const dirty = dirtyIdsRef.current;
      // 既存プレイヤーは変更したものだけ、新規（idなし）は常に送る
      const targetPlayers = (currentPlayers || players).filter(p => !p.id || dirty.has(p.id));
      if (targetPlayers.length === 0) return;
      // ktm_players はRLSで名前・MMR・weight等がanon直書き不可になったため(migration 12)、
      // 管理者フルカラム書き込みは /api/admin/players/save（サービスロール）に集約する。
      const toRow = (p: any) => ({
        name: p.name,
        ign: p.ign,
        mmr: parseInt(p.mmr) || 1200,
        role_preferences: p.role_preferences,
        is_active: p.is_active,
        ng_lane_1: p.ng_lane_1 || null,
        ng_lane_2: p.ng_lane_2 || null,
        highest_rank: p.highest_rank || null,
        mmr_top: parseInt(p.mmr_top) || 1200,
        mmr_jg: parseInt(p.mmr_jg) || 1200,
        mmr_mid: parseInt(p.mmr_mid) || 1200,
        mmr_adc: parseInt(p.mmr_adc) || 1200,
        mmr_sup: parseInt(p.mmr_sup) || 1200,
      });
      const updates = targetPlayers.filter(p => p.id).map(p => ({
        id: p.id,
        discord_id: p.discord_id,
        ...toRow(p),
        metadata: p.metadata,
      }));
      const inserts = targetPlayers.filter(p => !p.id).map(p => ({
        discord_id: (p.discord_id && p.discord_id.startsWith('new-')) ? '' : p.discord_id,
        ...toRow(p),
        metadata: p.metadata || { notes: "" },
      }));

      const res = await fetchWithTimeout('/api/admin/players/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, inserts }),
        timeout: 20000,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存に失敗しました');
      targetPlayers.forEach(p => { if (p.id) dirty.delete(p.id); });

      // 自動保存時は全体リロード(fetchPlayers)をせずチラつきを防ぐ
      checkIntegrity();
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ 保存エラー: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  // 単にローカルの players ステートを更新する関数（テキスト入力中。保存はフォーカスアウト時）
  const handleInputChange = (uid: string, field: string, value: any) => {
    dirtyIdsRef.current.add(uid);
    setPlayers(prevPlayers => prevPlayers.map(p => {
      if ((p.id || p.discord_id) !== uid) return p;
      if (field === "primary_role") return { ...p, role_preferences: { ...p.role_preferences, primary: value } };
      if (field === "secondary_role") return { ...p, role_preferences: { ...p.role_preferences, secondary: value } };
      if (field === "notes") return { ...p, metadata: { ...p.metadata, notes: value } };
      return { ...p, [field]: value };
    }));
  };

  // 即時セーブをトリガーする関数 (Select, Checkbox, MmrBadgeInput 用)
  const handleInputSave = async (uid: string, field: string, value: any) => {
    dirtyIdsRef.current.add(uid);
    setPlayers(prevPlayers => {
      const nextPlayers = prevPlayers.map(p => {
        if ((p.id || p.discord_id) !== uid) return p;
        if (field === "primary_role") return { ...p, role_preferences: { ...p.role_preferences, primary: value } };
        if (field === "secondary_role") return { ...p, role_preferences: { ...p.role_preferences, secondary: value } };
        if (field === "ng_lane_1") {
          // ng_lane_1 を正として更新し、role_preferences.ignore_role にも同期する
          return {
            ...p,
            ng_lane_1: value === "-" ? null : value,
            role_preferences: { ...p.role_preferences, ignore_role: value === "-" ? "-" : value }
          };
        }
        if (field === "ng_lane_2") return { ...p, ng_lane_2: value === "-" ? null : value };
        if (field === "notes") return { ...p, metadata: { ...p.metadata, notes: value } };
        return { ...p, [field]: value };
      });

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      handleSave(nextPlayers).then(() => triggerRowFlash(uid));

      return nextPlayers;
    });
  };

  // フォーカスアウト時 (onBlur) に即時保存を実行する関数 (Text Input用)
  const handleBlurSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    handleSave();
  };

  const handleDeactivateAll = async () => {
    if (!confirm("全員を非アクティブ（Activeのチェックを全て外す）にしますか？\n（本日の参加者だけをチェックし直す際に便利です）")) return;
    setSaving(true);
    try {
      const nextPlayers = players.map(p => ({ ...p, is_active: false }));
      nextPlayers.forEach(p => { if (p.id) dirtyIdsRef.current.add(p.id); });
      setPlayers(nextPlayers);
      await handleSave(nextPlayers);
      setMessage({ type: "success", text: "全員を非アクティブに設定しました。" });
    } catch (err: any) {
      setMessage({ type: "error", text: "一括更新エラー: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRebuildMmr = async () => {
    if (!confirm("過去のすべての試合履歴をもとに全プレイヤーのMMRを再計算します。よろしいですか？")) return;
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/mmr/rebuild", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "再計算に失敗しました");
      setMessage({ type: "success", text: "✅ " + data.message });
      fetchPlayers();
      checkIntegrity(); // 再計算完了後に整合性を再確認
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ Rebuild エラー: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  return {
    players, loading, setLoading, saving, setSaving, flashingPlayerIds, triggerRowFlash, integrityData,
    fetchPlayers, checkIntegrity, handleInputChange, handleInputSave, handleBlurSave, handleDeactivateAll, handleRebuildMmr,
  };
}
