'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MentorshipProfile } from '../api/mentorship/profiles/route';
import { ALL_CHAMPIONS, CHAMPION_JA } from '../../components/ChampSelect';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getKtmRank, RANKS as MMR_RANKS } from '../../lib/mmr';
import { getChampIcon } from '../../lib/ddragonClient';
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
  canBeMentor?: boolean;
  userTier?: { tier: string; label: string; totalGames: number } | null;
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

// 通話・指導・コミュニケーションスタイル（複数選択可能）
export const COMMUNICATION_STYLES = [
  { id: 'VC通話', label: '🎙️ VC通話', desc: 'Discord通話しながらプレイ・相談OK' },
  { id: '聞き専OK', label: '🎧 聞き専OK', desc: '話を聞きながらチャットで返答' },
  { id: 'テキスト', label: '💬 テキストチャット', desc: '文字・チャットのみで相談' },
  { id: '画面共有', label: '📺 画面共有', desc: '画面共有でリプレイ添削や実戦観戦' },
];

// 後方互換性エイリアス
export const VOICE_STYLES = COMMUNICATION_STYLES;


// 1クリック自己紹介テンプレート
const TEMPLATES_PUPIL = [
  {
    title: '🔰 基本から教えて！型',
    text: 'レーン戦のウェーブの引き方やCSの取り方を基礎から教えてほしいです！聞き専・テキストでも大丈夫な先輩よろしくお願いします！',
  },
  {
    title: '⚔️ 1試合カスタム見て！型',
    text: 'まずは週末カスタムやノーマルで1試合見てもらい、序盤の立ち回りについてアドバイスをもらいたいです！気軽によろしくお願いします！',
  },
  {
    title: '📺 リプレイ一緒に見て！型',
    text: '負け試合のリプレイを1本一緒に見てもらって、集団戦の立ち位置やミスのポイントを教えてほしいです！VC可能です。',
  },
  {
    title: '🤝 一緒に楽しく遊びたい型',
    text: '楽しく会話しながらノーマルやカスタムを一緒にプレイしつつ、アドバイスをもらえると嬉しいです！よろしくお願いします！',
  },
];

const TEMPLATES_MENTOR = [
  {
    title: '🧑‍🏫 初心者大歓迎・優しく教える型',
    text: 'アイアン〜ゴールド帯の方大歓迎です！CSの基本や安全なトレードを優しく教えます。厳しい指導や怒ることは絶対にありませんので気軽に声かけてください✨',
  },
  {
    title: '🎮 実戦・カスタム一緒に回す型',
    text: 'カスタムやノーマルを一緒にプレイしながら、リアルタイムに立ち回りやビルドのアドバイスをします！楽しく上達していきましょう！',
  },
  {
    title: '📺 リプレイ添削・立ち回り解説型',
    text: 'リプレイ添削や画面共有での解説が得意です！集団戦の立ち位置や得意チャンプの勝ちパターンを一緒に整理しましょう。聞き専の方も歓迎です！',
  },
];

export function MentorshipProfileModal({
  isOpen,
  onClose,
  onSave,
  initialProfile,
  defaultRole = 'PUPIL',
  myProfiles,
  canBeMentor = true,
  userTier,
}: MentorshipProfileModalProps) {
  const { user } = useCurrentUser();

  const [roleType, setRoleType] = useState<'PUPIL' | 'MENTOR'>(defaultRole);
  const [lanes, setLanes] = useState<string[]>([]);
  const [selectedChampions, setSelectedChampions] = useState<string[]>([]);
  const [champSearchQuery, setChampSearchQuery] = useState('');
  const [isChampDropdownOpen, setIsChampDropdownOpen] = useState(false);
  const [currentRank, setCurrentRank] = useState('SILVER');
  const [targetRank, setTargetRank] = useState('GOLD');
  const [selectedCommStyles, setSelectedCommStyles] = useState<string[]>(['VC通話']);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
      
      // コミュニケーションスタイルとその他タグの分離・正規化
      const rawTags = profile.tags || [];
      const extractedStyles = new Set<string>();
      const otherTags: string[] = [];

      rawTags.forEach((t) => {
        if (t === 'VC通話' || t === 'VC可能' || t === 'VC指導対応') {
          extractedStyles.add('VC通話');
        } else if (t === '聞き専OK' || t === '聞き専') {
          extractedStyles.add('聞き専OK');
        } else if (t === 'テキスト' || t === 'テキストのみ' || t === 'テキストチャット') {
          extractedStyles.add('テキスト');
        } else if (t === '画面共有' || t === '画面共有ライブコーチング' || t === '画面共有ライブ指導') {
          extractedStyles.add('画面共有');
        } else {
          // 旧ジャンクタグや期間タグは除外
          const isJunkOrDuration = [
            '優しく丁寧に教えます', 'チャンピオン使い方講座', 'ノーマル/カスタム同伴プレイ',
            '1on1マッチアップ特訓', '初心者大歓迎', 'ゴールド以下歓迎', '全ランク・初心者歓迎',
            'エメラルド以下歓迎', 'プラチナ以下歓迎', '1試合カスタム歓迎', 'リプレイ添削歓迎',
            '3日間お試し歓迎', '単発指導OK', 'エンゲージ・仕掛け判断の指導', 'ピール・キャリー保護の指導',
            '集団戦フォーカス優先度', 'ガンク警戒・ディープワード', 'オブジェクト周りの陣形・マクロ',
            'ジャングルルート・ガンク判断', 'サポートローム・視界支配', 'リプレイ添削・ミスの言語化',
            '対面マッチアップ勝ち方・トレード', 'トレード・キルライン見極め', '単発相談OK',
            'オブジェクト戦の陣形・視界', 'タワーダイブ・シージ・防衛', 'サポートのローム基準',
            'キー配置・カメラ操作見直し', 'ウェーブ管理・フリーズ', 'ローム・寄りの判断',
            '有利な試合の終わらせ方', 'リプレイ自己分析のコツ', '画面共有ライブコーチング',
            '画面共有ライブ指導', 'VC指導対応', 'VC可能', 'テキストのみ',
            '1試合カスタム', 'リプレイ添削', '3日間お試し', '2週間育成', '1ヶ月特訓', '長期指導'
          ].includes(t);
          if (!isJunkOrDuration) {
            otherTags.push(t);
          }
        }
      });

      if (extractedStyles.size === 0) {
        extractedStyles.add('VC通話');
      }
      setSelectedCommStyles(Array.from(extractedStyles));
      setSelectedTags(otherTags);

      setBio(profile.bio || '');
      setActiveHours(profile.active_hours || '');
      setMaxPupils(profile.max_pupils || 2);
    } else {
      // 新規作成時の自動プリセット
      const userRank = user?.rank ? user.rank.toUpperCase().split(' ')[0] : 'SILVER';
      const userLane = (user as any)?.role && (user as any).role !== 'ALL' ? [(user as any).role] : ['MID'];
      
      setLanes(userLane);
      setSelectedChampions([]);
      setCurrentRank(RANKS.includes(userRank) ? userRank : 'SILVER');
      setTargetRank(targetRole === 'PUPIL' ? 'GOLD' : '全ランク・初心者歓迎');
      setSelectedCommStyles(['VC通話']);
      setSelectedTags([]);
      setBio('');
      setActiveHours('平日 21:00〜24:00 / 休日');
      setMaxPupils(2);
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

  // 通話・指導スタイルのトグル選択（複数選択可・最低1つ選択）
  const toggleCommStyle = (styleId: string) => {
    setSelectedCommStyles((prev) => {
      if (prev.includes(styleId)) {
        if (prev.length <= 1) return prev; // 最低1つは残す
        return prev.filter((id) => id !== styleId);
      } else {
        return [...prev, styleId];
      }
    });
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

  const applyTemplate = (templateText: string) => {
    setBio(templateText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 通話・指導スタイルと他のタグを統合
      const finalTags = Array.from(new Set([...selectedCommStyles, ...selectedTags]));

      await onSave({
        id: initialProfile?.id,
        role_type: roleType,
        lanes,
        champions: selectedChampions,
        current_rank: currentRank,
        target_rank: targetRank || undefined,
        tags: finalTags,
        bio,
        active_hours: activeHours,
        status: 'OPEN',
        max_pupils: roleType === 'MENTOR' ? maxPupils : 1,
        discord_id: initialProfile?.discord_id || user?.discordId,
        player_name: initialProfile?.player_name || user?.displayName || user?.username,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save mentorship profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentTemplates = roleType === 'PUPIL' ? TEMPLATES_PUPIL : TEMPLATES_MENTOR;
  const isMentor = roleType === 'MENTOR';
  const rankInfo = getKtmRank(MMR_RANKS[currentRank] || 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-foreground animate-in fade-in zoom-in-95 duration-200">
        
        {/* モーダルヘッダー */}
        <div className="p-4 md:px-6 md:py-4 bg-background border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary-100 border border-primary-edge flex items-center justify-center text-xl shadow-2xs">
              🪪
            </div>
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                🎒 相談カード {initialProfile ? '編集' : '作成'}
              </h2>
              <p className="text-[11px] text-muted font-medium">
                得意なチャンプや相談したい内容を登録して、気軽に先輩・後輩とつながりましょう
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
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-primary-500/15 via-primary-500/10 to-primary-500/15 border border-primary-edge/50 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl animate-bounce">🎁</span>
                <div>
                  <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
                    <span>相談カード 初回作成ボーナス</span>
                    <span className="px-2 py-0.2 rounded-full bg-primary-500 text-stone-950 font-mono text-[10px] font-black">+500 コイン</span>
                  </div>
                  <p className="text-[11px] text-primary-800 font-medium">
                    カードを保存・公開すると、KTMショップや勝敗予想で使えるコインを即時GET！
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-primary-900 bg-surface/80 px-2 py-1 rounded-xl border border-primary-edge shrink-0 hidden sm:inline">
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

              <div className={`p-5 rounded-3xl border bg-surface shadow-md ${isMentor ? 'border-primary-edge' : 'border-success-edge'} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${isMentor ? 'bg-primary-100 text-primary-900 border border-primary-edge' : 'bg-success-100 text-success-900 border border-success-edge'}`}>
                      <span>{isMentor ? '🧑‍🏫' : '🙋‍♂️'}</span>
                      <span>{isMentor ? '教えるよ (先輩)' : '教えてほしい (後輩)'}</span>
                    </div>
                    {selectedCommStyles.map((st) => (
                      <span key={st} className="px-2.5 py-0.5 rounded-full text-[11px] font-black border bg-surface-subtle text-foreground-soft border-border">
                        {st === 'VC通話' ? '🎙️ VC通話' : st === '聞き専OK' ? '🎧 聞き専' : st === 'テキスト' ? '💬 テキスト' : '📺 画面共有'}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-success-700 font-black bg-success-50 px-2 py-0.5 rounded-full border border-success-edge-soft">🟢 募集中</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    {initialProfile?.player_name || user?.displayName || user?.username || 'あなたのプレイヤー名'}
                    <span className="text-xs font-mono font-bold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-lg border border-primary-edge">
                      🏆 {currentRank}
                    </span>
                  </h3>
                  {roleType === 'PUPIL' && targetRank && (
                    <div className="text-xs text-success-700 font-bold flex items-center gap-1">
                      <span>🎯 目標ランク:</span>
                      <span className="font-black underline">{targetRank}</span>
                    </div>
                  )}
                  {roleType === 'MENTOR' && targetRank && (
                    <div className="text-xs text-primary-800 font-bold flex items-center gap-1">
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
                            src={getChampIcon(c)}
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
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${isMentor ? 'bg-primary-50 text-primary-900 border-primary-edge' : 'bg-success-50 text-success-900 border-success-edge'}`}
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
                  <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[11px] flex items-center justify-center font-black">1</span>
                  参加するスタンス
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('PUPIL')}
                    className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden cursor-pointer ${
                      roleType === 'PUPIL'
                        ? 'bg-success-50 border-success-edge-strong text-success-950 ring-2 ring-success-500/30 shadow-md'
                        : 'bg-background border-border text-muted hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-black text-success-800 flex items-center gap-1.5">
                        <span>🙋‍♂️</span> 教えてほしい (後輩)
                      </div>
                      {roleType === 'PUPIL' && <Check size={16} className="text-success-600 font-bold" />}
                    </div>
                    <div className="text-[11px] font-medium text-muted mt-1">
                      気軽にアドバイスを聞きたい・立ち回りやチャンプを教わりたい
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!canBeMentor && !initialProfile) {
                        alert(
                          `先輩カードを登録できるのは、定期カスタムに15戦以上参加した「👑 常連」または「🎖️ 経験者」メンバー限定です。\n（現在のステータス: ${userTier?.label || 'ライト層'} / 通算${userTier?.totalGames || 0}戦）\nまずは「教えてほしい (後輩)」として相談したり、定期カスタムへの参加経験を重ねましょう！`
                        );
                        return;
                      }
                      handleRoleChange('MENTOR');
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden cursor-pointer ${
                      roleType === 'MENTOR'
                        ? 'bg-primary-50 border-primary-edge-strong text-primary-950 ring-2 ring-primary-500/30 shadow-md'
                        : 'bg-background border-border text-muted hover:bg-surface-subtle'
                    } ${!canBeMentor && !initialProfile ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-base font-black text-primary-800 flex items-center gap-1.5">
                        <span>🧑‍🏫</span> 教えるよ (先輩)
                      </div>
                      {roleType === 'MENTOR' && <Check size={16} className="text-primary-600 font-bold" />}
                      {!canBeMentor && !initialProfile && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-secondary-100 text-secondary-900 border border-secondary-edge">
                          👑常連・経験者限定
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-muted mt-1">
                      得意なレーンやチャンプのコツをシェアしたい・相談に乗れる
                    </div>
                  </button>
                </div>
                {!canBeMentor && !initialProfile && (
                  <p className="text-[11px] text-muted-strong font-medium mt-2 flex items-center gap-1">
                    <span>💡</span>
                    <span>先輩カード（教えるよ）は、定期カスタムに15戦以上参加した「👑 常連」または「🎖️ 経験者」のみ登録可能です。</span>
                  </p>
                )}
              </div>

              {/* 2. レーン選択 */}
              <div>
                <label className="block text-xs font-black text-foreground-subtle mb-1.5 flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[11px] flex items-center justify-center font-black">2</span>
                  メインレーン (1つ選択)
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
                            ? 'bg-primary-600 text-white border-primary-edge-strong shadow-sm scale-105 ring-2 ring-primary-400'
                            : 'bg-background border-border text-foreground-subtle hover:bg-surface-subtle'
                        }`}
                      >
                        {lane.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. ランク ＆ 活動時間帯 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-foreground-subtle mb-1 flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[11px] flex items-center justify-center font-black">3</span>
                    現在のランク
                  </label>
                  <select
                    value={currentRank}
                    onChange={(e) => setCurrentRank(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-xs font-bold focus:border-primary-edge-strong focus:bg-surface focus:outline-hidden"
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground-subtle mb-1 flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[11px] flex items-center justify-center font-black">⏰</span>
                    活動しやすい時間帯
                  </label>
                  <input
                    type="text"
                    value={activeHours}
                    onChange={(e) => setActiveHours(e.target.value)}
                    placeholder="例: 平日 21:00〜24:00 / 休日 昼〜夜"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground text-xs font-medium focus:border-primary-edge-strong focus:bg-surface focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 4. チャンピオン選択 (日本語インクリメンタル検索＆チップ) */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-foreground-subtle flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[11px] flex items-center justify-center font-black">4</span>
                    {roleType === 'PUPIL' ? '教えてほしい・練習中チャンピオン' : '得意・教えられるチャンピオン'} (最大8体)
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
                          src={getChampIcon(champId)}
                          alt={champId}
                          className="w-5 h-5 rounded-lg object-cover"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <span>{CHAMPION_JA[champId]?.ja || champId}</span>
                        <button
                          type="button"
                          onClick={() => removeChampion(champId)}
                          className="text-faint hover:text-danger-600 hover:bg-surface-subtle rounded-full w-4 h-4 flex items-center justify-center ml-0.5 transition cursor-pointer"
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
                      className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-foreground text-xs font-medium focus:border-primary-edge-strong focus:bg-surface focus:outline-hidden"
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
                              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary-50 text-left transition group cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={getChampIcon(champId)}
                                  alt={champId}
                                  className="w-6 h-6 rounded-lg object-cover"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                                <div>
                                  <span className="text-xs font-bold text-foreground group-hover:text-primary-800">
                                    {ja}
                                  </span>
                                  <span className="text-[10px] text-muted-strong ml-1.5 font-mono">
                                    ({champId})
                                  </span>
                                </div>
                              </div>
                              <Plus size={14} className="text-faint group-hover:text-primary-600" />
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

              {/* 5. 通話・相談スタイル (複数選択可能) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-foreground-subtle flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[11px] flex items-center justify-center font-black">5</span>
                    通話・相談スタイル (複数選択OK)
                  </label>
                  <span className="text-[11px] text-muted-strong font-bold">
                    {selectedCommStyles.length}個 選択中
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {COMMUNICATION_STYLES.map((style) => {
                    const isSelected = selectedCommStyles.includes(style.id);
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => toggleCommStyle(style.id)}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-edge-strong text-primary-950 dark:text-primary-200 ring-2 ring-primary-500/30 shadow-xs'
                            : 'bg-background border-border text-foreground-subtle hover:bg-surface-subtle'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">{style.label}</span>
                          <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black border transition ${
                            isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-border bg-surface'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted mt-1 leading-snug">
                          {style.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. ひとことメッセージ ＆ 例文テンプレート */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="block text-xs font-black text-foreground-subtle flex items-center gap-1.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-primary-500 text-white text-[11px] flex items-center justify-center font-black">6</span>
                    ひとことメッセージ
                  </label>
                  <span className="text-[11px] text-primary-700 font-bold flex items-center gap-1">
                    📝 例文タップで自動入力OK
                  </span>
                </div>

                {/* テンプレートボタン群 */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {currentTemplates.map((tmpl) => (
                    <button
                      key={tmpl.title}
                      type="button"
                      onClick={() => applyTemplate(tmpl.text)}
                      className="px-2.5 py-1 rounded-xl bg-surface-subtle border border-border hover:border-primary-edge text-foreground-subtle hover:text-primary-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>📝</span> {tmpl.title}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="教えてほしいことや得意なこと、気軽にメッセージを書いてみましょう（上の例文ボタンを押すと簡単に入力できます）..."
                  className="w-full bg-background border border-border rounded-2xl p-3 text-foreground text-xs focus:border-primary-edge-strong focus:bg-surface focus:outline-hidden leading-relaxed font-medium"
                />
              </div>

              {/* 7. 登録中のテーマタグ（不要なタグの消去・全削除） */}
              {selectedTags.length > 0 && (
                <div className="space-y-2 p-3.5 bg-background border border-border rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-foreground-subtle flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>登録中のテーマタグ ({selectedTags.length}件)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedTags([])}
                      className="text-[11px] font-bold text-danger-600 hover:text-danger-700 hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <span>🗑️</span>
                      <span>すべてのテーマタグを削除</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-muted leading-tight">
                    不要なタグは「✕」を押して個別に削除できます。空にすると通話・相談スタイルのみのスマート表示になります。
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-surface border border-border text-foreground shadow-2xs"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-danger-600 hover:bg-surface-subtle transition cursor-pointer text-[10px]"
                          title="このタグを削除"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                  ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-900/20'
                  : 'bg-success-600 hover:bg-success-500 text-white shadow-success-900/20'
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
