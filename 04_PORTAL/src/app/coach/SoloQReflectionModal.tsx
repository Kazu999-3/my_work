'use client';

import React, { useState, useEffect } from 'react';
import { apiJson } from '../../lib/apiClient';

interface MatchInfo {
  matchId: string;
  champion: string;
  enemyChampion: string;
  win: boolean;
  kda: string;
  cs: number;
  gameDuration: number;
  lane: string;
}

interface SoloQReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

// 勝敗に合わせたプリセットタグ
const WIN_TAGS = [
  'CSアドバンテージ',
  '視界コントロール',
  '集団戦のフォーカス',
  'オブジェクト関与',
  'レーンソロキル',
  'マクロ判断が成功',
  'カウンタービルド',
];

const LOSE_TAGS = [
  'レーン戦のミス',
  '無理なローム',
  '視界管理不足',
  'ティルト・集中力低下',
  '連戦疲労',
  'キャッチされた',
  '集団戦のフォーカスミス',
];

export default function SoloQReflectionModal({ isOpen, onClose, onSaved }: SoloQReflectionModalProps) {
  const [ign, setIgn] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState('');
  
  // マッチ一覧と選択インデックス
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(new Set());

  // フォーム状態
  // 試合全体の勝敗(win)とは別の、対面(レーン)単位の勝ち負け。集団戦で拾われた/味方の
  // 乱入等でチームの勝敗と対面の内容が一致しないケースを区別するため独立させている。
  const [laneResult, setLaneResult] = useState<'win' | 'even' | 'loss' | null>(null);
  const [mentalRating, setMentalRating] = useState<number>(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reflectionNote, setReflectionNote] = useState('');
  const [matchupMemo, setMatchupMemo] = useState('');
  const [nextFocusPoint, setNextFocusPoint] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // AI自動分析(coach_analyses)の結果キャッシュ。試合(matchId)ごとに1回だけ確認し、
  // タブ切替のたびに再取得しないようにする。見つからない場合は明示的なボタンで
  // 生成する（開くたびに自動でGeminiを叩くとクォータを無駄に消費するため）。
  const [analysisCache, setAnalysisCache] = useState<Record<string, any>>({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // 保存済みマッチIDのフェッチ。
  // 既定のlimit(10件)だけで判定すると、古い試合を遡って記録しようとした際に
  // 「済み」判定が効かず重複記録を誘発していた(2026-08-05発覚)。MySoloQDashboardと
  // 同じ200件まで見て判定する。
  const fetchSavedMatchIds = async () => {
    try {
      const res = await fetch('/api/soloq/reflections?limit=200');
      const data = await res.json();
      const ids = new Set<string>();
      if (data.reflections) {
        data.reflections.forEach((r: any) => { if (r.match_id) ids.add(r.match_id); });
      } else if (data.reflection?.match_id) {
        ids.add(data.reflection.match_id);
      }
      setSavedMatchIds(ids);
    } catch {}
  };

  // 1. 初回マウント時・モーダルオープン時に localStorage から Riot ID および入力下書きを自動ロード
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSavedMatchIds();
      const savedIgn = localStorage.getItem('soloq_riot_id') || '';
      if (savedIgn) {
        setIgn(savedIgn);
        fetchMatches(savedIgn);
      }

      // 下書きの復元
      try {
        const draftJson = localStorage.getItem('soloq_reflection_draft');
        if (draftJson) {
          const draft = JSON.parse(draftJson);
          if (draft.reflectionNote) setReflectionNote(draft.reflectionNote);
          if (draft.matchupMemo) setMatchupMemo(draft.matchupMemo);
          if (draft.nextFocusPoint) setNextFocusPoint(draft.nextFocusPoint);
          setDraftRestored(true);
        }
      } catch {}
    } else {
      setDraftRestored(false);
    }
  }, [isOpen]);

  // 入力中に自動下書き保存
  useEffect(() => {
    if (!isOpen) return;
    if (reflectionNote || matchupMemo || nextFocusPoint) {
      try {
        localStorage.setItem(
          'soloq_reflection_draft',
          JSON.stringify({ reflectionNote, matchupMemo, nextFocusPoint })
        );
      } catch {}
    }
  }, [isOpen, reflectionNote, matchupMemo, nextFocusPoint]);

  // 選択中の試合について、AI自動分析(coach_analyses)が既にあるか安価に確認する。
  // Gemini呼び出しを伴わない読み取りのみなので、選択が変わるたびに自動実行してよい。
  // 見つからなかった場合の「生成」ボタン(generateAnalysis)だけがコストのかかる呼び出し。
  useEffect(() => {
    const m = matches[selectedIndex];
    if (!m?.matchId || analysisCache[m.matchId] !== undefined) return;
    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError('');
    apiJson('/api/coach/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'post_lookup', matchId: m.matchId }),
    })
      .then((data: any) => {
        if (cancelled) return;
        setAnalysisCache((prev) => ({ ...prev, [m.matchId]: data.found ? data : { found: false } }));
      })
      .catch((e: any) => { if (!cancelled) setAnalysisError(e.message); })
      .finally(() => { if (!cancelled) setAnalysisLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, selectedIndex]);

  if (!isOpen) return null;

  const fetchMatches = async (targetIgn: string) => {
    if (!targetIgn || !targetIgn.includes('#')) {
      setMatchError('Riot ID (例: 名前#JP1) を正しく入力してください。');
      return;
    }

    setLoadingMatches(true);
    setMatchError('');

    try {
      // localStorage に記憶
      localStorage.setItem('soloq_riot_id', targetIgn);

      const res = await fetch('/api/soloq/recent-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ign: targetIgn }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '直近試合データの取得に失敗しました。');
      }

      setMatches(data.matches || []);
      setSelectedIndex(0);
      setSelectedTags([]); // マッチ切替時タグ初期化
      setLaneResult(null);
    } catch (err: any) {
      setMatchError(err.message);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleManualFetch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMatches(ign);
  };

  const currentMatch = matches[selectedIndex] || null;
  const currentAnalysis = currentMatch ? analysisCache[currentMatch.matchId] : undefined;

  const generateAnalysis = async () => {
    if (!currentMatch) return;
    setGenerating(true);
    setAnalysisError('');
    try {
      const data: any = await apiJson('/api/coach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'post', matchId: currentMatch.matchId }),
        timeout: 60000, // Gemini生成込みのため長め
      });
      setAnalysisCache((prev) => ({
        ...prev,
        [currentMatch.matchId]: { found: true, result: data.result, weaknesses: data.weaknesses, advice: data.advice, focus: data.focus, focusAchieved: data.focusAchieved },
      }));
    } catch (e: any) {
      setAnalysisError(e.message || 'AI分析の生成に失敗しました。');
    } finally {
      setGenerating(false);
    }
  };
  const isWin = currentMatch ? currentMatch.win : true;
  const availableTags = isWin ? WIN_TAGS : LOSE_TAGS;
  const isAlreadyReflected = !!currentMatch && savedMatchIds.has(currentMatch.matchId);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMatch) {
      alert('振り返る対象の試合データを選択してください。');
      return;
    }
    if (savedMatchIds.has(currentMatch.matchId)) {
      alert('この試合は既に振り返り済みです。');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        matchId: currentMatch.matchId,
        champion: currentMatch.champion,
        enemyChampion: currentMatch.enemyChampion,
        win: currentMatch.win,
        laneResult,
        kda: currentMatch.kda,
        cs: currentMatch.cs,
        gameDuration: currentMatch.gameDuration,
        mentalRating,
        winLoseReasonTags: selectedTags,
        reflectionNote,
        matchupMemo,
        nextFocusPoint,
      };

      const res = await fetch('/api/soloq/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '保存に失敗しました。');
      }

      setSaveSuccess(true);
      try { localStorage.removeItem('soloq_reflection_draft'); } catch {}
      if (onSaved) onSaved();

      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-50 border border-stone-300 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-amber-900 text-amber-50 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-lg font-bold">1分ソロQ振り返り</h2>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white text-xl font-bold px-2 py-0.5 rounded hover:bg-amber-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-stone-800 text-sm max-h-[82vh] overflow-y-auto">
          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold flex items-center justify-between gap-2 animate-fade-in shadow-md">
              <div className="flex items-center gap-2 text-xs">
                <span>✅</span> 振り返りを保存し、対面メモをDBへ更新しました！
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-black transition shadow"
              >
                ✕ 閉じてコーチ画面に戻る
              </button>
            </div>
          )}

          {/* 1. Riot ID 設定 & 直近5試合選択 */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800 text-xs flex items-center gap-1">
                <span>🎯</span> 1. 振り返る試合を選択 (直近5試合)
              </label>
              <span className="text-[11px] text-amber-700 font-medium">※ IDは自動記憶されます</span>
            </div>

            {/* ID入力欄 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Riot ID (例: 名前#JP1)"
                value={ign}
                onChange={(e) => setIgn(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-stone-300 rounded-md bg-stone-50 text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleManualFetch}
                disabled={loadingMatches}
                className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded shadow transition-colors disabled:opacity-50"
              >
                {loadingMatches ? '更新中...' : '試合再取得'}
              </button>
            </div>
            {matchError && <p className="text-xs text-rose-600 font-medium">{matchError}</p>}

            {/* 直近5試合の選択カード */}
            {loadingMatches ? (
              <div className="py-6 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                直近のソロQ対戦データを取得中...
              </div>
            ) : matches.length > 0 ? (
              <div className="space-y-1.5 mt-2">
                {matches.map((m, idx) => {
                  const isSelected = selectedIndex === idx;
                  const isDone = savedMatchIds.has(m.matchId);
                  return (
                    <button
                      type="button"
                      key={m.matchId || idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/90 ring-2 ring-amber-500/40 shadow-sm'
                          : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 font-bold text-[10px] rounded ${m.win ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                          {m.win ? 'WIN' : 'LOSE'}
                        </span>
                        <span className="font-bold text-stone-900">{m.champion}</span>
                        <span className="text-stone-400">vs</span>
                        <span className="font-bold text-stone-700">{m.enemyChampion}</span>
                        {isDone ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                            ✅ 振り返り完了
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                            ⚠️ 未振り返り
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-600 flex items-center gap-3">
                        <span>KDA: <strong className="text-stone-800">{m.kda}</strong></span>
                        <span>CS: <strong className="text-stone-800">{m.cs}</strong></span>
                        {isSelected && <span className="text-amber-800 font-bold text-xs">✓ 選択中</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Riot ID を入力して「試合再取得」を押してください。</p>
            )}
          </div>

          {/* AI自動分析(coach_analyses)。KDA/CS/Vision・弱点・アドバイスを、振り返りを
              書く前にその場で確認できるようにする。通知(ベル)に流れる内容と同じもの。 */}
          {currentMatch && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3.5 space-y-2 shadow-sm">
              <label className="font-bold text-indigo-950 text-xs block flex items-center gap-1.5">
                <span>🤖</span> AI自動分析（KDA / CS / Vision・弱点・アドバイス）
              </label>

              {analysisLoading ? (
                <p className="text-xs text-stone-500 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  確認中...
                </p>
              ) : currentAnalysis?.found ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white rounded-lg p-2 border border-indigo-100">
                      <div className="text-stone-400">KDA</div>
                      <div className="font-bold text-stone-800">{currentAnalysis.result.kda} ({currentAnalysis.result.kdaRatio})</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-indigo-100">
                      <div className="text-stone-400">CS/min</div>
                      <div className="font-bold text-stone-800">{currentAnalysis.result.csPerMin}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-indigo-100">
                      <div className="text-stone-400">Vision/min</div>
                      <div className="font-bold text-stone-800">{currentAnalysis.result.visionPerMin}</div>
                    </div>
                  </div>
                  {currentAnalysis.weaknesses?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {currentAnalysis.weaknesses.map((w: string, i: number) => (
                        <span key={i} className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">⚠️ {w}</span>
                      ))}
                    </div>
                  )}
                  {currentAnalysis.advice && (
                    <p className="text-xs text-stone-700 bg-white/70 rounded border border-indigo-100 p-2 whitespace-pre-wrap leading-relaxed">
                      {currentAnalysis.advice}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-stone-500">この試合はまだAI分析されていません。</p>
                  <button
                    type="button"
                    onClick={generateAnalysis}
                    disabled={generating}
                    className="shrink-0 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg shadow transition-colors disabled:opacity-50"
                  >
                    {generating ? '生成中...(最大1分)' : 'AI分析を生成する'}
                  </button>
                </div>
              )}
              {analysisError && <p className="text-xs text-rose-600 font-medium">{analysisError}</p>}
            </div>
          )}

          {/* 2. 対面(レーン)勝敗。試合全体の勝敗(win)とは別に記録する(#⑤) */}
          <div className="bg-white border border-stone-200 rounded-lg p-3.5 space-y-2 shadow-sm">
            <label className="font-bold text-stone-800 text-xs block">
              2. 対面 {currentMatch ? currentMatch.enemyChampion : ''} との勝敗（レーン戦の内容。任意）
              <span className="text-[11px] text-stone-400 font-normal block mt-0.5">試合自体の勝敗とは別に、対面との勝ち負けを記録します（集団戦で拾われた等で試合結果と食い違ってもOK）</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'win' as const, label: '🟢 レーン勝ち', color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
                { value: 'even' as const, label: '⚪ 互角', color: 'border-stone-300 bg-stone-100 text-stone-800' },
                { value: 'loss' as const, label: '🔴 レーン負け', color: 'border-rose-300 bg-rose-50 text-rose-900' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setLaneResult(laneResult === opt.value ? null : opt.value)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all text-center ${
                    laneResult === opt.value
                      ? `${opt.color} ring-2 ring-amber-500 shadow-sm scale-105`
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. メンタル度評価 */}
          <div className="bg-white border border-stone-200 rounded-lg p-3.5 space-y-2 shadow-sm">
            <label className="font-bold text-stone-800 text-xs block">3. 集中度・メンタル評価 (1〜5)</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { rating: 1, label: '1 (絶望/ティルト)', color: 'border-rose-300 bg-rose-50 text-rose-900' },
                { rating: 2, label: '2 (不調/焦り)', color: 'border-orange-300 bg-orange-50 text-orange-900' },
                { rating: 3, label: '3 (普通)', color: 'border-stone-300 bg-stone-50 text-stone-900' },
                { rating: 4, label: '4 (集中)', color: 'border-amber-300 bg-amber-50 text-amber-900' },
                { rating: 5, label: '5 (ゾーン/好調)', color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.rating}
                  onClick={() => setMentalRating(item.rating)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all text-center ${
                    mentalRating === item.rating
                      ? `${item.color} ring-2 ring-amber-500 shadow-sm scale-105`
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. 勝因・敗因ワンタップタグ ＆ 反省メモ */}
          <div className="bg-white border border-stone-200 rounded-lg p-3.5 space-y-2.5 shadow-sm">
            <label className="font-bold text-stone-800 text-xs block flex items-center justify-between">
              <span>4. {isWin ? '🏆 勝因タグ' : '⚠️ 敗因タグ'}（ワンタップ選定）</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isWin ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {isWin ? '勝利理由' : '敗北理由'}
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      active
                        ? isWin
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-sm'
                          : 'bg-rose-700 text-white border-rose-700 font-bold shadow-sm'
                        : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                    }`}
                  >
                    {active ? '✓ ' : ''}{tag}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1 pt-1 pb-1">
              <span className="text-[10px] text-stone-400 font-bold block w-full">⚡ タップでメモに即座追加:</span>
              {[
                '序盤の寄りが遅れた',
                '相手JG位置が見えていなかった',
                '無理なオールインで倒された',
                'オブジェクト意識が高く勝利',
                '視界管理でキャッチを防止できた',
                '次からは引いてファーム優先',
              ].map((snippet) => (
                <button
                  type="button"
                  key={snippet}
                  onClick={() => {
                    setReflectionNote((prev) => (prev ? `${prev} / ${snippet}` : snippet));
                  }}
                  className="px-2 py-0.5 text-[10px] bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200 rounded font-semibold transition"
                >
                  + {snippet}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              placeholder="反省メモや勝敗を分けたプレイ（例: 14分ドラゴン戦での寄りが遅れた / 相手JGの位置把握）"
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md bg-stone-50 text-stone-900 focus:bg-white focus:outline-none text-xs placeholder:text-stone-400"
            />
          </div>

          {/* 4. 対面メモ（対面DBへ自動連携） */}
          <div className="bg-white border border-stone-200 rounded-lg p-3.5 space-y-2 shadow-sm">
            <label className="font-bold text-stone-800 text-xs block">
              5. 対面チャンピオンメモ <span className="text-[11px] text-amber-800 font-normal">（対面DB `matchup_sentinel` へ自動蓄積）</span>
            </label>
            <textarea
              rows={2}
              placeholder={`対面 ${currentMatch ? currentMatch.enemyChampion : ''} への次回対策・やりづらかった点（例: Lv2トレード注意 / スペル落ちたタイミングでローム）`}
              value={matchupMemo}
              onChange={(e) => setMatchupMemo(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md bg-stone-50 text-stone-900 focus:bg-white focus:outline-none text-xs placeholder:text-stone-400"
            />
          </div>

          {/* 6. 次の1試合で意識すること */}
          <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-3.5 space-y-2 shadow-sm">
            <label className="font-bold text-amber-950 text-xs block flex items-center gap-1.5">
              <span>🔥</span> 6. 次の1試合で意識すること（次回テーマ）
            </label>
            <input
              type="text"
              placeholder="例: 8分ヘラルド前に必ずコントロールワードを指す / レーン戦で死なない"
              value={nextFocusPoint}
              onChange={(e) => setNextFocusPoint(e.target.value)}
              className="w-full px-3 py-2 border border-amber-300 rounded-md bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs placeholder:text-stone-400 font-medium"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end items-center gap-3 pt-2 border-t border-stone-200">
            {isAlreadyReflected && (
              <span className="text-[11px] text-emerald-700 font-bold mr-auto">✅ この試合は振り返り済みです</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-md text-stone-600 hover:bg-stone-100 text-xs font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !currentMatch || isAlreadyReflected}
              className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold shadow transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : isAlreadyReflected ? '振り返り済み' : '振り返りを保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
