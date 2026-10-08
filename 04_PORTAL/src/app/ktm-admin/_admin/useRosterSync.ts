import { useState } from "react";
import { fetchWithTimeout, initialMmrsFor, isValidRiotId } from "./adminUtils";
import type { AdminMessage } from "./useAdminRoster";

export interface RiotSyncError { id: number; name: string; ign: string; error: string }

/**
 * Discordメンバー同期（確認モーダル→実行。続けて新規・未同期プレイヤーの Riot API 同期を5人ずつ分割で実行）、
 * Riot ID エラーの個別修正。
 * 2026-10-07: app/ktm-admin/page.tsx から分離（処理は分離前と同じ）。
 */
export function useRosterSync({ players, fetchPlayers, checkIntegrity, setMessage, triggerRowFlash }: {
  players: any[];
  fetchPlayers: () => void;
  checkIntegrity: () => void;
  setMessage: (m: AdminMessage) => void;
  triggerRowFlash: (uid: string | number) => void;
}) {
  const [syncingDiscord, setSyncingDiscord] = useState(false);
  const [syncData, setSyncData] = useState<any>(null);
  const [riotSyncErrors, setRiotSyncErrors] = useState<RiotSyncError[]>([]);
  const [reSyncingPlayerId, setReSyncingPlayerId] = useState<number | null>(null);

  const parseRiotErrors = (errors: string[]) => {
    if (!errors || errors.length === 0) {
      setRiotSyncErrors([]);
      return;
    }
    const parsed: RiotSyncError[] = [];
    errors.forEach(errStr => {
      const match = errStr.match(/^\[(.*?)\]\s*(.*)$/);
      if (!match) return;
      const errorIgn = match[1];
      const errorMsg = match[2];
      if (errorIgn === 'SYSTEM') return;
      const targetPlayer = players.find(p => p.ign === errorIgn || p.name === errorIgn || p.ign?.startsWith(errorIgn));
      if (targetPlayer && !parsed.some(p => p.id === targetPlayer.id)) {
        parsed.push({ id: targetPlayer.id, name: targetPlayer.name, ign: targetPlayer.ign || errorIgn, error: errorMsg });
      }
    });
    setRiotSyncErrors(parsed);
  };

  const runRiotSyncInChunks = async (playerIds: number[], onProgress: (msg: string) => void) => {
    const chunkSize = 5;
    const allErrors: string[] = [];
    const allPromotions: Array<{ name: string; oldRank: string; newRank: string; ign?: string }> = [];
    let totalUpdated = 0;

    for (let i = 0; i < playerIds.length; i += chunkSize) {
      const chunk = playerIds.slice(i, i + chunkSize);
      onProgress(`Riot APIから最新情報を同期中 (${i + chunk.length}/${playerIds.length}人)...`);

      const res = await fetchWithTimeout('/api/admin/riot-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: chunk }),
        timeout: 20000 // 5人分の同期なので20秒タイムアウト
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Riot同期処理に失敗しました');
      if (data.promotions && Array.isArray(data.promotions)) allPromotions.push(...data.promotions);
      if (data.errors && data.errors.length > 0) allErrors.push(...data.errors);
      totalUpdated += chunk.length;
    }

    return {
      message: `${totalUpdated} 人のプレイヤーのRiot情報を同期しました。`,
      errors: allErrors,
      promotions: allPromotions
    };
  };

  const handleResolveRiotError = async (playerId: number, newIgn: string) => {
    setReSyncingPlayerId(playerId);
    try {
      // ign は管理者専用カラム(RLS)のため、直接更新ではなくサーバーAPI経由で保存する。
      const saveRes = await fetchWithTimeout('/api/admin/players/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: playerId, ign: newIgn }] }),
        timeout: 10000,
      });
      if (!saveRes.ok) {
        const d = await saveRes.json().catch(() => ({}));
        throw new Error(`Riot IDの保存に失敗: ${d.error || saveRes.status}`);
      }

      const res = await fetchWithTimeout('/api/admin/riot-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: [playerId] }),
        timeout: 10000 // 1人分の同期なので10秒タイムアウト
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '個別同期処理に失敗しました');

      if (data.errors && data.errors.length > 0) {
        const match = data.errors[0].match(/^\[(.*?)\]\s*(.*)$/);
        const errMsg = match ? match[2] : '同期エラー';
        setRiotSyncErrors(prev => prev.map(p => p.id === playerId ? { ...p, ign: newIgn, error: errMsg } : p));
        setMessage({ type: "error", text: `⚠️ 登録情報は保存されましたが、Riot APIでの同期はまだ失敗します: ${errMsg}` });
      } else {
        setRiotSyncErrors(prev => prev.filter(p => p.id !== playerId));
        setMessage({ type: "success", text: `✅ Riot IDを [${newIgn}] に更新し、同期が正常に完了しました！` });
        // ★ 2026-10-07: 以前は String(playerId) を渡しており、行の判定（数値の p.id）と一致せず光らなかった
        triggerRowFlash(playerId);
        // #28: ランク更新後の自動Rebuild（ズレ防止）
        try { await fetchWithTimeout('/api/mmr/rebuild', { method: 'POST', timeout: 30000 }); } catch (e) { console.warn('自動Rebuild失敗:', e); }
      }
      fetchPlayers();
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ エラー解消失敗: " + err.message });
    } finally {
      setReSyncingPlayerId(null);
    }
  };

  // 一括オート同期（handleAutoSyncAll）と全員のRiot同期（handleRiotSync）は、ボタンが 2026-07-22（cd92e25f）に
  // 画面から外れて呼ばれていなかったため 2026-10-07 の分割で削除。Riot同期は「Discord & Riot同期」の実行時に
  // 新規・未同期プレイヤーを対象に続けて行われる（executeSync）。

  const handleSyncCheck = async () => {
    setSyncingDiscord(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetchWithTimeout('/api/discord/members', { timeout: 15000 });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discordメンバーの取得に失敗しました');
      setSyncData(data);
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      setMessage({
        type: "error",
        text: isAbort
          ? "❌ 同期確認タイムアウト: Discord APIの応答がありません。しばらく時間をおいて再試行してください。"
          : "❌ Discord同期エラー: " + err.message
      });
    } finally {
      setSyncingDiscord(false); // モーダルを開いたらローディングを解除
    }
  };

  const executeSync = async () => {
    if (!syncData) return;

    // バリデーション: 新規追加メンバーのRiot ID(Name#TAG)が正しい形式かチェック
    const invalidPlayer = syncData.toAdd.find((p: any) => !isValidRiotId(p.ign));
    if (invalidPlayer) {
      setMessage({ type: "error", text: `❌ バリデーションエラー: [${invalidPlayer.name}] のRiot ID (Name#TAG) を正しく入力してください（例: サモナー名#JP1）。` });
      return;
    }

    setSyncingDiscord(true);
    setMessage({ type: "", text: "" });
    try {
      // 1. 新規追加メンバーのMMRをフロント側で自動計算してマージする
      const processedAdd = syncData.toAdd.map((p: any) => {
        const highest_rank = p.highest_rank || "UNRANKED";
        const prefs = p.role_preferences || { primary: "ALL", secondary: "-", ignore_role: "-" };
        return { ...p, highest_rank, role_preferences: prefs, ...initialMmrsFor(highest_rank, prefs), is_active: false };
      });

      // 2. Discord同期 POST の実行
      const res = await fetchWithTimeout('/api/discord/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          add: processedAdd, deactivate: syncData.toDeactivate, update_metadata: syncData.activeSync,
          delete_channels: (syncData.channelsToDelete || []).map((c: any) => c.channelId),
        }),
        timeout: 25000 // POST は少し長めに25秒タイムアウト
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同期処理に失敗しました');
      const requestedChannels = (syncData.channelsToDelete || []).length;
      const channelNote = requestedChannels > 0
        ? `\n退出者の個別案内チャンネル: ${data.channelsDeleted ?? 0}件を削除（予定${requestedChannels}件。戻ってきた人・確認できなかったものは残しています）`
        : '';

      // 3. 複合機能：Riot同期も自動で連続実行（新規追加・Riot情報未取得プレイヤーのみに絞り、タイムアウトを防止）
      const addedDiscordIds = syncData.toAdd.map((p: any) => p.discord_id).filter(Boolean);
      const latestPlayersRes = await fetch('/api/admin/players/list', { credentials: 'include' });
      const { players: latestPlayers } = await latestPlayersRes.json();
      const targetPlayerIds = (latestPlayers || [])
        .filter((p: any) => addedDiscordIds.includes(p.discord_id) || !p.puuid)
        .map((p: any) => p.id)
        .filter(Boolean);

      let riotErrors: string[] = [];
      if (targetPlayerIds.length > 0) {
        setMessage({ type: "success", text: `✅ Discord同期が完了しました。続けて新規・未同期プレイヤー (${targetPlayerIds.length}名) のRiot情報の同期を開始します...` });
        const resData = await runRiotSyncInChunks(targetPlayerIds, (msg) => setMessage({ type: "info", text: msg }));
        riotErrors = resData.errors || [];
      } else {
        setMessage({ type: "success", text: "✅ Discord同期が完了しました。Riot API同期が必要な新規・未同期プレイヤーはいません。" });
      }

      if (riotErrors.length > 0) {
        const errorDetails = riotErrors.slice(0, 10).join('\n') + (riotErrors.length > 10 ? `\n...他 ${riotErrors.length - 10} 件` : '');
        setMessage({
          type: "success",
          text: `✅ Discord & Riot情報の同期が完了しました（※Riot APIで一部エラーあり: ${riotErrors.length}件）。${channelNote}\n新規プレイヤーの初期MMR計算値を反映させるため、名簿上部の「🔄 Rebuild」を実行してください。\n\n【エラー詳細（サモナー名不一致など）】\n${errorDetails}`
        });
        parseRiotErrors(riotErrors);
      } else {
        setMessage({
          type: "success",
          text: `✅ Discord & Riot情報の同期がすべて正常に完了しました！${channelNote}\n新規プレイヤーの初期MMR計算値を反映させるため、名簿上部の「🔄 Rebuild」を実行してください。`
        });
        setRiotSyncErrors([]);
      }

      setSyncData(null);
      fetchPlayers();
      checkIntegrity();
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ 同期実行エラー: " + err.message });
    } finally {
      setSyncingDiscord(false);
    }
  };

  /** 通信が詰まってローディング表示が終わらない時の強制解除 */
  const resetSyncFlags = () => {
    setSyncingDiscord(false);
  };

  const cancelSyncPreview = () => { setSyncData(null); setSyncingDiscord(false); };

  return {
    syncingDiscord, syncData, setSyncData, riotSyncErrors, setRiotSyncErrors, reSyncingPlayerId,
    handleResolveRiotError, handleSyncCheck, executeSync, resetSyncFlags, cancelSyncPreview,
  };
}
