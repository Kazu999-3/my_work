"use client";

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, HelpCircle, ExternalLink } from 'lucide-react';
import ChampSelect from '../../../components/ChampSelect';

type PendingItem = {
  id: number;
  title: string;
  content: string;
  champion: string;
  tags: string[] | null;
  parent_id: number | null;
  parentTitle: string | null;
  is_atomic: boolean;
  source_url: string | null;
  created_at: string;
  isLaneGeneral: boolean;
};

// review_status='pending'の行を承認/却下するパネル。対象は2種類:
// 1. AIによるatomic insight分解(記事を独立した知見へ分割する処理、is_atomic=true) —
//    分割そのものを人間が確認するまで辞典生成にもレーンガイド統合にも使われない
//    (2026-08-15、「チャンピオンごとの分割も全て最終的に人間が確認するようにしたい」への対応)。
// 2. 動画解析(youtube_worker.py)が完全自動生成した攻略記事本体(is_atomic=false) —
//    「攻略ライブラリから各チャンピオンの辞典に振り分ける前にプレビューしたい」という要望
//    (2026-08-16)により、こちらも人間が承認するまで対象外にした。
export default function PendingInsightsPanel() {
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [championEdits, setChampionEdits] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/knowledge/pending-review', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.error || '取得に失敗しました');
        setItems(d.items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const act = async (id: number, action: 'approve' | 'reject', champion?: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/admin/knowledge/pending-review', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, champion }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || '処理に失敗しました');
      setItems((prev) => (prev || []).filter((i) => i.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <HelpCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          AIが自動生成した知見・記事の一覧です（記事から分割された「独立した知見」と、動画解析で自動保存された攻略記事本体の両方）。承認するまでチャンピオン辞典の生成にもレーン別ガイドへの統合にも一切使われません。
          内容とチャンピオン判定(空欄＝レーン一般論としてレーン別ガイド側の対象になります)を確認し、必要なら修正してから承認してください。
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">🧩 未承認のナレッジ {items ? `(${items.length}件)` : ''}</h3>
        <button onClick={load} disabled={loading} className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 再読み込み
        </button>
      </div>

      {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}

      {loading && !items && <p className="text-xs text-gray-400">読み込み中...</p>}

      {items && items.length === 0 && (
        <p className="text-xs text-gray-400 py-8 text-center">未承認のナレッジはありません。</p>
      )}

      <div className="space-y-4">
        {(items || []).map((item) => {
          const editedChampion = championEdits[item.id] ?? (item.isLaneGeneral ? '' : item.champion);
          const busy = busyId === item.id;
          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-gray-900">{item.title}</h4>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${
                      item.is_atomic ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-blue-50 border-blue-200 text-blue-600'
                    }`}>
                      {item.is_atomic ? '分割知見' : '動画解析記事'}
                    </span>
                  </div>
                  {item.parentTitle && (
                    <p className="text-[11px] text-gray-400 mt-0.5">元記事: {item.parentTitle}</p>
                  )}
                  {item.source_url && (
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-sky-600 hover:text-sky-800 mt-0.5 inline-flex items-center gap-1">
                      <ExternalLink size={11} /> 元動画/記事を開く
                    </a>
                  )}
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border shrink-0 ${
                  item.isLaneGeneral ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  {item.isLaneGeneral ? 'AI判定: レーン一般論' : `AI判定: ${item.champion}固有`}
                </span>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{item.content}</p>

              <div className="flex items-end justify-between gap-4 pt-3 border-t border-gray-100 flex-wrap">
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    チャンピオン(空欄＝レーン一般論として保存)
                  </label>
                  <ChampSelect
                    value={editedChampion}
                    onChange={(val) => setChampionEdits((prev) => ({ ...prev, [item.id]: val }))}
                    placeholder="空欄でレーン一般論"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(item.id, 'reject')}
                    disabled={busy}
                    className="px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl text-xs hover:bg-rose-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle size={14} /> 却下(削除)
                  </button>
                  <button
                    onClick={() => act(item.id, 'approve', editedChampion)}
                    disabled={busy}
                    className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} 承認
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
