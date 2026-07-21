"use client";

import { useState } from "react";
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
import { getChampIcon } from "../../lib/ddragonClient";

export default function ScoutTab() {
  const [riotId, setRiotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  // 鬼コーチ対策3箇条用のスライドインデックス
  const [adviceIndex, setAdviceIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("advice");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riotId || !riotId.includes('#')) {
      setError("Riot IDは「名前#タグ」の形式で入力してください (例: Koike#JP1)。");
      return;
    }

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-slate-950 to-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ヘッダー */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Compass className="w-8 h-8 text-cyan-400" />
            <span>ソロキュー対戦相手偵察 (Live Lookup)</span>
          </h1>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            現在進行中のライブゲームを検知し、敵ジャングラーの開始ルート、プレイ傾向、およびメタ対策ヒントをリアルタイム抽出します。
          </p>
        </div>

        {/* 検索フォーム */}
        <form onSubmit={handleSearch} className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl space-y-3">
          <label className="block text-xs font-black text-gray-400 uppercase tracking-wider">
            自身の Riot ID
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
              <input 
                type="text"
                placeholder="SummonerName#TagLine"
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 disabled:from-gray-800 disabled:to-gray-800 text-black font-black px-6 py-3 rounded-2xl text-sm transition shadow-[0_4px_20px_rgba(6,182,212,0.25)] flex items-center gap-2 shrink-0 disabled:text-gray-600"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Compass className="w-4 h-4" />}
              <span>{loading ? 'スキャン中...' : '偵察開始'}</span>
            </button>
          </div>
        </form>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-sm text-red-400 font-bold">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
            <div className="space-y-1">
              <div>エラーが発生しました</div>
              <p className="text-xs font-medium text-gray-400 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="space-y-6">
            {result.isPreMatch && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 text-xs text-amber-400 font-bold">
                <Sparkles className="w-5 h-5 shrink-0 text-amber-400 animate-pulse" />
                <div>現在ゲーム中ではありません。直近戦績に基づくプレマッチ（試合前）のスカウティング分析を表示しています。</div>
              </div>
            )}

            {(!result.isGameActive && !result.isPreMatch) ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-10 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/5 text-gray-500">
                  <Activity className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white">ゲーム中ではありません</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                    {result.message || '指定されたプレイヤーは現在進行中のマッチが見つかりませんでした。'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  
                  {/* 敵ジャングラープロフィール */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                      <img 
                        src={getChampIcon(result.championName)} 
                        alt={result.championName} 
                        className="w-16 h-16 rounded-2xl border border-white/10 shadow-lg"
                      />
                      <div className="space-y-1 flex-1">
                        <div className="text-[10px] text-gray-500 font-black tracking-wider uppercase">{result.isPreMatch ? "分析対象 (Target Player)" : "敵ジャングラー (Opponent JG)"}</div>
                        <div className="text-lg font-black text-white flex flex-wrap items-center gap-2">
                          <span>{result.enemyJgName}</span>
                          <span className="text-xs text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            {result.championName}
                          </span>
                          
                          {/* OTP 警告アラートバッジ */}
                          {result.isOtp && (
                            <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded border border-orange-500/20 font-black animate-pulse flex items-center gap-1">
                              🔥 OTP警告: {result.otpChampion}
                            </span>
                          )}

                          {/* ティルト警告アラートバッジ */}
                          {result.isTilted && (
                            <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20 font-black animate-pulse flex items-center gap-1">
                              ❄️ ティルト警戒 ({result.consecutiveLosses}連敗中)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">{result.isPreMatch ? "あなたのプレイスタイル・スライダー" : "敵のプレイスタイル・スライダー"} (Playstyle Sliders)</h4>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-gray-400">Passive (自重)</span>
                            <span className="text-amber-400 font-mono font-black">{result.playstyle.sliders.aggressive}%</span>
                            <span className="text-rose-400">Aggressive (攻撃)</span>
                          </div>
                          <div className="h-2.5 w-full bg-gray-950 rounded-full overflow-hidden border border-white/5 p-[1px]">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-gray-700 via-amber-500 to-rose-600 transition-all duration-500"
                              style={{ width: `${result.playstyle.sliders.aggressive}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-emerald-400">Ganking (関与)</span>
                            <span className="text-cyan-400 font-mono font-black">{result.playstyle.sliders.farming}%</span>
                            <span className="text-blue-400">Farming (成長)</span>
                          </div>
                          <div className="h-2.5 w-full bg-gray-950 rounded-full overflow-hidden border border-white/5 p-[1px]">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 transition-all duration-500"
                              style={{ width: `${result.playstyle.sliders.farming}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">{result.isPreMatch ? "あなたのプレイスタイルタグ" : "プレイスタイルタグ"} (Playstyle Tags)</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.playstyle.tags.map((tag: any) => (
                          <div 
                            key={tag.id}
                            className="bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 rounded-2xl space-y-1"
                          >
                            <div className="text-xs font-black text-cyan-300">{tag.name}</div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">{tag.description}</p>
                            <div className="text-[8px] text-gray-500 font-mono text-right">{tag.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sovereign Advisor タクティカルパネル */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                    {/* タブヘッダー */}
                    <div className="flex border-b border-white/5 pb-1 gap-2">
                      <button
                        onClick={() => setActiveTab("advice")}
                        className={`px-4 py-2.5 text-xs font-black transition-all rounded-t-xl border-b-2 uppercase tracking-wider flex items-center gap-1.5 ${
                          activeTab === "advice"
                            ? "border-red-500 text-red-400 bg-red-500/5"
                            : "border-transparent text-gray-400 hover:text-white"
                        }`}
                      >
                        <Flame className="w-4 h-4" />
                        <span>AIリアルタイム指示</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("knowledge")}
                        className={`px-4 py-2.5 text-xs font-black transition-all rounded-t-xl border-b-2 uppercase tracking-wider flex items-center gap-1.5 ${
                          activeTab === "knowledge"
                            ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
                            : "border-transparent text-gray-400 hover:text-white"
                        }`}
                      >
                        <Compass className="w-4 h-4" />
                        <span>攻略マニュアル</span>
                      </button>
                      <button
                        onClick={() => setActiveTab("lessons")}
                        className={`px-4 py-2.5 text-xs font-black transition-all rounded-t-xl border-b-2 uppercase tracking-wider flex items-center gap-1.5 ${
                          activeTab === "lessons"
                            ? "border-amber-500 text-amber-400 bg-amber-500/5"
                            : "border-transparent text-gray-400 hover:text-white"
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
                            <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                              <span>{result.isPreMatch ? "鬼コーチあなたへのアドバイス3箇条" : "鬼コーチ緊急指令3箇条"}</span>
                              <span className="font-mono">{adviceIndex + 1} / {result.coachAdvice.length}</span>
                            </div>

                            {/* スライド本文 */}
                            <div className="min-h-[140px] bg-black/40 p-5 rounded-2xl border border-red-500/10 flex flex-col justify-between space-y-4 relative overflow-hidden">
                              <div className="space-y-2">
                                <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{result.coachAdvice[adviceIndex]?.title}</span>
                                </div>
                                <p className="text-[11px] text-red-100/90 leading-relaxed font-medium">
                                  {result.coachAdvice[adviceIndex]?.detail}
                                </p>
                              </div>

                              {/* スライド切替ボタン */}
                              <div className="flex justify-end gap-1.5 pt-2">
                                <button
                                  type="button"
                                  disabled={adviceIndex === 0}
                                  onClick={() => setAdviceIndex((prev) => prev - 1)}
                                  className="bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5 p-1.5 rounded-lg transition"
                                >
                                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                                </button>
                                <button
                                  type="button"
                                  disabled={adviceIndex === result.coachAdvice.length - 1}
                                  onClick={() => setAdviceIndex((prev) => prev + 1)}
                                  className="bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5 p-1.5 rounded-lg transition"
                                >
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* 一般解説ヒント */}
                        <div className="bg-black/30 border border-white/5 p-4 rounded-2xl text-[11px] text-gray-300 leading-relaxed">
                          <strong className="text-cyan-400 block mb-1">💡 全体対策アドバイス</strong>
                          {result.tips}
                        </div>
                      </div>
                    )}

                    {activeTab === "knowledge" && (
                      <div className="space-y-4">
                        {/* ナレッジマニュアル表示 */}
                        {!result.knowledge?.strategy && !result.knowledge?.strengths ? (
                          <div className="text-center py-8 text-xs text-gray-500">
                            このチャンピオンのGLOBAL攻略データはまだ登録されていません。
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-emerald-400 font-black tracking-wider uppercase block">💪 対面の強み (Strengths)</span>
                                <p className="text-[11px] text-gray-300 leading-relaxed">{result.knowledge.strengths || "未登録"}</p>
                              </div>
                              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-rose-400 font-black tracking-wider uppercase block">☠️ 対面の弱み (Weaknesses)</span>
                                <p className="text-[11px] text-gray-300 leading-relaxed">{result.knowledge.weaknesses || "未登録"}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-amber-400 font-black tracking-wider uppercase block">⚡ パワースパイク (Power Spikes)</span>
                                <p className="text-[11px] text-gray-300 leading-relaxed">{result.knowledge.powerSpikes || "未登録"}</p>
                              </div>
                              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-1.5">
                                <span className="text-[10px] text-cyan-400 font-black tracking-wider uppercase block">🌲 周回クリアルート (Full Clear Path)</span>
                                <p className="text-[11px] text-gray-300 leading-relaxed font-bold">{result.knowledge.fullClearTime || "未登録"}</p>
                              </div>
                            </div>

                            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-1.5">
                              <span className="text-[10px] text-blue-400 font-black tracking-wider uppercase block">🛡️ 推奨ビルドとルーン (Build / Runes)</span>
                              <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{result.knowledge.buildRunes || "未登録"}</p>
                            </div>

                            <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-1.5">
                              <span className="text-[10px] text-cyan-300 font-black tracking-wider uppercase block">📖 基本攻略・戦略 (Strategy)</span>
                              <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{result.knowledge.strategy || "未登録"}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "lessons" && (
                      <div className="space-y-4">
                        {/* 過去の反省点表示 */}
                        {!result.knowledge?.pastInterrogation || result.knowledge.pastInterrogation.length === 0 ? (
                          <div className="text-center py-8 text-xs text-gray-500">
                            このチャンピオン対面での過去の敗因反省データ（教訓）はありません。良好な状態です！
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-2.5">
                              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                              <div>
                                <span className="font-black block">過去の教訓を活かして同じ失敗を防ぎなさい</span>
                                ユーザーが対戦後に記録したリアルな敗因データです。戦術アドバイザーがこれらを加味した指令を生成しています。
                              </div>
                            </div>
                            <div className="space-y-2">
                              {result.knowledge.pastInterrogation.map((lesson: string, idx: number) => (
                                <div key={idx} className="bg-black/40 border border-red-500/10 p-4 rounded-2xl text-xs text-red-100/90 leading-relaxed flex gap-2">
                                  <span className="text-red-400 font-bold font-mono">#{idx+1}</span>
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
                    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span>敵チーム メンバー情報 & ガンク脆弱レーン特定</span>
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-white/5 pb-2">
                              <th className="pb-2 font-bold uppercase tracking-wider">プレイヤー / チャンピオン</th>
                              <th className="pb-2 font-bold uppercase tracking-wider text-center">ロール</th>
                              <th className="pb-2 font-bold uppercase tracking-wider text-center">ソロQ勝率</th>
                              <th className="pb-2 font-bold uppercase tracking-wider text-right">ステータス / アラート</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {result.allParticipants
                              .filter((p: any) => p.isEnemy)
                              .map((p: any, idx: number) => {
                                const champName = getChampNameFromId(p.championId);
                                return (
                                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-3 flex items-center gap-2.5">
                                      <img 
                                        src={getChampIcon(champName)} 
                                        alt={champName} 
                                        className="w-8 h-8 rounded-lg border border-white/10 shadow"
                                      />
                                      <div>
                                        <div className="font-black text-white">{p.name}</div>
                                        <div className="text-[10px] text-cyan-400 font-bold">{champName}</div>
                                      </div>
                                    </td>
                                    <td className="py-3 text-center font-mono font-bold text-gray-400">
                                      {p.role}
                                    </td>
                                    <td className="py-3 text-center">
                                      <span className={`font-mono font-black ${
                                        p.winRate >= 55 ? 'text-emerald-400' : p.winRate <= 40 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
                                      }`}>
                                        {p.winRate}%
                                      </span>
                                    </td>
                                    <td className="py-3 text-right space-y-1">
                                      {p.isOtp && (
                                        <span className="inline-block text-[9px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 font-black">
                                          🔥 OTP ({p.otpChampion})
                                        </span>
                                      )}
                                      {p.isTilted && (
                                        <span className="inline-block text-[9px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-black ml-1">
                                          ❄️ 連敗ティルト ({p.consecutiveLosses}連敗)
                                        </span>
                                      )}
                                      {p.isVulnerable && (
                                        <span className="inline-block text-[9px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-black ml-1 animate-pulse">
                                          🎯 集中Gank推奨 (被FB: {p.fbRate}%)
                                        </span>
                                      )}
                                      {!p.isOtp && !p.isTilted && !p.isVulnerable && (
                                        <span className="text-[10px] text-gray-500 font-bold">特記事項なし</span>
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
                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      <span>{result.isPreMatch ? "あなたのゲーム序盤傾向" : "ゲーム序盤戦術予測"}</span>
                    </h3>

                    <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-gray-500 font-black tracking-wider uppercase">{result.isPreMatch ? "あなたの開始バフ傾向" : "予測開始位置"}</div>
                      <div className="text-xs font-black text-amber-400 leading-relaxed">
                        {result.startBuffPrediction}
                      </div>
                    </div>

                    <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-gray-500 font-black tracking-wider uppercase">{result.isPreMatch ? "あなたのファーストGank傾向" : "ファーストGank予測"}</div>
                      <div className="text-xs font-black text-rose-400 leading-relaxed">
                        {result.firstGankTarget}
                      </div>
                    </div>

                    {/* 対JG推奨カウンター & 解説 */}
                    {result.counters && result.counters.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <h4 className="text-[10px] text-gray-500 font-black tracking-wider uppercase flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          <span>{result.isPreMatch ? "あなたに対する推奨カウンター & 弱点対策" : "対JG推奨カウンター & 解説"}</span>
                        </h4>
                        <div className="space-y-3">
                          {result.counters.map((c: any, idx: number) => (
                            <div key={idx} className="bg-black/40 p-4 rounded-2xl border border-amber-500/10 space-y-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={getChampIcon(c.championName)} 
                                    alt={c.championName} 
                                    className="w-7 h-7 rounded-lg border border-white/10"
                                  />
                                  <span className="text-xs font-black text-amber-300">{c.championName}</span>
                                </div>
                                <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  対面勝率 {c.winRate}%
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-300 leading-relaxed font-medium">
                                {c.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <h4 className="text-[10px] text-gray-500 font-black tracking-wider uppercase">{result.isPreMatch ? "あなたの平均9分スタッツ先行度" : "敵の平均9分スタッツ先行度"}</h4>
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-gray-400">ゴールド先行度</span>
                            <span className="text-amber-400">+{result.playstyle.diffs.goldDiff} G</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-950 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (result.playstyle.diffs.goldDiff / 600) * 100)}%` }}></div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-gray-400">CS先行度</span>
                            <span className="text-emerald-400">+{result.playstyle.diffs.csDiff} CS</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-950 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (result.playstyle.csDiff || result.playstyle.diffs.csDiff || 1) * 10)}%` }}></div>
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
    </div>
  );
}

function getChampNameFromId(id: number): string {
  const mapping: Record<number, string> = {
    64: 'LeeSin', 121: 'Khazix', 76: 'Nidalee', 20: 'Nunu', 59: 'JarvanIV',
    35: 'Shaco', 24: 'Jax', 104: 'Graves', 254: 'Vi', 11: 'MasterYi',
    56: 'Nocturne', 113: 'Sejuani', 77: 'Udyr', 200: 'Belveth', 555: 'Pyke',
    240: 'Kled', 103: 'Ahri', 81: 'Ezreal', 201: 'Braum'
  };
  return mapping[id] || 'LeeSin';
}
