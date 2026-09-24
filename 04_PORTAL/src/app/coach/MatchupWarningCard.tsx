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
    laneRecord: {
      wins: number;
      evens: number;
      losses: number;
      total: number;
      laneWinRate: number;
      adjustedLaneWinRate: number;
      gameWinRate?: number;
      carryConversionRate?: number | null;
      noiseMatchCount?: number;
      isChampionSpecific?: boolean;
    } | null;
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

  const [myJungleTiming, setMyJungleTiming] = useState<{
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
      setMyJungleTiming(null);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // 1. 戦績・危険度情報の取得
        if (champion) {
          // 2026-09-22 修正: 従来は存在しない `/api/coach/matchup-warning` を叩いており、
          // このカードは未配線のまま一度も表示されたことがなかった。
          // 既存の `/api/soloq/matchup-warning` が同じ入出力
          //   POST { champion, enemyChampion } → { warning: { memo, laneRecord, personalDossier, lastUpdatedAt } }
          // を返すため、そちらへ向け直した。
          // ⚠️ 同APIは verifyAdminSession を要求するので、管理者以外では warning が null になる。
          const res = await fetch('/api/soloq/matchup-warning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ champion, enemyChampion }),
          });
          const data = await res.json();
          if (requestIdRef.current === myRequestId) setWarning(data.warning || null);
        }

        // 2. SSOT正本から対面および自陣の弱点・ジャングルタイミングを並列取得
        const [enemyDetailRes, myDetailRes] = await Promise.all([
          fetch(`/api/champions/detail?champion=${encodeURIComponent(enemyChampion)}`),
          champion ? fetch(`/api/champions/detail?champion=${encodeURIComponent(champion)}`) : Promise.resolve(null),
        ]);
        const detailData = await enemyDetailRes.json();
        const myDetailData = myDetailRes ? await myDetailRes.json() : null;

        if (requestIdRef.current === myRequestId) {
          if (detailData.dataFields) {
            setCounterIntel(detailData.dataFields);
          } else if (detailData.data) {
            setCounterIntel(detailData.data);
          }
          if (detailData.realJungleTiming) {
            setEnemyJungleTiming(detailData.realJungleTiming);
          } else {
            setEnemyJungleTiming(null);
          }
          if (myDetailData?.realJungleTiming) {
            setMyJungleTiming(myDetailData.realJungleTiming);
          } else {
            setMyJungleTiming(null);
          }
        }
      } catch {
        if (requestIdRef.current === myRequestId) {
          setWarning(null);
          setCounterIntel(null);
          setEnemyJungleTiming(null);
          setMyJungleTiming(null);
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
      {/* 対面(レーン/JG)純粋戦績。他メンバーの影響(チーム勝敗)を除外した純粋実力指標 */}
      {warning?.laneRecord && (
        <div className="bg-white border-2 border-amber-500/40 rounded-2xl p-4 shadow-md animate-fade-in space-y-2.5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <h4 className="font-black text-stone-900 text-xs flex items-center gap-1.5">
              <Target className="w-4 h-4 text-amber-600" />
              純粋対面実力指標 ({warning.champion} vs {warning.enemyChampion})
            </h4>
            <span className="text-[11px] font-mono text-stone-500 font-bold">{warning.laneRecord.total}戦の実戦データ</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 純粋レーン/JG勝率 */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
                🛡️ 純粋対面勝率 (LDR/JDR)
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-xl font-black ${
                  warning.laneRecord.laneWinRate >= 60 ? 'text-emerald-700' :
                  warning.laneRecord.laneWinRate >= 45 ? 'text-amber-700' : 'text-rose-700'
                }`}>
                  {warning.laneRecord.laneWinRate}%
                </span>
                <span className="text-[10px] text-stone-500 font-bold">
                  ({warning.laneRecord.wins}勝 {warning.laneRecord.losses}敗)
                </span>
              </div>
            </div>

            {/* チーム勝敗 (味方ガチャ対比) */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[10px] font-extrabold text-stone-600 uppercase tracking-wider">
                👑 チーム勝率 (Nexus破壊)
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-black text-stone-800">
                  {warning.laneRecord.gameWinRate}%
                </span>
                {warning.laneRecord.carryConversionRate !== null && (
                  <span className="text-[10px] text-indigo-700 font-extrabold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                    勝率変換 {warning.laneRecord.carryConversionRate}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                🟢 {warning.laneRecord.wins}勝
              </span>
              {warning.laneRecord.evens > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200">
                  ⚪ {warning.laneRecord.evens}互角 (耐え)
                </span>
              )}
              <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                🔴 {warning.laneRecord.losses}敗
              </span>
            </div>

            {(warning.laneRecord.noiseMatchCount ?? 0) > 0 && (
              <span className="text-[10px] text-stone-500 font-medium">
                🛡️ 他レーン崩壊等のノイズ検知: {warning.laneRecord.noiseMatchCount}戦
              </span>
            )}
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
      <div className="bg-white/95 text-stone-900 border border-stone-200/90 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-600" />
            <h3 className="font-black text-sm text-stone-900">
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
            <span className="text-[9px] font-bold px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-300 rounded-full" title="対面データが登録されている場合のみ表示されます">
              対面データ参照
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-4 text-center text-xs text-stone-500 font-medium">
            対面 {enemyChampion} のカウンター情報を検索中...
          </div>
        ) : counterIntel ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 突くべき弱点 */}
            <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 uppercase">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>最大の弱点・つけ入る隙</span>
              </div>
              <p className="text-xs font-semibold text-stone-800 leading-relaxed">
                {counterIntel.weaknesses || '（弱点は未登録です）'}
              </p>
            </div>

            {/* 警戒パワースパイク */}
            <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>警戒パワースパイク</span>
              </div>
              <p className="text-xs font-semibold text-stone-800 leading-relaxed">
                {counterIntel.power_spikes || '（警戒スパイクは未登録です）'}
              </p>
            </div>

            {/* カウンタービルド・ルーン方針 */}
            <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>推奨ビルド・立ち回り</span>
              </div>
              <p className="text-xs font-semibold text-stone-800 leading-relaxed">
                {counterIntel.build_runes || '（推奨ビルドは未登録です）'}
              </p>
            </div>
          </div>
        ) : (
          /* ★ 2026-09-22: ここは counterIntel が null(=対面データを1件も取得できなかった)
             ときの分岐。以前は「正本データは最新パッチ26.15に適合済みです」と表示しており、
             取得失敗を「確認済みで問題なし」と伝える逆方向の嘘になっていた(パッチ番号も固定)。 */
          <p className="text-xs text-stone-500 text-center py-2 font-medium">
            対面 {enemyChampion} のデータはまだ登録されていません。
            <br />
            <span className="text-[11px] text-stone-400">（チャンピオン辞典で対面メモを追加すると、ここに表示されます）</span>
          </p>
        )}

        {/* 🦀 2026年 JGテンポ ＆ カニ争奪シミュレーター */}
        {enemyJungleTiming && (
          <div className="mt-3 pt-3 border-t border-stone-200 bg-stone-50/80 p-3.5 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-800 flex items-center gap-1.5">
                <span>🦀</span> 2026年 JGテンポ ＆ カニ争奪シミュレーター（vs {enemyChampion}）
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                2:55カニ / 5:00グラブ湧き基準
              </span>
            </div>

            {/* カニ遭遇危険度バナー（自陣JGと敵JGの両方のタイムが揃っている場合） */}
            {myJungleTiming?.externalFastestClearSec && enemyJungleTiming.externalFastestClearSec && (() => {
              const myClear = myJungleTiming.externalFastestClearSec;
              const enemyClear = enemyJungleTiming.externalFastestClearSec;
              const diff = enemyClear - myClear; // 正: 自陣が早い(リード), 負: 敵が早い(ビハインド)

              const isAdvantage = diff >= 8;
              const isDanger = diff <= -8;

              return (
                <div className={`p-2.5 rounded-lg border text-xs ${
                  isAdvantage ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                  isDanger ? 'bg-rose-50 border-rose-300 text-rose-900' :
                  'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between font-black text-[11px] mb-1">
                    <span className="flex items-center gap-1">
                      {isAdvantage ? '⚡ 【テンポ優位】リバー先制掌握 ＆ カニ先狩り可能' :
                       isDanger ? '⚠️ 【交戦危険】カニ直接鉢合わせ禁止 ＆ 逆サイド迂回推奨' :
                       '⚔️ 【互角接敵】リバー2v2/3v3寄りの速さ勝負'}
                    </span>
                    <span className="font-mono text-xs">
                      {diff > 0 ? `+${diff}秒リード` : diff < 0 ? `${diff}秒遅延` : '同時着'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {isAdvantage
                      ? `自陣(${champion} ${Math.floor(myClear/60)}:${String(myClear%60).padStart(2,'0')})が敵(${enemyChampion} ${Math.floor(enemyClear/60)}:${String(enemyClear%60).padStart(2,'0')})より${diff}秒早くフルクリア可能。先にリバー視界を取り、同サイドカニまたは敵逆サイド森へのインベードが極めて有効。`
                      : isDanger
                      ? `敵(${enemyChampion} ${Math.floor(enemyClear/60)}:${String(enemyClear%60).padStart(2,'0')})が自陣より${Math.abs(diff)}秒早く森を空にしてリバーに入ります。同じカニへ向かうと孤立デスする危険が高いため、逆サイドカニへ迂回するかレーナーの寄りを確認してください。`
                      : `自陣と敵のクリア完了時刻がほぼ同時（${Math.abs(diff)}秒差）です。2:55のカニ湧きで正面衝突するため、ミッド・サイドレーンのプッシュ状況（主導権）がない場合は無理に争奪せず引く判断が必要です。`}
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold">敵の最速フルクリア</div>
                <div className="text-xs font-black text-amber-700 mt-0.5 font-mono">
                  {enemyJungleTiming.externalFastestClearSec
                    ? `${Math.floor(enemyJungleTiming.externalFastestClearSec / 60)}分${String(enemyJungleTiming.externalFastestClearSec % 60).padStart(2, '0')}秒`
                    : 'データ収集中'}
                </div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold">自陣の最速フルクリア</div>
                <div className="text-xs font-black text-emerald-700 mt-0.5 font-mono">
                  {myJungleTiming?.externalFastestClearSec
                    ? `${Math.floor(myJungleTiming.externalFastestClearSec / 60)}分${String(myJungleTiming.externalFastestClearSec % 60).padStart(2, '0')}秒`
                    : 'レーナー/未選択'}
                </div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-stone-200 col-span-2 sm:col-span-1">
                <div className="text-[10px] text-stone-500 font-bold">敵のカニ(2:55)先行差</div>
                <div className="text-xs font-black text-stone-800 mt-0.5 font-mono">
                  {enemyJungleTiming.externalFastestClearSec
                    ? `${175 - enemyJungleTiming.externalFastestClearSec >= 0 ? '+' : ''}${175 - enemyJungleTiming.externalFastestClearSec}秒`
                    : '-'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🗺️ 初動3分ルート分岐フローチャート */}
        {champion && enemyChampion && (
          <div className="mt-3 pt-3 border-t border-stone-200">
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
          <div className="bg-white border-2 border-amber-500/80 rounded-3xl shadow-2xl w-full max-w-lg p-6 text-stone-900 space-y-4">
            {/* HUDヘッダー */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-pulse">⚡</span>
                <div>
                  <h2 className="text-base font-black text-amber-800 tracking-wider uppercase">
                    HUD 戦闘ブリーフィング
                  </h2>
                  <p className="text-[11px] text-stone-600 font-mono">
                    {champion || 'YOU'} vs <strong className="text-stone-900 text-xs">{enemyChampion}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHudOpen(false)}
                className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition"
              >
                ✕ 閉じる
              </button>
            </div>

            {/* 今日の焦点 (最上部強調) */}
            {todayFocus && (
              <div className="bg-amber-50 border border-amber-300 p-3 rounded-2xl space-y-1">
                <div className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1">
                  <span>🎯</span> TODAY&apos;S FOCUS (最重要意識)
                </div>
                <div className="text-sm font-black text-amber-950 leading-snug">
                  {todayFocus}
                </div>
              </div>
            )}

            {/* 3秒で把握できる結論グリッド */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                  <span>⚠️</span> 警戒パワースパイク
                </div>
                <p className="text-xs font-bold text-stone-800">
                  {counterIntel?.power_spikes || 'Lv2/Lv6到達時に注意'}
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <span>💡</span> 推奨立ち回り
                </div>
                <p className="text-xs font-bold text-stone-800">
                  {counterIntel?.build_runes || '早期防御靴 ＆ 視界確保'}
                </p>
              </div>
            </div>

            {/* 過去の自分からのメモ */}
            {warning?.memo && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs space-y-1">
                <div className="text-[10px] font-black text-rose-700 flex items-center gap-1">
                  <span>📝</span> 過去の自分からの警戒メモ
                </div>
                <p className="text-xs font-medium text-rose-950 whitespace-pre-wrap leading-relaxed">
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
