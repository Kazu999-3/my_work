'use client';

import React, { useState, useEffect } from 'react';
import { SecretMatchProposal } from '../../lib/mentorshipMatchmaker';
import { toast } from '../../components/Toaster';
import { Sparkles, Shield, Send, CheckCircle2, XCircle, Clock, User, HeartHandshake, AlertCircle, X, ExternalLink } from 'lucide-react';

interface SecretMatchmakerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecretMatchmakerModal({ isOpen, onClose }: SecretMatchmakerModalProps) {
  const [proposals, setProposals] = useState<SecretMatchProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingPairId, setSendingPairId] = useState<string | null>(null);

  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mentorship/matchmaker');
      const data = await res.json();
      if (data.ok) {
        setProposals(data.proposals || []);
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

  const handleSendOffer = async (proposal: SecretMatchProposal) => {
    const confirmMsg =
      `【お見合い案内を送信】\n\n` +
      `先輩: ${proposal.mentor.name} (${proposal.mentor.rank})\n` +
      `後輩: ${proposal.pupil.name} (${proposal.pupil.rank})\n\n` +
      `双方向へお見合い案内（DM）を送信しますか？\n` +
      `※見送った場合でも相手には一切通知されません。`;

    if (!confirm(confirmMsg)) return;

    setSendingPairId(proposal.id);
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
        // 状態を更新
        setProposals((prev) =>
          prev.map((p) => (p.id === proposal.id ? { ...p, offerStatus: 'PENDING' } : p))
        );
      } else {
        toast.error(data.error || '送信に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setSendingPairId(null);
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

        {/* 完全非公開バナー */}
        <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
          <Shield size={15} className="text-emerald-600 shrink-0" />
          <span>
            <strong>🔒 安心ルール（完全サイレント）:</strong> どちらかが「今回は見送る」を選んでも、相手には一切通知されません。角が立つ心配ゼロでお届けできます。
          </span>
        </div>

        {/* リストエリア */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-foreground-subtle text-sm">
              <div className="inline-block animate-spin mb-3">🔄</div>
              <div>最新のロール・名簿データから相性を計算中...</div>
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-16 text-center text-foreground-subtle text-sm">
              現在おすすめ可能な相性ペアはありません。
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-foreground-subtle px-1">
                <span>算出したおすすめ候補: <strong>{proposals.length}組</strong></span>
                <span>※上位の相性抜群ペアから表示しています</span>
              </div>

              {proposals.slice(0, 15).map((proposal, idx) => {
                const isPending = proposal.offerStatus === 'PENDING' || proposal.offerStatus === 'PROPOSAL_PENDING';
                const isMatched = proposal.offerStatus === 'ACTIVE' || proposal.offerStatus === 'MATCHED';
                const isSending = sendingPairId === proposal.id;

                return (
                  <div
                    key={proposal.id}
                    className="p-4 md:p-5 rounded-2xl bg-surface border border-border hover:border-secondary-500/40 transition shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* ペア情報 */}
                      <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                        <div className="text-sm font-black text-foreground-subtle px-2 py-1 rounded-lg bg-surface-subtle">
                          #{idx + 1}
                        </div>

                        {/* 先輩 */}
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-secondary-500/20 text-secondary-600 flex items-center justify-center text-xs font-black">
                            先輩
                          </div>
                          <div>
                            <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                              {proposal.mentor.name}
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

                        {/* 後輩 */}
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-success-500/20 text-success-600 flex items-center justify-center text-xs font-black">
                            後輩
                          </div>
                          <div>
                            <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                              {proposal.pupil.name}
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
                              {proposal.pupil.secondaryLane ? ` (サブ: ${proposal.pupil.secondaryLane})` : ''}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* スコア ＆ 送信アクション */}
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
                            onClick={() => handleSendOffer(proposal)}
                            disabled={isSending}
                            className="px-3.5 py-2 rounded-xl bg-secondary-600 hover:bg-secondary-500 text-white font-black text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Send size={12} />
                            <span>{isSending ? '送信中...' : 'お見合い便を送る'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 相性理由タグ */}
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
          <span>KTM Mentorship AI Matchmaker • 実データ照合型</span>
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
