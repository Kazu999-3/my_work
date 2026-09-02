'use client';

import React, { useState, useEffect } from 'react';
import { Swords, Shield, Zap, Sparkles, AlertTriangle, Compass, Check, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';
import EarlyJunglePathingCard from './EarlyJunglePathingCard';

interface MatchupSmartCardProps {
  champion: string;
  enemyChampion: string;
  onSelectChampion?: (champ: string) => void;
}

export default function MatchupSmartCard({ champion, enemyChampion, onSelectChampion }: MatchupSmartCardProps) {
  const [counterData, setCounterData] = useState<any>(null);
  const [objectiveData, setObjectiveData] = useState<any>(null);
  const [warningData, setWarningData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!enemyChampion) {
      setCounterData(null);
      setObjectiveData(null);
      setWarningData(null);
      return;
    }

    let active = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        // 1. カウンターピック＆推奨ルーン
        const counterRes = fetch('/api/coach/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'counter_pick', enemyChampion })
        }).then(r => r.json()).catch(() => null);

        // 2. 5分オブジェクト方針診断
        const objRes = fetch('/api/coach/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'objective_priority', champion, enemyChampion })
        }).then(r => r.json()).catch(() => null);

        // 3. 過去の警戒メモ
        const warnRes = champion ? fetch('/api/soloq/matchup-warning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ champion, enemyChampion })
        }).then(r => r.json()).catch(() => null) : Promise.resolve(null);

        const [cData, oData, wData] = await Promise.all([counterRes, objRes, warnRes]);

        if (active) {
          if (cData && !cData.error) setCounterData(cData);
          if (oData && !oData.error) setObjectiveData(oData);
          if (wData && wData.warning) setWarningData(wData.warning);
        }
      } catch (e) {
        console.error('MatchupSmartCard fetch error:', e);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [champion, enemyChampion]);

  if (!enemyChampion) return null;

  return (
    <div className="bg-white/90 border-2 border-amber-300/80 rounded-2xl p-5 shadow-md space-y-4 animate-in">
      {/* ヘッダー: 対戦カード ＆ ステータス */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {champion ? (
              <Image
                src={getChampIcon(champion)}
                alt={champion}
                width={36}
                height={36}
                className="w-9 h-9 rounded-full border-2 border-amber-500 shadow-xs"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-300 flex items-center justify-center text-xs font-bold text-stone-400">?</div>
            )}
            <span className="font-black text-stone-900 text-sm">{champion || '未選択'}</span>
          </div>

          <span className="text-xs font-black text-amber-600 px-2 py-0.5 bg-amber-100/80 rounded-full">VS</span>

          <div className="flex items-center gap-2">
            <Image
              src={getChampIcon(enemyChampion)}
              alt={enemyChampion}
              width={36}
              height={36}
              className="w-9 h-9 rounded-full border-2 border-rose-500 shadow-xs"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="font-black text-rose-950 text-sm">{enemyChampion}</span>
          </div>
        </div>

        {loading && (
          <span className="text-xs font-bold text-amber-700 animate-pulse flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 animate-spin" /> AI即時分析中...
          </span>
        )}
      </div>

      {/* ① カウンターピック 3選（ワンタップ切り替えボタン） */}
      {counterData?.counters && counterData.counters.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Swords className="w-4 h-4 text-amber-600" />
              対 {enemyChampion} 有利カウンターピック (推奨)
            </h4>
            <span className="text-[10px] text-stone-400 font-bold">タップで使用チャンプにセット</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {counterData.counters.map((c: any) => {
              const isSelected = champion?.toLowerCase() === (c.nameJp || c.champion)?.toLowerCase() || champion?.toLowerCase() === c.champion?.toLowerCase();
              return (
                <button
                  key={c.champion}
                  type="button"
                  onClick={() => onSelectChampion && onSelectChampion(c.nameJp || c.champion)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-amber-100/90 border-amber-500 shadow-xs ring-2 ring-amber-400/40'
                      : 'bg-stone-50/70 border-stone-200/80 hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  <Image
                    src={getChampIcon(c.champion)}
                    alt={c.champion}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-lg border border-stone-300 shrink-0 shadow-2xs"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-stone-900 truncate">{c.nameJp || c.champion}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-stone-500 font-medium line-clamp-2 leading-tight mt-0.5">{c.reason}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ② 推奨ルーン ＆ 初手アイテム ＆ 序盤対策 */}
      {counterData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 text-xs">
          <div>
            <span className="font-extrabold text-amber-900 flex items-center gap-1 text-[11px] mb-1">
              <span>💎</span> 推奨キーストーン & 初手
            </span>
            <p className="text-stone-800 font-bold">
              {counterData.recommendedRune?.keystone || '征服者'} ({counterData.recommendedRune?.primaryTree} / {counterData.recommendedRune?.secondaryTree})
            </p>
            <p className="text-[11px] text-stone-600 mt-0.5">
              📦 初手: <strong className="text-stone-900">{counterData.starterItem || 'ドランブレード'}</strong>
            </p>
          </div>

          <div>
            <span className="font-extrabold text-amber-900 flex items-center gap-1 text-[11px] mb-1">
              <span>⚡</span> Lv1〜Lv3 初動攻略の核心
            </span>
            <p className="text-[11px] text-stone-700 font-medium leading-relaxed">
              {counterData.earlyLaningTip || '序盤は相手の主力スキル発動後の隙にダメージトレードを行いましょう。'}
            </p>
          </div>
        </div>
      )}

      {/* ③ 5分オブジェクト診断（ヴォイドグラブ vs ドラゴン方針） */}
      {objectiveData && (
        <div className="bg-gradient-to-r from-teal-50/80 to-emerald-50/80 border border-emerald-300/80 rounded-xl p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Compass className="w-4 h-4 text-emerald-700" />
              5分オブジェクト方針: <strong className="text-emerald-800 text-xs">{objectiveData.focusTitle}</strong>
            </span>
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-full border border-emerald-300">
              信頼度 {objectiveData.confidenceScore || 85}%
            </span>
          </div>

          <p className="text-xs font-bold text-stone-800 leading-relaxed bg-white/70 p-2 rounded-lg border border-emerald-200">
            🎯 {objectiveData.oneSentenceStrategy}
          </p>

          <div className="flex items-center justify-between text-[11px] text-stone-600 pt-1">
            <span>⏱️ 25秒前リセット目安: <strong className="text-emerald-900 font-bold">{objectiveData.resetTimingAlert}</strong></span>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-emerald-800 font-bold hover:text-emerald-950 flex items-center gap-0.5 cursor-pointer"
            >
              {isExpanded ? <>ロール別詳細を閉じる <ChevronUp className="w-3.5 h-3.5" /></> : <>ロール別詳細を見る <ChevronDown className="w-3.5 h-3.5" /></>}
            </button>
          </div>

          {isExpanded && objectiveData.laneTasks && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/80 text-[11px]">
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="font-bold text-emerald-900 block mb-0.5">🌲 JG 初動</span>
                <span className="text-stone-700">{objectiveData.laneTasks.jg}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="font-bold text-emerald-900 block mb-0.5">⚔️ TOP / MID</span>
                <span className="text-stone-700">{objectiveData.laneTasks.topMid}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="font-bold text-emerald-900 block mb-0.5">🏹 BOT / SUP</span>
                <span className="text-stone-700">{objectiveData.laneTasks.bot}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ④ 過去の自分からの警戒メモ（あれば） */}
      {warningData?.memo && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-xl p-3 text-xs text-rose-950 space-y-1">
          <div className="flex items-center gap-1.5 font-black text-rose-900">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>【過去の自分からの警戒メモ】 ({warningData.champion} vs {warningData.enemyChampion})</span>
          </div>
          <p className="font-medium whitespace-pre-wrap leading-relaxed">{warningData.memo}</p>
        </div>
      )}

      {/* ⑤ 敵JG初動ルート予測カード */}
      {champion && (
        <EarlyJunglePathingCard enemyChampion={enemyChampion} myChampion={champion} />
      )}
    </div>
  );
}
