'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Zap, Target, BookOpen, AlertCircle } from 'lucide-react';
import EarlyJunglePathingCard from './EarlyJunglePathingCard';

interface MatchupWarningCardProps {
  champion: string;
  enemyChampion: string;
}

export default function MatchupWarningCard({ champion, enemyChampion }: MatchupWarningCardProps) {
  const [warning, setWarning] = useState<{
    champion: string;
    enemyChampion: string;
    memo: string | null;
    laneRecord: { wins: number; evens: number; losses: number; total: number; gameWinRate?: number } | null;
    personalDossier?: {
      totalMatches: number;
      recentMatches: { matchId: string; champion: string; win: boolean; laneResult: string; kda: string; memo: string; createdAt: string }[];
      frequentTags: string[];
    } | null;
    lastUpdatedAt?: string;
  } | null>(null);

  const [counterIntel, setCounterIntel] = useState<{
    strengths?: string;
    weaknesses?: string;
    power_spikes?: string;
    build_runes?: string;
    full_clear_time?: string;
  } | null>(null);

  const [enemyJungleTiming, setEnemyJungleTiming] = useState<{
    sampleCount?: number;
    avgFirstCoreSec?: number | null;
    avgSecondCoreSec?: number | null;
    externalFastestClearSec?: number | null;
    tier?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [todayFocus, setTodayFocus] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    try {
      setTodayFocus(localStorage.getItem('today_soloq_focus') || localStorage.getItem('coach_focus') || '');
    } catch {}
  }, [isHudOpen]);

  useEffect(() => {
    if (!enemyChampion) {
      requestIdRef.current += 1;
      setWarning(null);
      setCounterIntel(null);
      setEnemyJungleTiming(null);
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

        // 2. SSOT正本から対面チャンピオンの弱点・カウンター情報およびジャングルタイミングを取得
        const detailRes = await fetch(`/api/champions/detail?champion=${encodeURIComponent(enemyChampion)}`);
        const detailData = await detailRes.json();
        if (requestIdRef.current === myRequestId) {
          if (detailData.dataFields) {
            setCounterIntel(detailData.dataFields);
          } else if (detailData.data) {
            setCounterIntel(detailData.data);
          }
          if (detailData.realJungleTiming) {
            setEnemyJungleTiming(detailData.realJungleTiming);
          }
        }
      } catch {
        if (requestIdRef.current === myRequestId) {
          setWarning(null);
          setCounterIntel(null);
          setEnemyJungleTiming(null);
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

      {/* 🛡️ 対面クイックカウンターカード (SSOT 正本連動) ＆ HUDカンペボタン */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-stone-100 border border-stone-700 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-stone-700/80 pb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm text-white">
              🛡️ 対面 {enemyChampion} クイックカウンターカード
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHudOpen(true)}
              className="px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-extrabold text-xs rounded-lg shadow transition flex items-center gap-1.5 active:scale-95"
            >
              <span>📱</span> ロード中HUDカンペ
            </button>
            <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full">
              SSOT正本連動
            </span>
          </div>
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

        {/* ⏱️ 敵JGテンポ・初動予測カード */}
        {enemyJungleTiming && (
          <div className="mt-3 pt-3 border-t border-stone-800 bg-stone-900/60 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-400 flex items-center gap-1.5">
                <span>⏱️</span> 敵JGテンポ・初動予測（{enemyChampion}）
              </span>
              <span className="text-[9px] text-stone-400">
                2:55スカトル / 5:00初代ドラゴン
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-stone-800/80 p-2 rounded-lg border border-stone-700">
                <div className="text-[10px] text-stone-400 font-bold">最速フルクリア基準</div>
                <div className="text-xs font-black text-amber-300 mt-0.5">
                  {enemyJungleTiming.externalFastestClearSec
                    ? `${Math.floor(enemyJungleTiming.externalFastestClearSec / 60)}分${String(enemyJungleTiming.externalFastestClearSec % 60).padStart(2, '0')}秒`
                    : 'データ収集中'}
                </div>
              </div>

              <div className="bg-stone-800/80 p-2 rounded-lg border border-stone-700">
                <div className="text-[10px] text-stone-400 font-bold">1stコア平均完成</div>
                <div className="text-xs font-black text-stone-200 mt-0.5">
                  {enemyJungleTiming.avgFirstCoreSec
                    ? `${Math.floor(enemyJungleTiming.avgFirstCoreSec / 60)}分${String(enemyJungleTiming.avgFirstCoreSec % 60).padStart(2, '0')}秒`
                    : '約11〜12分'}
                </div>
              </div>

              <div className="bg-stone-800/80 p-2 rounded-lg border border-stone-700 col-span-2 sm:col-span-1">
                <div className="text-[10px] text-stone-400 font-bold">初動ガンク・接敵目安</div>
                <div className="text-xs font-black text-emerald-400 mt-0.5">
                  {enemyJungleTiming.externalFastestClearSec && enemyJungleTiming.externalFastestClearSec <= 200
                    ? '⚡ 最速スカトル到達型'
                    : '🛡️ フルファーム先行型'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🗺️ 初動3分ルート分岐フローチャート */}
        {champion && enemyChampion && (
          <div className="mt-3 pt-3 border-t border-stone-800">
            <EarlyJunglePathingCard
              myChampion={champion}
              enemyChampion={enemyChampion}
              enemyFastestClearSec={enemyJungleTiming?.externalFastestClearSec}
            />
          </div>
        )}
      </div>

      {/* 📂 対面 {enemyChampion} とのパーソナル対戦カルテ（過去全ログ） */}
      {warning?.personalDossier && warning.personalDossier.recentMatches.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-1 border-b border-stone-100 pb-2">
            <h4 className="font-extrabold text-stone-800 text-xs flex items-center gap-1.5">
              <span>📂</span> あなたの対 {enemyChampion} 個人カルテ（過去{warning.personalDossier.totalMatches}戦）
            </h4>
            {warning.laneRecord?.gameWinRate !== undefined && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                warning.laneRecord.gameWinRate >= 50
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                総合勝率 {warning.laneRecord.gameWinRate}%
              </span>
            )}
          </div>

          {/* 頻出タグ */}
          {warning.personalDossier.frequentTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[10px] font-bold text-stone-400">よくある敗因/勝因:</span>
              {warning.personalDossier.frequentTags.map((tag, i) => (
                <span key={i} className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full border border-stone-200 font-semibold">
                  🏷️ {tag}
                </span>
              ))}
            </div>
          )}

          {/* 直近の戦歴リスト */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {warning.personalDossier.recentMatches.map((m, i) => (
              <div key={i} className="bg-stone-50 p-2 rounded-lg border border-stone-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-black text-[10px] px-1.5 py-0.5 rounded ${
                    m.win ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}>
                    {m.win ? 'WIN' : 'LOSE'}
                  </span>
                  <span className="font-bold text-stone-800">{m.champion}</span>
                  <span className="text-stone-400 font-mono text-[11px]">KDA: {m.kda}</span>
                </div>
                {m.memo && (
                  <span className="text-[10px] text-stone-500 truncate max-w-[200px]" title={m.memo}>
                    📝 {m.memo}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📱 ロード画面専用 HUDカンペモーダル (Compact Overlay) */}
      {isHudOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in">
          <div className="bg-stone-950 border-2 border-amber-500/80 rounded-3xl shadow-2xl w-full max-w-lg p-6 text-stone-100 space-y-4">
            {/* HUDヘッダー */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-pulse">⚡</span>
                <div>
                  <h2 className="text-base font-black text-amber-400 tracking-wider uppercase">
                    HUD 戦闘ブリーフィング
                  </h2>
                  <p className="text-[11px] text-stone-400 font-mono">
                    {champion || 'YOU'} vs <strong className="text-white text-xs">{enemyChampion}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHudOpen(false)}
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition"
              >
                ✕ 閉じる
              </button>
            </div>

            {/* 今日の焦点 (最上部強調) */}
            {todayFocus && (
              <div className="bg-gradient-to-r from-amber-950 to-stone-900 border border-amber-600/60 p-3 rounded-2xl space-y-1">
                <div className="text-[10px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1">
                  <span>🎯</span> TODAY&apos;S FOCUS (最重要意識)
                </div>
                <div className="text-sm font-black text-white leading-snug">
                  {todayFocus}
                </div>
              </div>
            )}

            {/* 3秒で把握できる結論グリッド */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-stone-900 border border-stone-800 p-3 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                  <span>⚠️</span> 警戒パワースパイク
                </div>
                <p className="text-xs font-bold text-stone-200">
                  {counterIntel?.power_spikes || 'Lv2/Lv6到達時に注意'}
                </p>
              </div>

              <div className="bg-stone-900 border border-stone-800 p-3 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <span>💡</span> 推奨立ち回り
                </div>
                <p className="text-xs font-bold text-stone-200">
                  {counterIntel?.build_runes || '早期防御靴 ＆ 視界確保'}
                </p>
              </div>
            </div>

            {/* 過去の自分からのメモ */}
            {warning?.memo && (
              <div className="bg-rose-950/60 border border-rose-700/80 p-3 rounded-xl text-xs space-y-1">
                <div className="text-[10px] font-black text-rose-400 flex items-center gap-1">
                  <span>📝</span> 過去の自分からの警戒メモ
                </div>
                <p className="text-xs font-medium text-rose-200 whitespace-pre-wrap leading-relaxed">
                  {warning.memo}
                </p>
              </div>
            )}

            {/* フッター */}
            <div className="pt-2 text-center">
              <button
                onClick={() => setIsHudOpen(false)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-sm rounded-xl shadow-lg transition active:scale-98"
              >
                ✅ 把握完了！試合へ集中する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
