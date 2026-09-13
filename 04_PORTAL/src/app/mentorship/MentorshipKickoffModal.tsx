'use client';

import React, { useState } from 'react';
import { KICKOFF_STEPS } from '../../lib/mentorshipConstants';
import { toast } from '../../components/Toaster';
import { X, Rocket, Copy, Check, ExternalLink, MessageSquare, Target, Swords } from 'lucide-react';

interface MentorshipKickoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: any;
}

export function MentorshipKickoffModal({
  isOpen,
  onClose,
  match,
}: MentorshipKickoffModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen || !match) return null;

  const mentorName = match.mentor?.player_name || '師匠';
  const pupilName = match.pupil?.player_name || '弟子';
  const durationLabel = match.meta?.durationLabel || '2週間育成コース';

  const templateGreeting = `【KTM師弟挨拶】\nお疲れ様です！マッチングいただきありがとうございます。\n今回の師弟期間（${durationLabel}）で一緒にプレイできるのを楽しみにしています！\n\n・よく使うチャンピオン/レーン: \n・OP.GG: \n・今回の目標: \n\n都合の良い日時や最初の1戦についてご相談させてください！よろしくお願いします🤝`;

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success('📋 クリップボードにコピーしました！Discordに貼り付けて使えます。');
      setTimeout(() => setCopiedIndex(null), 2500);
    } catch (_) {
      toast.error('コピーに失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-stone-900 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-5 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-b border-emerald-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-xl shadow-2xs">
              🚀
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                <span>師弟スタート・キックオフガイド</span>
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full">3ステップ</span>
              </h2>
              <p className="text-xs text-stone-600 font-bold">
                👑 {mentorName} × 🌱 {pupilName} ({durationLabel})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-full transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* ボディ */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* 説明バナー */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-stone-800 leading-relaxed font-medium">
            💡 ペア結成おめでとうございます！まずは以下の3つのステップに沿って、気楽に最初の挨拶とプレイを進めてみましょう。
          </div>

          {/* 3ステップ一覧 */}
          <div className="space-y-3">
            {KICKOFF_STEPS.map((s, idx) => (
              <div
                key={s.step}
                className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-2 hover:border-emerald-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-2xs">
                      {s.step}
                    </span>
                    <h3 className="text-xs font-black text-stone-900">
                      {s.title}
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-stone-600 pl-8 leading-relaxed font-medium">
                  {s.desc}
                </p>

                {/* Step 1 専用: 挨拶定型文コピーボタン */}
                {s.step === 1 && (
                  <div className="pl-8 pt-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(templateGreeting, 1)}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-stone-300 hover:border-emerald-400 text-stone-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      {copiedIndex === 1 ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span className="text-emerald-700">コピー完了！</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="text-stone-500" />
                          <span>挨拶テンプレートをコピー</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 挨拶テンプレートのプレビュー */}
          <div className="p-3.5 bg-stone-100 rounded-2xl border border-stone-200 space-y-1.5">
            <div className="text-[11px] font-black text-stone-700 flex items-center gap-1">
              <MessageSquare size={12} className="text-stone-500" />
              <span>挨拶テンプレート内容:</span>
            </div>
            <pre className="text-[11px] text-stone-800 font-mono whitespace-pre-wrap leading-relaxed bg-white p-2.5 rounded-xl border border-stone-200">
              {templateGreeting}
            </pre>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-black text-xs transition shadow-sm cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
