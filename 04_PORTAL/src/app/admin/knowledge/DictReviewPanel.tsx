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

  const apply = async (champion: string, action: 'keep' | 'archive' | 'regenerate') => {
    setActing(champion + action);
    setMsg('');
    try {
      const res = await fetch('/api/admin/dict-review', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champion, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || '反映に失敗');
      if (action === 'regenerate' && d.regenerated) {
        // カードは残し、再生成結果を表示（有効確認済みとして緑に）
        setCandidates(prev => prev.map(c => c.champion === champion
          ? { ...c, verdict: 'keep', reason: d.usedKnowledge ? '蓄積メモを反映して再生成' : '一般メタ知識から再生成', note: '', regenerated: d.regenerated }
          : c));
      } else {
        setCandidates(prev => prev.filter(c => c.champion !== champion));
      }
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
                <button onClick={() => apply(c.champion, 'regenerate')} disabled={acting === c.champion + 'regenerate'}
                  className="flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 disabled:opacity-50">
                  {acting === c.champion + 'regenerate' ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />} 再生成
                </button>
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

            {/* 現在の辞典内容: 中身を見ないと有効/アーカイブの判断ができないため展開できるようにする */}
            {c.current && (
              <details className="mt-2 group">
                <summary className="text-xs text-cyan-400 cursor-pointer hover:text-cyan-300 select-none">
                  📖 現在の辞典内容を確認する
                </summary>
                <div className="mt-2 space-y-1.5 text-xs bg-black/30 border border-white/5 rounded-lg p-3">
                  {([
                    ['強み', c.current.strengths],
                    ['弱み', c.current.weaknesses],
                    ['パワースパイク', c.current.power_spikes],
                    ['ビルド/ルーン', c.current.build_runes],
                    ['戦略', c.current.strategy],
                  ] as const).map(([label, val]) => (
                    <div key={label}>
                      <span className="text-gray-500">{label}: </span>
                      <span className="text-gray-300 whitespace-pre-wrap">
                        {val ? String(val).slice(0, 600) : <span className="text-gray-600">（未記入）</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {c.regenerated && (
              <div className="mt-2 space-y-0.5 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-300 font-bold mb-1">🔄 再生成結果（保存済み）</p>
                {c.regenerated.strengths && <p className="text-gray-300"><span className="text-gray-500">強み:</span> {c.regenerated.strengths}</p>}
                {c.regenerated.weaknesses && <p className="text-gray-300"><span className="text-gray-500">弱み:</span> {c.regenerated.weaknesses}</p>}
                {c.regenerated.power_spikes && <p className="text-gray-300"><span className="text-gray-500">パワースパイク:</span> {c.regenerated.power_spikes}</p>}
                {c.regenerated.build_runes && <p className="text-gray-300"><span className="text-gray-500">ビルド/ルーン:</span> {c.regenerated.build_runes}</p>}
              </div>
            )}
          </div>
        ))}
        {candidates.length === 0 && !loading && (
          <p className="text-center text-gray-500 text-sm py-10">「レビュー実行」を押すと、古い順に5件のAI判定が出ます。</p>
        )}
      </div>
    </div>
  );
}
