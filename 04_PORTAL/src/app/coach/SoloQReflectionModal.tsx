'use client';

import React, { useState } from 'react';

interface SoloQReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const PRESET_TAGS = [
  'CSアドバンテージ',
  '視界コントロール',
  'レーンソロキル',
  '集団戦のフォーカス',
  'オブジェクト関与',
  'レーン戦ミス',
  '無理なローム',
  'ティルト・集中力低下',
  'ビルド選択',
  'マップ警戒不足',
];

export default function SoloQReflectionModal({ isOpen, onClose, onSaved }: SoloQReflectionModalProps) {
  const [ign, setIgn] = useState('');
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState('');
  
  // Match stats
  const [matchData, setMatchData] = useState<{
    matchId: string;
    champion: string;
    enemyChampion: string;
    win: boolean;
    kda: string;
    cs: number;
    gameDuration: number;
  } | null>(null);

  // Form states
  const [mentalRating, setMentalRating] = useState<number>(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reflectionNote, setReflectionNote] = useState('');
  const [matchupMemo, setMatchupMemo] = useState('');
  const [nextFocusPoint, setNextFocusPoint] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFetchLatest = async () => {
    if (!ign || !ign.includes('#')) {
      setMatchError('Riot ID (例: 名前#JP1) を正しく入力してください。');
      return;
    }
    setLoadingMatch(true);
    setMatchError('');

    try {
      const res = await fetch('/api/soloq/latest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ign }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '試合データの取得に失敗しました。');
      }
      setMatchData(data);
    } catch (err: any) {
      setMatchError(err.message);
    } finally {
      setLoadingMatch(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        matchId: matchData?.matchId || null,
        champion: matchData?.champion || 'Unknown',
        enemyChampion: matchData?.enemyChampion || 'Unknown',
        win: matchData ? matchData.win : true,
        kda: matchData?.kda || '',
        cs: matchData?.cs || 0,
        gameDuration: matchData?.gameDuration || 0,
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
      <div className="bg-stone-50 border border-stone-300 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="bg-amber-900/90 text-amber-50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-lg font-bold">1分ソロQ振り返り</h2>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white text-xl font-bold px-2 py-0.5 rounded hover:bg-amber-800/50 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-stone-800 text-sm max-h-[80vh] overflow-y-auto">
          {saveSuccess && (
            <div className="p-4 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-medium flex items-center gap-2 animate-fade-in">
              <span>✅</span> 振り返りを保存し、対面メモを更新しました！
            </div>
          )}

          {/* 1. Riot API 連携 */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-3 shadow-sm">
            <label className="font-bold text-stone-700 block">1. 直近の試合データを取得 (Riot API)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Riot ID (例: 名前#JP1)"
                value={ign}
                onChange={(e) => setIgn(e.target.value)}
                className="flex-1 px-3 py-2 border border-stone-300 rounded-md bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-stone-900 placeholder:text-stone-400"
              />
              <button
                type="button"
                onClick={handleFetchLatest}
                disabled={loadingMatch}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-md shadow transition-colors disabled:opacity-50"
              >
                {loadingMatch ? '取得中...' : '自動ロード'}
              </button>
            </div>
            {matchError && <p className="text-xs text-rose-600">{matchError}</p>}

            {matchData && (
              <div className="mt-3 p-3 bg-stone-100 rounded-md border border-stone-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${matchData.win ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {matchData.win ? 'VICTORY' : 'DEFEAT'}
                  </span>
                  <span className="font-bold text-stone-900">{matchData.champion}</span>
                  <span className="text-stone-500">vs</span>
                  <span className="font-bold text-stone-700">{matchData.enemyChampion}</span>
                </div>
                <div className="text-xs text-stone-600 flex items-center gap-3">
                  <span>KDA: <strong className="text-stone-800">{matchData.kda}</strong></span>
                  <span>CS: <strong className="text-stone-800">{matchData.cs}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* 2. メンタル度評価 */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-2 shadow-sm">
            <label className="font-bold text-stone-700 block">2. 集中度・メンタル評価 (1〜5)</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { rating: 1, label: '1 (絶望/ティルト)', color: 'border-rose-300 bg-rose-50 text-rose-800' },
                { rating: 2, label: '2 (不調/焦り)', color: 'border-orange-300 bg-orange-50 text-orange-800' },
                { rating: 3, label: '3 (普通)', color: 'border-stone-300 bg-stone-50 text-stone-800' },
                { rating: 4, label: '4 (集中)', color: 'border-amber-300 bg-amber-50 text-amber-900' },
                { rating: 5, label: '5 (ゾーン/好調)', color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.rating}
                  onClick={() => setMentalRating(item.rating)}
                  className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all text-center ${
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

          {/* 3. 勝因・敗因タグ & 反省ノート */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-3 shadow-sm">
            <label className="font-bold text-stone-700 block">3. 勝因・敗因タグ ＆ 反省メモ</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      active
                        ? 'bg-amber-600 text-white border-amber-600 font-medium'
                        : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                    }`}
                  >
                    {active ? '✓ ' : ''}{tag}
                  </button>
                );
              })}
            </div>
            <textarea
              rows={2}
              placeholder="反省メモや勝敗を分けたポイント（任意）"
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md bg-stone-50 focus:bg-white focus:outline-none text-stone-900 placeholder:text-stone-400 text-xs"
            />
          </div>

          {/* 4. 対面メモ（自動同期） */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-2 shadow-sm">
            <label className="font-bold text-stone-700 block">
              4. 対面チャンピオンメモ <span className="text-xs text-amber-700 font-normal">（対面DBへ自動連携されます）</span>
            </label>
            <textarea
              rows={2}
              placeholder="対面の動き、ビルド対策、やりづらかった点など（例: Level 2で無理に交易しない）"
              value={matchupMemo}
              onChange={(e) => setMatchupMemo(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md bg-stone-50 focus:bg-white focus:outline-none text-stone-900 placeholder:text-stone-400 text-xs"
            />
          </div>

          {/* 5. 次の試合の「1つの意識項目」 */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-4 space-y-2 shadow-sm">
            <label className="font-bold text-amber-900 block flex items-center gap-1.5">
              <span>🔥</span> 5. 次の1試合で意識すること（次回テーマ）
            </label>
            <input
              type="text"
              placeholder="例: 8分ヘラルド前に必ず視界ワードを指す / Lv6前にウェーブを押し切る"
              value={nextFocusPoint}
              onChange={(e) => setNextFocusPoint(e.target.value)}
              className="w-full px-3 py-2 border border-amber-300 rounded-md bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-stone-400 text-xs"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-md text-stone-600 hover:bg-stone-100 text-xs font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold shadow transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '振り返りを保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
