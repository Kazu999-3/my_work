"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Swords, Shield, Zap, AlertTriangle, Play, BookOpen, 
  ExternalLink, Sparkles, CheckCircle2, ChevronRight, Eye, 
  ShieldAlert, ShieldCheck, Flame, Layers, ArrowUpRight
} from 'lucide-react';
import { getSpellIcon, getPassiveIcon, getChampIcon } from '../../../lib/ddragonClient';
import MatchupBlueprintCard from '../../coach/MatchupBlueprintCard';

interface ChampionVisualDashboardProps {
  champion: any; // DDragon champion object
  dataFields: any; // Supabase/local dictionary fields
  onOpenTactics?: () => void;
}

export default function ChampionVisualDashboard({
  champion,
  dataFields,
  onOpenTactics,
}: ChampionVisualDashboardProps) {
  const [activeTab, setActiveTab] = useState<'build' | 'matchup' | 'bible' | 'video'>('build');
  const [buildPreset, setBuildPreset] = useState<'standard' | 'tank' | 'burst'>('standard');
  const [activeVideoPlayer, setActiveVideoPlayer] = useState<{ videoId: string; startSeconds: number; title: string } | null>(null);
  const [tacticsData, setTacticsData] = useState<{
    exists: boolean;
    traps: string[];
    matchups: Array<{ enemy: string; result: string; learning: string; date?: string; trap?: string }>;
    videoClips?: Array<{ timestamp: string; url: string; title: string; why: string; how: string; rejected: string }>;
    rawContent?: string;
  } | null>(null);
  const [loadingTactics, setLoadingTactics] = useState(false);

  const champId = champion?.id || 'Aatrox';
  const spells = champion?.spells || [];
  const passive = champion?.passive;

  // スキルキー
  const skillKeys = ['Q', 'W', 'E', 'R'];

  // ローカル戦術バイブルの自動取得
  useEffect(() => {
    if (!champId) return;
    setLoadingTactics(true);
    fetch(`/api/champions/tactics?champion=${encodeURIComponent(champId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTacticsData({
            exists: data.exists,
            traps: data.traps || [],
            matchups: data.matchups || [],
            videoClips: data.videoClips || [],
            rawContent: data.rawContent || '',
          });
        }
      })
      .catch((e) => console.warn('[ChampionVisualDashboard] Tactics fetch failed:', e))
      .finally(() => setLoadingTactics(false));
  }, [champId]);

  // 推奨スキル先行順（パースまたはフォールバック）
  const skillPriority = (() => {
    if (dataFields?.skill_order) return dataFields.skill_order;
    // デフォルトの推定
    return ['Q', 'E', 'W'];
  })();

  // 相性マトリクス（対面の有利不利）
  const matchupCounters = (() => {
    const raw = dataFields?.counterChampions || '';
    // 有利・不利の簡易パース
    const lines = raw.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const goodAgainst: Array<{ name: string; note: string }> = [];
    const badAgainst: Array<{ name: string; note: string }> = [];

    let currentMode: 'good' | 'bad' = 'good';
    for (const l of lines) {
      if (l.includes('有利') || l.includes('勝ち') || l.includes('得意')) currentMode = 'good';
      else if (l.includes('不利') || l.includes('天敵') || l.includes('苦手')) currentMode = 'bad';
      else {
        const cleaned = l.replace(/^[-*•\s\d.]+/, '');
        const parts = cleaned.split(/[:：-]/);
        const name = parts[0]?.trim() || 'Champion';
        const note = parts[1]?.trim() || '間合い管理徹底';
        if (currentMode === 'good' && goodAgainst.length < 5) goodAgainst.push({ name, note });
        else if (currentMode === 'bad' && badAgainst.length < 5) badAgainst.push({ name, note });
      }
    }

    // デフォルトフォールバック
    if (goodAgainst.length === 0) {
      goodAgainst.push({ name: 'Sion', note: 'ウェーブ押し込み後のローム優位' }, { name: 'DrMundo', note: '回復阻害と序盤のトレード主導権' });
    }
    if (badAgainst.length === 0) {
      badAgainst.push({ name: 'Fiora', note: 'W受けと割合ダメージに注意' }, { name: 'Irelia', note: 'スタック維持時のオールイン警戒' });
    }

    return { goodAgainst, badAgainst };
  })();

  return (
    <div className="w-full space-y-4">
      {/* 🚀 1. スキル先行順 ＆ クイックスキルHUD */}
      <div className="bg-stone-900/90 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4.5 backdrop-blur-md shadow-lg text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black tracking-wider uppercase">
              Skill HUD
            </span>
            <span className="text-xs font-bold text-stone-300">スキル構成 ＆ 推奨先行上げ順</span>
          </div>

          {/* スキル上げ優先順位バッジ */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] text-stone-400 font-bold">先行上げ:</span>
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-stone-950 font-black text-xs shadow-xs">
                {skillPriority[0] || 'Q'}
              </span>
              <ChevronRight size={14} className="text-stone-500" />
              <span className="px-2 py-0.5 rounded-md bg-stone-700 text-white font-black text-xs">
                {skillPriority[1] || 'E'}
              </span>
              <ChevronRight size={14} className="text-stone-500" />
              <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 font-black text-xs">
                {skillPriority[2] || 'W'}
              </span>
              <span className="text-[10px] text-stone-400 ml-1">（※Rは随時取得）</span>
            </div>
          </div>
        </div>

        {/* スキルアイコン列 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* パッシブ */}
          {passive && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-black/40 border border-white/5 hover:border-amber-500/30 transition-all">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-amber-400/40 shrink-0">
                <img
                  src={getPassiveIcon(passive.image?.full)}
                  alt={passive.name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 bg-stone-900/90 text-amber-400 text-[9px] font-black px-1 rounded-tl">
                  P
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-stone-200 block truncate" title={passive.name}>
                  {passive.name}
                </span>
                <span className="text-[10px] text-stone-400 block truncate">固有スキル</span>
              </div>
            </div>
          )}

          {/* Q, W, E, R */}
          {spells.slice(0, 4).map((spell: any, idx: number) => {
            const key = skillKeys[idx];
            return (
              <div key={spell.id || idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-black/40 border border-white/5 hover:border-amber-500/30 transition-all">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20 shrink-0">
                  <img
                    src={getSpellIcon(spell.image?.full)}
                    alt={spell.name}
                    className="w-full h-full object-cover"
                  />
                  <span className={`absolute bottom-0 right-0 text-[10px] font-black px-1.5 rounded-tl ${
                    key === 'R' ? 'bg-rose-600 text-white' : 'bg-stone-900/90 text-amber-300'
                  }`}>
                    {key}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-stone-100 block truncate" title={spell.name}>
                    {spell.name}
                  </span>
                  <span className="text-[10px] text-stone-400 block truncate">
                    CD: {spell.cooldownBurn || spell.cooldown?.[0]}s
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🧭 2. 中段 4大ビジュアルタブナビゲーション */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('build')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'build'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Swords size={14} /> ⚔️ 戦略・シチュエーション別ビルド
        </button>
        <button
          onClick={() => setActiveTab('matchup')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'matchup'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert size={14} /> 🥊 対面相性 ＆ キルライン
        </button>
        <button
          onClick={() => setActiveTab('bible')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'bible'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <BookOpen size={14} /> 📜 実戦バイブル ＆ 罠・没理由
          {tacticsData?.exists && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'video'
              ? 'bg-amber-500 text-stone-950 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Play size={14} /> 🎥 プロ実演クリップ
        </button>
      </div>

      {/* 📦 3. タブコンテンツ */}

      {/* タブ 1: 戦略・シチュエーション別ビルド */}
      {activeTab === 'build' && (
        <div className="space-y-4">
          {/* ビルドプリセット切り替え */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-stone-900 dark:text-white">
                  シチュエーション別ビルド分岐
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                  敵構成に合わせて即時選択
                </span>
              </div>

              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
                <button
                  onClick={() => setBuildPreset('standard')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    buildPreset === 'standard'
                      ? 'bg-white dark:bg-stone-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-white'
                  }`}
                >
                  標準コア
                </button>
                <button
                  onClick={() => setBuildPreset('tank')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    buildPreset === 'tank'
                      ? 'bg-white dark:bg-stone-700 text-rose-600 dark:text-rose-400 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-white'
                  }`}
                >
                  対タンク (貫通)
                </button>
                <button
                  onClick={() => setBuildPreset('burst')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    buildPreset === 'burst'
                      ? 'bg-white dark:bg-stone-700 text-sky-600 dark:text-sky-400 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-white'
                  }`}
                >
                  対バースト (高耐久)
                </button>
              </div>
            </div>

            {/* ビルド詳細カード */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-stone-800/60 border border-amber-200 dark:border-stone-700">
                <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase block mb-1">
                  1コア (ファースト完成)
                </span>
                <p className="font-bold text-stone-900 dark:text-white text-sm">
                  {buildPreset === 'standard' ? '赤月の刃 / スプリットコア' : buildPreset === 'tank' ? '黒斧 (Black Cleaver)' : 'ステラックの篭手 / デスダンス'}
                </p>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">
                  {buildPreset === 'standard' ? 'ダメージ最大化＆レーン主導権' : buildPreset === 'tank' ? '多段ヒットによるAR破砕＆MS加速' : '即死回避・シールド耐久'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-stone-800/60 border border-sky-200 dark:border-stone-700">
                <span className="text-[10px] font-black text-sky-800 dark:text-sky-400 uppercase block mb-1">
                  2〜3コア (集団戦スパイク)
                </span>
                <p className="font-bold text-stone-900 dark:text-white text-sm">
                  {buildPreset === 'standard' ? 'ショウジンの矛 ➔ デスダンス' : buildPreset === 'tank' ? 'サンダードスカイ ➔ セリルの怨恨' : 'デスダンス ➔ 精霊の容貌'}
                </p>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">
                  パワースパイクを迎える時間帯
                </span>
              </div>

              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-stone-800/60 border border-purple-200 dark:border-stone-700">
                <span className="text-[10px] font-black text-purple-800 dark:text-purple-400 uppercase block mb-1">
                  キーストーン推奨ルーン
                </span>
                <p className="font-bold text-stone-900 dark:text-white text-sm">
                  {buildPreset === 'standard' ? '征服者 (Conqueror)' : buildPreset === 'tank' ? '征服者 + 不撓不屈' : '不死者の握撃 / フリート'}
                </p>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">
                  {dataFields?.buildRunes ? dataFields.buildRunes.split('\n')[0].slice(0, 30) : '凱旋 / 迅速 / 背水の陣'}
                </span>
              </div>
            </div>
          </div>

          {/* パワースパイク分析 */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
            <h3 className="text-sm font-black text-stone-900 dark:text-white mb-2 flex items-center gap-2">
              <Zap size={16} className="text-amber-500" /> 時間帯別パワースパイク ＆ 立ち回り
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <span className="font-black text-amber-700 dark:text-amber-400 block mb-0.5">Lv1〜3 (序盤レーン戦)</span>
                <p className="text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed">
                  {dataFields?.powerSpikes ? dataFields.powerSpikes.split('\n')[0] : 'スキルを当てて主導権を取り、Lv2先行でウェーブをフリーズ。'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <span className="font-black text-emerald-700 dark:text-emerald-400 block mb-0.5">1コア〜Lv9 (中盤ローム)</span>
                <p className="text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed">
                  最も戦闘力が高いパワースパイク。ヘラルド・ドラゴン前にプッシュして視界制圧。
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700">
                <span className="font-black text-indigo-700 dark:text-indigo-400 block mb-0.5">集団戦 (終盤)</span>
                <p className="text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed">
                  正面から突っ込まず、側道から敵キャリーにCCを合わせ、耐久を活かして前線を維持。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* タブ 2: 対面相性 ＆ キルライン */}
      {activeTab === 'matchup' && (
        <div className="space-y-4">
          {/* 有利・不利マトリクス */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* カモ（有利 TOP5） */}
            <div className="bg-white dark:bg-stone-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-300">
                    🟢 有利な相手 (カモ TOP)
                  </h3>
                </div>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                  勝ちパターン確立済み
                </span>
              </div>
              <div className="space-y-2">
                {matchupCounters.goodAgainst.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-50/50 dark:bg-stone-800/50 border border-emerald-100 dark:border-emerald-900/30">
                    <img
                      src={getChampIcon(item.name)}
                      alt={item.name}
                      className="w-8 h-8 rounded-lg object-cover border border-emerald-400/40 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black text-stone-900 dark:text-white block">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-emerald-800 dark:text-emerald-400 font-medium block truncate">
                        {item.note}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 天敵（不利 TOP5） */}
            <div className="bg-white dark:bg-stone-900 border border-rose-500/30 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-500" />
                  <h3 className="text-sm font-black text-rose-950 dark:text-rose-300">
                    🔴 不利・天敵 (要注意 TOP)
                  </h3>
                </div>
                <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-full">
                  即死トリガー警戒
                </span>
              </div>
              <div className="space-y-2">
                {matchupCounters.badAgainst.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-rose-50/50 dark:bg-stone-800/50 border border-rose-100 dark:border-rose-900/30">
                    <img
                      src={getChampIcon(item.name)}
                      alt={item.name}
                      className="w-8 h-8 rounded-lg object-cover border border-rose-400/40 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black text-stone-900 dark:text-white block">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-rose-800 dark:text-rose-400 font-medium block truncate">
                        {item.note}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI実戦対面手順書 ＆ キルライン計算 */}
          <MatchupBlueprintCard enemyChampion={champId} />
        </div>
      )}

      {/* タブ 3: 実戦バイブル ＆ 罠・没理由 */}
      {activeTab === 'bible' && (
        <div className="space-y-4">
          {/* 罠・不採用ビルドの暴露エリア */}
          <div className="bg-gradient-to-r from-rose-950/20 via-stone-900/90 to-rose-950/20 border border-rose-500/40 rounded-2xl p-4 shadow-md text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-400" />
                <h3 className="text-sm font-black text-rose-200">
                  🚫 避けるべき罠・不採用ビルド（没理由）
                </h3>
              </div>
              <span className="text-[10px] bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                実戦検証済み
              </span>
            </div>

            {tacticsData?.traps && tacticsData.traps.length > 0 ? (
              <div className="space-y-2">
                {tacticsData.traps.map((trap, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs p-2.5 rounded-xl bg-black/40 border border-rose-500/20">
                    <span className="text-rose-400 font-bold shrink-0">❌</span>
                    <p className="text-stone-200 leading-relaxed font-medium">{trap}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-stone-400 p-3 rounded-xl bg-black/30 border border-white/5">
                初手王剣ラッシュ（耐久不足により即死リスク高、ステラックまたはデスダンス優先）。
              </div>
            )}
          </div>

          {/* 実戦対面ログ */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-amber-500" />
                <h3 className="text-sm font-black text-stone-900 dark:text-white">
                  ⚔️ 実戦対面アーカイブ (Matchup Logs)
                </h3>
              </div>
              <span className="text-[10px] text-stone-500 font-bold">
                {tacticsData?.matchups.length || 0} 件の実戦データ
              </span>
            </div>

            {tacticsData?.matchups && tacticsData.matchups.length > 0 ? (
              <div className="space-y-2.5">
                {tacticsData.matchups.map((m, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <img
                          src={getChampIcon(m.enemy)}
                          alt={m.enemy}
                          className="w-6 h-6 rounded-md object-cover"
                        />
                        <span className="font-black text-stone-900 dark:text-white text-xs">
                          vs {m.enemy}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          m.result === 'WIN'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {m.result === 'WIN' ? '🏆 勝利 (WIN)' : '💀 敗北 (LOSS)'}
                        </span>
                      </div>
                      {m.date && (
                        <span className="text-[10px] text-stone-400">{m.date}</span>
                      )}
                    </div>
                    <p className="text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed">
                      💡 {m.learning}
                    </p>
                    {m.trap && (
                      <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1">
                        ⚠️ 罠: {m.trap}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-stone-400 text-center py-6">
                まだ対面実戦ログが記録されていません。試合終了後に自動同期されます。
              </div>
            )}
          </div>
        </div>
      )}

      {/* タブ 4: プロ実演クリップ */}
      {activeTab === 'video' && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play size={16} className="text-rose-500" />
              <h3 className="text-sm font-black text-stone-900 dark:text-white">
                🎥 チャレンジャー／プロ実演アクションクリップ
              </h3>
            </div>
            <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2.5 py-0.5 rounded-full font-bold">
              {tacticsData?.videoClips?.length || 0} 件の重要シーン
            </span>
          </div>

          {/* 📺 インラインYouTubeプレイヤー（該当秒数から直接再生） */}
          {activeVideoPlayer && (
            <div className="rounded-2xl overflow-hidden border border-rose-500/40 bg-black shadow-xl space-y-2 p-2">
              <div className="flex items-center justify-between px-2 pt-1 text-xs">
                <span className="text-white font-bold truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  再生中: {activeVideoPlayer.title} ({Math.floor(activeVideoPlayer.startSeconds / 60)}:{(activeVideoPlayer.startSeconds % 60).toString().padStart(2, '0')}〜)
                </span>
                <button
                  onClick={() => setActiveVideoPlayer(null)}
                  className="text-stone-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/10 transition-colors"
                >
                  ✕ 閉じる
                </button>
              </div>
              <div className="relative w-full pb-[56.25%] h-0 rounded-xl overflow-hidden">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeVideoPlayer.videoId}?start=${activeVideoPlayer.startSeconds}&autoplay=1`}
                  title={activeVideoPlayer.title}
                  className="absolute top-0 left-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          <div className="space-y-3 text-xs">
            {tacticsData?.videoClips && tacticsData.videoClips.length > 0 ? (
              tacticsData.videoClips.map((clip, idx) => {
                // 秒数・ID抽出
                const idMatch = clip.url.match(/(?:youtu\.be\/|v=)([\w-]+)/);
                const vid = idMatch ? idMatch[1] : '';
                const tMatch = clip.url.match(/[?&]t=(\d+)/);
                const startSec = tMatch ? parseInt(tMatch[1], 10) : 0;

                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 dark:border-stone-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-black text-[11px] shadow-2xs">
                          {clip.timestamp}
                        </span>
                        <span className="font-black text-stone-900 dark:text-white text-xs">
                          {clip.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        {vid && (
                          <button
                            onClick={() => setActiveVideoPlayer({ videoId: vid, startSeconds: startSec, title: clip.title })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] transition-all shadow-2xs cursor-pointer"
                          >
                            <Play size={12} fill="currentColor" />
                            <span>ここで再生</span>
                          </button>
                        )}
                        <a
                          href={clip.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 font-bold text-[11px] transition-all"
                          title="YouTube別タブで開く"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>

                    {clip.why && (
                      <p className="text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed">
                        <span className="font-bold text-amber-600 dark:text-amber-400 mr-1">💡 理由:</span>
                        {clip.why}
                      </p>
                    )}
                    {clip.how && (
                      <p className="text-stone-700 dark:text-stone-300 text-[11px] leading-relaxed">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-1">🎯 コツ:</span>
                        {clip.how}
                      </p>
                    )}
                    {clip.rejected && (
                      <p className="text-rose-600 dark:text-rose-400 text-[11px] leading-relaxed">
                        <span className="font-bold mr-1">🚫 没理由:</span>
                        {clip.rejected}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 space-y-3">
                <p className="text-stone-400 text-xs">
                  まだこのチャンピオンの動画解析クリップが登録されていません。
                </p>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(champId + ' challenger gameplay guide')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-rose-500 hover:text-white text-stone-700 text-xs font-bold transition-all border border-stone-200"
                >
                  YouTubeで攻略動画を探す <ArrowUpRight size={14} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
