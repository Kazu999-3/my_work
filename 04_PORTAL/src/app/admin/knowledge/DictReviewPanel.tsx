"use client";

import { useState } from 'react';
import { RefreshCw, Check, Archive, Sparkles } from 'lucide-react';

// 辞典の鮮度レビュー（#50 フェーズC）: 古い辞典データをLLMが現パッチで有効か判定 → 承認制で反映
export default function DictReviewPanel() {
  const [loading, setLoading] = useState(false);
  const [currentPatch, setCurrentPatch] = useState<string>('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [acting, setActing] = useState<string>('');
  const [msg, setMsg] = useState('');

  const runReview = async () => {
    setLoading(true); setMsg('');
    try {
      const res = await fetch('/api/admin/dict-review?limit=5', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'レビューに失敗しました');
      setCurrentPatch(data.currentPatch || '');
      setCandidates(data.candidates || []);
    } catch (e: any) { setMsg('❌ ' + e.message); }
    finally { setLoading(false); }
  };

  const apply = async (champion: string, action: 'keep' | 'archive') => {
    setActing(champion + action);
    try {
      const res = await fetch('/api/admin/dict-review', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion, action }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '反映に失敗'); }
      setCandidates(prev => prev.filter(c => c.champion !== champion));
    } catch (e: any) { setMsg('❌ ' + e.message); }
    finally { setActing(''); }
  };

  const verdictStyle: Record<string, string> = {
    keep: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    update: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    archive: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };
  const verdictLabel: Record<string, string> = { keep: '✅ 有効', update: '⚠️ 要更新', archive: '🗑️ 古い' };

  return (
    <div className="space-y-5 animate-in">
      <div className="bg-[#0f111a] border border-gray-800/60 rounded-3xl p-6">
        <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2"><Sparkles size={18} className="text-pink-400" /> 辞典の鮮度レビュー</h2>
        <p className="text-xs text-gray-500 mb-4">未レビュー/古い順に辞典データをLLMが「現パッチでも有効か」判定します。承認したものだけ反映され、削除はされません（アーカイブのみ）。</p>
        <button onClick={runReview} disabled={loading}
          className="flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-all disabled:opacity-50">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'AI判定中...' : '5件レビュー実行'}
        </button>
        {currentPatch && <span className="ml-3 text-xs text-gray-500">現パッチ: {currentPatch}</span>}
      </div>

      {msg && <p className="text-sm text-red-400">{msg}</p>}

      <div className="space-y-3">
        {candidates.map((c) => (
          <div key={c.champion} className="bg-[#0f111a] border border-gray-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{c.champion}</span>
                <span className="text-[10px] text-gray-500">作成パッチ {c.patch || '不明'}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${verdictStyle[c.verdict] || verdictStyle.keep}`}>{verdictLabel[c.verdict] || c.verdict}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => apply(c.champion, 'keep')} disabled={acting === c.champion + 'keep'}
                  className="flex items-center gap-1 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50">
                  <Check size={13} /> 有効確認
                </button>
                <button onClick={() => apply(c.champion, 'archive')} disabled={acting === c.champion + 'archive'}
                  className="flex items-center gap-1 text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 disabled:opacity-50">
                  <Archive size={13} /> アーカイブ
                </button>
              </div>
            </div>
            {c.reason && <p className="text-xs text-gray-400 mt-2">判定理由: {c.reason}</p>}
            {c.note && <p className="text-xs text-amber-300/80 mt-1">要修正点: {c.note}</p>}
          </div>
        ))}
        {candidates.length === 0 && !loading && (
          <p className="text-center text-gray-500 text-sm py-10">「レビュー実行」を押すと、古い順に5件のAI判定が出ます。</p>
        )}
      </div>
    </div>
  );
}
