'use client';

import React, { useState } from 'react';
import { Sparkles, X, Target, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeepResearchModal({ isOpen, onClose, onSuccess }: DeepResearchModalProps) {
  const [champion, setChampion] = useState('');
  const [role, setRole] = useState('JG');
  const [fetchVideos, setFetchVideos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

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
        throw new Error(data.error || 'ディープリサーチに失敗しました。');
      }

      setResultMsg({
        type: 'success',
        text: data.summary || `「${champion}」のディープリサーチが正常に完了しました！`,
      });
      onSuccess();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Target size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">特定チャンプ ディープリサーチ</h3>
            <p className="text-xs text-slate-400">対象チャンピオンの最新メタ・動画発掘・攻略バイブル作成を一発実行</p>
          </div>
        </div>

        <form onSubmit={handleResearch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              対象チャンピオン名 (英語名)
            </label>
            <input
              type="text"
              placeholder="例: Ahri, Riven, Aatrox, LeeSin"
              value={champion}
              onChange={(e) => setChampion(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              想定メインレーン
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="TOP">TOP (トップ)</option>
              <option value="JG">JUNGLE (ジャングル)</option>
              <option value="MID">MID (ミッド)</option>
              <option value="ADC">ADC (ボットキャリー)</option>
              <option value="SUP">SUPPORT (サポート)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="fetchVideos"
              checked={fetchVideos}
              onChange={(e) => setFetchVideos(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-purple-500 focus:ring-purple-500"
            />
            <label htmlFor="fetchVideos" className="text-xs text-slate-300 cursor-pointer">
              YouTubeから高レート最新解説動画を自動検索しキュー登録する
            </label>
          </div>

          {resultMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                resultMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {resultMsg.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
              <span>{resultMsg.text}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !champion.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs flex items-center gap-2 hover:opacity-90 disabled:opacity-50 shadow-lg shadow-purple-600/30 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  ディープリサーチ中...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  ディープリサーチを実行
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
