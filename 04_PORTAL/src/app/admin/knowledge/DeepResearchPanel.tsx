'use client';

import React, { useState } from 'react';
import { Sparkles, Target, Loader2, CheckCircle2, AlertCircle, Search, Layers, Video, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DeepResearchPanelProps {
  onSuccess?: () => void;
}

export default function DeepResearchPanel({ onSuccess }: DeepResearchPanelProps) {
  const [champion, setChampion] = useState('');
  const [role, setRole] = useState('JG');
  const [fetchVideos, setFetchVideos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string; details?: any } | null>(null);

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!champion.trim()) return;

    setLoading(true);
    setResultMsg(null);

    try {
      const res = await fetch('/api/admin/champion-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          champion: champion.trim(),
          role,
          fetchVideos,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ディープリサーチ処理に失敗しました。');
      }

      setResultMsg({
        type: 'success',
        text: data.summary || `「${champion}」のディープリサーチが完了しました！`,
        details: data,
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setResultMsg({
        type: 'error',
        text: err.message || '通信エラーが発生しました。',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 text-foreground shadow-2xl space-y-6">
      <div className="flex items-center gap-3 border-b border-black/5 pb-5">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary-100 to-danger-100 text-primary-700 border border-amber-200">
          <Target size={26} />
        </div>
        <div>
          <h3 className="font-extrabold text-xl text-foreground tracking-tight flex items-center gap-2">
            特定チャンプ ディープリサーチ
            <span className="text-[10px] bg-primary-100 text-primary-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
              AI Deep Analysis
            </span>
          </h3>
          <p className="text-xs text-muted-strong mt-1">
            対象チャンピオンの最新パッチメタ・戦術リサーチ・高レート解説動画の発掘・攻略ナレッジ化を一発自動実行
          </p>
        </div>
      </div>

      <form onSubmit={handleResearch} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-foreground-subtle mb-1.5 flex items-center gap-1">
              <Search size={14} className="text-primary-600" />
              対象チャンピオン名 (日本語名・英語名OK)
            </label>
            <input
              type="text"
              placeholder="例: アーリ, リー・シン, Ahri, LeeSin, Viego"
              value={champion}
              onChange={(e) => setChampion(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-sm text-foreground placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-primary-500 transition-all font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground-subtle mb-1.5 flex items-center gap-1">
              <Layers size={14} className="text-primary-600" />
              想定メインレーン
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-sm text-foreground focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="TOP">TOP (トップ)</option>
              <option value="JG">JUNGLE (ジャングル)</option>
              <option value="MID">MID (ミッド)</option>
              <option value="ADC">ADC (ボットキャリー)</option>
              <option value="SUP">SUPPORT (サポート)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-black/[0.03] p-4 rounded-2xl border border-black/5">
          <input
            type="checkbox"
            id="fetchVideosPanel"
            checked={fetchVideos}
            onChange={(e) => setFetchVideos(e.target.checked)}
            className="w-4 h-4 rounded bg-surface border-border text-primary-500 focus:ring-primary-500 accent-primary-500 cursor-pointer"
          />
          <label htmlFor="fetchVideosPanel" className="text-xs text-foreground-subtle font-medium cursor-pointer flex items-center gap-1.5">
            <Video size={14} className="text-danger-600" />
            YouTubeから最新の高レート（Challenger/OTP）解説動画を自動検索しキュー登録する
          </label>
        </div>

        {resultMsg && (
          <div
            className={`p-4 rounded-2xl text-xs space-y-2 border ${
              resultMsg.type === 'success'
                ? 'bg-success-100 border-emerald-200 text-success-700'
                : 'bg-danger-100 border-rose-200 text-danger-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {resultMsg.type === 'success' ? <CheckCircle2 size={18} className="text-success-600 shrink-0" /> : <AlertCircle size={18} className="text-danger-600 shrink-0" />}
              <span>{resultMsg.type === 'success' ? 'ディープリサーチ完了' : 'エラーが発生しました'}</span>
            </div>
            <p className="leading-relaxed text-foreground-subtle">{resultMsg.text}</p>
            {resultMsg.details && (
              <div className="pt-2 border-t border-emerald-200 text-[11px] text-success-700/90 font-mono space-y-1">
                <div>・記事タイトル: {resultMsg.details.articleTitle}</div>
                <div>・本文の文字数: {(resultMsg.details.articleLength || 0).toLocaleString()}字</div>
                <div>・パッチ情報: {resultMsg.details.patch}</div>
                <div>・公式データ(Data Dragon): {resultMsg.details.lolalyticsUsed ? '取得成功' : '取得できず'}</div>
                {!resultMsg.details.lolalyticsUsed && resultMsg.details.statsFailureReason && (
                  <div className="text-primary-700/90">　└ 理由: {resultMsg.details.statsFailureReason}</div>
                )}
                <div>・内部ナレッジ: {resultMsg.details.internalKnowledgeUsed ? '反映済み' : 'まだ無し'}</div>
                <div>・キュー追加動画: {resultMsg.details.enqueuedVideos}本</div>
                {!resultMsg.details.lolalyticsUsed && !resultMsg.details.internalKnowledgeUsed && (
                  <div className="text-primary-700/90 pt-1">
                    ※ 公式データも内部ナレッジも参照できず、AIの一般知識のみで生成したため内容が浅めです。
                    このチャンプの記事・メモを溜めると、次回から深くなります。
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 生成された攻略バイブルをその場で表示（本当に中身があるか確認できるように） */}
        {resultMsg?.type === 'success' && resultMsg.details?.article && (
          <div className="bg-background border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-black/5 bg-surface/60">
              <span className="text-xs font-black text-foreground-subtle flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary-600" /> 生成された攻略バイブル（プレビュー）
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={`/champions?champ=${encodeURIComponent(resultMsg.details.champion || champion)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
                >
                  📖 チャンピオン辞典で開く <ExternalLink size={12} />
                </a>
                {resultMsg.details.articleId && (
                  <a
                    href={`/admin/knowledge?tab=library&article=${resultMsg.details.articleId}`}
                    className="text-[11px] font-bold text-primary-700 hover:text-primary-800 flex items-center gap-1"
                  >
                    ライブラリで開く <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto p-5 prose prose-sm max-w-none prose-headings:text-primary-700 prose-strong:text-foreground prose-li:text-foreground-subtle prose-p:text-foreground-subtle">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultMsg.details.article}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !champion.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-600 via-danger-600 to-primary-600 hover:from-primary-500 hover:to-primary-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-primary-600/20 hover:shadow-primary-600/40 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                最新メタ＆動画をディープリサーチ中... (10〜20秒)
              </>
            ) : (
              <>
                <Sparkles size={18} />
                「{champion.trim() || '特定チャンプ'}」のディープリサーチを実行する
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
