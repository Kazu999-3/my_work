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

export function SecretMatchmakerModal({ isOpen, onClose }: SecretMatchmakerModalProps) {
  const [viewMode, setViewMode] = useState<'BATCH' | 'PAIR'>('BATCH');
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
    const confirmMsg =
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
        setProposals((prev) =>
          prev.map((p) => (p.id === proposal.id ? { ...p, offerStatus: 'PENDING' } : p))
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
    const mentorNames = batch.mentors.map((m, i) => `${i + 1}. ${m.name} (${m.lanes.join('/')} / ★${m.matchScore}%)`).join('\n');
    const confirmMsg =
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
                <span>後輩候補: <strong>{batches.length}名</strong>（相性上位の先輩を最大2〜3名紐付け）</span>
                <span>※「📖 教わりたい」ロール所持者を最優先表示</span>
              </div>

              {batches.slice(0, 10).map((batch, bIdx) => {
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
                      </div>

                      {/* 送信ボタン */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {hasMatched ? (
                          <span className="px-3 py-1.5 rounded-xl bg-success-500/20 text-success-700 text-xs font-black flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            成立済み
                          </span>
                        ) : hasPending ? (
                          <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-700 text-xs font-black flex items-center gap-1">
                            <Clock size={13} />
                            回答待ち
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendBatchOffer(batch)}
                            disabled={isSending}
                            className="px-4 py-2 rounded-xl bg-secondary-600 hover:bg-secondary-500 text-white font-black text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Send size={12} />
                            <span>{isSending ? '送信中...' : `まとめ便を送信 (${batch.mentors.length}名分)`}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 紐づく先輩一覧（最大2〜3名） */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {batch.mentors.map((m, mIdx) => {
                        const numIcons = ['①', '②', '③'];
                        return (
                          <div
                            key={m.profileId}
                            className="p-3 rounded-xl bg-surface-subtle/50 border border-border/60 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-black text-foreground flex-wrap">
                                <span className="text-secondary-600">{numIcons[mIdx]}</span>
                                <span>{m.name} 先輩</span>
                                {m.tierLabel && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTierBadgeStyle(m.tier)}`}>
                                    {m.tierLabel}
                                  </span>
                                )}
                                <span className="text-[10px] font-normal text-foreground-subtle">({m.rank} / {m.lanes.join('/')})</span>
                              </div>
                              <div className="text-secondary-600 font-black text-xs">
                                ★ {m.matchScore}%
                              </div>
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
                <span>算出したおすすめペア: <strong>{proposals.length}組</strong></span>
              </div>

              {proposals.slice(0, 15).map((proposal, idx) => {
                const isPending = proposal.offerStatus === 'PENDING' || proposal.offerStatus === 'PROPOSAL_PENDING';
                const isMatched = proposal.offerStatus === 'ACTIVE' || proposal.offerStatus === 'MATCHED';
                const isSending = sendingId === proposal.id;

                return (
                  <div
                    key={proposal.id}
                    className="p-4 md:p-5 rounded-2xl bg-surface border border-border hover:border-secondary-500/40 transition shadow-2xs space-y-3"
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
                          <div className="text-base font-black text-secondary-600">
                            {proposal.matchScore}%
                          </div>
                        </div>

                        {isMatched ? (
                          <span className="px-3 py-1.5 rounded-xl bg-success-500/20 text-success-700 text-xs font-black flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            成立済み
                          </span>
                        ) : isPending ? (
                          <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-700 text-xs font-black flex items-center gap-1">
                            <Clock size={13} />
                            回答待ち
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendSingleOffer(proposal)}
                            disabled={isSending}
                            className="px-3.5 py-2 rounded-xl bg-secondary-600 hover:bg-secondary-500 text-white font-black text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Send size={12} />
                            <span>{isSending ? '送信中...' : 'お見合い便を送る'}</span>
                          </button>
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
