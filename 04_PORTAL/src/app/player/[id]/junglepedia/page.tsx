"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { 
  ChevronLeft, 
  Activity, 
  Compass, 
  ShieldAlert, 
  Zap, 
  Clock, 
  Trophy, 
  Gauge, 
  Sparkles,
  Award,
  HelpCircle,
  TrendingUp,
  Target
} from "lucide-react";
import { getChampIcon } from "../../../../lib/ddragonClient";

export default function JunglepediaPlayerPage() {
  const { id } = useParams(); // Discord ID or Player Name
  const router = useRouter();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState("bronze-gold");
  const [playstyle, setPlaystyle] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [advice, setAdvice] = useState<any>(null);
  const [adviceLoading, setAdviceLoading] = useState(true);
  const [adviceTab, setAdviceTab] = useState<'self' | 'enemy'>('self');

  // Junglepedia 特有のプレイスタイル項目定義とマッピング
  const junglepediaSliders = useMemo(() => {
    if (!playstyle) {
      // ダミーデータ（Kazurin-4036 の典型的なジャングラー統計）
      return {
        habitualDynamic: 62, // Habitual vs Dynamic
        topBot: 55,          // Top vs Bot (Starting Side)
        redBlue: 70,         // Red vs Blue (Start Buff)
        objectiveTrade: 45,  // Objective vs Trade
        passiveAggressive: 65, // Passive vs Aggressive
        clearSpeed: 78       // Slow vs Fast (Clear Speed)
      };
    }
    const sliders = playstyle.sliders || {};
    return {
      habitualDynamic: sliders.habitualDynamic ?? 60,
      topBot: sliders.topBot ?? 50,
      redBlue: sliders.redBlue ?? 50,
      objectiveTrade: sliders.objectiveTrade ?? 50,
      passiveAggressive: sliders.aggressive ?? 50,
      clearSpeed: sliders.farming ?? 50
    };
  }, [playstyle]);

  // オブジェクト関与率データ
  const objectiveStats = useMemo(() => {
    return {
      firstDragon: { teamSecure: 52, contestRate: 70, avgTime: "06:12" },
      secondDragon: { teamSecure: 48, contestRate: 65, avgTime: "11:45" },
      thirdDragon: { teamSecure: 45, contestRate: 60, avgTime: "17:20" },
      fourthDragon: { teamSecure: 55, contestRate: 80, avgTime: "22:50" },
      grubs: { teamSecure: 60, contestRate: 75, avgTime: "05:40" },
      herald: { teamSecure: 50, contestRate: 55, avgTime: "15:10" },
      baron: { teamSecure: 42, contestRate: 68, avgTime: "23:45" }
    };
  }, []);

  // プレイスタイルタグ
  const junglepediaTags = useMemo(() => {
    if (!playstyle || !playstyle.tags || playstyle.tags.length === 0) {
      return [
        { name: "ワンチャンピオン", desc: "特定の得意チャンピオン (マスタリーLv高) に依存した立ち回りです。" },
        { name: "レッドバフスタート派", desc: "ゲーム開始時、70%以上の確率でレッドサイドからクリアを開始します。" },
        { name: "アグレッシブ", desc: "Lv3時点でのガンクやインベイド、ファーストブラッド関与率が高めです。" },
        { name: "ハビチュアル", desc: "毎回同じスタートバフ and クリア周回ルートを好む傾向があります。" }
      ];
    }
    return playstyle.tags.map((t: any) => ({ name: t.name, desc: t.description }));
  }, [playstyle]);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        // 1. 基本情報の取得
        const { data: pData } = await supabase
          .from("ktm_players")
          .select("*")
          .eq("discord_id", id)
          .maybeSingle();

        let resolvedName = id;
        if (pData) {
          setPlayer(pData);
          resolvedName = pData.name;
        } else {
          // fallback
          const { data: pDataName } = await supabase
            .from("ktm_players")
            .select("*")
            .eq("name", id)
            .maybeSingle();
          if (pDataName) {
            setPlayer(pDataName);
            resolvedName = pDataName.name;
          } else {
            setPlayer({ name: id, ign: id });
          }
        }

        // 2. KTM戦績の取得
        const res = await fetch(`/api/player/profile?name=${encodeURIComponent(resolvedName as string)}`);
        const sData = await res.json();
        if (sData.stats) setStats(sData.stats);
        if (sData.history) setHistory(sData.history);
        if (sData.playstyle) setPlaystyle(sData.playstyle);

        // 3. AIアドバイスの取得
        try {
          const adviceRes = await fetch(`/api/player/junglepedia/advice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerName: resolvedName,
              sliders: sData.playstyle?.sliders || {
                habitualDynamic: 62,
                topBot: 55,
                redBlue: 70,
                objectiveTrade: 45,
                aggressive: 65,
                farming: 78
              },
              tags: sData.playstyle?.tags || [],
              objectives: {}
            })
          });
          const adviceData = await adviceRes.json();
          if (adviceRes.ok && !adviceData.error) {
            setAdvice(adviceData);
          } else {
            setAdvice({ error: adviceData.error || "アドバイスの生成に失敗しました。" });
          }
        } catch (adviceErr: any) {
          console.warn("⚠️ AIアドバイスのフェッチに失敗しました:", adviceErr);
          setAdvice({ error: adviceErr.message || "通信エラーが発生しました。" });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setAdviceLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#110e14] text-white flex items-center justify-center">
        <Activity className="w-12 h-12 text-[#A63160] animate-spin" />
      </div>
    );
  }

  const playerNameDisplay = player?.name || "Kazurin-4036";
  const playerIgnDisplay = player?.ign || "Kazurin#4036";
  const playerRank = player?.highest_rank || "GOLD IV";

  return (
    <div className="min-h-screen bg-[#110e14] text-[#EBE6EF] font-sans selection:bg-[#A63160]/30 pb-16">
      {/* ナビゲーションバー風装飾 */}
      <header className="border-b border-[#2C2433] bg-[#17131B] py-3 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()} 
              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-[#2C2433]"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[#A63160] font-black text-xl tracking-tight">Junglepedia</span>
              <span className="text-xs bg-[#A63160]/10 border border-[#A63160]/20 text-[#A63160] px-2 py-0.5 rounded font-black">REPLICA</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
            <span>Riot API Connected</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* メイングリッド */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* プレイヤー情報ヘッダー */}
        <div className="bg-[#1C1622] border border-[#2C2433] rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#A63160]/10 to-indigo-500/10 rounded-full blur-3xl -z-10"></div>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-gradient-to-br from-[#A63160] to-[#E35489] rounded-2xl flex items-center justify-center text-3xl font-black text-white border border-white/10 shadow-[0_4px_24px_rgba(166,49,96,0.3)]">
              {playerNameDisplay.substring(0, 2).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Jungle Analytics Player Profile</div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{playerNameDisplay}</span>
                <span className="text-xs text-[#E35489] font-bold bg-[#A63160]/10 px-2 py-0.5 rounded border border-[#A63160]/20">
                  {playerIgnDisplay}
                </span>
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-[#241D2C] border border-[#3E3347] px-2.5 py-0.5 rounded text-gray-300 font-bold">
                  {playerRank}
                </span>
                <span className="bg-[#241D2C] border border-[#3E3347] px-2.5 py-0.5 rounded text-gray-300 font-bold font-mono">
                  JP1 Region
                </span>
              </div>
            </div>
          </div>

          {/* ティア選択コントロール */}
          <div className="flex flex-col gap-1.5 w-full md:w-auto">
            <span className="text-[10px] text-gray-500 font-black tracking-wider uppercase">Scouting Tier Target</span>
            <div className="flex bg-[#120F16] border border-[#2B2332] p-1 rounded-xl">
              {["iron-silver", "bronze-gold", "emerald-diamond", "master-plus"].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all whitespace-nowrap capitalize ${
                    activeTier === tier 
                      ? "bg-[#A63160] text-white shadow-md shadow-[#A63160]/20" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tier.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2カラムレイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 左カラム: プレイスタイルスライダー */}
          <div className="lg:col-span-2 space-y-6">

            {/* 🔮 AI戦術アドバイザー (Junglepedia Analytics) */}
            <div className="bg-[#1C1622] border border-[#2C2433] rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-[#2C2433] pb-3">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#E35489] animate-pulse" />
                  <span>🔮 AI戦術アドバイザー (Junglepedia Analytics)</span>
                </h3>
                {/* アドバイス種別トグル */}
                <div className="flex bg-[#120F16] border border-[#2C2433] p-0.5 rounded-lg">
                  <button
                    onClick={() => setAdviceTab("self")}
                    className={`px-2.5 py-1 rounded text-[9px] font-black transition-all ${
                      adviceTab === "self" 
                        ? "bg-[#A63160] text-white" 
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    本人向け改善
                  </button>
                  <button
                    onClick={() => setAdviceTab("enemy")}
                    className={`px-2.5 py-1 rounded text-[9px] font-black transition-all ${
                      adviceTab === "enemy" 
                        ? "bg-[#A63160] text-white" 
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    敵向け対策
                  </button>
                </div>
              </div>

              {adviceLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#A63160]"></div>
                  <span className="text-xs text-gray-500 font-bold">AIがプレイスタイル指標からアドバイスを錬成中...</span>
                </div>
              ) : advice?.error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 font-bold leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
                  <div>
                    <span className="font-black block mb-1">アドバイス生成制限</span>
                    {advice.error}
                  </div>
                </div>
              ) : !advice ? (
                <p className="text-gray-500 italic text-xs py-4 text-center">アドバイスを生成できませんでした。</p>
              ) : (
                <div className="space-y-3">
                  {/* スライダーやタグを分析したAIコーチメッセージ */}
                  <div className={`p-4 rounded-2xl text-[11px] leading-relaxed flex items-start gap-2.5 ${
                    adviceTab === 'self' 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' 
                      : 'bg-red-500/10 border border-red-500/20 text-red-300'
                  }`}>
                    {adviceTab === 'self' ? (
                      <Compass className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                    )}
                    <div>
                      <span className="font-black block mb-1">
                        {adviceTab === 'self' 
                          ? '【AI鬼コーチの勝率向上指令】' 
                          : '【対このプレイヤーの弱点攻略法】'}
                      </span>
                      {adviceTab === 'self' 
                        ? 'あなたの過去の周回傾向とプレイスタイルを自己分析した結果です。さらなる高みへ進むための指針としなさい。' 
                        : 'このプレイヤーが敵のジャングラーとして現れた際の対策です。クリアルートを予測し、戦闘傾向を逆手に取りなさい。'}
                    </div>
                  </div>

                  {/* 3箇条カード */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(adviceTab === 'self' ? advice.selfImprovement : advice.counterTactics)?.map((item: any, idx: number) => (
                      <div key={idx} className="bg-[#120F16] border border-[#2C2433] p-4 rounded-2xl space-y-2 hover:border-[#A63160]/20 transition-all">
                        <div className={`text-xs font-black flex items-center gap-1.5 ${
                          adviceTab === 'self' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          <span>{item.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* スライダーグループ */}
            <div className="bg-[#1C1622] border border-[#2C2433] rounded-3xl p-6 space-y-6">
              <h3 className="text-base font-black text-white flex items-center gap-2 border-b border-[#2C2433] pb-3">
                <Gauge className="w-5 h-5 text-[#E35489]" />
                <span>Jungle Playstyle Metrics (プレイスタイル・インジケーター)</span>
              </h3>

              <div className="space-y-6">
                {/* 1. Habitual vs Dynamic */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-400">Habitual (固定派)</span>
                    <span className="text-[#E35489] font-mono font-black">{junglepediaSliders.habitualDynamic}%</span>
                    <span className="text-cyan-400">Dynamic (変幻自在)</span>
                  </div>
                  <div className="h-3 w-full bg-[#120F16] rounded-full overflow-hidden border border-[#2C2433] p-[1px]">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 via-[#A63160] to-cyan-500 transition-all duration-500"
                      style={{ width: `${junglepediaSliders.habitualDynamic}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    バフのスタートサイド、ファーストガンクの位置、インベイド警戒頻度のゲームごとの揺らぎ度合いを可視化します。
                  </p>
                </div>

                {/* 2. Top-side Start vs Bot-side Start */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-purple-400">Top-side Start (トップスタート)</span>
                    <span className="text-[#E35489] font-mono font-black">{junglepediaSliders.topBot}%</span>
                    <span className="text-emerald-400">Bot-side Start (ボットスタート)</span>
                  </div>
                  <div className="h-3 w-full bg-[#120F16] rounded-full overflow-hidden border border-[#2C2433] p-[1px]">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 via-[#A63160] to-emerald-500 transition-all duration-500"
                      style={{ width: `${junglepediaSliders.topBot}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    最初のクリア周回を上ルート（青/赤バフ）と下ルート（赤/青バフ）のどちら側から始めるかの割合。
                  </p>
                </div>

                {/* 3. Red side vs Blue side Start */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-red-400">Red-side Start (赤バフ派)</span>
                    <span className="text-[#E35489] font-mono font-black">{junglepediaSliders.redBlue}%</span>
                    <span className="text-blue-400">Blue-side Start (青バフ派)</span>
                  </div>
                  <div className="h-3 w-full bg-[#120F16] rounded-full overflow-hidden border border-[#2C2433] p-[1px]">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-red-500 via-[#A63160] to-blue-500 transition-all duration-500"
                      style={{ width: `${junglepediaSliders.redBlue}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Red Buff (赤バフ / ラプタースタート) と Blue Buff (青バフ / グロンプスタート) の初期選択率。
                  </p>
                </div>

                {/* 4. Objective vs Trade */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-amber-400">Objective-focused (中立優先)</span>
                    <span className="text-[#E35489] font-mono font-black">{junglepediaSliders.objectiveTrade}%</span>
                    <span className="text-rose-400">Trade-heavy (戦闘・介入優先)</span>
                  </div>
                  <div className="h-3 w-full bg-[#120F16] rounded-full overflow-hidden border border-[#2C2433] p-[1px]">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 via-[#A63160] to-rose-500 transition-all duration-500"
                      style={{ width: `${junglepediaSliders.objectiveTrade}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    ドラゴンやヴォイドグラブの奪取率と、早期Gank・ダメージトレード関与度のバランスです。
                  </p>
                </div>

                {/* 5. Passive vs Aggressive */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-400">Passive (堅実ファーム)</span>
                    <span className="text-[#E35489] font-mono font-black">{junglepediaSliders.passiveAggressive}%</span>
                    <span className="text-red-500 animate-pulse">Aggressive (戦闘狂)</span>
                  </div>
                  <div className="h-3 w-full bg-[#120F16] rounded-full overflow-hidden border border-[#2C2433] p-[1px]">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-gray-700 via-[#A63160] to-red-600 transition-all duration-500"
                      style={{ width: `${junglepediaSliders.passiveAggressive}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    インベイド回数、早期カウンターGank、被FB率などのアグレッシブシグナルから総合判定。
                  </p>
                </div>

                {/* 6. Clear Speed */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-orange-400">Slow (安定クリア)</span>
                    <span className="text-[#E35489] font-mono font-black">{junglepediaSliders.clearSpeed}%</span>
                    <span className="text-emerald-400">Fast (爆速クリア)</span>
                  </div>
                  <div className="h-3 w-full bg-[#120F16] rounded-full overflow-hidden border border-[#2C2433] p-[1px]">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 via-[#A63160] to-emerald-500 transition-all duration-500"
                      style={{ width: `${junglepediaSliders.clearSpeed}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    グローバル統計と比較した、最初のLv4到達スピードの優秀度を表します。
                  </p>
                </div>
              </div>
            </div>

            {/* プレイスタイルタグ一覧 */}
            <div className="bg-[#1C1622] border border-[#2C2433] rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2 border-b border-[#2C2433] pb-3">
                <Sparkles className="w-5 h-5 text-[#E35489]" />
                <span>Jungle Playstyle Tags (分析傾向ラベル)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {junglepediaTags.map((tag: any, idx: number) => (
                  <div 
                    key={idx}
                    className="bg-[#120F16] border border-[#2C2433] p-4 rounded-2xl space-y-1.5 hover:border-[#A63160]/30 transition-colors"
                  >
                    <div className="text-xs font-black text-[#E35489] flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#A63160]"></div>
                      <span>{tag.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed">{tag.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 右カラム: オブジェクト・クリアタイム */}
          <div className="space-y-6">
            
            {/* オブジェクト関与率 */}
            <div className="bg-[#1C1622] border border-[#2C2433] rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2 border-b border-[#2C2433] pb-3">
                <Target className="w-5 h-5 text-[#E35489]" />
                <span>Objective Secure Rates (オブジェクト獲得率)</span>
              </h3>
              
              <div className="space-y-3.5">
                {Object.entries(objectiveStats).map(([key, value]) => {
                  const labelMap: Record<string, string> = {
                    firstDragon: "ファーストドラゴン",
                    secondDragon: "セカンドドラゴン",
                    thirdDragon: "サードドラゴン",
                    fourthDragon: "エルダードラゴン+",
                    grubs: "ヴォイドグラブ (Grubs)",
                    herald: "リフトヘラルド (Herald)",
                    baron: "ナショールバロン (Baron)"
                  };
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-300">
                        <span>{labelMap[key]}</span>
                        <span className="text-emerald-400 font-mono">{value.teamSecure}%</span>
                      </div>
                      <div className="w-full bg-[#120F16] rounded-full h-1.5 border border-[#2C2433] overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${value.teamSecure}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[8px] text-gray-500">
                        <span>関与・競争率: {value.contestRate}%</span>
                        <span>平均出現時奪取: {value.avgTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* クリア時間レコード */}
            <div className="bg-[#1C1622] border border-[#2C2433] rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2 border-b border-[#2C2433] pb-3">
                <Clock className="w-5 h-5 text-[#E35489]" />
                <span>Standard Clear Records (標準クリアタイム)</span>
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-[#120F16] p-3 rounded-xl border border-[#2C2433]">
                  <div className="text-xs">
                    <span className="font-bold text-gray-300 block">Blue Side Start (ブルーサイド)</span>
                    <span className="text-[9px] text-gray-500">フルクリア (6キャンプ)</span>
                  </div>
                  <span className="text-sm font-mono font-black text-cyan-400">03:18</span>
                </div>
                <div className="flex justify-between items-center bg-[#120F16] p-3 rounded-xl border border-[#2C2433]">
                  <div className="text-xs">
                    <span className="font-bold text-gray-300 block">Red Side Start (レッドサイド)</span>
                    <span className="text-[9px] text-gray-500">フルクリア (6キャンプ)</span>
                  </div>
                  <span className="text-sm font-mono font-black text-cyan-400">03:15</span>
                </div>
              </div>
            </div>

            {/* 直近の対戦履歴 */}
            <div className="bg-[#1C1622] border border-[#2C2433] rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2 border-b border-[#2C2433] pb-3">
                <Trophy className="w-5 h-5 text-[#E35489]" />
                <span>Recent Match History (直近内戦)</span>
              </h3>
              
              <div className="space-y-3">
                {history && history.length > 0 ? (
                  history.slice(0, 4).map((m, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        m.isWin ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={getChampIcon(m.champion)} 
                          className="w-8 h-8 rounded-full border border-white/10" 
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                        />
                        <div className="text-xs">
                          <span className="font-bold text-white block">{m.champion}</span>
                          <span className="text-[9px] text-gray-500">{m.role}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-black block ${m.isWin ? "text-emerald-400" : "text-rose-400"}`}>
                          {m.isWin ? "WIN" : "LOSE"}
                        </span>
                        <span className="text-[9px] text-gray-500 font-mono">
                          {m.kills}/{m.deaths}/{m.assists}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-xs italic text-center py-4">データがありません</p>
                )}
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
