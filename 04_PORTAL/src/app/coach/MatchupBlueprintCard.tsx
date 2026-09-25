'use client';

import { useEffect, useState } from 'react';
import { Zap, Shield, Sparkles, AlertTriangle, CheckCircle2, Swords, Eye, Compass, Target, Clock } from 'lucide-react';
import Image from 'next/image';
import { getChampIcon } from '../../lib/ddragonClient';
import { getVisionAlertRule } from '../../lib/visionAlertRules';
import EarlyJunglePathingCard from './EarlyJunglePathingCard';

interface Phase {
  phase: string;
  title: string;
  action: string;
  win_trigger: string;
  badge: string;
}

interface KillLineData {
  enemy_champion: string;
  enemy_level: number;
  has_ignite: boolean;
  total_lethal_damage: number;
  raw_burst_damage: number;
  ignite_damage: number;
  kill_hp_percent: number;
  my_max_hp: number;
  safe_hp_threshold: number;
  danger_badge: string;
  danger_color: string;
  advice: string;
}

interface RejectedIntel {
  weaknesses: string | null;
  counter_champions: string | null;
  is_enemy_counter: boolean;
  matchup_memo: string | null;
  source_patch: string | null;
  confidence: string | null;
}

interface BlueprintResponse {
  success: boolean;
  my_champion: string;
  enemy_champion: string;
  kill_line?: KillLineData;
  blueprint: {
    phases: Phase[];
  };
  rejected_intel?: RejectedIntel;
}

export default function MatchupBlueprintCard({
  myChampion: initialMyChampion = 'JarvanIV',
  enemyChampion: initialEnemyChampion = 'LeeSin',
  onMyChampionChange,
  onEnemyChampionChange,
}: {
  myChampion?: string;
  enemyChampion?: string;
  onMyChampionChange?: (champ: string) => void;
  onEnemyChampionChange?: (champ: string) => void;
}) {
  const [myChamp, setMyChamp] = useState(initialMyChampion);
  const [enemyChamp, setEnemyChamp] = useState(initialEnemyChampion);
  const [data, setData] = useState<BlueprintResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 4大タブ（手順書 / 推奨ルーン＆ビルド / 敵JG初動ルート / 実戦の罠・不採用ビルド）
  const [activeTab, setActiveTab] = useState<'blueprint' | 'builds' | 'jungle' | 'rejected'>('blueprint');
  const [counterData, setCounterData] = useState<any>(null);
  const [counterLoading, setCounterLoading] = useState(false);
  const [matchupWarning, setMatchupWarning] = useState<any>(null);

  // JGタイミング
  const [enemyJungleTiming, setEnemyJungleTiming] = useState<{
    sampleCount?: number;
    avgFirstCoreSec?: number | null;
    avgSecondCoreSec?: number | null;
    externalFastestClearSec?: number | null;
    tier?: string;
  } | null>(null);
  const [myJungleTiming, setMyJungleTiming] = useState<{
    sampleCount?: number;
    avgFirstCoreSec?: number | null;
    avgSecondCoreSec?: number | null;
    externalFastestClearSec?: number | null;
    tier?: string;
  } | null>(null);

  // 外部からのprops更新に同期
  useEffect(() => {
    if (initialMyChampion) setMyChamp(initialMyChampion);
  }, [initialMyChampion]);

  useEffect(() => {
    if (initialEnemyChampion) setEnemyChamp(initialEnemyChampion);
  }, [initialEnemyChampion]);

  const handleMyChange = (val: string) => {
    setMyChamp(val);
    if (onMyChampionChange) onMyChampionChange(val);
  };

  const handleEnemyChange = (val: string) => {
    setEnemyChamp(val);
    if (onEnemyChampionChange) onEnemyChampionChange(val);
  };

  useEffect(() => {
    if (!enemyChamp) return;
    setLoading(true);
    fetch(`/api/lol/matchup-blueprint?my=${encodeURIComponent(myChamp)}&enemy=${encodeURIComponent(enemyChamp)}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [myChamp, enemyChamp]);

  // カウンター＆ビルド情報の取得（myChampion vs enemyChampion に完全連動）
  useEffect(() => {
    if (!enemyChamp) return;
    setCounterLoading(true);
    fetch('/api/coach/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'counter_pick', enemyChampion: enemyChamp, myChampion: myChamp })
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setCounterData(d);
        setCounterLoading(false);
      })
      .catch(() => setCounterLoading(false));
  }, [myChamp, enemyChamp]);

  // 過去の反省遺言・対面過去戦績 ＆ JGテンポ詳細の取得
  useEffect(() => {
    if (!enemyChamp) return;

    fetch('/api/soloq/matchup-warning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champion: myChamp, enemyChampion: enemyChamp })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.warning) {
          setMatchupWarning(d.warning);
        } else {
          setMatchupWarning(null);
        }
      })
      .catch(() => setMatchupWarning(null));

    // SSOT正本から対面および自陣のジャングルタイミングを取得
    Promise.all([
      fetch(`/api/champions/detail?champion=${encodeURIComponent(enemyChamp)}`),
      myChamp ? fetch(`/api/champions/detail?champion=${encodeURIComponent(myChamp)}`) : Promise.resolve(null),
    ])
      .then(async ([enemyRes, myRes]) => {
        const enemyDetail = await enemyRes.json().catch(() => null);
        const myDetail = myRes ? await myRes.json().catch(() => null) : null;
        if (enemyDetail?.realJungleTiming) setEnemyJungleTiming(enemyDetail.realJungleTiming);
        else setEnemyJungleTiming(null);
        if (myDetail?.realJungleTiming) setMyJungleTiming(myDetail.realJungleTiming);
        else setMyJungleTiming(null);
      })
      .catch(() => {
        setEnemyJungleTiming(null);
        setMyJungleTiming(null);
      });
  }, [myChamp, enemyChamp]);

  if (loading && !data) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs animate-pulse">
        <div className="h-4 bg-stone-200 rounded w-1/3 mb-3"></div>
        <div className="h-16 bg-stone-100 rounded-xl mb-4"></div>
        <div className="h-24 bg-stone-100 rounded-xl"></div>
      </div>
    );
  }

  const blueprint = data?.blueprint || { phases: [] };

  return (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm text-stone-900 space-y-4">
      {/* ⚠️ 過去の自分の反省遺言バナー ＆ 純粋対面勝率（LDR/JDR） */}
      {matchupWarning && (matchupWarning.memo || matchupWarning.matchupMemo || matchupWarning.laneRecord) && (
        <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-2 border-amber-500/60 rounded-xl p-3.5 shadow-2xs space-y-2 animate-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce shrink-0" />
              <span>【過去の反省遺言】 vs {enemyChamp} 前回の教訓</span>
            </div>
            {matchupWarning.laneRecord && (
              <div className="flex items-center gap-1 text-[10px] font-black font-mono">
                <span className="bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded">
                  純粋対面勝率 {matchupWarning.laneRecord.laneWinRate}% ({matchupWarning.laneRecord.wins}勝 {matchupWarning.laneRecord.losses}敗)
                </span>
                {matchupWarning.laneRecord.gameWinRate !== undefined && (
                  <span className="bg-white/90 text-stone-700 border border-stone-300 px-2 py-0.5 rounded">
                    試合勝率 {matchupWarning.laneRecord.gameWinRate}%
                  </span>
                )}
              </div>
            )}
          </div>
          {(matchupWarning.memo || matchupWarning.matchupMemo) && (
            <p className="text-xs font-bold text-stone-800 bg-white/95 p-2 rounded-lg border border-amber-200/80 leading-relaxed">
              💬 <span className="text-amber-900 font-extrabold">メモ:</span> {matchupWarning.memo || matchupWarning.matchupMemo}
            </p>
          )}
          {matchupWarning.sentinelStrategy && (
            <p className="text-[11px] font-medium text-stone-700 leading-snug">
              🛡️ <span className="font-bold">対策要点:</span> {matchupWarning.sentinelStrategy}
            </p>
          )}
        </div>
      )}

      {/* 👁️ コントロールワード警戒アラート（対面・敵ステルス・奇襲特性連動） */}
      {(() => {
        const visionRule = getVisionAlertRule(enemyChamp);
        if (!visionRule) return null;

        const isCritical = visionRule.threatLevel === 'CRITICAL';
        const isHigh = visionRule.threatLevel === 'HIGH';

        const bgClass = isCritical
          ? 'bg-gradient-to-r from-rose-500/15 via-red-500/10 to-rose-500/15 border-2 border-rose-500/60'
          : isHigh
          ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/60'
          : 'bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-blue-500/10 border border-blue-500/40';

        const iconColor = isCritical ? 'text-rose-600' : isHigh ? 'text-amber-600' : 'text-blue-600';
        const badgeBg = isCritical ? 'bg-rose-100 text-rose-900 border-rose-200' : isHigh ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-blue-100 text-blue-900 border-blue-200';

        return (
          <div className={`${bgClass} rounded-xl p-3.5 shadow-2xs space-y-2.5 animate-in`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                <Eye className={`w-4 h-4 ${iconColor} ${isCritical ? 'animate-pulse' : ''}`} />
                <span>【視界警戒アラート】 vs {enemyChamp} コントロールワード対策</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${badgeBg}`}>
                {visionRule.badgeLabel}
              </span>
            </div>

            <div className="bg-white/95 rounded-lg p-2.5 border border-stone-200/80 space-y-1.5 text-xs">
              <p className="font-black text-stone-900 flex items-center gap-1">
                <span>🎯</span>
                <span>{visionRule.title}</span>
              </p>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                {visionRule.reason}
              </p>
              <div className="pt-1 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-start gap-1">
                  <span className="font-bold text-amber-800 shrink-0">⏱️ 購入基準:</span>
                  <span className="text-stone-700 font-medium">{visionRule.timingAdvice}</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="font-bold text-emerald-800 shrink-0">📍 配置場所:</span>
                  <span className="text-stone-700 font-medium">{visionRule.placementAdvice}</span>
                </div>
              </div>
              {visionRule.recommendedItem && (
                <div className="pt-1 text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                  <span>🎒 推奨装備:</span>
                  <span>{visionRule.recommendedItem}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ヘッダー: 対戦カードサマリー（親セレクターと完全連動・重複UIなし） */}
      <div className="border-b border-stone-100 pb-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-stone-100/90 px-3 py-1.5 rounded-xl border border-stone-200/80">
              <div className="flex items-center gap-1.5">
                <Image
                  src={getChampIcon(myChamp)}
                  alt={myChamp}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full border border-amber-500 shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="font-black text-xs text-stone-900">{myChamp}</span>
              </div>
              <span className="text-[10px] font-black text-stone-400">VS</span>
              <div className="flex items-center gap-1.5">
                <Image
                  src={getChampIcon(enemyChamp)}
                  alt={enemyChamp}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full border border-rose-500 shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="font-black text-xs text-rose-900">{enemyChamp}</span>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider">
              マッチアップ戦術同期中
            </span>
          </div>
        </div>

        {/* 💀 即死キルライン境界メーター (数学的確定計算) */}
        {data?.kill_line && (
          <div className="bg-stone-900 text-white rounded-xl p-3.5 border border-stone-700/80 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-base">💀</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-400">即死キルライン境界メーター</span>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs"
                      style={{
                        backgroundColor: `${data.kill_line.danger_color}25`,
                        color: data.kill_line.danger_color,
                        borderColor: `${data.kill_line.danger_color}60`
                      }}
                    >
                      {data.kill_line.danger_badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400 font-medium">
                    対面Lv6フルコンボ{data.kill_line.has_ignite ? ' ＋ イグナイト' : ''} 確定ダメージ（自防御力軽減済み）
                  </p>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] text-stone-400">確定最大火力: </span>
                <span className="text-sm font-black text-rose-400">{data.kill_line.total_lethal_damage} DMG</span>
              </div>
            </div>

            {/* HPゲージバー */}
            <div className="space-y-1">
              <div className="relative w-full h-5 bg-stone-800 rounded-lg overflow-hidden border border-stone-700/80 flex">
                {/* 即死ゾーン */}
                <div
                  className="h-full bg-gradient-to-r from-rose-600 to-red-500 flex items-center justify-center text-[10px] font-black text-white px-2 transition-all duration-500"
                  style={{ width: `${data.kill_line.kill_hp_percent}%` }}
                >
                  {data.kill_line.kill_hp_percent >= 25 && `即死ゾーン: HP ${data.kill_line.kill_hp_percent}%`}
                </div>
                {/* 安全ゾーン */}
                <div
                  className="h-full bg-stone-800/90 flex items-center justify-end text-[10px] font-black text-emerald-400 px-2 transition-all duration-500 flex-1"
                >
                  {data.kill_line.kill_hp_percent < 80 && `安全域: > ${data.kill_line.safe_hp_threshold} HP`}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 font-mono px-0.5">
                <span>0 HP</span>
                <span className="text-rose-400 font-bold">即死境界: {data.kill_line.total_lethal_damage} HP ({data.kill_line.kill_hp_percent}%)</span>
                <span>最大 {data.kill_line.my_max_hp} HP</span>
              </div>
            </div>

            {/* アドバイス処方箋 */}
            <div className="bg-stone-800/90 border border-stone-700/60 p-2 rounded-lg text-xs font-bold text-amber-200 flex items-start gap-1.5">
              <span className="shrink-0 text-amber-400">⚠️</span>
              <span className="leading-snug">{data.kill_line.advice}</span>
            </div>
          </div>
        )}

        {/* 4大タブ切替 */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('blueprint')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'blueprint'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>📋 3段階勝ちパターン</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builds')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'builds'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>🛡️ 推奨ルーン ＆ ビルド</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('jungle')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'jungle'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>🌲 敵JG初動ルート ＆ テンポ</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'rejected'
                ? 'bg-rose-900 text-rose-100 shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>⚠️ 罠 ＆ 不採用ビルド</span>
          </button>
        </div>
      </div>

      {/* タブ1: 3段階勝ちパターン手順書 */}
      {activeTab === 'blueprint' && (
        <div className="space-y-3.5 animate-in fade-in">
          <div className="flex items-center gap-1.5 text-xs font-black text-stone-800">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>{myChamp} vs {enemyChamp} 3段階勝ちパターン・タイムライン</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {blueprint.phases.map((p, idx) => (
              <div
                key={idx}
                className="bg-stone-50/80 border border-stone-200 rounded-xl p-3.5 space-y-2 flex flex-col justify-between shadow-2xs hover:border-amber-300 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200">
                      {p.phase}
                    </span>
                    <span className="font-bold text-stone-600 text-[10px]">
                      {p.badge}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-stone-900 leading-snug">
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                    {p.action}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-200/70 space-y-1.5">
                  <div className="text-[10px] text-emerald-800 font-bold bg-emerald-50/80 p-1.5 rounded">
                    🎯 クリア条件: {p.win_trigger}
                  </div>
                  {idx === 2 && data?.kill_line && (
                    <div className="text-[10px] font-bold text-rose-800 bg-rose-50/80 px-2 py-1 rounded border border-rose-200/80 flex items-center justify-between">
                      <span>💀 敵Lv6即死境界:</span>
                      <span className="font-mono font-black">{data.kill_line.total_lethal_damage} DMG (HP {data.kill_line.kill_hp_percent}%)</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 対面トレードの要点 */}
          {counterData?.tips && (
            <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs text-stone-800 leading-relaxed font-medium">
              <span className="font-black text-amber-900 block mb-1">💡 対面トレードの極意:</span>
              {counterData.tips}
            </div>
          )}
        </div>
      )}

      {/* タブ2: 推奨ルーン ＆ 初期ビルド */}
      {activeTab === 'builds' && (
        <div className="space-y-3 animate-in fade-in">
          {counterLoading ? (
            <div className="p-8 text-center text-xs text-stone-500 font-bold animate-pulse">
              {myChamp} vs {enemyChamp} のビルド＆ルーン最適解を計算中...
            </div>
          ) : counterData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 推奨ルーン */}
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>{myChamp} 推奨ルーン構成</span>
                  </div>
                  <div className="text-xs font-black text-amber-950 bg-amber-100/70 p-2.5 rounded-lg border border-amber-300">
                    {counterData.recommendedRunes || '推奨ルーンデータ未取得（再読み込みしてください）'}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                    {counterData.runeReason || '対面マッチアップに応じたルーンの選定理由が未取得です。'}
                  </p>
                </div>

                {/* 推奨初手アイテム・コアビルド */}
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>初手アイテム ＆ 対策コアビルド</span>
                  </div>
                  <div className="text-xs font-black text-emerald-950 bg-emerald-100/70 p-2.5 rounded-lg border border-emerald-300">
                    {counterData.recommendedItems || '推奨ビルドデータ未取得（再読み込みしてください）'}
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                    {counterData.itemReason || `${enemyChamp} に対するアイテム選定理由が未取得です。`}
                  </p>
                </div>
              </div>

              {/* カウンター留意点 */}
              {counterData.tips && (
                <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs text-stone-800 leading-relaxed font-medium">
                  <span className="font-black text-amber-900 block mb-1">💡 対面トレードの極意:</span>
                  {counterData.tips}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-stone-500">
              ビルドデータが取得できませんでした
            </div>
          )}
        </div>
      )}

      {/* タブ3: 🌲 敵JG初動ルート ＆ テンポシミュレーター */}
      {activeTab === 'jungle' && (
        <div className="space-y-3.5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <h4 className="font-black text-stone-900 text-xs flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-sky-600" />
              <span>🌲 vs {enemyChamp} 敵JG初動3分ルート ＆ カニ争奪テンポ</span>
            </h4>
            <span className="text-[10px] font-bold text-stone-500 font-mono">
              2:55 カニ湧き / 5:00 ヴォイドグラブ基準
            </span>
          </div>

          {/* カニ遭遇危険度バナー（自陣JGと敵JGの両方のタイムが揃っている場合） */}
          {myJungleTiming?.externalFastestClearSec && enemyJungleTiming?.externalFastestClearSec && (() => {
            const myClear = myJungleTiming.externalFastestClearSec;
            const enemyClear = enemyJungleTiming.externalFastestClearSec;
            const diff = enemyClear - myClear; // 正: 自陣が早い(リード), 負: 敵が早い(ビハインド)

            const isAdvantage = diff >= 8;
            const isDanger = diff <= -8;

            return (
              <div className={`p-3 rounded-xl border text-xs shadow-2xs ${
                isAdvantage ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                isDanger ? 'bg-rose-50 border-rose-300 text-rose-900' :
                'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-center justify-between font-black text-xs mb-1.5">
                  <span className="flex items-center gap-1">
                    {isAdvantage ? '⚡ 【テンポ優位】リバー先制掌握 ＆ カニ先狩り可能' :
                     isDanger ? '⚠️ 【交戦危険】カニ直接鉢合わせ禁止 ＆ 逆サイド迂回推奨' :
                     '⚔️ 【互角接敵】リバー2v2/3v3寄りの速さ勝負'}
                  </span>
                  <span className="font-mono text-xs font-black">
                    {diff > 0 ? `+${diff}秒リード` : diff < 0 ? `${diff}秒遅延` : '同時着'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-95">
                  {isAdvantage
                    ? `自陣(${myChamp} ${Math.floor(myClear/60)}:${String(myClear%60).padStart(2,'0')})が敵(${enemyChamp} ${Math.floor(enemyClear/60)}:${String(enemyClear%60).padStart(2,'0')})より${diff}秒早くフルクリア可能。先にリバー視界を取り、同サイドカニまたは敵逆サイド森へのインベードが極めて有効。`
                    : isDanger
                    ? `敵(${enemyChamp} ${Math.floor(enemyClear/60)}:${String(enemyClear%60).padStart(2,'0')})が自陣より${Math.abs(diff)}秒早く森を空にしてリバーに入ります。同じカニへ向かうと孤立デスする危険が高いため、逆サイドカニへ迂回するかレーナーの寄りを確認してください。`
                    : `自陣と敵のクリア完了時刻がほぼ同時（${Math.abs(diff)}秒差）です。2:55のカニ湧きで正面衝突するため、ミッド・サイドレーンのプッシュ状況（主導権）がない場合は無理に争奪せず引く判断が必要です。`}
                </p>
              </div>
            );
          })()}

          {/* フルクリア時間比較カード */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <div className="text-[10px] text-stone-500 font-bold">敵({enemyChamp})の最速フルクリア</div>
              <div className="text-xs font-black text-amber-700 mt-0.5 font-mono">
                {enemyJungleTiming?.externalFastestClearSec
                  ? `${Math.floor(enemyJungleTiming.externalFastestClearSec / 60)}分${String(enemyJungleTiming.externalFastestClearSec % 60).padStart(2, '0')}秒`
                  : 'データ収集中'}
              </div>
            </div>

            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <div className="text-[10px] text-stone-500 font-bold">自陣({myChamp})の最速フルクリア</div>
              <div className="text-xs font-black text-emerald-700 mt-0.5 font-mono">
                {myJungleTiming?.externalFastestClearSec
                  ? `${Math.floor(myJungleTiming.externalFastestClearSec / 60)}分${String(myJungleTiming.externalFastestClearSec % 60).padStart(2, '0')}秒`
                  : 'レーナー/未選択'}
              </div>
            </div>

            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-stone-500 font-bold">敵のカニ(2:55)先行差</div>
              <div className="text-xs font-black text-stone-800 mt-0.5 font-mono">
                {enemyJungleTiming?.externalFastestClearSec
                  ? `${175 - enemyJungleTiming.externalFastestClearSec >= 0 ? '+' : ''}${175 - enemyJungleTiming.externalFastestClearSec}秒`
                  : '-'}
              </div>
            </div>
          </div>

          {/* 🗺️ 初動3分ルート分岐フローチャート */}
          {myChamp && enemyChamp && (
            <div className="pt-2 border-t border-stone-100">
              <EarlyJunglePathingCard
                myChampion={myChamp}
                enemyChampion={enemyChamp}
                enemyFastestClearSec={enemyJungleTiming?.externalFastestClearSec}
              />
            </div>
          )}
        </div>
      )}

      {/* タブ4: 実戦の罠・不採用ビルド (Rejected Options / 没理由) */}
      {activeTab === 'rejected' && (
        <div className="space-y-3.5 animate-in fade-in">
          <div className="flex items-center gap-1.5 text-xs font-black text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{myChamp} vs {enemyChamp} 実戦の罠・やってはいけないNG行動（没理由DB）</span>
          </div>

          {/* ★ 2026-09-22: ここは以前、チャンピオンを一切参照しないハードコード文言を
              「没理由DB」由来であるかのように表示していた(Zyra(APメイジ)の対面で
              「脅威積み」「防具完成前」等のAD向け助言が出ていた)。
              champion_facts / matchup_sentinel の実データのみを表示し、
              データが無い対面はそれらしい汎用文で埋めず「未登録」と明示する。 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* この対面で突かれる弱点（champion_facts.weaknesses） */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-black text-rose-950">
                <span className="text-sm">🩸</span>
                <span>{myChamp} の弱点・突かれどころ</span>
              </div>
              {data?.rejected_intel?.weaknesses ? (
                <p className="text-[11px] text-stone-700 leading-relaxed font-medium whitespace-pre-line">
                  {data?.rejected_intel.weaknesses}
                </p>
              ) : (
                <p className="text-[11px] text-stone-500 leading-relaxed font-medium">
                  {myChamp} の弱点はまだ辞典に登録されていません。
                  <br />
                  <span className="text-stone-400">（チャンピオン辞典の「AI更新」から取得できます）</span>
                </p>
              )}
            </div>

            {/* 苦手な相手（champion_facts.counter_champions）＋ 今回の対面が該当するか */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                <span className="text-sm">⚔️</span>
                <span>苦手な相手・カウンター</span>
              </div>
              {data?.rejected_intel?.counter_champions ? (
                <>
                  <div
                    className={`text-xs font-black p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      data?.rejected_intel.is_enemy_counter
                        ? 'text-rose-900 bg-rose-100/80 border-rose-300'
                        : 'text-emerald-900 bg-emerald-100/80 border-emerald-300'
                    }`}
                  >
                    <span>
                      {data?.rejected_intel.is_enemy_counter
                        ? `⚠️ ${enemyChamp} は苦手リストに入っています`
                        : `${enemyChamp} は苦手リストには入っていません`}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-700 leading-relaxed font-medium whitespace-pre-line">
                    {data?.rejected_intel.counter_champions}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-stone-500 leading-relaxed font-medium">
                  {myChamp} の苦手な相手はまだ辞典に登録されていません。
                </p>
              )}
            </div>
          </div>

          {/* この対面固有の実戦メモ（matchup_sentinel.strategy） */}
          {data?.rejected_intel?.matchup_memo && (
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-black text-stone-900">
                <span className="text-sm">📝</span>
                <span>{myChamp} vs {enemyChamp} の実戦メモ</span>
              </div>
              <p className="text-[11px] text-stone-700 leading-relaxed font-medium whitespace-pre-line">
                {data?.rejected_intel.matchup_memo}
              </p>
            </div>
          )}

          {/* 出典の明示（どのパッチ時点の、どの確度のデータか） */}
          {data?.rejected_intel?.source_patch && (
            <p className="text-[10px] text-stone-400 font-medium">
              出典: チャンピオン辞典（パッチ {data?.rejected_intel.source_patch} 時点
              {data?.rejected_intel.confidence ? ` / 確度: ${data?.rejected_intel.confidence}` : ''}）
            </p>
          )}

          {/* ★ この文章は対面に依存しない一般原則。以前は「戦術バイブル・実戦同期ナレッジ」と
              題してバイブル由来のように見せていたが、実際はどの対面でも同じ固定文なので、
              一般論であることが分かる見出しに改めた。 */}
          <div className="bg-stone-900 text-stone-200 rounded-xl p-3.5 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <span>📜</span>
                <span>対面共通の基本原則（一般論）</span>
              </span>
              <span className="text-[10px] text-stone-400 font-mono">対面別データではありません</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed font-medium">
              💡 <strong>序盤テンポ維持の鉄則:</strong> Lv1~2で無理なロングトレードを仕掛けず、自軍ミニオン有利を活かしたショートトレードを徹底すること。敵JGの位置がマップに見えるまでフラッシュを使ったオールインは禁止です。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
