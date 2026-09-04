import Link from 'next/link';
import { Swords, Users, BookOpen, Trophy, Activity, Sparkles, Shield, ChevronRight, Flame, Layers, Award, BarChart3 } from 'lucide-react';

export const metadata = {
  title: 'KTM Sovereign Command Center | LoL完全勝利サイクル ＆ 対戦バランサー',
  description: 'パーソナルコーチ、5v5チーム分けバランサー、173体チャンピオン攻略辞典、対戦履歴を一元管理するSovereignポータル',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 font-sans p-4 sm:p-6 md:p-8 flex flex-col justify-between">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* トップブランドヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl p-2 bg-amber-500/10 rounded-2xl border border-amber-500/30">👑</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    KTM SOVEREIGN COMMAND CENTER
                  </h1>
                  <span className="text-[10px] bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                    v6.0 Unified
                  </span>
                </div>
                <p className="text-xs text-stone-400 font-medium">
                  LoL完全勝利サイクル (ドラフト ➔ インゲーム ➔ 5大分析) ＆ 5v5対戦バランサー
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/hud"
              target="_blank"
              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="サブモニターや画面端に置いておける極小Web HUD"
            >
              <span>🖥️</span> 軽量Web HUD
            </Link>
            <Link
              href="/admin/dashboard"
              className="px-3.5 py-2 bg-stone-800/80 hover:bg-stone-700 text-stone-300 border border-stone-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              title="開発者用 Sovereign OS 監視センター"
            >
              <Shield className="w-3.5 h-3.5 text-stone-400" /> OS管理
            </Link>
          </div>
        </header>

        {/* 4大メインゲートウェイ (プレイヤーが求めるコア機能) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. パーソナルコーチ */}
          <Link
            href="/coach"
            className="group relative bg-gradient-to-br from-amber-950/40 via-stone-900 to-stone-900 border-2 border-amber-500/40 hover:border-amber-400 p-6 rounded-3xl transition-all duration-300 shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🏆
                </div>
                <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                  ソロQ完全勝利サイクル
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                  パーソナルコーチ (SoloQ Victory Loop)
                </h2>
                <p className="text-xs text-stone-400 leading-relaxed mt-1 font-medium">
                  即死キルライン境界計算 ➔ 3段階フェーズ手順書 ➔ 5大ディープアナリティクス ➔ 過去の反省遺言自動ポップアップ。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-amber-400 group-hover:translate-x-1 transition-transform border-t border-stone-800 pt-3">
              <span>コーチング司令塔を起動</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 2. チーム分けバランサー */}
          <Link
            href="/balancer"
            className="group relative bg-gradient-to-br from-emerald-950/40 via-stone-900 to-stone-900 border-2 border-emerald-500/40 hover:border-emerald-400 p-6 rounded-3xl transition-all duration-300 shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ⚖️
                </div>
                <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  MMR対面格差最適化
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white group-hover:text-emerald-300 transition-colors">
                  チーム分けバランサー (5v5 Custom Match)
                </h2>
                <p className="text-xs text-stone-400 leading-relaxed mt-1 font-medium">
                  10人〜24人リアルタイム参加集計。対面MMR格差を最小化し、AI勝敗予想＆5v5シミュレータと一発連動。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-emerald-400 group-hover:translate-x-1 transition-transform border-t border-stone-800 pt-3">
              <span>チーム分けを実行する</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 3. チャンピオン攻略辞典 */}
          <Link
            href="/champions"
            className="group relative bg-gradient-to-br from-sky-950/40 via-stone-900 to-stone-900 border border-stone-800 hover:border-sky-500/60 p-6 rounded-3xl transition-all duration-300 shadow-md hover:shadow-sky-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  👑
                </div>
                <span className="text-[11px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 rounded-full">
                  173体 DataDragon確定値
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white group-hover:text-sky-300 transition-colors">
                  チャンピオン攻略辞典 ＆ 戦術ライブラリ
                </h2>
                <p className="text-xs text-stone-400 leading-relaxed mt-1 font-medium">
                  全チャンピオンのスキル倍率・基礎ステータス・カウンター相性・レーンマクロ攻略を即時検索。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-sky-400 group-hover:translate-x-1 transition-transform border-t border-stone-800 pt-3">
              <span>チャンピオン辞典を開く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 4. 対戦履歴 ＆ リーダーボード */}
          <Link
            href="/history"
            className="group relative bg-gradient-to-br from-purple-950/40 via-stone-900 to-stone-900 border border-stone-800 hover:border-purple-500/60 p-6 rounded-3xl transition-all duration-300 shadow-md hover:shadow-purple-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📊
                </div>
                <span className="text-[11px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-full">
                  集団戦分析 ＆ ランキング
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white group-hover:text-purple-300 transition-colors">
                  カスタム対戦履歴 ＆ リーダーボード
                </h2>
                <p className="text-xs text-stone-400 leading-relaxed mt-1 font-medium">
                  過去全カスタム戦の勝敗アーカイブ、集団戦ディープアナリティクス、ロール別MMRランキング。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform border-t border-stone-800 pt-3">
              <span>対戦履歴・ランキングを見る</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* クイックサブメニュー */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/balancer/record"
            className="p-3 bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 rounded-2xl text-center transition group"
          >
            <span className="text-base block mb-1">📝</span>
            <span className="text-xs font-black text-stone-300 group-hover:text-white">試合結果を記録</span>
          </Link>
          <Link
            href="/player"
            className="p-3 bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 rounded-2xl text-center transition group"
          >
            <span className="text-base block mb-1">👤</span>
            <span className="text-xs font-black text-stone-300 group-hover:text-white">プレイヤー名簿</span>
          </Link>
          <Link
            href="/casino"
            className="p-3 bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 rounded-2xl text-center transition group"
          >
            <span className="text-base block mb-1">🎰</span>
            <span className="text-xs font-black text-stone-300 group-hover:text-white">KTM カジノ</span>
          </Link>
          <Link
            href="/leaderboard"
            className="p-3 bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 rounded-2xl text-center transition group"
          >
            <span className="text-base block mb-1">🏆</span>
            <span className="text-xs font-black text-stone-300 group-hover:text-white">MMR順位表</span>
          </Link>
        </div>
      </div>

      {/* フッター */}
      <footer className="mt-12 text-center text-[11px] text-stone-500 space-y-1">
        <div>KTM Sovereign Platform © 2026 — League of Legends Victory Ecosystem</div>
        <div>Riot API × Supabase × Gemini AI</div>
      </footer>
    </div>
  );
}
