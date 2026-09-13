"use client";

import React, { useState } from 'react';
import { 
  ScrollText, 
  Sparkles, 
  Copy, 
  Check, 
  Share2, 
  Calendar, 
  Tag, 
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { CHANGELOG, ChangelogEntry, formatChangelogForDiscord } from '../../../lib/changelog';

export default function GuideUpdatesTab() {
  const [copiedDate, setCopiedDate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCopyDiscord = (entry: ChangelogEntry) => {
    const text = formatChangelogForDiscord(entry);
    navigator.clipboard.writeText(text);
    setCopiedDate(entry.date);
    setToastMessage(`「${entry.date} の更新概要」をDiscord形式でコピーしました！`);
    
    setTimeout(() => {
      setCopiedDate(null);
      setToastMessage(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 relative">
      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-6 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-amber-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check size={14} />
          </div>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 text-xs font-black border border-amber-500/30">
              <ScrollText size={14} className="text-amber-600" />
              リリースノート ＆ 更新履歴
            </div>
            <h2 className="text-xl md:text-2xl font-black text-stone-900">
              機能アップデート ＆ 改善ログ一覧
            </h2>
            <p className="text-stone-700 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              KTMポータル、Discord Bot、カスタム管理システムの最新アップデート情報です。各カードの「📋 Discord告知文をコピー」を押すと、Discordにそのまま共有できる告知テキストを取得できます。
            </p>
          </div>
        </div>
      </div>

      {/* 更新ログ一覧 */}
      <div className="space-y-5">
        {CHANGELOG.map((entry, index) => (
          <div
            key={entry.date + entry.title}
            className="bg-white border border-stone-200 rounded-3xl p-6 relative overflow-hidden shadow-xs hover:border-amber-400 transition group"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Calendar size={12} className="text-stone-400" />
                    {entry.date}
                  </span>
                  {entry.tag && (
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        entry.tag === 'NEW'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}
                    >
                      {entry.tag}
                    </span>
                  )}
                </div>
                <h3 className="text-base md:text-lg font-black text-stone-900">
                  {entry.title}
                </h3>
              </div>

              {/* Discord共有ボタン */}
              <button
                type="button"
                onClick={() => handleCopyDiscord(entry)}
                className="px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-[#5865F2]/10 border border-stone-200 hover:border-[#5865F2]/40 text-stone-700 hover:text-[#5865F2] font-black text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                title="Discord告知用テキストをコピー"
              >
                {copiedDate === entry.date ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-700 font-bold">コピー完了！</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} className="text-[#5865F2]" />
                    <span>📋 Discord告知文をコピー</span>
                  </>
                )}
              </button>
            </div>

            {/* 箇条書き項目 */}
            <ul className="space-y-2">
              {entry.items.map((item, i) => (
                <li
                  key={i}
                  className="text-xs md:text-sm text-stone-700 leading-relaxed pl-3 border-l-2 border-amber-400/60"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
