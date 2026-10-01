'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, CheckCircle2, AlertTriangle, BookOpen, 
  MessageSquare, Star, ArrowRight, RefreshCw, Sparkles, Swords
} from 'lucide-react';
import { getChampIcon } from '@/lib/ddragonClient';

interface SoloQReflection {
  id: string;
  created_at: string;
  match_id?: string;
  champion: string;
  enemy_champion: string;
  win: boolean;
  kda?: string;
  cs?: number;
  mental_rating?: number;
  win_lose_reason_tags: string[];
  reflection_note?: string;
  matchup_memo?: string;
  next_focus_point?: string;
}

export default function SoloQReflectionTab() {
  const [reflections, setReflections] = useState<SoloQReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // フォームステート
  const [myChamp, setMyChamp] = useState('');
  const [enemyChamp, setEnemyChamp] = useState('');
  const [win, setWin] = useState(true);
  const [kda, setKda] = useState('');
  const [mental, setMental] = useState(4);
  const [reflectionNote, setReflectionNote] = useState('');
  const [matchupMemo, setMatchupMemo] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReflections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/soloq/reflections?limit=100');
      const data = await res.json();
      setReflections(data.reflections || []);
    } catch {
      setReflections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReflections();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myChamp.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/soloq/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          champion: myChamp.trim(),
          enemyChampion: enemyChamp.trim(),
          win,
          kda: kda.trim(),
          mentalRating: mental,
          reflectionNote: reflectionNote.trim(),
          matchupMemo: matchupMemo.trim(),
          nextFocusPoint: nextFocus.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存に失敗しました');

      showMessage('反省メモを記録しました（対面メモは辞典へ自動マージされました）', 'success');
      setIsFormOpen(false);
      setReflectionNote('');
      setMatchupMemo('');
      setNextFocus('');
      fetchReflections();
    } catch (err: any) {
      showMessage(err.message || '通信エラー', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = reflections.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.champion?.toLowerCase().includes(q) ||
      r.enemy_champion?.toLowerCase().includes(q) ||
      r.reflection_note?.toLowerCase().includes(q) ||
      r.matchup_memo?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">

      {/* ヘッダー操作バー */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="反省メモや対面名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => fetchReflections()}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="更新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>反省メモを記録</span>
          </button>
        </div>
      </div>

      {/* トースト通知 */}
      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/80 border-rose-700/60 text-rose-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* 新規反省メモ入力フォーム */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> 試合後リフレクション（反省ノート）
            </h4>
            <span className="text-[11px] text-slate-500">対面メモは辞典へ自動同期されます</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1">自チャンプ (必須)</label>
              <input
                type="text"
                placeholder="例: JarvanIV"
                value={myChamp}
                onChange={(e) => setMyChamp(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1">対面チャンプ</label>
              <input
                type="text"
                placeholder="例: LeeSin"
                value={enemyChamp}
                onChange={(e) => setEnemyChamp(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1">勝敗</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWin(true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    win ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  勝利 👑
                </button>
                <button
                  type="button"
                  onClick={() => setWin(false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    !win ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  敗北 💀
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1">KDA (任意)</label>
              <input
                type="text"
                placeholder="例: 5/2/8"
                value={kda}
                onChange={(e) => setKda(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">💬 今回の反省・勝敗の分岐点</label>
              <textarea
                rows={2}
                placeholder="例: 2手目のガンクで敵JGと鉢合わせフラッシュを吐かされた。対面が引いているときは無理に突っ込まない。"
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-indigo-300 font-bold block mb-1">
                🛡️ 対面特化メモ（次回の試合前設計図に直結）
              </label>
              <input
                type="text"
                placeholder="例: 敵のQ2着地に合わせてEQを置けば確定でノックアップできる"
                value={matchupMemo}
                onChange={(e) => setMatchupMemo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-indigo-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-amber-300 font-bold block mb-1">
                🎯 次回ゲームのフォーカスポイント
              </label>
              <input
                type="text"
                placeholder="例: 1手目のスカトル前は必ずマップを見て隣接レーンの主導権を確認する"
                value={nextFocus}
                onChange={(e) => setNextFocus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 hover:text-white"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      )}

      {/* 過去ログ一覧 */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
            反省ログを取得中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            反省メモがありません。「反省メモを記録」から追加してください。
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <img src={getChampIcon(r.champion)} alt={r.champion} className="w-7 h-7 rounded-lg object-cover" />
                    <span className="font-bold text-white text-xs">{r.champion}</span>
                  </div>
                  {r.enemy_champion && (
                    <>
                      <span className="text-slate-600 text-xs font-bold">vs</span>
                      <div className="flex items-center gap-1.5">
                        <img src={getChampIcon(r.enemy_champion)} alt={r.enemy_champion} className="w-7 h-7 rounded-lg object-cover" />
                        <span className="font-bold text-rose-300 text-xs">{r.enemy_champion}</span>
                      </div>
                    </>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      r.win ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                    }`}
                  >
                    {r.win ? 'WIN' : 'LOSS'}
                  </span>
                  {r.kda && <span className="font-mono text-xs text-indigo-400 font-bold">{r.kda}</span>}
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(r.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>

              {r.reflection_note && (
                <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                  💬 <strong className="text-slate-200">反省:</strong> {r.reflection_note}
                </p>
              )}

              {r.matchup_memo && (
                <div className="text-[11px] text-indigo-300 flex items-center gap-1.5 font-medium pl-1">
                  <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span><strong>対面対策:</strong> {r.matchup_memo}</span>
                </div>
              )}

              {r.next_focus_point && (
                <div className="text-[11px] text-amber-300 flex items-center gap-1.5 font-medium pl-1">
                  <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                  <span><strong>次回テーマ:</strong> {r.next_focus_point}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
