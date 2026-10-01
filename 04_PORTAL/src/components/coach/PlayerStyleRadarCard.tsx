'use client';

import React, { useState } from 'react';
import {
  Shield,
  Zap,
  Target,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Award,
  Swords,
  Crosshair,
  TrendingUp,
  Flame,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { KAZURIN_STYLE_PROFILE, RADAR_HISTORY_TIMELINE, KAZURIN_VISION_METRICS, PROFILE_SNAPSHOT_DATE, RadarHistoryPoint } from '../../lib/playerStyleProfile';
import { Eye, ShieldCheck, MapPin } from 'lucide-react';

// プレイスタイルの4大タイプ
const PLAY_STYLE_TYPES = [
  {
    id: 'farmer_scaler',
    name: 'ファームスケーリング＆セーフティ型',
    badge: '現在のKazurinタイプ',
    icon: '🌾',
    color: 'emerald',
    desc: '無駄死にを極限まで排除し、正確なジャングルルートで確実にゴールド差をつける高安定スタイル。',
    pros: 'ゲーム終盤のアイテム先行、逆転率の高さ、ティルトしにくい安定感',
    cons: '序盤15分に敵JGの能動的ガンクで味方レーンが崩壊した際に試合展開が重くなる',
    recommendedChamps: ['Lillia', 'Graves', 'Shyvana', 'Karthus', 'Viego'],
  },
  {
    id: 'invader_counter',
    name: 'インベード侵略＆カウンター型',
    badge: '次のステップ推奨',
    icon: '⚔️',
    color: 'amber',
    desc: '敵JGの初動を読み切り、敵陣のキャンプを奪う・カウンターガンクで敵の行動を無効化するスタイル。',
    pros: '低リスクで敵JGを完全に腐らせ、味方の安全を間接的に確保できる',
    cons: '味方レーンのプッシュ状況（プライオリティ）を見誤ると孤立死するリスク',
    recommendedChamps: ['Nidalee', 'Graves', 'Kindred', 'Talon'],
  },
  {
    id: 'gank_snowball',
    name: 'アグレッシブ・ガンカー型',
    badge: '弱点克服型',
    icon: '⚡',
    color: 'rose',
    desc: 'ファームを必要最小限に抑え、序盤からハイペースにレーンへ干渉して味方をスノーボールさせる。',
    pros: '15分以内の降伏勝ちを量産可能、味方のメンタルを保ちやすい',
    cons: 'ガンク失敗時のCS遅れが大きく、失敗が続くと急速に腐る',
    recommendedChamps: ['XinZhao', 'JarvanIV', 'Nocturne', 'LeeSin'],
  },
  {
    id: 'controller_tank',
    name: '集団戦コントロール＆タンク型',
    badge: 'チーム支援型',
    icon: '🛡️',
    color: 'sky',
    desc: '視界確保とオブジェクト管理を徹底し、集団戦のイニシエートで試合を支配するチームプレイ重視スタイル。',
    pros: '味方のキャリーが育ったときの勝率が跳ね上がる、構成事故が起きにくい',
    cons: 'ソロQで味方キャリーが機能しないときに1人で試合を決めきれない',
    recommendedChamps: ['Zac', 'Amumu', 'Sejuani', 'Maokai'],
  },
];

export default function PlayerStyleRadarCard() {
  const p = KAZURIN_STYLE_PROFILE;
  const history = RADAR_HISTORY_TIMELINE;
  const vision = KAZURIN_VISION_METRICS;
  const [activeTab, setActiveTab] = useState<'profile' | 'timeline' | 'vision' | 'types'>('profile');
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number>(history.length - 1);

  const selectedPeriod = history[selectedPeriodIdx];
  const prevPeriod = selectedPeriodIdx > 0 ? history[selectedPeriodIdx - 1] : null;

  return (
    <div className="rounded-3xl border border-border/90 bg-surface/95 p-5 shadow-xs space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>プレイスタイル深層特性カルテ</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-surface-subtle text-muted border border-border rounded-full" title="your.ggから手入力で記録した固定値です。試合ごとに自動更新はされません。">
                {PROFILE_SNAPSHOT_DATE} 時点の手入力値
              </span>
            </h3>
            <p className="text-[11px] text-muted-strong font-mono">
              {p.summonerName} | {p.tier} ({p.role} メイン)
            </p>
          </div>
        </div>

        {/* タブ切り替えボタン */}
        <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-2 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'profile' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-strong hover:text-foreground-soft'
            }`}
          >
            📈 現在
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-2 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'timeline' ? 'bg-surface text-foreground shadow-2xs text-primary-700' : 'text-muted-strong hover:text-foreground-soft'
            }`}
          >
            📊 5大推移
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vision')}
            className={`px-2 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'vision' ? 'bg-surface text-primary-700 font-black shadow-2xs' : 'text-muted-strong hover:text-foreground-soft'
            }`}
          >
            👁️ 視界解析
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('types')}
            className={`px-2 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'types' ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-strong hover:text-foreground-soft'
            }`}
          >
            🧭 4大比較
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. 現在のカルテタブ */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-4 animate-in fade-in">
          {/* プレイスタイル総合評価バナー */}
          <div className="rounded-2xl border border-emerald-200 bg-success-50/50 p-3.5 flex items-start gap-3">
            <span className="text-2xl">🛡️</span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-success-950">タイプ: ファームスケーリング＆セーフティ型</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-success-200/80 text-success-900 rounded-md">
                  安定度 S
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed font-medium">
                {p.diagnosisSummary}
              </p>
            </div>
          </div>

          {/* 5大指標レーダーバー */}
          <div className="rounded-2xl border border-border bg-background/50 p-4 space-y-3">
            <div className="text-xs font-black text-foreground-soft flex items-center justify-between">
              <span>📊 プレイスタイル 5大レーダー解析</span>
              <span className="text-[10px] text-faint font-normal">同ランク比較（{PROFILE_SNAPSHOT_DATE} 時点の手入力値）</span>
            </div>

            <div className="space-y-2.5">
              {/* 生存力 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-success-700 flex items-center gap-1">
                    <Shield size={12} /> 生存率・デス回避 (Survival)
                  </span>
                  <span className="text-foreground font-black">96点 <span className="text-[10px] text-success-600 font-normal">(上位4%)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                  <div className="h-full bg-success-500 rounded-full" style={{ width: '96%' }} />
                </div>
              </div>

              {/* ファーム効率 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-secondary-700 flex items-center gap-1">
                    <Zap size={12} /> 15分CSリード (CSD@15)
                  </span>
                  <span className="text-foreground font-black">88点 <span className="text-[10px] text-secondary-600 font-normal">(上位12% / +13.9CS)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                  <div className="h-full bg-secondary-500 rounded-full" style={{ width: '88%' }} />
                </div>
              </div>

              {/* 序盤戦闘関与 (ボトルネック) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-danger-700 flex items-center gap-1">
                    <AlertTriangle size={12} /> 15分キル関与 (KP@15) <span className="text-[10px] bg-danger-100 text-danger-800 px-1.5 py-0.2 rounded font-black">要改善</span>
                  </span>
                  <span className="text-danger-600 font-black">35点 <span className="text-[10px] font-normal">(下位3% / 35%関与)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                  <div className="h-full bg-danger-500 rounded-full" style={{ width: '35%' }} />
                </div>
              </div>

              {/* オブジェクト管理 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-primary-700 flex items-center gap-1">
                    <Target size={12} /> オブジェクト確保 (Obj Control)
                  </span>
                  <span className="text-foreground font-black">74点 <span className="text-[10px] text-primary-700 font-normal">(標準以上)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: '74%' }} />
                </div>
              </div>

              {/* 集団戦ポジショニング */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-primary-700 flex items-center gap-1">
                    <Crosshair size={12} /> 集団戦ポジショニング (Teamfight)
                  </span>
                  <span className="text-foreground font-black">82点 <span className="text-[10px] text-primary-600 font-normal">(高KDA維持)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* ボトルネック深掘り ＆ 典型的負け筋の克服 */}
          <div className="rounded-2xl border border-amber-300 bg-primary-50/60 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-primary-950">
              <span className="p-1 rounded-md bg-primary-200 text-primary-900">⚠️</span>
              <span>勝率を跳ね上げる「ボトルネック解消」の急所</span>
            </div>
            <p className="text-xs text-foreground-subtle leading-relaxed font-medium">
              {p.coreBottleNeck}
            </p>
            <div className="rounded-xl border border-amber-400/60 bg-surface p-3 space-y-1">
              <div className="text-[11px] font-black text-primary-900 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-primary-600" />
                <span>今日のソロQで実践する具体的アクション:</span>
              </div>
              <p className="text-xs text-foreground-soft font-bold leading-relaxed">
                {p.actionGuideline}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 📊 5大推移トレンドタブ */}
      {/* ========================================================================= */}
      {activeTab === 'timeline' && (
        <div className="space-y-4 animate-in fade-in">
          {/* 期間選択ピル */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground-subtle">
              <span className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-primary-600" />
                <span>時系列スコア推移（過去スプリット比較）</span>
              </span>
              <span className="text-[10px] text-faint font-medium">
                期間をタップして比較
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {history.map((pt, idx) => {
                const isSelected = selectedPeriodIdx === idx;
                return (
                  <button
                    key={pt.period}
                    type="button"
                    onClick={() => setSelectedPeriodIdx(idx)}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                      isSelected
                        ? 'border-amber-500 bg-primary-50/80 shadow-xs ring-2 ring-primary-400/40'
                        : 'border-border bg-background/70 hover:bg-surface-subtle hover:border-border'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-muted-strong truncate">
                      {pt.period}
                    </div>
                    <div className="text-xs font-black text-foreground truncate">
                      {pt.label}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-primary-700">
                      <span>{pt.gamesCount}戦</span>
                      <span>• KDA {pt.avgKda}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 選択期間の推移ハイライトサマリー */}
          <div className="rounded-2xl border border-border bg-background/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📌</span>
                <div>
                  <div className="text-xs font-black text-foreground">
                    {selectedPeriod.label} の特性 ＆ 総括
                  </div>
                  <div className="text-[10px] text-muted-strong">
                    {selectedPeriod.period} ({selectedPeriod.gamesCount}試合)
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black text-success-700">
                  平均被デス {selectedPeriod.avgDeaths}
                </div>
                <div className="text-[10px] font-bold text-muted-strong">
                  CS差 +{selectedPeriod.csd15} / KP {selectedPeriod.kp15}%
                </div>
              </div>
            </div>
            <p className="text-xs text-muted leading-relaxed font-medium bg-surface/80 p-2.5 rounded-xl border border-border/70">
              {selectedPeriod.summary}
            </p>
          </div>

          {/* 5大指標の推移バー ＆ 変化差分 */}
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3.5 shadow-2xs">
            <div className="text-xs font-black text-foreground-soft flex items-center justify-between border-b border-stone-100 pb-2">
              <span>📊 5大指標スコアの変化</span>
              {prevPeriod && (
                <span className="text-[10px] text-muted-strong font-bold">
                  （前期間 {prevPeriod.label} との比較）
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* ① 生存率 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-success-700 flex items-center gap-1">
                    <Shield size={12} /> ① 生存率・デス回避
                  </span>
                  <div className="flex items-center gap-2">
                    {prevPeriod && (
                      <span className={`text-[10px] font-black ${selectedPeriod.survival >= prevPeriod.survival ? 'text-success-600' : 'text-danger-500'}`}>
                        {selectedPeriod.survival >= prevPeriod.survival ? `▲ +${selectedPeriod.survival - prevPeriod.survival}` : `▼ -${prevPeriod.survival - selectedPeriod.survival}`}
                      </span>
                    )}
                    <span className="text-foreground font-black">{selectedPeriod.survival}点</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden">
                  <div className="h-full bg-success-500 rounded-full transition-all duration-500" style={{ width: `${selectedPeriod.survival}%` }} />
                </div>
              </div>

              {/* ② 15分CSリード */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-secondary-700 flex items-center gap-1">
                    <Zap size={12} /> ② 15分CSリード (CSD@15)
                  </span>
                  <div className="flex items-center gap-2">
                    {prevPeriod && (
                      <span className={`text-[10px] font-black ${selectedPeriod.farm >= prevPeriod.farm ? 'text-success-600' : 'text-danger-500'}`}>
                        {selectedPeriod.farm >= prevPeriod.farm ? `▲ +${selectedPeriod.farm - prevPeriod.farm}` : `▼ -${prevPeriod.farm - selectedPeriod.farm}`}
                      </span>
                    )}
                    <span className="text-foreground font-black">{selectedPeriod.farm}点</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden">
                  <div className="h-full bg-secondary-500 rounded-full transition-all duration-500" style={{ width: `${selectedPeriod.farm}%` }} />
                </div>
              </div>

              {/* ③ 15分キル関与 (弱点克服の焦点) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-danger-700 flex items-center gap-1">
                    <AlertTriangle size={12} /> ③ 15分キル関与 (KP@15)
                    <span className="text-[10px] bg-danger-100 text-danger-800 px-1.5 py-0.2 rounded font-black">重点克服</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {prevPeriod && (
                      <span className={`text-[10px] font-black ${selectedPeriod.combat >= prevPeriod.combat ? 'text-success-600' : 'text-danger-500'}`}>
                        {selectedPeriod.combat >= prevPeriod.combat ? `▲ +${selectedPeriod.combat - prevPeriod.combat} (改善中!)` : `▼ -${prevPeriod.combat - selectedPeriod.combat}`}
                      </span>
                    )}
                    <span className="text-danger-600 font-black">{selectedPeriod.combat}点 ({selectedPeriod.kp15}%)</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden">
                  <div className="h-full bg-danger-500 rounded-full transition-all duration-500" style={{ width: `${selectedPeriod.combat}%` }} />
                </div>
              </div>

              {/* ④ オブジェクト確保 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-primary-700 flex items-center gap-1">
                    <Target size={12} /> ④ オブジェクト確保 (Obj Control)
                  </span>
                  <div className="flex items-center gap-2">
                    {prevPeriod && (
                      <span className={`text-[10px] font-black ${selectedPeriod.objectives >= prevPeriod.objectives ? 'text-success-600' : 'text-danger-500'}`}>
                        {selectedPeriod.objectives >= prevPeriod.objectives ? `▲ +${selectedPeriod.objectives - prevPeriod.objectives}` : `▼ -${prevPeriod.objectives - selectedPeriod.objectives}`}
                      </span>
                    )}
                    <span className="text-foreground font-black">{selectedPeriod.objectives}点</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${selectedPeriod.objectives}%` }} />
                </div>
              </div>

              {/* ⑤ 集団戦ポジショニング */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-primary-700 flex items-center gap-1">
                    <Crosshair size={12} /> ⑤ 集団戦ポジショニング (Teamfight)
                  </span>
                  <div className="flex items-center gap-2">
                    {prevPeriod && (
                      <span className={`text-[10px] font-black ${selectedPeriod.teamfight >= prevPeriod.teamfight ? 'text-success-600' : 'text-danger-500'}`}>
                        {selectedPeriod.teamfight >= prevPeriod.teamfight ? `▲ +${selectedPeriod.teamfight - prevPeriod.teamfight}` : `▼ -${prevPeriod.teamfight - selectedPeriod.teamfight}`}
                      </span>
                    )}
                    <span className="text-foreground font-black">{selectedPeriod.teamfight}点</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-subtle overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${selectedPeriod.teamfight}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* 成長トレンドの総括バナー */}
          <div className="rounded-2xl border border-emerald-300 bg-success-50/70 p-3.5 flex items-start gap-2.5">
            <span className="text-xl">📈</span>
            <div className="space-y-0.5 text-xs text-foreground-subtle">
              <div className="font-black text-success-950">
                克服トレンドの成果: 15分キル関与率 +7%（28% ➔ 35%）
              </div>
              <p className="leading-relaxed font-medium">
                「1周目ファーム完了後のレーン干渉・逆サイド荒らし」の意識付けにより、生存率（96点）とCSリード（88点）の圧倒的な強みを維持したまま、序盤のレーン崩壊防止力が着実に向上しています。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 👁️ 視界・コントロール解析タブ */}
      {/* ========================================================================= */}
      {activeTab === 'vision' && (
        <div className="space-y-4 animate-in fade-in">
          {/* 視界総合評価バナー */}
          <div className="rounded-2xl border border-amber-200 bg-primary-50/60 p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">👁️</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-primary-950">
                    視界総合評価: {vision.visionScoreTier}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-primary-200 text-primary-900 rounded-md">
                    上位 {vision.visionRankPercentile}%
                  </span>
                </div>
                <p className="text-xs text-foreground-subtle leading-relaxed font-medium">
                  {vision.strengthsSummary}
                </p>
              </div>
            </div>
          </div>

          {/* 4大 視界客観メトリクスグリッド */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 分間視界スコア */}
            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-muted-strong flex items-center justify-between">
                <span>分間視界スコア (VS/m)</span>
                <span className="text-primary-600 font-bold">上位18%</span>
              </div>
              <div className="text-base font-black text-foreground">
                {vision.visionScorePerMin} <span className="text-xs font-normal text-faint">/分</span>
              </div>
              <div className="text-[10px] text-success-700 font-bold">
                同帯平均 (1.18) 対比 +37%
              </div>
            </div>

            {/* コントロールワード */}
            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-muted-strong flex items-center justify-between">
                <span>ピンクワード購入</span>
                <span className="text-success-600 font-bold">高水準</span>
              </div>
              <div className="text-base font-black text-foreground">
                {vision.controlWardsPerGame} <span className="text-xs font-normal text-faint">本 / 試合</span>
              </div>
              <div className="text-[10px] text-muted-strong font-bold">
                平均生存: {vision.controlWardAvgLifetimeSec}秒
              </div>
            </div>

            {/* ワード設置 */}
            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-muted-strong flex items-center justify-between">
                <span>分間ワード設置</span>
                <span className="text-faint">Placing</span>
              </div>
              <div className="text-base font-black text-foreground">
                {vision.wardsPlacedPerMin} <span className="text-xs font-normal text-faint">個 / 分</span>
              </div>
              <div className="text-[10px] text-muted-strong">
                1試合 約20〜25個
              </div>
            </div>

            {/* 敵ワード破壊 */}
            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-muted-strong flex items-center justify-between">
                <span>分間ワード破壊</span>
                <span className="text-faint">Clearing</span>
              </div>
              <div className="text-base font-black text-foreground">
                {vision.wardsClearedPerMin} <span className="text-xs font-normal text-faint">個 / 分</span>
              </div>
              <div className="text-[10px] text-muted-strong">
                レンズ・植物活用
              </div>
            </div>
          </div>

          {/* 視界配置バランス（ディープ 24% vs 防衛 76%） */}
          <div className="p-4 bg-surface rounded-2xl border border-border shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-black text-foreground-soft">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-primary-600" />
                <span>視界配置バランス ＆ 侵入深度</span>
              </span>
              <span className="text-[10px] text-muted-strong">
                自陣防衛 {vision.defensiveWardRatioPercent}% / 敵陣ディープ {vision.deepWardRatioPercent}%
              </span>
            </div>

            {/* 2色スプリットプログレスバー */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-surface-subtle flex overflow-hidden">
                <div
                  className="h-full bg-success-500"
                  style={{ width: `${vision.defensiveWardRatioPercent}%` }}
                  title={`自陣・リバー防衛視界: ${vision.defensiveWardRatioPercent}%`}
                />
                <div
                  className="h-full bg-primary-500"
                  style={{ width: `${vision.deepWardRatioPercent}%` }}
                  title={`敵ジャングル深部ディープ視界: ${vision.deepWardRatioPercent}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-success-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success-500" />
                  自陣・ドラゴン防衛視界 ({vision.defensiveWardRatioPercent}%)
                </span>
                <span className="text-primary-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary-500" />
                  敵陣ディープ視界 ({vision.deepWardRatioPercent}%)
                </span>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed font-medium bg-background p-2.5 rounded-xl border border-border/60">
              {vision.bottleneckSummary}
            </p>
          </div>

          {/* 視界アクションアドバイス */}
          <div className="rounded-2xl border border-amber-300 bg-primary-50/70 p-3.5 space-y-1">
            <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary-600" />
              <span>客観データから導く「視界の急所アクション」:</span>
            </div>
            <p className="text-xs text-foreground-soft font-bold leading-relaxed">
              {vision.actionAdvice}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. 4大スタイル比較タブ */}
      {/* ========================================================================= */}
      {activeTab === 'types' && (
        <div className="space-y-3 animate-in fade-in">
          <p className="text-xs text-muted-strong">
            ジャングラーの4つの基本プレイスタイルです。自分の強みを活かしつつ、敵構成や味方に合わせてスタイルを調整できます。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PLAY_STYLE_TYPES.map((t) => (
              <div
                key={t.id}
                className={`rounded-2xl border p-4 space-y-2 transition ${
                  t.id === 'farmer_scaler'
                    ? 'border-emerald-400 bg-success-50/40 shadow-xs'
                    : 'border-border bg-surface hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <span className="font-black text-xs text-foreground">{t.name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.id === 'farmer_scaler'
                        ? 'bg-success-200 text-success-900'
                        : 'bg-surface-subtle text-muted'
                    }`}
                  >
                    {t.badge}
                  </span>
                </div>

                <p className="text-xs text-muted leading-relaxed font-medium">{t.desc}</p>

                <div className="pt-1 space-y-1 text-[11px]">
                  <div className="text-success-700 font-bold">
                    <span className="text-faint">強み:</span> {t.pros}
                  </div>
                  <div className="text-danger-700 font-bold">
                    <span className="text-faint">弱み:</span> {t.cons}
                  </div>
                  <div className="text-foreground-subtle font-bold pt-0.5">
                    <span className="text-faint">相性◎:</span> {t.recommendedChamps.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 5問セルフ診断テスト */}
      {/* ========================================================================= */}
    </div>
  );
}
