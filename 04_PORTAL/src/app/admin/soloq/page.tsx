"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
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
import { getChampIcon } from "../../../lib/ddragonClient";

export default function SoloqScoutPage() {
  const [riotId, setRiotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  // 管理者向け登録プレイヤープレイスタイル管理用のState
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playstyle, setPlaystyle] = useState<any>(null);
  const [playstyleSource, setPlaystyleSource] = useState<'custom' | 'soloq'>('custom');
  const [syncingSoloq, setSyncingSoloq] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);

  // 鬼コーチ対策3箇条用のスライドインデックス
  const [adviceIndex, setAdviceIndex] = useState(0);

  // アクティブプレイヤー一覧をロード
  useEffect(() => {
    async function loadPlayers() {
      try {
        const { data, error: err } = await supabase
          .from("ktm_players")
          .select("*")
          .order("name", { ascending: true });
        if (err) throw err;
        setPlayers(data || []);
      } catch (e) {
        console.error("Failed to load players for playstyle manager:", e);
      }
    }
    loadPlayers();
  }, []);

  // 選択プレイヤーのプレイスタイル詳細をフェッチ
  const handlePlayerSelect = async (player: any) => {
    setSelectedPlayer(player);
    setPlayerLoading(true);
    setPlaystyle(null);
    try {
      const res = await fetch(`/api/player/profile?name=${encodeURIComponent(player.name)}`);
      const data = await res.json();
      if (res.ok && data.playstyle) {
        setPlaystyle(data.playstyle);
      }
    } catch (err) {
      console.error("Failed to load playstyle:", err);
    } finally {
      setPlayerLoading(false);
    }
  };

  // 選択プレイヤーのソロキューデータを同期＆プレイスタイル更新
  const handleSyncSoloq = async () => {
    if (!selectedPlayer) return;
    setSyncingSoloq(true);
    try {
      const res = await fetch('/api/player/sync-soloq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedPlayer.name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同期エラー');
      
      alert(data.message);
      if (data.playstyle) {
        setPlaystyle((prev: any) => ({
          ...prev,
          soloq: data.playstyle
        }));
      }
    } catch (err: any) {
      alert(`❌ ソロキュー同期失敗: ${err.message}`);
    } finally {
      setSyncingSoloq(false);
    }
  };

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
        method: 'POST',
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
        
        {/* ナビゲーション */}
        <div className="flex justify-between items-center">
          <Link 
            href="/ktm-admin" 
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>管理者ダッシュボードへ戻る</span>
          </Link>
          <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 uppercase tracking-widest">
            管理者専用 🔑
          </span>
        </div>

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
            {!result.isGameActive ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-10 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/5 text-gray-500">
                  <Activity className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white">ゲーム中ではありません</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                    {result.message || '指定されたプレイヤーは現在進行中のマッチが見つかりませんでした。ソロキュー開始後に再度スキャンしてください。'}
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
                        <div className="text-[10px] text-gray-500 font-black tracking-wider uppercase">敵ジャングラー (Opponent JG)</div>
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
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">プレイスタイル・スライダー (Playstyle Sliders)</h4>
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
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">プレイスタイルタグ (Playstyle Tags)</h4>
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

                  {/* 鬼コーチAIの対面対策3箇条 (スライダー形式) */}
                  {result.coachAdvice && result.coachAdvice.length > 0 && (
                    <div className="bg-gradient-to-r from-red-500/10 via-orange-500/5 to-transparent border border-red-500/20 rounded-3xl p-6 shadow-xl space-y-4">
                      <div className="flex justify-between items-center border-b border-white/5 pb-3">
                        <h3 className="text-base font-black text-red-400 flex items-center gap-2">
                          <Flame className="w-5 h-5 text-red-500 animate-pulse animate-duration-1000" />
                          <span>鬼コーチAIの対面対策3箇条</span>
                        </h3>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {adviceIndex + 1} / {result.coachAdvice.length}
                        </div>
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

                </div>

                <div className="space-y-6">
                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      <span>ゲーム序盤戦術予測</span>
                    </h3>

                    <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-gray-500 font-black tracking-wider uppercase">予測開始位置</div>
                      <div className="text-xs font-black text-amber-400 leading-relaxed">
                        {result.startBuffPrediction}
                      </div>
                    </div>

                    <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-gray-500 font-black tracking-wider uppercase">ファーストGank予測</div>
                      <div className="text-xs font-black text-rose-400 leading-relaxed">
                        {result.firstGankTarget}
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <h4 className="text-[10px] text-gray-500 font-black tracking-wider uppercase">敵の平均9分スタッツ先行度</h4>
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

        {/* 🔑 登録プレイヤーのプレイスタイル分析・管理 (Junglepedia) */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-lg font-black text-white">登録プレイヤーのプレイスタイル管理 (Junglepedia)</h2>
              <p className="text-xs text-gray-400">アクティブメンバーを選択し、プレイスタイル詳細やスタッツ差分の検証、およびRiot APIとの手動同期を実行します。</p>
            </div>
          </div>

          {/* プレイヤー選択グリッド */}
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePlayerSelect(p)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                  selectedPlayer?.id === p.id 
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-black shadow-md' 
                    : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* 選択されたプレイヤーのプレイスタイル詳細 */}
          {selectedPlayer && (
            <div className="border-t border-white/5 pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-1.5">
                    <span>{selectedPlayer.name} のプレイスタイル</span>
                    {selectedPlayer.ign && (
                      <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded border border-white/5">
                        {selectedPlayer.ign}
                      </span>
                    )}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => setPlaystyleSource('custom')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        playstyleSource === 'custom'
                          ? 'bg-cyan-505 bg-cyan-500 text-black shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      KTMカスタム
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaystyleSource('soloq')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        playstyleSource === 'soloq'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      ソロキュー (Riot)
                    </button>
                  </div>

                  {playstyleSource === 'soloq' && (
                    <button
                      type="button"
                      onClick={handleSyncSoloq}
                      disabled={syncingSoloq}
                      className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-amber-400 px-3 py-1.5 rounded-xl border border-gray-700 text-xs font-bold transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingSoloq ? 'animate-spin' : ''}`} />
                      同期
                    </button>
                  )}
                </div>
              </div>

              {playerLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              ) : playstyle ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* 左: スライダー */}
                  <div className="md:col-span-7 space-y-6 bg-black/30 p-5 rounded-2xl border border-white/5">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">分析スライダー (Playstyle Sliders)</h4>
                    
                    {(() => {
                      const currentStyle = playstyle[playstyleSource] || {
                        sliders: { aggressive: 50, farming: 50, supportive: 50 },
                        tags: []
                      };
                      return (
                        <div className="space-y-6">
                          {/* 1. Aggressive スライダー */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-gray-400">Passive (自重型)</span>
                              <span className="text-amber-400 font-mono font-black">{currentStyle.sliders.aggressive}%</span>
                              <span className="text-rose-400">Aggressive (超攻撃型)</span>
                            </div>
                            <div className="h-3 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5 p-[1px] relative">
                              <div className="h-full rounded-full bg-gradient-to-r from-gray-700 via-amber-500 to-rose-600 transition-all duration-500" style={{ width: `${currentStyle.sliders.aggressive}%` }}></div>
                            </div>
                          </div>

                          {/* 2. Farming スライダー */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-emerald-400">Ganking (戦闘関与)</span>
                              <span className="text-cyan-400 font-mono font-black">{currentStyle.sliders.farming}%</span>
                              <span className="text-blue-400">Farming (成長優先)</span>
                            </div>
                            <div className="h-3 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5 p-[1px]">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 transition-all duration-500" style={{ width: `${currentStyle.sliders.farming}%` }}></div>
                            </div>
                          </div>

                          {/* 3. Supportive スライダー */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-indigo-400">Selfish (キャリー型)</span>
                              <span className="text-purple-400 font-mono font-black">{currentStyle.sliders.supportive}%</span>
                              <span className="text-pink-400">Supportive (献身型)</span>
                            </div>
                            <div className="h-3 w-full bg-gray-950 rounded-full overflow-hidden border border-white/5 p-[1px]">
                              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${currentStyle.sliders.supportive}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 右: 自動プレイタグ */}
                  <div className="md:col-span-5 space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">プレイスタイルタグ (Playstyle Tags)</h4>
                    {(() => {
                      const currentStyle = playstyle[playstyleSource] || { tags: [] };
                      if (!currentStyle.tags || currentStyle.tags.length === 0) {
                        return (
                          <div className="text-center text-xs text-gray-500 py-8 border border-dashed border-white/5 rounded-xl">
                            プレイタグがありません。
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-col gap-3">
                          {currentStyle.tags.map((tag: any) => (
                            <div key={tag.id} className="group relative bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-cyan-500/20 p-3 rounded-2xl transition duration-200 cursor-help">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                                <span className="text-xs font-black text-cyan-300">{tag.name}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{tag.description}</p>
                              <div className="text-[9px] text-gray-500 font-mono mt-1 text-right">根拠: {tag.reason}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                </div>
              ) : (
                <div className="text-center text-xs text-gray-500 py-12 border border-dashed border-white/5 rounded-2xl">
                  プレイスタイルデータが存在しません。ソロキュー同期を行うかスタッツを登録してください。
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
