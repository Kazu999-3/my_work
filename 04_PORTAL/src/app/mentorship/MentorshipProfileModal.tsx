'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { ALL_CHAMPIONS, CHAMPION_JA } from '../../components/ChampSelect';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getKtmRank, RANKS as MMR_RANKS } from '../../lib/mmr';
import { Search, Plus, X, Sparkles, Volume2, Video, Swords, BookOpen, Clock, Shield, Check } from 'lucide-react';

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

const RANKS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];

// カテゴリ別タグ定義
const TAG_CATEGORIES_PUPIL = [
  {
    category: '🔊 通話・コミュニケーション',
    tags: ['VC可能', '聞き専OK', 'テキストチャットのみ', 'Discord通話希望'],
  },
  {
    category: '🎯 学びたい形式',
    tags: ['画面共有ライブ指導', 'リプレイ添削', '1on1レーン特訓', 'ノーマル/カスタム同伴', 'ビルド・ルーン相談'],
  },
  {
    category: '💡 重点的な悩み・課題',
    tags: ['レーン戦トレード', 'ウェーブ管理・フリーズ', 'CS精度・ロスト防止', '集団戦の立ち位置', 'リコール判断', 'ガンク回避・視界管理', 'ローム・寄りの判断', 'ゴールド/プラチナ昇格目標', 'エメラルド/ダイヤ目標'],
  },
];

const TAG_CATEGORIES_MENTOR = [
  {
    category: '🔊 指導・通話スタイル',
    tags: ['VC指導対応', '聞き専生徒OK', 'テキスト添削可能', '優しく丁寧に教えます'],
  },
  {
    category: '🎯 指導可能メニュー',
    tags: ['画面共有ライブコーチング', '録画・リプレイ添削', '1on1マッチアップ特訓', 'ノーマル/カスタム同伴プレイ', 'チャンピオン使い方講座'],
  },
  {
    category: '💡 得意な指導テーマ',
    tags: ['ウェーブ管理・ラインコントロール', '対面マッチアップ勝ち方', 'マクロ・ローテーション', '集団戦ポジショニング', 'ジャングルルート・ガンク判断', '初心者・アイアン〜シルバー歓迎', 'ダイヤ到達ノウハウ'],
  },
];

// 1クリック自己紹介テンプレート
const TEMPLATES_PUPIL = [
  {
    title: '🔰 基礎からしっかり型',
    text: 'レーン戦で対面に負けてしまうことが多く、ウェーブの引き方やトレードのタイミング、CSの取り方を基礎から学びたいです！聞き専でも大丈夫な師匠を探しています。よろしくお願いします！',
  },
  {
    title: '📈 ランク昇格目標型',
    text: '今シーズン中にゴールド/プラチナ昇格を目指して練習しています！得意チャンピオンの練度向上や、中盤以降の集団戦の立ち位置・リプレイ添削をご指導いただきたいです。',
  },
  {
    title: '🤝 一緒に楽しく上達型',
    text: '楽しく会話しながらノーマルや定期カスタムで一緒にプレイしつつ、リアルタイムにアドバイスをもらえると嬉しいです！VC可能です。',
  },
];

const TEMPLATES_MENTOR = [
  {
    title: '👨‍🏫 初心者・基礎歓迎型',
    text: 'アイアン〜ゴールド帯の方を対象に、ウェーブ管理やCS、安全なトレードの基本を分かりやすく丁寧に教えます！怒ったり厳しい指導は一切ありませんので気軽にお声がけください。',
  },
  {
    title: '⚔️ 実戦・リプレイ添削型',
    text: 'リプレイ添削や画面共有、1on1でのマッチアップ解説が得意です！ダイヤ・エメラルドを目指している方、特定チャンピオンを極めたい方の力になります。',
  },
];

export function MentorshipProfileModal({
  isOpen,
  onClose,
  onSave,
  initialProfile,
}: MentorshipProfileModalProps) {
  const { user } = useCurrentUser();

  const [roleType, setRoleType] = useState<'PUPIL' | 'MENTOR'>('PUPIL');
  const [lanes, setLanes] = useState<string[]>([]);
  const [selectedChampions, setSelectedChampions] = useState<string[]>([]);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [isChampDropdownOpen, setIsChampDropdownOpen] = useState(false);
  const [currentRank, setCurrentRank] = useState('SILVER');
  const [targetRank, setTargetRank] = useState('GOLD');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [bio, setBio] = useState('');
  const [activeHours, setActiveHours] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 初期値のロード（ログインユーザー情報があれば自動補完）
  useEffect(() => {
    if (initialProfile) {
      setRoleType(initialProfile.role_type || 'PUPIL');
      setLanes(initialProfile.lanes || []);
      setSelectedChampions(initialProfile.champions || []);
      setCurrentRank(initialProfile.current_rank || 'SILVER');
      setTargetRank(initialProfile.target_rank || 'GOLD');
      setSelectedTags(initialProfile.tags || []);
      setBio(initialProfile.bio || '');
      setActiveHours(initialProfile.active_hours || '');
    } else {
      // 新規作成時の自動プリセット
      const userRank = user?.rank ? user.rank.toUpperCase().split(' ')[0] : 'SILVER';
      const userLane = (user as any)?.role && (user as any).role !== 'ALL' ? [(user as any).role] : ['MID'];
      
      setRoleType('PUPIL');
      setLanes(userLane);
      setSelectedChampions([]);
      setCurrentRank(RANKS.includes(userRank) ? userRank : 'SILVER');
      setTargetRank('GOLD');
      setSelectedTags(['VC可能', '画面共有ライブ指導', 'レーン戦トレード']);
      setBio('');
      setActiveHours('平日 21:00〜24:00 / 休日');
    }
  }, [initialProfile, isOpen, user]);

  // チャンピオン検索のフィルタリング (日本語名 / 英語名 / 読み)
  const filteredChampions = ALL_CHAMPIONS.filter((id) => {
    if (selectedChampions.includes(id)) return false;
    if (!champSearchQuery.trim()) return true;
    const q = champSearchQuery.toLowerCase().trim();
    const idMatch = id.toLowerCase().includes(q);
    const jaInfo = CHAMPION_JA[id];
    if (!jaInfo) return idMatch;
    const jaMatch = jaInfo.ja.toLowerCase().includes(q);
    const rubyMatch = jaInfo.ruby.toLowerCase().includes(q);
    return idMatch || jaMatch || rubyMatch;
  }).slice(0, 15);

  const toggleLane = (laneId: string) => {
    if (lanes.includes(laneId)) {
      setLanes(lanes.filter((l) => l !== laneId));
    } else {
      setLanes([...lanes, laneId]);
    }
  };

  const addChampion = (champId: string) => {
    if (!selectedChampions.includes(champId) && selectedChampions.length < 8) {
      setSelectedChampions([...selectedChampions, champId]);
      setChampSearchQuery('');
      setIsChampDropdownOpen(false);
    }
  };

  const removeChampion = (champId: string) => {
    setSelectedChampions(selectedChampions.filter((c) => c !== champId));
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

  const applyTemplate = (templateText: string) => {
    setBio(templateText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        role_type: roleType,
        lanes,
        champions: selectedChampions,
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

  if (!isOpen) return null;

  const currentCategories = roleType === 'PUPIL' ? TAG_CATEGORIES_PUPIL : TAG_CATEGORIES_MENTOR;
  const currentTemplates = roleType === 'PUPIL' ? TEMPLATES_PUPIL : TEMPLATES_MENTOR;
  const isMentor = roleType === 'MENTOR';
  const rankInfo = getKtmRank(MMR_RANKS[currentRank] || 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-stone-900 border border-stone-700 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-stone-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* モーダルヘッダー */}
        <div className="p-4 md:px-6 md:py-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg">
              🪪
            </div>
            <div>
              <h2 className="text-base font-black text-stone-100 flex items-center gap-2">
                師弟自己紹介カード {initialProfile ? '編集' : '作成'}
              </h2>
              <p className="text-[11px] text-stone-400">
                あなたの得意分野や学びたい内容を公開して、相性の良いバディを見つけましょう
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 編集 / プレビュー切り替え */}
            <div className="flex bg-stone-800 p-0.5 rounded-lg text-xs font-bold border border-stone-700">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1 rounded-md transition ${activeTab === 'edit' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'}`}
              >
                ✏️ 入力
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md transition ${activeTab === 'preview' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'}`}
              >
                👀 プレビュー
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center font-bold text-sm transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* モーダルボディ */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {activeTab === 'preview' ? (
            /* プレビュー表示 */
            <div className="space-y-4">
              <div className="text-xs font-bold text-stone-400 flex items-center gap-1.5">
                <span>✨ 掲示板に表示されるカードの見た目プレビュー:</span>
              </div>

              <div className={`p-5 rounded-2xl border ${isMentor ? 'bg-stone-900/90 border-amber-500/50 shadow-xl shadow-amber-950/30' : 'bg-stone-900/90 border-emerald-500/50 shadow-xl shadow-emerald-950/30'} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1 ${isMentor ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}`}>
                    {isMentor ? '👨‍🏫 師匠 (Mentor)' : '🔰 弟子 (Pupil)'}
                  </div>
                  <span className="text-xs text-emerald-400 font-bold">🟢 募集中</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-xl font-black text-amber-400">
                    {(user?.displayName || user?.username || 'あなた').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-100">{user?.displayName || user?.username || 'あなた (プレイヤー名)'}</h3>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${rankInfo.bg} ${rankInfo.color} border border-current/20`}>
                        {rankInfo.name} ({currentRank})
                      </span>
                      {!isMentor && targetRank && (
                        <span className="text-[11px] text-emerald-400 font-bold">➔ 目標: {targetRank}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* レーン */}
                {lanes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {lanes.map((l) => (
                      <span key={l} className="px-2 py-0.5 bg-stone-800 border border-stone-700 rounded-md text-[11px] font-bold text-stone-300">
                        {AVAILABLE_LANES.find(al => al.id === l)?.label || l}
                      </span>
                    ))}
                  </div>
                )}

                {/* チャンピオン */}
                {selectedChampions.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-stone-400">
                      {isMentor ? '⚔️ 指導可能チャンピオン:' : '🎯 練習中チャンピオン:'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedChampions.map((c) => (
                        <div key={c} className="flex items-center gap-1.5 px-2 py-0.5 bg-stone-800 border border-stone-700 rounded-lg text-xs text-stone-200">
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${c}.png`}
                            alt={c}
                            className="w-4 h-4 rounded object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                          <span>{CHAMPION_JA[c]?.ja || c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* タグ */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedTags.map((t) => (
                      <span key={t} className={`px-2 py-0.5 rounded text-[10px] font-medium border ${isMentor ? 'bg-amber-950/40 text-amber-300 border-amber-800/40' : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'}`}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* 自己紹介 */}
                {bio && (
                  <div className="p-3 bg-stone-950/70 rounded-xl border border-stone-800 text-xs text-stone-300 leading-relaxed whitespace-pre-wrap">
                    {bio}
                  </div>
                )}

                {/* 活動時間 */}
                {activeHours && (
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                    <Clock size={12} className="text-amber-400" />
                    <span>活動時間:</span>
                    <span className="text-stone-200 font-semibold">{activeHours}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 入力フォーム */
            <form id="mentorship-form" onSubmit={handleSubmit} className="space-y-5 text-sm">
              
              {/* 1. 役割の選択 */}
              <div>
                <label className="block text-xs font-black text-stone-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">1</span>
                  参加する役割
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRoleType('PUPIL')}
                    className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden ${
                      roleType === 'PUPIL'
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40'
                        : 'bg-stone-800/40 border-stone-700/80 text-stone-400 hover:bg-stone-800/80 hover:text-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-black text-emerald-300 flex items-center gap-1.5">
                        <span>🔰</span> 弟子 (Pupil)
                      </div>
                      {roleType === 'PUPIL' && <Check size={16} className="text-emerald-400" />}
                    </div>
                    <div className="text-[11px] font-medium text-stone-400 mt-1">
                      アドバイスをもらって上達したい・ランクを上げたい
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoleType('MENTOR')}
                    className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden ${
                      roleType === 'MENTOR'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-200 ring-2 ring-amber-500/30 shadow-lg shadow-amber-950/40'
                        : 'bg-stone-800/40 border-stone-700/80 text-stone-400 hover:bg-stone-800/80 hover:text-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-black text-amber-300 flex items-center gap-1.5">
                        <span>👨‍🏫</span> 師匠 (Mentor)
                      </div>
                      {roleType === 'MENTOR' && <Check size={16} className="text-amber-400" />}
                    </div>
                    <div className="text-[11px] font-medium text-stone-400 mt-1">
                      ノウハウや経験を教えたい・コミュニティを育てたい
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. レーン選択 */}
              <div>
                <label className="block text-xs font-black text-stone-300 mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">2</span>
                  {roleType === 'PUPIL' ? '学びたい対象レーン' : '教えられるレーン'} (複数選択可)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LANES.map((lane) => {
                    const isSelected = lanes.includes(lane.id);
                    return (
                      <button
                        key={lane.id}
                        type="button"
                        onClick={() => toggleLane(lane.id)}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-950/30 scale-105'
                            : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-700 hover:text-stone-100'
                        }`}
                      >
                        {lane.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. ランク選択 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-stone-300 mb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">3</span>
                    現在のランク
                  </label>
                  <select
                    value={currentRank}
                    onChange={(e) => setCurrentRank(e.target.value)}
                    className="w-full bg-stone-800/90 border border-stone-700 rounded-xl px-3 py-2.5 text-stone-100 text-xs font-bold focus:border-amber-500 focus:outline-hidden"
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {roleType === 'PUPIL' ? (
                  <div>
                    <label className="block text-xs font-black text-stone-300 mb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-stone-950 text-[10px] flex items-center justify-center font-black">🎯</span>
                      目標ランク
                    </label>
                    <select
                      value={targetRank}
                      onChange={(e) => setTargetRank(e.target.value)}
                      className="w-full bg-stone-800/90 border border-stone-700 rounded-xl px-3 py-2.5 text-stone-100 text-xs font-bold focus:border-emerald-500 focus:outline-hidden"
                    >
                      {RANKS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black text-stone-300 mb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">👥</span>
                      歓迎する生徒の帯域
                    </label>
                    <div className="text-xs text-stone-400 bg-stone-800/50 border border-stone-700/60 rounded-xl p-2.5 font-medium">
                      全ランク歓迎 / 初心者歓迎
                    </div>
                  </div>
                )}
              </div>

              {/* 4. チャンピオン選択 (日本語インクリメンタル検索＆チップ) */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-stone-300 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">4</span>
                    {roleType === 'PUPIL' ? '練習中・使いたいチャンピオン' : '得意・指導可能チャンピオン'} (最大8体)
                  </div>
                  <span className="text-[11px] text-stone-400 font-normal">
                    {selectedChampions.length}/8体 選択中
                  </span>
                </label>

                {/* 選択済みチャンピオンのチップ表示 */}
                {selectedChampions.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2.5 bg-stone-950/60 border border-stone-800 rounded-2xl">
                    {selectedChampions.map((champId) => (
                      <div
                        key={champId}
                        className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-stone-800 border border-stone-700 rounded-xl text-xs font-bold text-stone-200 shadow-xs"
                      >
                        <img
                          src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champId}.png`}
                          alt={champId}
                          className="w-5 h-5 rounded-lg object-cover"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <span>{CHAMPION_JA[champId]?.ja || champId}</span>
                        <button
                          type="button"
                          onClick={() => removeChampion(champId)}
                          className="text-stone-400 hover:text-rose-400 hover:bg-stone-700 rounded-full w-4 h-4 flex items-center justify-center ml-0.5 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 検索入力欄＆ドロップダウン */}
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={champSearchQuery}
                      onChange={(e) => {
                        setChampSearchQuery(e.target.value);
                        setIsChampDropdownOpen(true);
                      }}
                      onFocus={() => setIsChampDropdownOpen(true)}
                      placeholder="日本語名（例: アーリ、ヤスオ）または英語名で検索..."
                      className="w-full bg-stone-800/90 border border-stone-700 rounded-xl pl-9 pr-3 py-2 text-stone-100 text-xs focus:border-amber-500 focus:outline-hidden"
                    />
                  </div>

                  {/* サジェストドロップダウン */}
                  {isChampDropdownOpen && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-2xl shadow-2xl max-h-52 overflow-y-auto p-1.5 space-y-1">
                      {filteredChampions.length > 0 ? (
                        filteredChampions.map((champId) => {
                          const ja = CHAMPION_JA[champId]?.ja || champId;
                          return (
                            <button
                              key={champId}
                              type="button"
                              onClick={() => addChampion(champId)}
                              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-stone-700/80 text-left transition group"
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champId}.png`}
                                  alt={champId}
                                  className="w-6 h-6 rounded-lg object-cover"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                                <div>
                                  <span className="text-xs font-bold text-stone-200 group-hover:text-amber-300">
                                    {ja}
                                  </span>
                                  <span className="text-[10px] text-stone-400 ml-1.5 font-mono">
                                    ({champId})
                                  </span>
                                </div>
                              </div>
                              <Plus size={14} className="text-stone-400 group-hover:text-amber-400" />
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-stone-400">
                          該当するチャンピオンが見つかりません
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. カテゴリ別実用タグの選択 */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-stone-300 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">5</span>
                  {roleType === 'PUPIL' ? '希望する指導・通話スタイル ＆ 悩み' : '指導可能スタイル ＆ 得意テーマ'} (タップで選択)
                </label>

                {currentCategories.map((cat) => (
                  <div key={cat.category} className="space-y-1.5 bg-stone-950/40 p-2.5 rounded-2xl border border-stone-800/80">
                    <div className="text-[11px] font-bold text-stone-400">
                      {cat.category}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.tags.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition ${
                              isSelected
                                ? isMentor
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-xs'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-xs'
                                : 'bg-stone-800/70 text-stone-400 border-stone-700/80 hover:bg-stone-700/80 hover:text-stone-200'
                            }`}
                          >
                            #{tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* 独自タグの追加 */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    placeholder="自由なタグを追加 (例: #週1回希望)..."
                    className="flex-1 bg-stone-800/80 border border-stone-700 rounded-xl px-3 py-1.5 text-stone-200 text-xs focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="px-3.5 py-1.5 bg-stone-700 hover:bg-stone-600 rounded-xl text-xs font-bold transition"
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* 6. 自己紹介文 ＆ 1クリックテンプレート */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-stone-300 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">6</span>
                    自己紹介・意気込み
                  </label>
                  <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                    <Sparkles size={12} /> 例文テンプレートから自動入力可能
                  </span>
                </div>

                {/* テンプレートボタン群 */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {currentTemplates.map((tmpl) => (
                    <button
                      key={tmpl.title}
                      type="button"
                      onClick={() => applyTemplate(tmpl.text)}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 border border-stone-700 hover:border-amber-500/60 text-stone-300 hover:text-amber-300 text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <span>📝</span> {tmpl.title}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="自己紹介や教えてほしいこと、どんな雰囲気でやりたいかを自由に記入してください..."
                  className="w-full bg-stone-800/90 border border-stone-700 rounded-2xl p-3 text-stone-100 text-xs focus:border-amber-500 focus:outline-hidden leading-relaxed"
                />
              </div>

              {/* 7. 活動しやすい時間帯 */}
              <div>
                <label className="block text-xs font-black text-stone-300 mb-1 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 text-[10px] flex items-center justify-center font-black">7</span>
                  活動しやすい時間帯・曜日
                </label>
                <input
                  type="text"
                  value={activeHours}
                  onChange={(e) => setActiveHours(e.target.value)}
                  placeholder="例: 平日 21:00〜24:00 / 休日 昼〜夜"
                  className="w-full bg-stone-800/90 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 text-xs focus:border-amber-500 focus:outline-hidden"
                />
              </div>
            </form>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="p-4 md:px-6 md:py-3.5 bg-stone-950/90 border-t border-stone-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-stone-400">
            {activeTab === 'edit' ? '入力内容を確認したい時は右上の「プレビュー」を押してください' : 'プレビューを確認後、右下のボタンで公開できます'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold text-stone-300 transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              form="mentorship-form"
              disabled={isSaving}
              onClick={activeTab === 'preview' ? (e) => handleSubmit(e as any) : undefined}
              className={`px-6 py-2 rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5 ${
                isMentor
                  ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-950/40'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-950/40'
              } disabled:opacity-50`}
            >
              {isSaving ? '保存中...' : '🪪 カードを保存・公開する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
