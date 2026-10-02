'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, RefreshCw, ExternalLink, AlertTriangle, ClipboardCheck } from 'lucide-react';

interface ReviewItem {
  id: number;
  title: string;
  content: string;
  champion: string | null;
  is_atomic: boolean;
  source_url: string | null;
  created_at: string;
  parentTitle: string | null;
  isLaneGeneral: boolean;
}
interface RosterChampion { id: string; name: string }

// AIが自動生成した記事（動画解析の記事本体・記事から分割した知見）の承認画面。
// 承認するまで辞典同期にもトレンド集計にも使われない。旧ポータル /admin/knowledge の
// 「未承認ナレッジ」パネルを移植したもの（Geminiを使う辞典反映プレビューは移していない）。
export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [roster, setRoster] = useState<RosterChampion[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'' | 'video' | 'atomic'>('');
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mergeToDict, setMergeToDict] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, t: 'success' | 'error') => {
    setMessage({ text, type: t });
    setTimeout(() => setMessage(null), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (type) qs.set('type', type);
      const res = await fetch(`/api/knowledge/review?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '取得に失敗しました');
      setItems(json.items || []);
      setTotal(json.total || 0);
      if (json.roster?.length) setRoster(json.roster);
      setSelected(new Set());
      setEdits({});
    } catch (e: any) {
      showMessage(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const nameOf = (id: string | null) => roster.find((c) => c.id === id)?.name || id || '';

  const post = async (payload: Record<string, any>) => {
    setBusy(true);
    try {
      const res = await fetch('/api/knowledge/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '処理に失敗しました');
      showMessage(json.message, 'success');
      return true;
    } catch (e: any) {
      showMessage(e.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeFromList = (ids: number[]) => {
    const s = new Set(ids);
    setItems((prev) => prev.filter((i) => !s.has(i.id)));
    setTotal((t) => Math.max(0, t - ids.length));
    setSelected((prev) => new Set(Array.from(prev).filter((id) => !s.has(id))));
  };

  const approveOne = async (item: ReviewItem) => {
    const champion = edits[item.id] ?? (item.isLaneGeneral ? '' : nameOf(item.champion));
    if (await post({ id: item.id, action: 'approve', champion, mergeToDict })) removeFromList([item.id]);
  };
  const rejectOne = async (item: ReviewItem) => {
    if (!confirm(`「${item.title}」を却下して削除しますか？`)) return;
    if (await post({ id: item.id, action: 'reject' })) removeFromList([item.id]);
  };
  const batch = async (action: 'approve' | 'reject') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(action === 'approve'
      ? `選択した${ids.length}件を承認しますか？（チャンピオン判定はAIの判定のまま保存されます）`
      : `選択した${ids.length}件を却下して削除しますか？`)) return;
    if (await post({ ids, action, mergeToDict })) removeFromList(ids);
  };

  const toggle = (set: Set<number>, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-amber-400" /> 生成記事の承認
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              動画解析などでAIが自動生成した記事です。承認するまで辞典への同期やトレンド集計には使われません。
              チャンピオン判定を確認し、違っていれば直してから承認してください（空欄＝レーン一般論）。
            </p>
          </div>
          <Link href="/admin/youtube" className="shrink-0 text-xs text-slate-400 hover:text-white">← 動画解析センター</Link>
        </div>

        {message && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400' : 'bg-rose-950/30 border-rose-800/60 text-rose-400'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {([['', 'すべて'], ['video', '動画解析の記事'], ['atomic', '分割された知見']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                  type === k ? 'bg-amber-500/10 border-amber-500/60 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
            <span className="text-xs text-slate-400">承認待ち <b className="text-amber-300 font-mono">{total}</b>件（古い順）</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none" title="承認時に champion_facts の戦略欄へ要約を1行追記します（上限4,000字を超える場合は追記しません）">
              <input type="checkbox" checked={mergeToDict} onChange={(e) => setMergeToDict(e.target.checked)} className="accent-amber-500" />
              承認時に辞典の戦略欄へ1行追記
            </label>
            <button onClick={load} disabled={loading} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-1 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 更新
            </button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={selected.size === items.length}
                onChange={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
              />
              表示中を全選択（{selected.size}/{items.length}）
            </label>
            {selected.size > 0 && (
              <>
                <button onClick={() => batch('approve')} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 選択分を承認
                </button>
                <button onClick={() => batch('reject')} disabled={busy} className="px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> 選択分を却下
                </button>
              </>
            )}
          </div>
        )}

        <datalist id="roster-champions">
          {roster.map((c) => <option key={c.id} value={c.name}>{c.id}</option>)}
        </datalist>

        <div className="space-y-3">
          {loading && items.length === 0 && <p className="text-xs text-slate-500 text-center py-8">読み込み中...</p>}
          {!loading && items.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-10 bg-slate-900/40 border border-slate-800 rounded-xl">承認待ちの記事はありません</p>
          )}
          {items.map((item) => {
            const champValue = edits[item.id] ?? (item.isLaneGeneral ? '' : nameOf(item.champion));
            const isOpen = expanded.has(item.id);
            return (
              <div key={item.id} className={`p-4 rounded-xl border space-y-2 ${selected.has(item.id) ? 'bg-amber-500/5 border-amber-500/40' : 'bg-slate-900/80 border-slate-800'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => setSelected((s) => toggle(s, item.id))} className="mt-1 accent-amber-500 shrink-0" aria-label="選択" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white break-words">{item.title}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.is_atomic ? 'text-teal-300 border-teal-800/60 bg-teal-950/40' : 'text-amber-300 border-amber-800/60 bg-amber-950/40'}`}>
                        {item.is_atomic ? '分割された知見' : '動画解析の記事'}
                      </span>
                      <span className="text-[10px] text-slate-400">AI判定: {item.isLaneGeneral ? 'レーン一般論' : `${nameOf(item.champion)}（${item.champion}）`}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                      <span>{new Date(item.created_at).toLocaleDateString('ja-JP')} 生成</span>
                      {item.parentTitle && <span>元記事: {item.parentTitle}</span>}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> 元動画を開く
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <p className={`text-xs text-slate-300 leading-relaxed whitespace-pre-wrap ${isOpen ? '' : 'line-clamp-5'}`}>{item.content}</p>
                {item.content.length > 300 && (
                  <button onClick={() => setExpanded((s) => toggle(s, item.id))} className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer">
                    {isOpen ? '折りたたむ' : '全文を表示'}
                  </button>
                )}

                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <label className="flex flex-col gap-1 text-[10px] text-slate-500 font-bold">
                    チャンピオン（空欄＝レーン一般論）
                    <input
                      list="roster-champions"
                      value={champValue}
                      onChange={(e) => setEdits((p) => ({ ...p, [item.id]: e.target.value }))}
                      placeholder="例: ジャーヴァンⅣ / JarvanIV"
                      className="w-full sm:w-56 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-normal focus:outline-none focus:border-amber-500"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => rejectOne(item)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" /> 却下
                    </button>
                    <button onClick={() => approveOne(item)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 承認
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!loading && total > items.length && (
          <p className="text-[11px] text-slate-500 text-center">
            表示は古い順に{items.length}件までです。処理すると次の記事が表示されます（残り {total - items.length}件）。
            <button onClick={load} className="ml-2 text-amber-400 cursor-pointer">次を読み込む</button>
          </p>
        )}
      </div>
    </div>
  );
}
