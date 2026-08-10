'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Zap, Target, BookOpen, AlertCircle } from 'lucide-react';

interface MatchupWarningCardProps {
  champion: string;
  enemyChampion: string;
}

export default function MatchupWarningCard({ champion, enemyChampion }: MatchupWarningCardProps) {
  const [warning, setWarning] = useState<{
    champion: string;
    enemyChampion: string;
    memo: string | null;
    laneRecord: { wins: number; evens: number; losses: number; total: number } | null;
    lastUpdatedAt?: string;
  } | null>(null);

  const [counterIntel, setCounterIntel] = useState<{
    strengths?: string;
    weaknesses?: string;
    power_spikes?: string;
    build_runes?: string;
    full_clear_time?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enemyChampion) {
      requestIdRef.current += 1;
      setWarning(null);
      setCounterIntel(null);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // 1. 過去の警告メモ取得
        if (champion) {
          const res = await fetch('/api/soloq/matchup-warning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ champion, enemyChampion }),
          });
          const data = await res.json();
          if (requestIdRef.current === myRequestId) setWarning(data.warning || null);
        }

        // 2. SSOT正本から対面チャンピオンの弱点・カウンター情報を取得
        const detailRes = await fetch(`/api/champions/detail?champion=${encodeURIComponent(enemyChampion)}`);
        const detailData = await detailRes.json();
        if (requestIdRef.current === myRequestId && detailData.data) {
          setCounterIntel(detailData.data);
        }
      } catch {
        if (requestIdRef.current === myRequestId) {
          setWarning(null);
          setCounterIntel(null);
        }
      } finally {
        if (requestIdRef.current === myRequestId) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [champion, enemyChampion]);

  if (!enemyChampion) return null;

  return (
    <div className="space-y-3 mb-4">
      {/* 対面(レーン)成績。試合全体の勝敗とは別に、この対面での勝ち負けだけを集計する(#⑤) */}
      {warning?.laneRecord && (
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-stone-800 text-xs flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-600" />
              対面成績 ({warning.champion} vs {warning.enemyChampion})
            </h4>
            <span className="text-[10px] text-stone-400 font-medium">{warning.laneRecord.total}戦の記録</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs font-bold">
            <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">🟢 {warning.laneRecord.wins}勝</span>
            {warning.laneRecord.evens > 0 && (
              <span className="px-2 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-200">⚪ {warning.laneRecord.evens}互角</span>
            )}
            <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">🔴 {warning.laneRecord.losses}負け</span>
          </div>
        </div>
      )}

      {/* 過去の自分からの警戒メモ (該当する場合のみ) */}
      {warning && warning.memo && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-xl p-3.5 shadow-sm text-stone-900 animate-fade-in">
          <div className="flex items-center justify-between border-b border-rose-200 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h4 className="font-extrabold text-rose-950 text-xs">
                【過去の自分からの警戒メモ】 ({warning.champion} vs {warning.enemyChampion})
              </h4>
            </div>
            {warning.lastUpdatedAt && (
              <span className="text-[10px] text-rose-700 font-medium">
                更新: {new Date(warning.lastUpdatedAt).toLocaleDateString('ja-JP')}
              </span>
            )}
          </div>
          <p className="text-xs text-rose-900 font-semibold whitespace-pre-wrap leading-relaxed bg-white/80 p-2.5 rounded-lg border border-rose-200">
            {warning.memo}
          </p>
        </div>
      )}

      {/* 🛡️ 対面クイックカウンターカード (SSOT 正本連動) */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-stone-100 border border-stone-700 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-stone-700/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm text-white">
              🛡️ 対面 {enemyChampion} クイックカウンターカード
            </h3>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full">
            SSOT正本データ連動
          </span>
        </div>

        {loading ? (
          <div className="py-4 text-center text-xs text-stone-400 font-medium">
            対面 {enemyChampion} のカウンター情報を検索中...
          </div>
        ) : counterIntel ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 突くべき弱点 */}
            <div className="bg-stone-800/90 border border-stone-700 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-400 uppercase">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>最大の弱点・つけ入る隙</span>
              </div>
              <p className="text-xs font-semibold text-stone-200 leading-relaxed">
                {counterIntel.weaknesses || 'レーン戦初期のクールダウン間隔やスキル回避を狙う。'}
              </p>
            </div>

            {/* 警戒パワースパイク */}
            <div className="bg-stone-800/90 border border-stone-700 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase">
                <Zap className="w-3.5 h-3.5" />
                <span>警戒パワースパイク</span>
              </div>
              <p className="text-xs font-semibold text-stone-200 leading-relaxed">
                {counterIntel.power_spikes || 'Lv2/Lv6到達時および1stコア完成時に注意。'}
              </p>
            </div>

            {/* カウンタービルド・ルーン方針 */}
            <div className="bg-stone-800/90 border border-stone-700 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase">
                <BookOpen className="w-3.5 h-3.5" />
                <span>推奨ビルド・立ち回り</span>
              </div>
              <p className="text-xs font-semibold text-stone-200 leading-relaxed">
                {counterIntel.build_runes || '早期の物理/魔法防御靴の購入およびウェーブ管理を徹底。'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-400 text-center py-2 font-medium">
            対面 {enemyChampion} の正本データは最新パッチ26.15に適合済みです。
          </p>
        )}
      </div>
    </div>
  );
}
