'use client';

import React, { useState } from 'react';
import { Sparkles, Target, Loader2, CheckCircle2, AlertCircle, Search, Layers, Video } from 'lucide-react';

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
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/30">
          <Target size={26} />
        </div>
        <div>
          <h3 className="font-extrabold text-xl text-white tracking-tight flex items-center gap-2">
            特定チャンプ ディープリサーチ
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
              AI Deep Analysis
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            対象チャンピオンの最新パッチメタ・戦術リサーチ・高レート解説動画の発掘・攻略ナレッジ化を一発自動実行
          </p>
        </div>
      </div>

      <form onSubmit={handleResearch} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Search size={14} className="text-purple-400" />
              対象チャンピオン名 (英語名)
            </label>
            <input
              type="text"
              placeholder="例: Ahri, Riven, Aatrox, LeeSin, Viego"
              value={champion}
              onChange={(e) => setChampion(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Layers size={14} className="text-purple-400" />
              想定メインレーン
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
            >
              <option value="TOP">TOP (トップ)</option>
              <option value="JG">JUNGLE (ジャングル)</option>
              <option value="MID">MID (ミッド)</option>
              <option value="ADC">ADC (ボットキャリー)</option>
              <option value="SUP">SUPPORT (サポート)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
          <input
            type="checkbox"
            id="fetchVideosPanel"
            checked={fetchVideos}
            onChange={(e) => setFetchVideos(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500 accent-purple-500 cursor-pointer"
          />
          <label htmlFor="fetchVideosPanel" className="text-xs text-slate-300 font-medium cursor-pointer flex items-center gap-1.5">
            <Video size={14} className="text-pink-400" />
            YouTubeから最新の高レート（Challenger/OTP）解説動画を自動検索しキュー登録する
          </label>
        </div>

        {resultMsg && (
          <div
            className={`p-4 rounded-2xl text-xs space-y-2 border ${
              resultMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {resultMsg.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> : <AlertCircle size={18} className="text-rose-400 shrink-0" />}
              <span>{resultMsg.type === 'success' ? 'ディープリサーチ完了' : 'エラーが発生しました'}</span>
            </div>
            <p className="leading-relaxed text-slate-300">{resultMsg.text}</p>
            {resultMsg.details && (
              <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-400/90 font-mono space-y-1">
                <div>・記事タイトル: {resultMsg.details.articleTitle}</div>
                <div>・パッチ情報: {resultMsg.details.patch}</div>
                <div>・キュー追加動画: {resultMsg.details.enqueuedVideos}本</div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !champion.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/20 hover:shadow-purple-600/40 disabled:opacity-50 transition-all"
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
