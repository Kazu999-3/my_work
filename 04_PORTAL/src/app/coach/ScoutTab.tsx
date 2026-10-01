"use client";

import { useState, useEffect } from "react";
import {
  Users, 
  Search, 
  RefreshCw, 
  Activity, 
  Sparkles, 
  ShieldAlert, 
  Compass, 
  Flame, 
  TrendingUp, 
  Zap, 
  Award,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Image from "next/image";
import { getChampIcon } from "../../lib/ddragonClient";

// 5v5シミュレータの自動反映(リアルタイム連携)用に、ライブ試合の参加者10人を
// {champion, isEnemy, isJungle}のシンプルな形へ整形して呼び出し元へ渡す型。
export type LiveRosterEntry = { champion: string; isEnemy: boolean; isJungle: boolean };

export default function ScoutTab({ onLiveMatchDetected }: {
  onLiveMatchDetected?: (myChampion: string, enemyChampion: string, roster?: LiveRosterEntry[]) => void
}) {
  const [riotId, setRiotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  // 鬼コーチ対策3箇条用のスライドインデックス
  const [adviceIndex, setAdviceIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("advice");

  // 常に「自身のRiot ID」を入力する運用のため、毎回入力させず前回値を記憶する。
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scout_own_riot_id');
      if (saved) setRiotId(saved);
    } catch {}
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riotId || !riotId.includes('#')) {
      setError("Riot IDは「名前#タグ」の形式で入力してください (例: Koike#JP1)。");
      return;
    }
    try { localStorage.setItem('scout_own_riot_id', riotId); } catch {}

    setLoading(true);
    setError("");
    setResult(null);
    setAdviceIndex(0); // 検索時にアドバイスインデックスをリセット

    try {
      const res = await fetch('/api/admin/live-match', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riotId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '検索エラーが発生しました。');

      setResult(data);

      // 実際に進行中のライブゲームで自分・対面の両チャンピオンが判明した場合のみ、
      // コーチページのマッチアップ分析を自動起動する(#① 手動タブ廃止に伴う自動化)。
      // プレマッチ(推定表示)時は本当の対面が存在しないため対象外。
      if (data.isGameActive && data.myChampionName && data.championName && onLiveMatchDetected) {
        const roster: LiveRosterEntry[] | undefined = Array.isArray(data.allParticipants)
          ? data.allParticipants
              .filter((p: any) => !!p.championName)
              .map((p: any) => ({ champion: p.championName, isEnemy: !!p.isEnemy, isJungle: p.role === 'JG' }))
          : undefined;
        onLiveMatchDetected(data.myChampionName, data.championName, roster);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">

        {/* ヘッダー */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-secondary-600 via-primary-600 to-danger-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Compass className="w-8 h-8 text-secondary-600" />
            <span>ソロキュー対戦相手偵察 (Live Lookup)</span>
          </h1>
          <p className="text-xs text-faint max-w-md mx-auto leading-relaxed">
            現在進行中のライブゲームを検知し、敵ジャングラーの開始ルート、プレイ傾向、およびメタ対策ヒントをリアルタイム抽出します。
          </p>
        </div>

        {/* 検索フォーム */}
        <form onSubmit={handleSearch} className="bg-black/3 backdrop-blur-xl border border-black/10 p-5 rounded-3xl shadow-2xl space-y-3">
          <label className="block text-xs font-black text-faint uppercase tracking-wider">
            自身の Riot ID
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-muted-strong" />
              <input 
                type="text"
                placeholder="SummonerName#TagLine"
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                className="w-full bg-black/5 border border-black/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold placeholder-gray-500 focus:outline-none focus:border-secondary-edge-strong/50 focus:ring-1 focus:ring-secondary-500/50 transition-all text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-secondary-500 to-primary-500 hover:from-secondary-400 hover:to-primary-400 disabled:from-gray-200 disabled:to-gray-200 text-black font-black px-6 py-3 rounded-2xl text-sm transition shadow-[0_4px_20px_rgba(6,182,212,0.25)] flex items-center gap-2 shrink-0 disabled:text-faint"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
              <span>{loading ? 'スキャン中...' : '偵察開始'}</span>
            </button>
          </div>
        </form>

        {/* エラー表示 */}
        {error && (
          <div className="bg-danger-100 border border-danger-edge-soft p-4 rounded-2xl flex items-start gap-3 text-sm text-danger-700 font-bold">
            <ShieldAlert className="w-5 h-5 shrink-0 text-danger-600" />
            <div className="space-y-1">
              <div>エラーが発生しました</div>
              <p className="text-xs font-medium text-faint leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="space-y-6">
            {result.isPreMatch && (
              <div className="bg-primary-100 border border-primary-edge-soft p-4 rounded-2xl flex items-center gap-3 text-xs text-primary-700 font-bold">
                <Sparkles className="w-5 h-5 shrink-0 text-primary-600 animate-pulse" />
                <div>現在ゲーム中ではありません。直近戦績に基づくプレマッチ（試合前）のスカウティング分析を表示しています。</div>
              </div>
            )}

            {(!result.isGameActive && !result.isPreMatch) ? (
              <div className="bg-black/3 border border-black/10 rounded-3xl p-10 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto border border-black/10 text-muted-strong">
                  <Activity className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-foreground">ゲーム中ではありません</h3>
                  <p className="text-xs text-faint max-w-sm mx-auto leading-relaxed">
                    {result.message || '指定されたプレイヤーは現在進行中のマッチが見つかりませんでした。'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  
                  {/* 敵ジャングラープロフィール */}
                  <div className="bg-black/3 border border-black/10 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center gap-4 border-b border-black/10 pb-4">
                      <Image
                        src={getChampIcon(result.championName)}
                        alt={result.championName}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-2xl border border-black/10 shadow-lg"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="text-[10px] text-muted-strong font-black tracking-wider uppercase">{result.isPreMatch ? "分析対象 (Target Player)" : "敵ジャングラー (Opponent JG)"}</div>
                        <div className="text-lg font-black text-foreground flex flex-wrap items-center gap-2">
                          <span>{result.enemyJgName}</span>
                          <span className="text-xs text-secondary-700 font-bold bg-secondary-100 px-2 py-0.5 rounded border border-secondary-edge-soft">
                            {result.championName}
                          </span>

                          {/* OTP 警告アラートバッジ */}
                          {result.isOtp && (
                            <span className="text-[10px] text-primary-700 bg-primary-100 px-2.5 py-1 rounded border border-primary-edge-soft font-black animate-pulse flex items-center gap-1">
                              🔥 OTP警告: {result.otpChampion}
                            </span>
                          )}

                          {/* ティルト警告アラートバッジ */}
                          {result.isTilted && (
                            <span className="text-[10px] text-secondary-700 bg-secondary-100 px-2.5 py-1 rounded border border-secondary-edge-soft font-black animate-pulse flex items-center gap-1">
                              ❄️ ティルト警戒 ({result.consecutiveLosses}連敗中)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <h4 className="text-xs font-black text-faint uppercase tracking-wider">{result.isPreMatch ? "あなたのプレイスタイル・スライダー" : "敵のプレイスタイル・スライダー"} (Playstyle Sliders)</h4>
                      {result.playstyle.dataInsufficient && (
                        <div className="text-[10px] font-bold text-primary-700 bg-primary-100 border border-primary-edge-soft rounded-xl px-3 py-2">
                          ⚠️ 過去の対戦データが取得できなかったため、以下は実測値ではなく暫定的な推定値です。
                        </div>
                      )}
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-faint">Passive (自重)</span>
                            <span className="text-primary-600 font-mono font-black">{result.playstyle.sliders.aggressive}%</span>
                            <span className="text-danger-600">Aggressive (攻撃)</span>
                          </div>
                          <div className="h-2.5 w-full bg-black/10 rounded-full overflow-hidden border border-black/10 p-[1px]">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-gray-700 via-primary-500 to-danger-600 transition-all duration-500"
                              style={{ width: `${result.playstyle.sliders.aggressive}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-success-600">Ganking (関与)</span>
                            <span className="text-secondary-600 font-mono font-black">{result.playstyle.sliders.farming}%</span>
                            <span className="text-secondary-600">Farming (成長)</span>
                          </div>
                          <div className="h-2.5 w-full bg-black/10 rounded-full overflow-hidden border border-black/10 p-[1px]">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-success-500 via-secondary-500 to-secondary-600 transition-all duration-500"
                              style={{ width: `${result.playstyle.sliders.farming}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-black/10">
                      <h4 className="text-xs font-black text-faint uppercase tracking-wider">{result.isPreMatch ? "あなたのプレイスタイルタグ" : "プレイスタイルタグ"} (Playstyle Tags)</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.playstyle.tags.map((tag: any) => (
                          <div 
                            key={tag.id}
                            className="bg-secondary-100 border border-secondary-edge-soft px-3 py-2 rounded-2xl space-y-1"
                          >
                            <div className="text-xs font-black text-secondary-700">{tag.name}</div>
                            <p className="text-[10px] text-faint leading-relaxed">{tag.description}</p>
                            <div className="text-[8px] text-muted-strong font-mono text-right">{tag.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sovereign Advisor タクティカルパネル */}
                  <div className="bg-black/3 border border-black/10 rounded-3xl p-6 shadow-xl space-y-4">
                    {/* タブヘッダー */}
                    <div className="flex border-b border-black/10 pb-1 gap-2">
                      <button
                        onClick={() => setActiveTab("advice")}
                        className={`px-4 py-2.5 text-xs font-black transition-all rounded-t-xl border-b-2 uppercase tracking-wider flex items-center gap-1.5 ${
                          activeTab === "advice"
                            ? "border-danger-edge-strong text-danger-700 bg-danger-100"
                            : "border-transparent text-faint hover:text-foreground"
                        }`}
                      >
                        <Flame className="w-4 h-4" />
                        <span>AIリアルタイム指示</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("knowledge")}
                        className={`px-4 py-2.5 text-xs font-black transition-all rounded-t-xl border-b-2 uppercase tracking-wider flex items-center gap-1.5 ${
                          activeTab === "knowledge"
                            ? "border-secondary-edge-strong text-secondary-700 bg-secondary-100"
                            : "border-transparent text-faint hover:text-foreground"
                        }`}
                      >
                        <Compass className="w-4 h-4" />
                        <span>攻略マニュアル</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("lessons")}
                        className={`px-4 py-2.5 text-xs font-black transition-all rounded-t-xl border-b-2 uppercase tracking-wider flex items-center gap-1.5 ${
                          activeTab === "lessons"
                            ? "border-primary-edge-strong text-primary-700 bg-primary-100"
                            : "border-transparent text-faint hover:text-foreground"
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>過去の教訓 ({result.knowledge?.pastInterrogation?.length || 0})</span>
                      </button>
                    </div>

                    {/* タブコンテンツ */}
                    {activeTab === "advice" && (
                      <div className="space-y-4">
                        {/* 鬼コーチAIの対面対策3箇条 (スライダー形式) */}
                        {result.coachAdvice && result.coachAdvice.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs font-bold text-faint">
                              <span>{result.isPreMatch ? "鬼コーチあなたへのアドバイス3箇条" : "鬼コーチ緊急指令3箇条"}</span>
                              <span className="font-mono">{adviceIndex + 1} / {result.coachAdvice.length}</span>
                            </div>

                            {/* スライド本文 */}
                            <div className="min-h-[140px] bg-black/5 p-5 rounded-2xl border border-danger-edge-soft flex flex-col justify-between space-y-4 relative overflow-hidden">
                              <div className="space-y-2">
                                <div className="text-xs font-black text-primary-700 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                                  <span>{result.coachAdvice[adviceIndex]?.title}</span>
                                </div>
                                <p className="text-[11px] text-danger-800 leading-relaxed font-medium">
                                  {result.coachAdvice[adviceIndex]?.detail}
                                </p>
                              </div>

                              {/* スライド切替ボタン */}
                              <div className="flex justify-end gap-1.5 pt-2">
                                <button
                                  type="button"
                                  disabled={adviceIndex === 0}
                                  onClick={() => setAdviceIndex((prev) => prev - 1)}
                                  className="bg-black/5 hover:bg-black/10 disabled:opacity-30 border border-black/10 p-1.5 rounded-lg transition"
                                >
                                  <ChevronLeft className="w-4 h-4 text-faint" />
                                </button>
                                <button
                                  type="button"
                                  disabled={adviceIndex === result.coachAdvice.length - 1}
                                  onClick={() => setAdviceIndex((prev) => prev + 1)}
                                  className="bg-black/5 hover:bg-black/10 disabled:opacity-30 border border-black/10 p-1.5 rounded-lg transition"
                                >
                                  <ChevronRight className="w-4 h-4 text-faint" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* 一般解説ヒント */}
                        <div className="bg-black/3 border border-black/10 p-4 rounded-2xl text-[11px] text-foreground-subtle leading-relaxed">
                          <strong className="text-secondary-600 block mb-1">💡 全体対策アドバイス</strong>
                          {result.tips}
                        </div>
                      </div>
                    )}

                    {activeTab === "knowledge" && (
                      <div className="space-y-4">
                        {/* ナレッジマニュアル表示 */}
                        {!result.knowledge?.strategy && !result.knowledge?.strengths ? (
                          <div className="text-center py-8 text-xs text-muted-strong">
                            このチャンピオンのGLOBAL攻略データはまだ登録されていません。
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-black/5 border border-black/10 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-success-600 font-black tracking-wider uppercase block">💪 対面の強み (Strengths)</span>
                                <p className="text-[11px] text-foreground-subtle leading-relaxed">{result.knowledge.strengths || "未登録"}</p>
                              </div>
                              <div className="bg-black/5 border border-black/10 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-danger-600 font-black tracking-wider uppercase block">☠️ 対面の弱み (Weaknesses)</span>
                                <p className="text-[11px] text-foreground-subtle leading-relaxed">{result.knowledge.weaknesses || "未登録"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-black/5 border border-black/10 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-primary-600 font-black tracking-wider uppercase block">⚡ パワースパイク (Power Spikes)</span>
                                <p className="text-[11px] text-foreground-subtle leading-relaxed">{result.knowledge.powerSpikes || "未登録"}</p>
                              </div>
                              <div className="bg-black/5 border border-black/10 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-secondary-600 font-black tracking-wider uppercase block">🌲 周回クリアルート (2026 Full Clear Path)</span>
                                <p className="text-[11px] text-foreground-subtle leading-relaxed font-bold">{result.knowledge.fullClearTime || "未登録"}</p>
                              </div>
                            </div>

                            <div className="bg-black/5 border border-black/10 p-4 rounded-2xl space-y-1.5">
                              <span className="text-[10px] text-secondary-600 font-black tracking-wider uppercase block">🛡️ 推奨ビルドとルーン (Build / Runes)</span>
                              <p className="text-[11px] text-foreground-subtle leading-relaxed whitespace-pre-wrap">{result.knowledge.buildRunes || "未登録"}</p>
                            </div>

                            <div className="bg-black/5 border border-black/10 p-4 rounded-2xl space-y-1.5">
                              <span className="text-[10px] text-secondary-700 font-black tracking-wider uppercase block">📖 基本攻略・戦略 (Strategy)</span>
                              <p className="text-[11px] text-foreground-subtle leading-relaxed whitespace-pre-wrap">{result.knowledge.strategy || "未登録"}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "lessons" && (
                      <div className="space-y-4">
                        {/* 過去の反省点表示 */}
                        {!result.knowledge?.pastInterrogation || result.knowledge.pastInterrogation.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted-strong">
                            このチャンピオン対面での過去の敗因反省データ（教訓）はありません。良好な状態です！
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-primary-100 border border-primary-edge-soft p-4 rounded-2xl text-[11px] text-primary-800 leading-relaxed flex items-start gap-2.5">
                              <ShieldAlert className="w-4 h-4 shrink-0 text-primary-600" />
                              <div>
                                <span className="font-black block">過去の教訓を活かして同じ失敗を防ぎなさい</span>
                                ユーザーが対戦後に記録したリアルな敗因データです。戦術アドバイザーがこれらを加味した指令を生成しています。
                              </div>
                            </div>
                            <div className="space-y-2">
                              {result.knowledge.pastInterrogation.map((lesson: string, idx: number) => (
                                <div key={idx} className="bg-black/5 border border-danger-edge-soft p-4 rounded-2xl text-xs text-danger-800 leading-relaxed flex gap-2">
                                  <span className="text-danger-600 font-bold font-mono">#{idx+1}</span>
                                  <p className="font-medium whitespace-pre-wrap">{lesson}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 敵チーム全員の簡易分析グリッド */}
                  {result.allParticipants && result.allParticipants.some((p: any) => p.isEnemy) && (
                    <div className="bg-black/3 border border-black/10 rounded-3xl p-6 shadow-xl space-y-5">
                      {/* 🎯 敵の穴特定 ＆ JGガンク優先度サマリー */}
                      {(() => {
                        const enemies = result.allParticipants.filter((p: any) => p.isEnemy);
                        // ガンク優先度スコアの算出 (連敗ティルト: +35, 被FB率高: +30, 低勝率: +20, OTP: -30)
                        const scoredEnemies = enemies.map((e: any) => {
                          let score = 50;
                          const reasons: string[] = [];
                          if (e.isTilted || (e.consecutiveLosses && e.consecutiveLosses >= 3)) {
                            score += 35;
                            reasons.push(`${e.consecutiveLosses || 3}連敗中(ティルト警戒)`);
                          }
                          if (e.fbRate && e.fbRate >= 25) {
                            score += 30;
                            reasons.push(`被ファーストブラッド率高(${e.fbRate}%)`);
                          } else if (e.isVulnerable) {
                            score += 25;
                            reasons.push(`直近戦績不調(狙い目)`);
                          }
                          if (e.winRate && e.winRate <= 40) {
                            score += 20;
                            reasons.push(`直近勝率低迷(${e.winRate}%)`);
                          }
                          if (e.isOtp) {
                            score -= 30;
                            reasons.push(`直近ピック集中(${e.otpChampion || e.championName})`);
                          }
                          return { ...e, gankScore: score, reasons };
                        }).sort((a: any, b: any) => b.gankScore - a.gankScore);

                        const primaryTarget = scoredEnemies[0];
                        const avoidTarget = [...scoredEnemies].reverse().find((e: any) => e.isOtp || e.gankScore < 40);

                        return (
                          <div className="bg-gradient-to-r from-danger-900/10 via-primary-900/5 to-transparent border border-danger-edge rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black text-danger-950 flex items-center gap-1.5 uppercase tracking-wider">
                                <Zap className="w-4 h-4 text-danger-600 animate-pulse" />
                                <span>ローディング速報: JGガンク優先ターゲット診断</span>
                              </h4>
                              <span className="text-[10px] font-black bg-danger-600 text-white px-2 py-0.5 rounded-full">
                                敵の隙を自動検知
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {/* 🎯 最優先ガンクターゲット */}
                              {primaryTarget && (
                                <div className="bg-surface p-3 rounded-xl border border-danger-edge-soft shadow-2xs space-y-1">
                                  <div className="text-[10px] font-black text-danger-600 flex items-center gap-1">
                                    <span>🎯</span> 【最優先破壊レーン】
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Image
                                      src={getChampIcon(primaryTarget.championName || 'Unknown')}
                                      alt={primaryTarget.championName || 'Champ'}
                                      width={28}
                                      height={28}
                                      className="rounded-lg border border-danger-edge-soft"
                                    />
                                    <div>
                                      <div className="font-black text-foreground">
                                        {primaryTarget.role}: {primaryTarget.championName} ({primaryTarget.name})
                                      </div>
                                      <div className="text-[10px] text-danger-700 font-bold">
                                        ⚠️ 理由: {primaryTarget.reasons.join('、') || '立ち位置の甘さを突く'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 🛡️ 警戒・放置推奨レーン */}
                              {avoidTarget && avoidTarget.name !== primaryTarget?.name && (
                                <div className="bg-surface p-3 rounded-xl border border-border shadow-2xs space-y-1">
                                  <div className="text-[10px] font-black text-muted flex items-center gap-1">
                                    <span>🛡️</span> 【警戒・カウンター警戒レーン】
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Image
                                      src={getChampIcon(avoidTarget.championName || 'Unknown')}
                                      alt={avoidTarget.championName || 'Champ'}
                                      width={28}
                                      height={28}
                                      className="rounded-lg border border-border"
                                    />
                                    <div>
                                      <div className="font-black text-foreground">
                                        {avoidTarget.role}: {avoidTarget.championName} ({avoidTarget.name})
                                      </div>
                                      <div className="text-[10px] text-muted font-medium">
                                        熟練度が高いため、無理なダイブを避け味方の救援優先
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-black/10 pb-3">
                        <Users className="w-4 h-4 text-secondary-600" />
                        <span>敵チーム メンバー情報 & ガンク脆弱レーン特定</span>
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-muted-strong border-b border-black/10 pb-2">
                              <th className="pb-2 font-bold uppercase tracking-wider">プレイヤー / チャンピオン</th>
                              <th className="pb-2 font-bold uppercase tracking-wider text-center">ロール</th>
                              <th className="pb-2 font-bold uppercase tracking-wider text-center">ソロQ勝率</th>
                              <th className="pb-2 font-bold uppercase tracking-wider text-right">ステータス / アラート</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/10">
                            {result.allParticipants
                              .filter((p: any) => p.isEnemy)
                              .map((p: any, idx: number) => {
                                // championNameはバックエンドがDDragonで正式に名前解決した値。
                                // 以前はここで19体だけのハードコードマップを使っており、
                                // それ以外のチャンピオンは全部LeeSin表示になっていた(#②)。
                                const champName = p.championName || 'Unknown';
                                return (
                                  <tr key={idx} className="hover:bg-black/3 transition-colors">
                                    <td className="py-3 flex items-center gap-2.5">
                                      <Image
                                        src={getChampIcon(champName)}
                                        alt={champName}
                                        width={32}
                                        height={32}
                                        className="w-8 h-8 rounded-lg border border-black/10 shadow"
                                      />
                                      <div>
                                        <div className="font-black text-foreground">{p.name}</div>
                                        <div className="text-[10px] text-secondary-600 font-bold">{champName}</div>
                                      </div>
                                    </td>
                                    <td className="py-3 text-center font-mono font-bold text-faint">
                                      {p.role}
                                    </td>
                                    <td className="py-3 text-center">
                                      {p.dataInsufficient ? (
                                        <span className="text-[10px] text-muted-strong font-bold">データ不足</span>
                                      ) : (
                                        <span className={`font-mono font-black ${
                                          p.winRate >= 55 ? 'text-success-600' : p.winRate <= 40 ? 'text-danger-600 animate-pulse' : 'text-primary-600'
                                        }`}>
                                          {p.winRate}%
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 text-right space-y-1">
                                      {p.isOtp && (
                                        <span className="inline-block text-[9px] text-primary-700 bg-primary-100 px-2 py-0.5 rounded border border-primary-edge-soft font-black">
                                          🔥 OTP ({p.otpChampion})
                                        </span>
                                      )}
                                      {p.isTilted && (
                                        <span className="inline-block text-[9px] text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded border border-secondary-edge-soft font-black ml-1">
                                          ❄️ 連敗ティルト ({p.consecutiveLosses}連敗)
                                        </span>
                                      )}
                                      {p.isVulnerable && (
                                        <span className="inline-block text-[9px] text-danger-700 bg-danger-100 px-2 py-0.5 rounded border border-danger-edge-soft font-black ml-1 animate-pulse">
                                          🎯 集中Gank推奨 ({p.fbRate ? `被FB: ${p.fbRate}%` : '直近不調'})
                                        </span>
                                      )}
                                      {p.dataInsufficient && !p.isOtp && !p.isTilted && !p.isVulnerable && (
                                        <span className="text-[10px] text-muted-strong font-bold">戦績データなし</span>
                                      )}
                                      {!p.dataInsufficient && !p.isOtp && !p.isTilted && !p.isVulnerable && (
                                        <span className="text-[10px] text-muted-strong font-bold">特記事項なし</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                <div className="space-y-6">
                  <div className="bg-black/3 border border-black/10 rounded-3xl p-6 shadow-xl space-y-5">
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-black/10 pb-3">
                      <Compass className="w-4 h-4 text-secondary-600" />
                      <span>{result.isPreMatch ? "あなたのゲーム序盤傾向" : "ゲーム序盤戦術予測"}</span>
                    </h3>

                    <div className="space-y-2 bg-black/5 p-4 rounded-2xl border border-black/10">
                      <div className="text-[10px] text-muted-strong font-black tracking-wider uppercase">{result.isPreMatch ? "あなたの開始バフ傾向" : "予測開始位置"}</div>
                      <div className="text-xs font-black text-primary-600 leading-relaxed">
                        {result.startBuffPrediction}
                      </div>
                    </div>

                    <div className="space-y-2 bg-black/5 p-4 rounded-2xl border border-black/10">
                      <div className="text-[10px] text-muted-strong font-black tracking-wider uppercase">{result.isPreMatch ? "あなたのファーストGank傾向" : "ファーストGank予測"}</div>
                      <div className="text-xs font-black text-danger-600 leading-relaxed">
                        {result.firstGankTarget}
                      </div>
                    </div>

                    {/* 対JG推奨カウンター & 解説。辞典に実データ(counterChampions)がある場合は
                        そちらをそのまま表示する。無い場合のみ下の汎用フォールバックを使う
                        （以前は数体だけの手書きデータで、それ以外は毎回同じ結果になっていた）。 */}
                    {result.hasRealCounterData && result.knowledge?.counterChampions && (
                      <div className="space-y-2 pt-3 border-t border-black/10">
                        <h4 className="text-[10px] text-muted-strong font-black tracking-wider uppercase flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-primary-600" />
                          <span>対面カウンター情報（辞典データ）</span>
                        </h4>
                        <div className="bg-black/5 p-4 rounded-2xl border border-primary-edge-soft">
                          <p className="text-[11px] text-foreground-subtle leading-relaxed whitespace-pre-wrap">{result.knowledge.counterChampions}</p>
                        </div>
                      </div>
                    )}

                    {!result.hasRealCounterData && result.counters && result.counters.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-black/10">
                        <h4 className="text-[10px] text-muted-strong font-black tracking-wider uppercase flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-primary-600 animate-pulse" />
                          <span>{result.isPreMatch ? "あなたに対する推奨カウンター & 弱点対策" : "対JG推奨カウンター & 解説"}</span>
                        </h4>
                        <div className="space-y-3">
                          {result.counters.map((c: any, idx: number) => (
                            <div key={idx} className="bg-black/5 p-4 rounded-2xl border border-primary-edge-soft space-y-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={getChampIcon(c.championName)}
                                    alt={c.championName}
                                    width={28}
                                    height={28}
                                    className="w-7 h-7 rounded-lg border border-black/10"
                                  />
                                  <span className="text-xs font-black text-primary-700">{c.championName}</span>
                                </div>
                                <span className="text-[10px] font-black text-success-800 bg-success-100/90 px-2 py-0.5 rounded border border-success-edge-soft/80">
                                  有利カウンター
                                </span>
                              </div>
                              <p className="text-[10px] text-foreground-subtle leading-relaxed font-medium">
                                {c.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 pt-3 border-t border-black/10">
                      <h4 className="text-[10px] text-muted-strong font-black tracking-wider uppercase">{result.isPreMatch ? "あなたの平均9分スタッツ先行度" : "敵の平均9分スタッツ先行度"}</h4>
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-faint">ゴールド先行度</span>
                            <span className="text-primary-600">+{result.playstyle.diffs.goldDiff} G</span>
                          </div>
                          <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500" style={{ width: `${Math.min(100, (result.playstyle.diffs.goldDiff / 600) * 100)}%` }}></div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-faint">CS先行度</span>
                            <span className="text-success-600">+{result.playstyle.diffs.csDiff} CS</span>
                          </div>
                          <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                            <div className="h-full bg-success-500" style={{ width: `${Math.min(100, (result.playstyle.csDiff || result.playstyle.diffs.csDiff || 1) * 10)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

    </div>
  );
}
