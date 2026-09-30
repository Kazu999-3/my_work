'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { ALL_CHAMPIONS, CHAMPION_JA } from '../../components/ChampSelect';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getKtmRank, RANKS as MMR_RANKS } from '../../lib/mmr';
import { MENTORSHIP_DURATIONS } from '../../lib/mentorshipConstants';
import { Search, Plus, X, Sparkles, Volume2, Video, Swords, BookOpen, Clock, Shield, Check } from 'lucide-react';

interface MentorshipProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profileData: Partial<MentorshipProfile>) => Promise<void>;
  initialProfile?: MentorshipProfile | null;
  defaultRole?: 'PUPIL' | 'MENTOR';
  myProfiles?: {
    PUPIL?: MentorshipProfile | null;
    MENTOR?: MentorshipProfile | null;
  };
}

const AVAILABLE_LANES = [
  { id: 'TOP', label: '🛡️ TOP' },
  { id: 'JUNGLE', label: '🌲 JUNGLE' },
  { id: 'MID', label: '⚡ MID' },
  { id: 'BOT', label: '🏹 BOT' },
  { id: 'SUPPORT', label: '💖 SUPPORT' },
];

const RANKS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];

const TARGET_STUDENT_RANKS = [
  '全ランク・初心者歓迎',
  'アイアン〜シルバー歓迎',
  'ゴールド以下歓迎',
  'プラチナ以下歓迎',
  'エメラルド以下歓迎',
  'ダイヤ以下歓迎',
];

// カテゴリ別タグ定義
const TAG_CATEGORIES_PUPIL = [
  {
    category: '✨ 気軽な希望・ライトコース',
    tags: ['1試合カスタム希望', 'リプレイ添削希望', '3日間お試し希望', '単発相談OK', '初心者大歓迎'],
  },
  {
    category: '🔊 通話・コミュニケーション',
    tags: ['VC可能', '聞き専OK', 'テキストチャットのみ', 'Discord通話希望'],
  },
  {
    category: '🎯 学びたい形式・メニュー',
    tags: ['画面共有ライブ指導', '録画・リプレイ添削', '1on1マッチアップ特訓', 'ノーマル/カスタム同伴', 'ビルド・ルーン相談'],
  },
  {
    category: '⚔️ 集団戦・立ち回りの悩み',
    tags: ['キャリー立ち位置・カイト', 'エンゲージ・仕掛けの判断', 'ピール・味方キャリー保護', 'フランク・裏回り・暗殺', 'フォーカス合わせ・標的選定', '2v2/3v3小規模戦'],
  },
  {
    category: '⚖️ レーン戦・対面ファイトの悩み',
    tags: ['ウェーブ管理・フリーズ', 'トレード・キルライン見極め', 'ガンク回避・視界・敵JG警戒', 'ローム・寄りの判断', 'タワー下CS精度・ラストヒット'],
  },
  {
    category: '🗺️ マクロ・試合運びの悩み',
    tags: ['オブジェクト戦の陣形・視界', 'サイドプッシュ・スプリット', '中盤レーン割り振り・ローテーション', 'タワーダイブ・シージ・防衛', '有利な試合の終わらせ方'],
  },
  {
    category: '🌲 JG/サポ専攻 ＆ 🧠 座学・メンタル',
    tags: ['JG周回ルート・ガンク判断', 'ディープワード・視界制圧', 'サポートのローム基準', 'キー配置・カメラ操作見直し', 'リプレイ自己分析のコツ', '連敗メンタル管理・チルト対策'],
  },
];

const TAG_CATEGORIES_MENTOR = [
  {
    category: '✨ 気軽な指導・ライトコース歓迎',
    tags: ['1試合カスタム歓迎', 'リプレイ添削歓迎', '3日間お試し歓迎', '単発指導OK', '初心者大歓迎'],
  },
  {
    category: '👥 歓迎する生徒の帯域',
    tags: ['全ランク・初心者歓迎', 'アイアン〜シルバー歓迎', 'ゴールド以下歓迎', 'プラチナ以下歓迎', 'エメラルド以下歓迎'],
  },
  {
    category: '🔊 指導・通話スタイル',
    tags: ['VC指導対応', '聞き専生徒OK', 'テキスト添削可能', '優しく丁寧に教えます'],
  },
  {
    category: '🎯 指導可能メニュー',
    tags: ['画面共有ライブコーチング', '録画・リプレイ添削', '1on1マッチアップ特訓', 'ノーマル/カスタム同伴プレイ', 'チャンピオン使い方講座'],
  },
  {
    category: '⚔️ 得意な指導：集団戦・立ち回り',
    tags: ['エンゲージ・仕掛け判断の指導', 'ピール・キャリー保護の指導', 'キャリー立ち位置・カイト指導', 'フランク・暗殺ルート指導', '集団戦フォーカス優先度'],
  },
  {
    category: '⚖️ 得意な指導：レーン戦・マクロ',
    tags: ['ウェーブ管理・ラインコントロール', '対面マッチアップ勝ち方・トレード', 'ガンク警戒・ディープワード', 'サイドプッシュ・スプリット管理', 'オブジェクト周りの陣形・マクロ', '試合の終わらせ方・クローズ'],
  },
  {
    category: '🌲 JG/サポ専攻 ＆ 🧠 座学・メンタル',
    tags: ['ジャングルルート・ガンク判断', 'サポートローム・視界支配', 'キー配置・設定・カメラ操作', 'リプレイ添削・ミスの言語化', 'ランクメンタル・モチベ維持'],
  },
];

// 1クリック自己紹介テンプレート
const TEMPLATES_PUPIL = [
  {
    title: '🎮 1試合カスタム・お試し型',
    text: 'まずは1試合カスタムで対面を見てもらい、序盤の立ち回りやCSトレードについてアドバイスをいただきたいです！気軽によろしくお願いします！',
  },
  {
    title: '📺 リプレイ添削希望型',
    text: '直近の負け試合のリプレイを1本見ていただき、中盤の立ち回りや改善ポイントを教えてもらいたいです！聞き専・テキスト添削でもOKです！',
  },
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
  defaultRole = 'PUPIL',
  myProfiles,
}: MentorshipProfileModalProps) {
  const { user } = useCurrentUser();

  const [roleType, setRoleType] = useState<'PUPIL' | 'MENTOR'>(defaultRole);
  const [lanes, setLanes] = useState<string[]>([]);
  const [selectedChampions, setSelectedChampions] = useState<string[]>([]);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [isChampDropdownOpen, setIsChampDropdownOpen] = useState(false);
  const [currentRank, setCurrentRank] = useState('SILVER');
  const [targetRank, setTargetRank] = useState('GOLD');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [preferredDuration, setPreferredDuration] = useState<string>('14_DAYS');
  const [customTag, setCustomTag] = useState('');
  const [bio, setBio] = useState('');
  const [activeHours, setActiveHours] = useState('');
  const [maxPupils, setMaxPupils] = useState<number>(3);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // プロフィールデータをフォーム状態に反映するヘルパー
  const loadProfileData = (targetRole: 'PUPIL' | 'MENTOR', profile?: MentorshipProfile | null) => {
    setRoleType(targetRole);
    if (profile) {
      setLanes(profile.lanes || []);
      setSelectedChampions(profile.champions || []);
      setCurrentRank(profile.current_rank || 'SILVER');
      setTargetRank(profile.target_rank || (targetRole === 'PUPIL' ? 'GOLD' : '全ランク・初心者歓迎'));
      setSelectedTags(profile.tags || []);
      
      // preferred_duration 判定（profile.preferred_duration または tags から復元）
      const profDuration = (profile as any).preferred_duration;
      if (profDuration && MENTORSHIP_DURATIONS[profDuration]) {
        setPreferredDuration(profDuration);
      } else if (profile.tags?.some(t => t.includes('1試合') || t.includes('カスタム') || t.includes('単発'))) {
        setPreferredDuration('1_MATCH');
      } else if (profile.tags?.some(t => t.includes('リプレイ') || t.includes('添削'))) {
        setPreferredDuration('REPLAY');
      } else if (profile.tags?.some(t => t.includes('3日') || t.includes('お試し'))) {
        setPreferredDuration('3_DAYS');
      } else {
        setPreferredDuration(targetRole === 'PUPIL' ? '1_MATCH' : '14_DAYS');
      }

      setBio(profile.bio || '');
      setActiveHours(profile.active_hours || '');
      setMaxPupils(profile.max_pupils || 3);
    } else {
      // 新規作成時の自動プリセット
      const userRank = user?.rank ? user.rank.toUpperCase().split(' ')[0] : 'SILVER';
      const userLane = (user as any)?.role && (user as any).role !== 'ALL' ? [(user as any).role] : ['MID'];
      
      setLanes(userLane);
      setSelectedChampions([]);
      setCurrentRank(RANKS.includes(userRank) ? userRank : 'SILVER');
      setTargetRank(targetRole === 'PUPIL' ? 'GOLD' : '全ランク・初心者歓迎');
      setPreferredDuration(targetRole === 'PUPIL' ? '1_MATCH' : '14_DAYS');
      setSelectedTags(
        targetRole === 'PUPIL'
          ? ['VC可能', '画面共有ライブ指導', 'トレード・キルライン見極め']
          : ['VC指導対応', '優しく丁寧に教えます', '画面共有ライブコーチング']
      );
      setBio('');
      setActiveHours('平日 21:00〜24:00 / 休日');
      setMaxPupils(3);
    }
  };

  // 初期値のロード
  useEffect(() => {
    if (!isOpen) return;
    const targetRole = initialProfile?.role_type || defaultRole;
    const targetProf = initialProfile || (myProfiles ? myProfiles[targetRole] : null);
    loadProfileData(targetRole, targetProf);
  }, [initialProfile, isOpen, defaultRole]);

  // 役割（弟子 ⇄ 師匠）を切り替えたときの連動
  const handleRoleChange = (newRole: 'PUPIL' | 'MENTOR') => {
    if (newRole === roleType) return;
    const existing = myProfiles ? myProfiles[newRole] : null;
    loadProfileData(newRole, existing);
  };

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

  const selectLane = (laneId: string) => {
    // 師弟関係は単一レーンに特化するため、単一選択
    setLanes([laneId]);
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
        target_rank: targetRank || undefined,
        tags: selectedTags,
        bio,
        active_hours: activeHours,
        status: 'OPEN',
        preferred_duration: preferredDuration,
        max_pupils: roleType === 'MENTOR' ? maxPupils : 1,
        discord_id: user?.discordId,
        player_name: user?.displayName || user?.username,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-foreground animate-in fade-in zoom-in-95 duration-200">
        
        {/* モーダルヘッダー */}
        <div className="p-4 md:px-6 md:py-4 bg-background border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-xl shadow-2xs">
              🪪
            </div>
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                師弟自己紹介カード {initialProfile ? '編集' : '作成'}
              </h2>
              <p className="text-[11px] text-muted font-medium">
                あなたの得意分野や学びたい内容を公開して、相性の良いバディを見つけましょう
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 編集 / プレビュー切り替え */}
            <div className="flex bg-surface-subtle p-0.5 rounded-xl text-xs font-black border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeTab === 'edit' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted hover:text-foreground'}`}
              >
                ✏️ 入力
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeTab === 'preview' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted hover:text-foreground'}`}
              >
                👀 プレビュー
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-surface-subtle hover:bg-surface-hover text-muted-strong hover:text-foreground flex items-center justify-center font-bold text-sm transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* モーダルボディ */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          
          {/* 🎁 初回登録ボーナス告知バナー */}
          {!initialProfile && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-400/50 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl animate-bounce">🎁</span>
                <div>
                  <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <span>自己紹介カード 初回作成ボーナス</span>
                    <span className="px-2 py-0.2 rounded-full bg-amber-500 text-stone-950 font-mono text-[10px] font-black">+500 コイン</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">
                    カードを保存・公開すると、KTMショップや勝敗予想で使えるコインを即時GET！
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-900 bg-surface/80 px-2 py-1 rounded-xl border border-amber-300 shrink-0 hidden sm:inline">
                即時付与🪙
              </span>
            </div>
          )}

          {activeTab === 'preview' ? (
            /* プレビュー表示 */
            <div className="space-y-4">
              <div className="text-xs font-bold text-muted flex items-center gap-1.5">
                <span>✨ 掲示板に表示されるカードの見た目プレビュー:</span>
              </div>

              <div className={`p-5 rounded-3xl border bg-surface shadow-md ${isMentor ? 'border-amber-400' : 'border-emerald-400'} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${isMentor ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                      <span>{isMentor ? '👨‍🏫' : '🔰'}</span>
                      <span>{isMentor ? '師匠 (Mentor)' : '弟子 (Pupil)'}</span>
                    </div>
                    {preferredDuration && MENTORSHIP_DURATIONS[preferredDuration] && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border shadow-2xs ${MENTORSHIP_DURATIONS[preferredDuration].badgeColor || 'bg-surface-subtle text-foreground-soft border-border'}`}>
                        {MENTORSHIP_DURATIONS[preferredDuration].shortLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">🟢 募集中</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    {user?.displayName || user?.username || 'あなたのプレイヤー名'}
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300">
                      🏆 {currentRank}
                    </span>
                  </h3>
                  {roleType === 'PUPIL' && targetRank && (
                    <div className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <span>🎯 目標ランク:</span>
                      <span className="font-black underline">{targetRank}</span>
                    </div>
                  )}
                  {roleType === 'MENTOR' && targetRank && (
                    <div className="text-xs text-amber-800 font-bold flex items-center gap-1">
                      <span>👥 歓迎生徒:</span>
                      <span className="font-black underline">{targetRank}</span>
                    </div>
                  )}
                </div>

                {/* メインレーン */}
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-muted-strong">プレイレーン</div>
                  <div className="flex flex-wrap gap-1.5">
                    {lanes.length > 0 ? (
                      lanes.map((l) => (
                        <span key={l} className="px-2.5 py-0.5 rounded-lg bg-surface-subtle text-foreground-soft text-xs font-black border border-border">
                          {AVAILABLE_LANES.find((item) => item.id === l)?.label || l}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-faint">未選択</span>
                    )}
                  </div>
                </div>

                {/* 得意チャンピオン */}
                {selectedChampions.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-muted-strong">
                      {roleType === 'PUPIL' ? '練習中・使いたいチャンピオン' : '得意・指導可能チャンピオン'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedChampions.map((c) => (
                        <div key={c} className="flex items-center gap-1 px-2 py-0.5 bg-background rounded-lg border border-border text-xs font-bold text-foreground-soft">
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${c}.png`}
                            alt={c}
                            className="w-4 h-4 rounded-full"
                          />
                          <span>{CHAMPION_JA[c]?.ja || c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 自己紹介文 */}
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-muted-strong">自己紹介・意気込み</div>
                  <p className="text-xs text-foreground-soft leading-relaxed whitespace-pre-wrap bg-background p-3 rounded-2xl border border-border font-medium">
                    {bio || '（自己紹介文が未記入です）'}
                  </p>
                </div>

                {/* タグ一覧 */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${isMentor ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300'}`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 入力フォーム */
            <form id="mentorship-form" onSubmit={handleSubmit} className="space-y-5 text-sm">
              
              {/* 1. 役割の選択 */}
              <div>
                <label className="block text-xs font-black text-foreground-subtle mb-1.5 flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">1</span>
                  参加する役割
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('PUPIL')}
                    className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden cursor-pointer ${
                      roleType === 'PUPIL'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/30 shadow-md'
                        : 'bg-background border-border text-muted hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-black text-emerald-800 flex items-center gap-1.5">
                        <span>🔰</span> 弟子 (Pupil)
                      </div>
                      {roleType === 'PUPIL' && <Check size={16} className="text-emerald-600 font-bold" />}
                    </div>
                    <div className="text-[11px] font-medium text-muted mt-1">
                      アドバイスをもらって上達したい・ランクを上げたい
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('MENTOR')}
                    className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden cursor-pointer ${
                      roleType === 'MENTOR'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/30 shadow-md'
                        : 'bg-background border-border text-muted hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-black text-amber-800 flex items-center gap-1.5">
                        <span>👨‍🏫</span> 師匠 (Mentor)
                      </div>
                      {roleType === 'MENTOR' && <Check size={16} className="text-amber-600 font-bold" />}
                    </div>
                    <div className="text-[11px] font-medium text-muted mt-1">
                      ノウハウや経験を教えたい・コミュニティを育てたい
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. レーン選択 */}
              <div>
                <label className="block text-xs font-black text-foreground-subtle mb-1.5 flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">2</span>
                  {roleType === 'PUPIL' ? '学びたい対象レーン' : '指導レーン'} (1つ選択)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LANES.map((lane) => {
                    const isSelected = lanes.includes(lane.id);
                    return (
                      <button
                        key={lane.id}
                        type="button"
                        onClick={() => selectLane(lane.id)}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm scale-105 ring-2 ring-amber-400'
                            : 'bg-background border-border text-foreground-subtle hover:bg-surface-subtle'
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
                  <label className="block text-xs font-black text-foreground-subtle mb-1 flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">3</span>
                    現在のランク
                  </label>
                  <select
                    value={currentRank}
                    onChange={(e) => setCurrentRank(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-xs font-bold focus:border-amber-500 focus:bg-surface focus:outline-hidden"
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
                    <label className="block text-xs font-black text-foreground-subtle mb-1 flex items-center gap-1.5">
                      <span className="w-4.5 h-4.5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-black">🎯</span>
                      目標ランク
                    </label>
                    <select
                      value={targetRank}
                      onChange={(e) => setTargetRank(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-xs font-bold focus:border-emerald-600 focus:bg-surface focus:outline-hidden"
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
                    <label className="block text-xs font-black text-foreground-subtle mb-1 flex items-center gap-1.5">
                      <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">👥</span>
                      歓迎する生徒の帯域
                    </label>
                    <select
                      value={targetRank || '全ランク・初心者歓迎'}
                      onChange={(e) => setTargetRank(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-xs font-bold focus:border-amber-500 focus:bg-surface focus:outline-hidden"
                    >
                      {TARGET_STUDENT_RANKS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 師匠専用: 同時受入可能人数 (1〜3人) */}
              {roleType === 'MENTOR' && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-300/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <span>👥</span>
                      <span>同時に受け入れ可能な弟子の人数</span>
                    </label>
                    <span className="text-[11px] font-black text-amber-700 bg-surface px-2 py-0.5 rounded-md border border-amber-300">
                      現在設定: 最大 {maxPupils} 人まで
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxPupils(num)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                          maxPupils === num
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs scale-[1.02]'
                            : 'bg-surface text-foreground-subtle border-amber-200 hover:bg-amber-100/50'
                        }`}
                      >
                        {num === 1 ? '👤 1人（専任）' : num === 2 ? '👥 2人（兄弟弟子）' : '✨ 3人（ゼミ型・推奨）'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-900/80 leading-relaxed font-medium">
                    ※ 単発やリプレイ添削を受ける場合、2〜3人に設定しておくと枠が埋まらずスムーズに教えられます。
                  </p>
                </div>
              )}

              {/* 4. 希望する受講・指導スタイル / 期間コース */}
              <div className="space-y-2 p-3.5 bg-background border border-border rounded-2xl">
                <label className="block text-xs font-black text-foreground-soft flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">4</span>
                    <span>{roleType === 'PUPIL' ? '希望する受講スタイル・期間' : '対応可能な指導スタイル・期間'}</span>
                  </span>
                  <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    ⚡ 1試合・単発OK
                  </span>
                </label>

                {/* 気軽な1回・お試しコース */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-strong uppercase tracking-wider">✨ 気軽な1回・お試しコース</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {Object.entries(MENTORSHIP_DURATIONS)
                      .filter(([_, item]) => item.isLight)
                      .map(([key, item]) => {
                        const isSelected = preferredDuration === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPreferredDuration(key)}
                            className={`p-2.5 rounded-xl text-left border text-xs font-bold transition flex flex-col justify-between gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-br from-teal-50 to-amber-50 border-teal-500 text-foreground shadow-2xs ring-2 ring-teal-300 scale-[1.02]'
                                : 'bg-surface border-border text-foreground-subtle hover:bg-teal-50/50 hover:border-teal-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold">{item.shortLabel}</span>
                              {isSelected && <span className="text-teal-600 text-xs font-black">✓</span>}
                            </div>
                            <span className="text-[10px] text-muted-strong font-medium leading-tight">{item.label.split('（')[0]}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* しっかり継続コース */}
                <div className="space-y-1 pt-1 border-t border-border/60">
                  <span className="text-[10px] font-black text-muted-strong uppercase tracking-wider">🔥 しっかり継続コース</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {Object.entries(MENTORSHIP_DURATIONS)
                      .filter(([_, item]) => !item.isLight)
                      .map(([key, item]) => {
                        const isSelected = preferredDuration === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPreferredDuration(key)}
                            className={`p-2 rounded-xl text-left border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-2xs ring-1 ring-amber-300'
                                : 'bg-surface border-border text-foreground-subtle hover:bg-surface-subtle'
                            }`}
                          >
                            <span className="font-bold">{item.shortLabel}</span>
                            {isSelected && <span className="text-amber-600 text-xs font-black">✓</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* 5. チャンピオン選択 (日本語インクリメンタル検索＆チップ) */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-foreground-subtle flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">5</span>
                    {roleType === 'PUPIL' ? '練習中・使いたいチャンピオン' : '得意・指導可能チャンピオン'} (最大8体)
                  </div>
                  <span className="text-[11px] text-muted-strong font-bold">
                    {selectedChampions.length}/8体 選択中
                  </span>
                </label>

                {/* 選択済みチャンピオンのチップ表示 */}
                {selectedChampions.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2.5 bg-background border border-border rounded-2xl">
                    {selectedChampions.map((champId) => (
                      <div
                        key={champId}
                        className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 bg-surface border border-border rounded-xl text-xs font-bold text-foreground shadow-2xs"
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
                          className="text-faint hover:text-rose-600 hover:bg-surface-subtle rounded-full w-4 h-4 flex items-center justify-center ml-0.5 transition cursor-pointer"
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
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
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
                      className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-foreground text-xs font-medium focus:border-amber-500 focus:bg-surface focus:outline-hidden"
                    />
                    {champSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setChampSearchQuery('');
                          setIsChampDropdownOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* サジェストドロップダウン */}
                  {isChampDropdownOpen && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-2xl shadow-xl max-h-52 overflow-y-auto p-1.5 space-y-1">
                      {filteredChampions.length > 0 ? (
                        filteredChampions.map((champId) => {
                          const ja = CHAMPION_JA[champId]?.ja || champId;
                          return (
                            <button
                              key={champId}
                              type="button"
                              onClick={() => addChampion(champId)}
                              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-amber-50 text-left transition group cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={`https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${champId}.png`}
                                  alt={champId}
                                  className="w-6 h-6 rounded-lg object-cover"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                                <div>
                                  <span className="text-xs font-bold text-foreground group-hover:text-amber-800">
                                    {ja}
                                  </span>
                                  <span className="text-[10px] text-muted-strong ml-1.5 font-mono">
                                    ({champId})
                                  </span>
                                </div>
                              </div>
                              <Plus size={14} className="text-faint group-hover:text-amber-600" />
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-strong font-medium">
                          該当するチャンピオンが見つかりません
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 6. カテゴリ別実用タグの選択 */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-foreground-subtle flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">6</span>
                  {roleType === 'PUPIL' ? '希望する指導・通話スタイル ＆ 悩み' : '指導可能スタイル ＆ 得意テーマ'} (タップで選択)
                </label>

                {currentCategories.map((cat) => (
                  <div key={cat.category} className="space-y-1.5 bg-background p-3 rounded-2xl border border-border">
                    <div className="text-[11px] font-black text-muted">
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
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              isSelected
                                ? isMentor
                                  ? 'bg-amber-100 text-amber-900 border-amber-400 shadow-2xs'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-400 shadow-2xs'
                                : 'bg-surface text-foreground-subtle border-border hover:border-border hover:bg-background'
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
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-1.5 text-foreground text-xs focus:border-amber-500 focus:bg-surface focus:outline-hidden font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="px-3.5 py-1.5 bg-surface-hover hover:bg-stone-300 text-foreground-soft rounded-xl text-xs font-black transition cursor-pointer"
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* 7. 自己紹介文 ＆ 1クリックテンプレート */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="block text-xs font-black text-foreground-subtle flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">7</span>
                    自己紹介・意気込み
                  </label>
                  <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                    📝 例文テンプレートから自動入力可能
                  </span>
                </div>

                {/* テンプレートボタン群 */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {currentTemplates.map((tmpl) => (
                    <button
                      key={tmpl.title}
                      type="button"
                      onClick={() => applyTemplate(tmpl.text)}
                      className="px-2.5 py-1 rounded-xl bg-surface-subtle border border-border hover:border-amber-400 text-foreground-subtle hover:text-amber-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>📝</span> {tmpl.title}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="自己紹介や教えてほしいこと、どんな雰囲気でやりたいかを自由に記入してください（上の例文ボタンから簡単入力も可能です）..."
                  className="w-full bg-background border border-border rounded-2xl p-3 text-foreground text-xs focus:border-amber-500 focus:bg-surface focus:outline-hidden leading-relaxed font-medium"
                />
              </div>

              {/* 8. 活動しやすい時間帯 */}
              <div>
                <label className="block text-xs font-black text-foreground-subtle mb-1 flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-black">8</span>
                  活動しやすい時間帯・曜日
                </label>
                <input
                  type="text"
                  value={activeHours}
                  onChange={(e) => setActiveHours(e.target.value)}
                  placeholder="例: 平日 21:00〜24:00 / 休日 昼〜夜"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground text-xs font-medium focus:border-amber-500 focus:bg-surface focus:outline-hidden"
                />
              </div>
            </form>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="p-4 md:px-6 md:py-3.5 bg-background border-t border-border flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-strong font-medium">
            {activeTab === 'edit' ? '入力内容を確認したい時は右上の「プレビュー」を押してください' : 'プレビューを確認後、右下のボタンで公開できます'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-hover hover:bg-stone-300 rounded-xl text-xs font-black text-foreground-subtle transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              form="mentorship-form"
              disabled={isSaving}
              onClick={activeTab === 'preview' ? (e) => handleSubmit(e as any) : undefined}
              className={`px-6 py-2 rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer ${
                isMentor
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
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
