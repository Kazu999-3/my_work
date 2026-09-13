'use client';

import React, { useState, useEffect } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';

interface MentorshipProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profileData: Partial<MentorshipProfile>) => Promise<void>;
  initialProfile?: MentorshipProfile | null;
}

const AVAILABLE_LANES = [
  { id: 'TOP', label: '🛡️ TOP' },
  { id: 'JUNGLE', label: '🌲 JUNGLE' },
  { id: 'MID', label: '⚡ MID' },
  { id: 'BOT', label: '🏹 BOT' },
  { id: 'SUPPORT', label: '💖 SUPPORT' },
];

const PRESET_TAGS_PUPIL = [
  'レーン戦トレード',
  'ウェーブ管理・フリーズ',
  'CS精度',
  'リコール判断',
  'ガンク回避・視界',
  '集団戦立ち位置',
  'ロームタイミング',
  'ビルド・アイテム選択',
];

const PRESET_TAGS_MENTOR = [
  'ウェーブ管理指導',
  'マッチアップ解説',
  'リプレイ添削',
  '1on1特訓可能',
  'ボイスコーチング',
  'マクロ・ローテーション',
  '初心者歓迎',
  'ダイヤ到達ノウハウ',
];

const RANKS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER'];

export function MentorshipProfileModal({
  isOpen,
  onClose,
  onSave,
  initialProfile,
}: MentorshipProfileModalProps) {
  const [roleType, setRoleType] = useState<'PUPIL' | 'MENTOR'>('PUPIL');
  const [lanes, setLanes] = useState<string[]>([]);
  const [championsText, setChampionsText] = useState('');
  const [currentRank, setCurrentRank] = useState('SILVER');
  const [targetRank, setTargetRank] = useState('GOLD');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [bio, setBio] = useState('');
  const [activeHours, setActiveHours] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      setRoleType(initialProfile.role_type || 'PUPIL');
      setLanes(initialProfile.lanes || []);
      setChampionsText((initialProfile.champions || []).join(', '));
      setCurrentRank(initialProfile.current_rank || 'SILVER');
      setTargetRank(initialProfile.target_rank || 'GOLD');
      setSelectedTags(initialProfile.tags || []);
      setBio(initialProfile.bio || '');
      setActiveHours(initialProfile.active_hours || '');
    } else {
      setRoleType('PUPIL');
      setLanes(['MID']);
      setChampionsText('');
      setCurrentRank('SILVER');
      setTargetRank('GOLD');
      setSelectedTags(['レーン戦トレード', 'CS精度']);
      setBio('');
      setActiveHours('平日 21:00〜24:00');
    }
  }, [initialProfile, isOpen]);

  if (!isOpen) return null;

  const toggleLane = (laneId: string) => {
    if (lanes.includes(laneId)) {
      setLanes(lanes.filter((l) => l !== laneId));
    } else {
      setLanes([...lanes, laneId]);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags([...selectedTags, customTag.trim()]);
      setCustomTag('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const champions = championsText
        .split(/[,、\s]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      await onSave({
        role_type: roleType,
        lanes,
        champions,
        current_rank: currentRank,
        target_rank: roleType === 'PUPIL' ? targetRank : undefined,
        tags: selectedTags,
        bio,
        active_hours: activeHours,
        status: 'OPEN',
      });
      onClose();
    } catch (err) {
      console.error('Failed to save mentorship profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentPresetTags = roleType === 'PUPIL' ? PRESET_TAGS_PUPIL : PRESET_TAGS_MENTOR;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 text-stone-100">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <h2 className="text-lg font-black flex items-center gap-2">
            <span>🪪</span>
            <span>師弟プロフィールカード {initialProfile ? '編集' : '作成'}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* 1. 役割の選択 */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1.5">
              1. 参加する役割
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRoleType('PUPIL')}
                className={`p-3 rounded-xl border text-center font-bold transition ${
                  roleType === 'PUPIL'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:bg-stone-800'
                }`}
              >
                <div className="text-base">🔰 弟子 (Pupil)</div>
                <div className="text-[11px] font-normal text-stone-400 mt-0.5">
                  アドバイスをもらって上達したい
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRoleType('MENTOR')}
                className={`p-3 rounded-xl border text-center font-bold transition ${
                  roleType === 'MENTOR'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
                    : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:bg-stone-800'
                }`}
              >
                <div className="text-base">👨‍🏫 師匠 (Mentor)</div>
                <div className="text-[11px] font-normal text-stone-400 mt-0.5">
                  ノウハウや経験を教えたい
                </div>
              </button>
            </div>
          </div>

          {/* 2. レーン選択 */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1.5">
              2. {roleType === 'PUPIL' ? '学びたいレーン' : '教えられるレーン'} (複数選択可)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_LANES.map((lane) => {
                const isSelected = lanes.includes(lane.id);
                return (
                  <button
                    key={lane.id}
                    type="button"
                    onClick={() => toggleLane(lane.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {lane.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. ランク */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-1">現在のランク</label>
              <select
                value={currentRank}
                onChange={(e) => setCurrentRank(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500 focus:outline-hidden"
              >
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {roleType === 'PUPIL' && (
              <div>
                <label className="block text-xs font-bold text-stone-400 mb-1">目標ランク</label>
                <select
                  value={targetRank}
                  onChange={(e) => setTargetRank(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-emerald-500 focus:outline-hidden"
                >
                  {RANKS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 4. チャンピオン */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1">
              {roleType === 'PUPIL' ? '練習中・使いたいチャンピオン' : '得意・指導可能チャンピオン'} (英語名カンマ区切り)
            </label>
            <input
              type="text"
              value={championsText}
              onChange={(e) => setChampionsText(e.target.value)}
              placeholder="例: Ahri, Syndra, Zed"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* 5. タグ */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1.5">
              {roleType === 'PUPIL' ? '教えてほしいテーマ (悩みタグ)' : '教えられるテーマ'}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {currentPresetTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                        : 'bg-stone-800/80 text-stone-400 border-stone-700 hover:text-stone-200'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="独自のタグを追加..."
                className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-xs focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 rounded-lg text-xs font-bold"
              >
                追加
              </button>
            </div>
          </div>

          {/* 6. 自己紹介文 */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1">
              自己紹介・意気込み
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={
                roleType === 'PUPIL'
                  ? '例: レーン戦でCSを取るタイミングやリコール判断を教えてほしいです！よろしくお願いします。'
                  : '例: フリーズやスロープッシュの作り方、対面ごとの勝ちパターンなら分かりやすく教えられます！'
              }
              className="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-stone-200 text-xs focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* 7. 活動時間帯 */}
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1">
              活動しやすい時間帯
            </label>
            <input
              type="text"
              value={activeHours}
              onChange={(e) => setActiveHours(e.target.value)}
              placeholder="例: 平日 21:00〜24:00、土日終日"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-xs focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* 送信ボタン */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold text-stone-300"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 rounded-xl text-xs font-black shadow-lg shadow-amber-950/40"
            >
              {isSaving ? '保存中...' : 'カードを保存・公開'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
