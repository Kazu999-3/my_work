'use client';

import React, { useState, useEffect } from 'react';
import { SecretMatchProposal, SecretMatchBatchProposal } from '../../lib/mentorshipMatchmaker';
import { toast } from '../../components/Toaster';
import { Sparkles, Shield, Send, CheckCircle2, XCircle, Clock, User, HeartHandshake, AlertCircle, X, ExternalLink, Users, Layers } from 'lucide-react';

interface SecretMatchmakerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getTierBadgeStyle = (tier?: string) => {
  switch (tier) {
    case 'light':
      return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
    case 'new':
      return 'bg-green-500/15 text-green-700 border-green-500/30';
    case 'regular':
      return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
    case 'experienced':
      return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
    case 'returning':
      return 'bg-purple-500/15 text-purple-700 border-purple-500/30';
    default:
      return 'bg-surface-subtle text-foreground-subtle border-border/50';
  }
};

/**
 * 送信日時のフォーマット ＆ 連投判定（48時間以内）
 */
export function formatOfferDate(isoString?: string | null): { text: string; relative: string; isRecent: boolean } | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const text = `${month}/${day} ${hours}:${mins}`;

  let relative = '';
  if (diffMinutes < 1) relative = 'たった今';
  else if (diffMinutes < 60) relative = `${diffMinutes}分前`;
  else if (diffHours < 24) relative = `${diffHours}時間前`;
  else if (diffDays === 1) relative = '昨日';
  else relative = `${diffDays}日前`;

  const isRecent = diffHours < 48; // 48時間以内は連投注意

  return { text, relative, isRecent };
}

/**
 * 見送り日時のフォーマット
 */
export function formatDismissedDate(isoString?: string | null): { text: string; relative: string } | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const text = `${month}/${day} ${hours}:${mins}`;

  let relative = '';
  if (diffDays === 0) relative = '本日';
  else if (diffDays === 1) relative = '昨日';
  else relative = `${diffDays}日前`;

  return { text, relative };
}

/**
 * 見送り理由の日本語ラベル
 */
export function getDeclineLabel(declineReason?: string, pupilStatus?: string, mentorStatus?: string): { text: string; who: 'pupil' | 'mentor' | 'both' | 'unknown' } {
  if (declineReason === 'PUPIL_DECLINED' || pupilStatus === 'DECLINED') {
    return { text: '後輩が見送り', who: 'pupil' };
  }
  if (declineReason === 'MENTOR_DECLINED' || mentorStatus === 'DECLINED') {
    return { text: '先輩が見送り', who: 'mentor' };
  }
  if (declineReason === 'BOTH_DECLINED') {
    return { text: '双方見送り', who: 'both' };
  }
  return { text: '見送り', who: 'unknown' };
}

/**
 * 回答進捗（誰がOK済で誰の返事待ちか）のラベルとスタイル
 */
export function getPendingProgressInfo(mentorStatus?: string, pupilStatus?: string): {
  type: 'MENTOR_ACCEPTED' | 'PUPIL_ACCEPTED' | 'BOTH_PENDING';
  label: string;
  subLabel: string;
  badgeClass: string;
  icon: string;
} {
  if (mentorStatus === 'ACCEPTED' && pupilStatus !== 'ACCEPTED') {
    return {
      type: 'MENTOR_ACCEPTED',
      label: '先輩OK済',
      subLabel: '後輩の返事待ち',
      badgeClass: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
      icon: '👍',
    };
  }
  if (pupilStatus === 'ACCEPTED' && mentorStatus !== 'ACCEPTED') {
    return {
      type: 'PUPIL_ACCEPTED',
      label: '後輩リクエスト中',
      subLabel: '先輩の返事待ち',
      badgeClass: 'bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-500/30',
      icon: '🎒',
    };
  }
  return {
    type: 'BOTH_PENDING',
    label: '双方未回答',
    subLabel: '回答待ち',
    badgeClass: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30',
    icon: '🕒',
  };
}

export function SecretMatchmakerModal({ isOpen, onClose }: SecretMatchmakerModalProps) {
  const [viewMode, setViewMode] = useState<'BATCH' | 'PAIR'>('BATCH');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DECLINED' | 'UNSENT'>('ALL');
  const [proposals, setProposals] = useState<SecretMatchProposal[]>([]);
  const [batches, setBatches] = useState<SecretMatchBatchProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mentorship/matchmaker');
      const data = await res.json();
      if (data.ok) {
        setProposals(data.proposals || []);
        setBatches(data.batches || []);
      } else {
        toast.error(data.error || 'お見合い候補の取得に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProposals();
    }
  }, [isOpen]);

  // 単一ペア送信
  const handleSendSingleOffer = async (proposal: SecretMatchProposal) => {
    const offerDate = formatOfferDate(proposal.lastOfferedAt);
    let warningPrefix = '';
    if (offerDate?.isRecent) {
      warningPrefix =
        `⚠️【連投注意】\n` +
        `このペアには ${offerDate.text} (${offerDate.relative}) に送信済みです。\n` +
        `短期間での再送信（重複DM）となりますが、本当に送信しますか？\n\n`;
    }

    const confirmMsg =
      warningPrefix +
      `【お見合い案内を送信】\n\n` +
      `先輩: ${proposal.mentor.name} (${proposal.mentor.rank})\n` +
      `後輩: ${proposal.pupil.name} (${proposal.pupil.rank})\n\n` +
      `双方向へお見合い案内（DM）を送信しますか？\n` +
      `※見送った場合でも相手には一切通知されません。`;

    if (!confirm(confirmMsg)) return;

    setSendingId(proposal.id);
    try {
      const res = await fetch('/api/mentorship/matchmaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_OFFER',
          proposal,
          sendToPupil: true,
          sendToMentor: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`💌 ${proposal.pupil.name} さんと ${proposal.mentor.name} さんへお見合い便を届けました！`);
        const nowIso = new Date().toISOString();
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposal.id ? { ...p, offerStatus: 'PENDING', lastOfferedAt: nowIso } : p
          )
        );
      } else {
        toast.error(data.error || '送信に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setSendingId(null);
    }
  };

  // 複数まとめ便送信（パターンA）
  const handleSendBatchOffer = async (batch: SecretMatchBatchProposal) => {
    const offerDate = formatOfferDate(batch.lastOfferedAt);
    let warningPrefix = '';
    if (offerDate?.isRecent) {
      warningPrefix =
        `⚠️【連投注意】\n` +
        `この後輩（${batch.pupil.name} さん）には ${offerDate.text} (${offerDate.relative}) に送信済みです。\n` +
        `短期間での再送信（重複DM）となりますが、本当に送信しますか？\n\n`;
    }

    const mentorNames = batch.mentors.map((m, i) => `${i + 1}. ${m.name} (${m.lanes.join('/')} / ★${m.matchScore}%)`).join('\n');
    const confirmMsg =
      warningPrefix +
      `【まとめ便（パターンA）を送信】\n\n` +
      `後輩: ${batch.pupil.name} さん (${batch.pupil.rank} / ${batch.pupil.primaryLane})\n\n` +
      `ご紹介する先輩（${batch.mentors.length}名）:\n${mentorNames}\n\n` +
      `上記をまとめた1通のDMを後輩へ送信しますか？\n` +
      `※見送った場合でも相手には一切通知されません。`;

    if (!confirm(confirmMsg)) return;

    setSendingId(batch.pupil.discordId);
    try {
      const res = await fetch('/api/mentorship/matchmaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_BATCH_OFFER',
          batch,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`💌 ${batch.pupil.name} さんへ先輩${batch.mentors.length}名のまとめ便を届けました！`);
        const nowIso = new Date().toISOString();
        setBatches((prev) =>
          prev.map((b) =>
            b.pupil.discordId === batch.pupil.discordId
              ? {
                  ...b,
                  lastOfferedAt: nowIso,
                  mentors: b.mentors.map((m) => ({ ...m, offerStatus: 'PENDING', lastOfferedAt: nowIso })),
                }
              : b
          )
        );
        fetchProposals();
      } else {
        toast.error(data.error || '送信に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setSendingId(null);
    }
  };

  // BATCH 各ステータス件数
  const batchCounts = {
    all: batches.length,
    pending: batches.filter((b) => b.mentors.some((m) => m.offerStatus === 'PENDING' || m.offerStatus === 'PROPOSAL_PENDING')).length,
    declined: batches.filter((b) => b.hasDeclined || b.mentors.some((m) => m.offerStatus === 'DECLINED')).length,
    unsent: batches.filter((b) => {
      const hasPending = b.mentors.some((m) => m.offerStatus === 'PENDING' || m.offerStatus === 'PROPOSAL_PENDING');
      const hasMatched = b.mentors.some((m) => m.offerStatus === 'ACTIVE' || m.offerStatus === 'MATCHED');
      const hasDeclined = b.hasDeclined || b.mentors.some((m) => m.offerStatus === 'DECLINED');
      return !hasPending && !hasMatched && !hasDeclined;
    }).length,
  };

  // PAIR 各ステータス件数
  const pairCounts = {
    all: proposals.length,
    pending: proposals.filter((p) => p.offerStatus === 'PENDING' || p.offerStatus === 'PROPOSAL_PENDING').length,
    declined: proposals.filter((p) => p.offerStatus === 'DECLINED').length,
    unsent: proposals.filter((p) => {
      const isPending = p.offerStatus === 'PENDING' || p.offerStatus === 'PROPOSAL_PENDING';
      const isMatched = p.offerStatus === 'ACTIVE' || p.offerStatus === 'MATCHED';
      const isDeclined = p.offerStatus === 'DECLINED';
      return !isPending && !isMatched && !isDeclined;
    }).length,
  };

  const currentCounts = viewMode === 'BATCH' ? batchCounts : pairCounts;

  const filteredBatches = batches.filter((b) => {
    const hasPending = b.mentors.some((m) => m.offerStatus === 'PENDING' || m.offerStatus === 'PROPOSAL_PENDING');
    const hasMatched = b.mentors.some((m) => m.offerStatus === 'ACTIVE' || m.offerStatus === 'MATCHED');
    const hasDeclined = b.hasDeclined || b.mentors.some((m) => m.offerStatus === 'DECLINED');

    if (statusFilter === 'PENDING') return hasPending;
    if (statusFilter === 'DECLINED') return hasDeclined;
    if (statusFilter === 'UNSENT') return !hasPending && !hasMatched && !hasDeclined;
    return true;
  });

  const filteredProposals = proposals.filter((p) => {
    const isPending = p.offerStatus === 'PENDING' || p.offerStatus === 'PROPOSAL_PENDING';
    const isMatched = p.offerStatus === 'ACTIVE' || p.offerStatus === 'MATCHED';
    const isDeclined = p.offerStatus === 'DECLINED';

    if (statusFilter === 'PENDING') return isPending;
    if (statusFilter === 'DECLINED') return isDeclined;
    if (statusFilter === 'UNSENT') return !isPending && !isMatched && !isDeclined;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="p-5 md:p-6 border-b border-border bg-surface-subtle/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-secondary-500/20 text-secondary-600 flex items-center justify-center border border-secondary-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-foreground">
                  🤖 シークレットお見合い便（管理者テスト画面）
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-secondary-500/20 text-secondary-800 border border-secondary-500/30">
                  MVP味見モード
                </span>
              </div>
              <p className="text-xs text-foreground-subtle mt-0.5">
                名簿データ（未登録メンバー含む）と登録済み先輩から相性を自動算出。双方がOKした時だけ繋がる安全設計です。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-subtle hover:bg-surface-hover flex items-center justify-center text-foreground-subtle transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* サブバー: 完全非公開バナー ＆ 表示モード切替 */}
        <div className="px-6 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 font-medium">
            <Shield size={14} className="text-emerald-600 shrink-0" />
            <span>
              <strong>🔒 安心ルール:</strong> 「見送る」を選んでも相手には一切通知されません。
            </span>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto bg-surface/80 p-0.5 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode('BATCH')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-black transition flex items-center gap-1 ${
                viewMode === 'BATCH'
                  ? 'bg-secondary-600 text-white shadow-2xs'
                  : 'text-foreground-subtle hover:text-foreground'
              }`}
            >
              <Layers size={11} />
              <span>まとめ便 (パターンA)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('PAIR')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-black transition flex items-center gap-1 ${
                viewMode === 'PAIR'
                  ? 'bg-secondary-600 text-white shadow-2xs'
                  : 'text-foreground-subtle hover:text-foreground'
              }`}
            >
              <Users size={11} />
              <span>個別ペア一覧</span>
            </button>
          </div>
        </div>

        {/* ステータス絞り込みフィルターバー */}
        <div className="px-6 py-2 bg-surface-subtle/80 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-foreground-subtle mr-1">状態絞り込み:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'bg-surface hover:bg-surface-hover text-foreground-subtle border border-border/60'
              }`}
            >
              <span>すべて</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                {currentCounts.all}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-surface hover:bg-surface-hover text-amber-700 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              <Clock size={11} />
              <span>回答待ち</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                {currentCounts.pending}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DECLINED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'DECLINED'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-surface hover:bg-surface-hover text-slate-700 dark:text-slate-300 border border-slate-500/30'
              }`}
            >
              <span>🍃 見送り</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                {currentCounts.declined}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNSENT')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'UNSENT'
                  ? 'bg-secondary-600 text-white shadow-2xs'
                  : 'bg-surface hover:bg-surface-hover text-foreground-subtle border border-border/60'
              }`}
            >
              <span>未送信</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                {currentCounts.unsent}
              </span>
            </button>
          </div>
          <div className="text-[11px] text-foreground-subtle font-medium">
            表示中: <strong className="text-foreground">{viewMode === 'BATCH' ? filteredBatches.length : filteredProposals.length}</strong> 件
          </div>
        </div>

        {/* リストエリア */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-foreground-subtle text-sm">
              <div className="inline-block animate-spin mb-3">🔄</div>
              <div>最新のロール・名簿データから相性を計算中...</div>
            </div>
          ) : viewMode === 'BATCH' ? (
            /* パターンA: 後輩ごとのまとめ便一覧 */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-foreground-subtle px-1">
                <span>後輩候補: <strong>{filteredBatches.length}名</strong>（相性上位の先輩を最大2〜3名紐付け）</span>
                <span>※「📖 教わりたい」ロール所持者を最優先表示</span>
              </div>

              {filteredBatches.length === 0 ? (
                <div className="py-12 text-center text-foreground-subtle text-xs bg-surface-subtle/40 rounded-2xl border border-dashed border-border">
                  該当するまとめ便候補はありません
                </div>
              ) : filteredBatches.slice(0, 15).map((batch, bIdx) => {
                const isSending = sendingId === batch.pupil.discordId;
                const hasPending = batch.mentors.some((m) => m.offerStatus === 'PENDING' || m.offerStatus === 'PROPOSAL_PENDING');
                const hasMatched = batch.mentors.some((m) => m.offerStatus === 'ACTIVE' || m.offerStatus === 'MATCHED');

                return (
                  <div
                    key={batch.pupil.discordId}
                    className="p-4 md:p-5 rounded-2xl bg-surface border border-border hover:border-secondary-500/40 transition shadow-2xs space-y-3.5"
                  >
                    {/* 後輩ヘッダー */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="text-xs font-black text-foreground-subtle px-2 py-0.5 rounded-lg bg-surface-subtle">
                          #{bIdx + 1}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-foreground">{batch.pupil.name}</span>
                          {batch.pupil.tierLabel && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getTierBadgeStyle(batch.pupil.tier)}`}>
                              {batch.pupil.tierLabel}
                              {batch.pupil.totalGames !== undefined && (
                                <span className="ml-1 opacity-70 font-normal">({batch.pupil.totalGames}戦)</span>
                              )}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-subtle text-foreground-subtle">
                            {batch.pupil.rank}
                          </span>
                          <span className="text-xs text-foreground-subtle font-medium">
                            🛡️ {batch.pupil.primaryLane}{batch.pupil.secondaryLane ? ` (サブ: ${batch.pupil.secondaryLane})` : ''}
                          </span>
                        </div>
                        {batch.pupil.hasLearnRole && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700">
                            📖 教わりたい
                          </span>
                        )}
                        {!batch.pupil.isRegistered && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
                            名簿（カード未登録）
                          </span>
                        )}

                        {/* 見送りありバッジ */}
                        {batch.hasDeclined && (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 flex items-center gap-1"
                            title={batch.dismissedAt ? `${formatDismissedDate(batch.dismissedAt)?.text} に見送りがありました` : '見送り履歴あり'}
                          >
                            <span>🍃 見送りあり</span>
                            {batch.dismissedAt && formatDismissedDate(batch.dismissedAt) && (
                              <span className="opacity-80">({formatDismissedDate(batch.dismissedAt)?.relative})</span>
                            )}
                          </span>
                        )}

                        {/* 送信履歴バッジ */}
                        {(() => {
                          const offerDate = formatOfferDate(batch.lastOfferedAt);
                          if (offerDate) {
                            return (
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                  offerDate.isRecent
                                    ? 'bg-amber-500/20 text-amber-800 border-amber-500/40'
                                    : 'bg-surface-subtle text-foreground-subtle border-border/60'
                                }`}
                                title={offerDate.isRecent ? '48時間以内に送信済みです（連投にご注意ください）' : '過去の送信履歴'}
                              >
                                <Send size={10} className={offerDate.isRecent ? 'text-amber-600' : 'text-foreground-subtle'} />
                                <span>{offerDate.isRecent ? '⚠️ 直近送信: ' : '📨 送信済: '}{offerDate.text} ({offerDate.relative})</span>
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-subtle/60 text-foreground-subtle/70 border border-border/40">
                              未送信
                            </span>
                          );
                        })()}
                      </div>

                      {/* 送信ボタンエリア */}
                      <div className="flex flex-col sm:items-end gap-1 self-end sm:self-auto shrink-0">
                        {hasMatched ? (
                          <span className="px-3 py-1.5 rounded-xl bg-success-500/20 text-success-700 text-xs font-black flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            成立済み
                          </span>
                        ) : hasPending ? (
                          <div className="flex flex-col items-end gap-0.5">
                            {(() => {
                              const acceptedMentor = batch.mentors.find((m) => m.mentorStatus === 'ACCEPTED');
                              const isPupilReq = batch.mentors.some((m) => m.pupilStatus === 'ACCEPTED');
                              if (acceptedMentor) {
                                return (
                                  <>
                                    <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center gap-1 border border-emerald-500/30">
                                      <span>👍 {acceptedMentor.name}先輩OK済</span>
                                    </span>
                                    <span className="text-[10px] text-foreground-subtle font-medium">
                                      後輩の回答待ち
                                    </span>
                                  </>
                                );
                              }
                              if (isPupilReq) {
                                return (
                                  <>
                                    <span className="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-800 dark:text-blue-300 text-xs font-black flex items-center gap-1 border border-blue-500/30">
                                      <span>🎒 後輩リクエスト中</span>
                                    </span>
                                    <span className="text-[10px] text-foreground-subtle font-medium">
                                      先輩の回答待ち
                                    </span>
                                  </>
                                );
                              }
                              return (
                                <>
                                  <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-black flex items-center gap-1 border border-amber-500/30">
                                    <Clock size={12} />
                                    <span>双方未回答</span>
                                  </span>
                                  <span className="text-[10px] text-foreground-subtle font-medium">
                                    回答待ち
                                  </span>
                                </>
                              );
                            })()}
                            {batch.lastOfferedAt && formatOfferDate(batch.lastOfferedAt) && (
                              <span className="text-[9px] text-foreground-subtle font-normal">
                                {formatOfferDate(batch.lastOfferedAt)?.text} 送信 ({formatOfferDate(batch.lastOfferedAt)?.relative})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleSendBatchOffer(batch)}
                              disabled={isSending}
                              className={`px-4 py-2 rounded-xl text-white font-black text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                formatOfferDate(batch.lastOfferedAt)?.isRecent
                                  ? 'bg-amber-600 hover:bg-amber-500'
                                  : 'bg-secondary-600 hover:bg-secondary-500'
                              }`}
                            >
                              <Send size={12} />
                              <span>
                                {isSending
                                  ? '送信中...'
                                  : formatOfferDate(batch.lastOfferedAt)?.isRecent
                                  ? `まとめ便を再送信 (${batch.mentors.length}名)`
                                  : `まとめ便を送信 (${batch.mentors.length}名分)`}
                              </span>
                            </button>
                            {formatOfferDate(batch.lastOfferedAt) && (
                              <span className="text-[10px] text-foreground-subtle font-medium">
                                前回: {formatOfferDate(batch.lastOfferedAt)?.text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 紐づく先輩一覧（最大2〜3名） */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {batch.mentors.map((m, mIdx) => {
                        const numIcons = ['①', '②', '③'];
                        const mOfferDate = formatOfferDate(m.lastOfferedAt);
                        const isMentorDeclined = m.offerStatus === 'DECLINED';
                        const mDecline = getDeclineLabel(m.declineReason, m.pupilStatus, m.mentorStatus);
                        const mDismissedDate = formatDismissedDate(m.dismissedAt);

                        return (
                          <div
                            key={m.profileId}
                            className={`p-3 rounded-xl border space-y-2 text-xs transition ${
                              isMentorDeclined
                                ? 'bg-surface-subtle/30 border-border/50 opacity-80'
                                : 'bg-surface-subtle/50 border-border/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-black text-foreground flex-wrap">
                                <span className={isMentorDeclined ? 'text-foreground-subtle' : 'text-secondary-600'}>
                                  {numIcons[mIdx]}
                                </span>
                                <span>{m.name} 先輩</span>
                                {m.tierLabel && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTierBadgeStyle(m.tier)}`}>
                                    {m.tierLabel}
                                  </span>
                                )}
                                <span className="text-[10px] font-normal text-foreground-subtle">({m.rank} / {m.lanes.join('/')})</span>
                              </div>

                              {isMentorDeclined ? (
                                <div className="text-right">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-700 dark:text-slate-300 text-[10px] font-black border border-slate-500/30 inline-block">
                                    🍃 {mDecline.text}
                                  </span>
                                  {mDismissedDate && (
                                    <div className="text-[9px] text-foreground-subtle font-medium mt-0.5">
                                      {mDismissedDate.text} ({mDismissedDate.relative})
                                    </div>
                                  )}
                                  {m.daysRemaining !== undefined && m.daysRemaining > 0 && (
                                    <div className="text-[9px] text-slate-500 dark:text-slate-400">
                                      残り{m.daysRemaining}日
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="text-secondary-600 font-black text-xs">
                                    ★ {m.matchScore}%
                                  </div>
                                  {/* 先輩ごとの進捗バッジ */}
                                  {m.mentorStatus === 'ACCEPTED' ? (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] font-black border border-emerald-500/30 inline-block mt-0.5">
                                      👍 先輩OK済
                                    </span>
                                  ) : m.pupilStatus === 'ACCEPTED' ? (
                                    <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-800 dark:text-blue-300 text-[9px] font-black border border-blue-500/30 inline-block mt-0.5">
                                      🎒 後輩リクエスト
                                    </span>
                                  ) : (m.offerStatus === 'PENDING' || m.offerStatus === 'PROPOSAL_PENDING') ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[9px] font-bold border border-amber-500/20 inline-block mt-0.5">
                                      🕒 未回答
                                    </span>
                                  ) : null}
                                  {mOfferDate && (
                                    <div className="text-[9px] text-foreground-subtle font-normal mt-0.5">
                                      送信: {mOfferDate.text}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {m.champions && m.champions.length > 0 && (
                              <div className="text-[11px] text-foreground-subtle">
                                🛡️ 得意: {m.champions.slice(0, 3).join(', ')}
                              </div>
                            )}

                            <div className="flex items-center gap-1 flex-wrap text-[10px] text-foreground-subtle">
                              {m.reasons.slice(0, 2).map((r, ri) => (
                                <span key={ri} className="px-1.5 py-0.2 rounded bg-surface border border-border/50">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 個別ペア一覧表示 */
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-foreground-subtle px-1">
                <span>算出したおすすめペア: <strong>{filteredProposals.length}組</strong></span>
              </div>

              {filteredProposals.length === 0 ? (
                <div className="py-12 text-center text-foreground-subtle text-xs bg-surface-subtle/40 rounded-2xl border border-dashed border-border">
                  該当する個別ペア候補はありません
                </div>
              ) : filteredProposals.slice(0, 20).map((proposal, idx) => {
                const isPending = proposal.offerStatus === 'PENDING' || proposal.offerStatus === 'PROPOSAL_PENDING';
                const isMatched = proposal.offerStatus === 'ACTIVE' || proposal.offerStatus === 'MATCHED';
                const isDeclined = proposal.offerStatus === 'DECLINED';
                const isSending = sendingId === proposal.id;

                return (
                  <div
                    key={proposal.id}
                    className={`p-4 md:p-5 rounded-2xl bg-surface border transition shadow-2xs space-y-3 ${
                      isDeclined
                        ? 'border-border/60 hover:border-slate-500/40 opacity-85'
                        : 'border-border hover:border-secondary-500/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                        <div className="text-sm font-black text-foreground-subtle px-2 py-1 rounded-lg bg-surface-subtle">
                          #{idx + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-secondary-500/20 text-secondary-600 flex items-center justify-center text-xs font-black">
                            先輩
                          </div>
                          <div>
                            <div className="text-xs font-black text-foreground flex items-center gap-1.5 flex-wrap">
                              {proposal.mentor.name}
                              {proposal.mentor.tierLabel && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTierBadgeStyle(proposal.mentor.tier)}`}>
                                  {proposal.mentor.tierLabel}
                                </span>
                              )}
                              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-surface-subtle text-foreground-subtle">
                                {proposal.mentor.rank}
                              </span>
                            </div>
                            <div className="text-[11px] text-foreground-subtle">
                              🛡️ {proposal.mentor.lanes.join('/')}
                            </div>
                          </div>
                        </div>
                        <div className="text-foreground-subtle font-black text-xs">✕</div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-success-500/20 text-success-600 flex items-center justify-center text-xs font-black">
                            後輩
                          </div>
                          <div>
                            <div className="text-xs font-black text-foreground flex items-center gap-1.5 flex-wrap">
                              {proposal.pupil.name}
                              {proposal.pupil.tierLabel && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTierBadgeStyle(proposal.pupil.tier)}`}>
                                  {proposal.pupil.tierLabel}
                                  {proposal.pupil.totalGames !== undefined && (
                                    <span className="ml-0.5 opacity-70 font-normal">({proposal.pupil.totalGames}戦)</span>
                                  )}
                                </span>
                              )}
                              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-surface-subtle text-foreground-subtle">
                                {proposal.pupil.rank}
                              </span>
                              {proposal.pupil.hasLearnRole && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-700">
                                  📖 教わりたい
                                </span>
                              )}
                              {!proposal.pupil.isRegistered && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
                                  名簿（未登録）
                                </span>
                              )}

                              {/* 見送りバッジ */}
                              {isDeclined && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/30 flex items-center gap-0.5">
                                  <span>🍃 見送り</span>
                                </span>
                              )}

                              {/* 送信履歴バッジ */}
                              {(() => {
                                const pairDate = formatOfferDate(proposal.lastOfferedAt);
                                if (pairDate) {
                                  return (
                                    <span
                                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                                        pairDate.isRecent
                                          ? 'bg-amber-500/20 text-amber-800 border-amber-500/40'
                                          : 'bg-surface-subtle text-foreground-subtle border-border/60'
                                      }`}
                                      title={pairDate.isRecent ? '48時間以内に送信済みです（連投注意）' : '過去の送信履歴'}
                                    >
                                      <Send size={9} className={pairDate.isRecent ? 'text-amber-600' : 'text-foreground-subtle'} />
                                      <span>{pairDate.isRecent ? '⚠️ 直近送信: ' : '📨 送信済: '}{pairDate.text} ({pairDate.relative})</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-subtle/60 text-foreground-subtle/70 border border-border/40">
                                    未送信
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="text-[11px] text-foreground-subtle">
                              🛡️ {proposal.pupil.primaryLane}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="text-xs text-foreground-subtle font-medium">相性スコア</div>
                          <div className={`text-base font-black ${isDeclined ? 'text-foreground-subtle' : 'text-secondary-600'}`}>
                            {proposal.matchScore}%
                          </div>
                        </div>

                        {isMatched ? (
                          <span className="px-3 py-1.5 rounded-xl bg-success-500/20 text-success-700 text-xs font-black flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            成立済み
                          </span>
                        ) : isPending ? (
                          <div className="flex flex-col items-end gap-0.5">
                            {(() => {
                              const progress = getPendingProgressInfo(proposal.mentorStatus, proposal.pupilStatus);
                              return (
                                <>
                                  <span className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 border ${progress.badgeClass}`}>
                                    <span>{progress.icon}</span>
                                    <span>{progress.label}</span>
                                  </span>
                                  <span className="text-[10px] text-foreground-subtle font-medium">
                                    {progress.subLabel}
                                  </span>
                                </>
                              );
                            })()}
                            {proposal.lastOfferedAt && formatOfferDate(proposal.lastOfferedAt) && (
                              <span className="text-[9px] text-foreground-subtle font-normal">
                                {formatOfferDate(proposal.lastOfferedAt)?.text} 送信 ({formatOfferDate(proposal.lastOfferedAt)?.relative})
                              </span>
                            )}
                          </div>
                        ) : isDeclined ? (
                          <div className="flex flex-col items-end gap-1">
                            {(() => {
                              const decline = getDeclineLabel(proposal.declineReason, proposal.pupilStatus, proposal.mentorStatus);
                              const disDate = formatDismissedDate(proposal.dismissedAt);
                              return (
                                <>
                                  <span className="px-3 py-1 rounded-xl bg-slate-500/20 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center gap-1 border border-slate-500/30">
                                    <span>🍃 {decline.text}</span>
                                  </span>
                                  <div className="text-[10px] text-foreground-subtle text-right">
                                    {disDate && <span>{disDate.text} ({disDate.relative})</span>}
                                    {proposal.daysRemaining !== undefined && proposal.daysRemaining > 0 && (
                                      <span className="ml-1 text-slate-500 dark:text-slate-400 font-medium">
                                        • 残り{proposal.daysRemaining}日
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSendSingleOffer(proposal)}
                                    disabled={isSending}
                                    className="px-2.5 py-1 rounded-lg text-foreground-subtle hover:text-foreground text-[10px] font-bold border border-border/60 hover:bg-surface-hover transition cursor-pointer mt-0.5"
                                    title="見送り状態ですが、管理者が再度打診（再送信）できます"
                                  >
                                    {isSending ? '送信中...' : '🔄 見送りを解除して再送信'}
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleSendSingleOffer(proposal)}
                              disabled={isSending}
                              className={`px-3.5 py-2 rounded-xl text-white font-black text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                formatOfferDate(proposal.lastOfferedAt)?.isRecent
                                  ? 'bg-amber-600 hover:bg-amber-500'
                                  : 'bg-secondary-600 hover:bg-secondary-500'
                              }`}
                            >
                              <Send size={12} />
                              <span>
                                {isSending
                                  ? '送信中...'
                                  : formatOfferDate(proposal.lastOfferedAt)?.isRecent
                                  ? 'お見合い便を再送信'
                                  : 'お見合い便を送る'}
                              </span>
                            </button>
                            {formatOfferDate(proposal.lastOfferedAt) && (
                              <span className="text-[10px] text-foreground-subtle font-medium">
                                前回: {formatOfferDate(proposal.lastOfferedAt)?.text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50 text-[11px]">
                      {proposal.reasons.map((r, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-surface-subtle text-foreground-subtle border border-border/50"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-border bg-surface-subtle/50 flex items-center justify-between text-xs text-foreground-subtle">
          <span>KTM Mentorship AI Matchmaker • パターンA（まとめ便）完全対応</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-hover font-bold text-foreground text-xs transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
