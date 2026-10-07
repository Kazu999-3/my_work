import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "../../../components/Toaster";
import { buildResultCopyText } from "../../../lib/balancer/teams";

type SetMessage = (m: { type: string; text: string }) => void;

/**
 * チーム分け結果の共有操作: 候補案のDiscord投稿・結果のDiscord通知・コピー・記録画面へ移動、
 * 募集状況のDiscord通知。
 * 2026-10-07: app/balancer/page.tsx から分離（処理は分離前と同じ）。
 */
export function useResultActions({ balanceResult, proposals, players, handicapNames, setMessage }: {
  balanceResult: any;
  proposals: any[];
  players: any[];
  handicapNames: Set<string>;
  setMessage: SetMessage;
}) {
  const router = useRouter();
  const [savingPending, setSavingPending] = useState(false);
  const [sendingProposals, setSendingProposals] = useState(false);
  const [sendingDiscord, setSendingDiscord] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [announcingStats, setAnnouncingStats] = useState(false);

  const handleRecordNavigate = async () => {
    if (!balanceResult) return;
    setSavingPending(true);
    try {
      try {
        localStorage.setItem('balancer_last_result', JSON.stringify(balanceResult));
      } catch (e) {
        console.error('Failed to cache balancer_last_result:', e);
      }
      const res = await fetch('/api/balancer/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balanceResult })
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        const pendingId = data.pendingId || data.id;
        if (pendingId) {
          router.push(`/balancer/record?pending_id=${pendingId}`);
          return;
        }
      }
      // API保存が失敗しても、localStorageフォールバックがあるので記録画面へ遷移
      router.push('/balancer/record');
    } catch (err: any) {
      console.error('Navigate error:', err);
      router.push('/balancer/record');
    } finally {
      setSavingPending(false);
    }
  };

  const handleAnnounceStats = async () => {
    const activeCount = players.filter(p => p.is_active && !p.is_spectator_fixed).length;
    if (activeCount === 0) {
      toast.info("参加予定のプレイヤーが選択されていません。");
      return;
    }
    setAnnouncingStats(true);
    try {
      const res = await fetch('/api/discord/announce-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "通知に失敗しました。");
      toast.success("📢 Discordへ現在の募集・希望レーン状況を通知しました！");
    } catch (err: any) {
      toast.error(`通知エラー: ${err.message}`);
    } finally {
      setAnnouncingStats(false);
    }
  };

  // 4案すべてをDiscordへ投稿(#77)。メンバーはリアクションで希望表明。
  const handleSendProposals = async () => {
    if (!proposals || proposals.length === 0) return;
    if (!confirm(`チーム分け候補 ${proposals.length}案 をすべてDiscordへ投稿しますか？（メンバーがリアクションで投票できます）`)) return;
    setSendingProposals(true);
    try {
      const res = await fetch('/api/discord/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '投稿に失敗しました');
      setMessage({ type: 'success', text: `✅ ${proposals.length}案をDiscordに投稿しました！` });
    } catch (err: any) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setSendingProposals(false);
    }
  };

  const handleSendDiscord = async () => {
    if (!balanceResult) return;
    if (!confirm("チーム分けの結果をDiscordのKTMチャンネルへ通知しますか？")) return;
    setSendingDiscord(true);
    try {
      const res = await fetch('/api/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ハンデ参加者を通知にも明示する
        body: JSON.stringify({ ...balanceResult, handicaps: Array.from(handicapNames) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discord通知に失敗しました');
      setMessage({ type: "success", text: "✅ Discordに結果を送信しました！" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSendingDiscord(false);
    }
  };

  const handleCopyResultText = () => {
    if (!balanceResult) return;
    const text = buildResultCopyText(balanceResult);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
      setMessage({ type: "success", text: "📋 チーム分け結果テキストをクリップボードにコピーしました！" });
    }).catch(err => {
      setMessage({ type: "error", text: "コピーに失敗しました: " + err.message });
    });
  };

  return {
    savingPending, sendingProposals, sendingDiscord, copiedResult, announcingStats,
    handleRecordNavigate, handleAnnounceStats, handleSendProposals, handleSendDiscord, handleCopyResultText,
  };
}
