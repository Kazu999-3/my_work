import Link from 'next/link';
import { 
  Swords, 
  Users, 
  BookOpen, 
  Trophy, 
  Activity, 
  Sparkles, 
  Shield, 
  ChevronRight, 
  Flame, 
  Coins, 
  HeartHandshake, 
  ScrollText, 
  BookHeart, 
  TrendingUp, 
  History 
} from 'lucide-react';

export const metadata = {
  title: 'KTM Sovereign Command Center | LoL完全勝利サイクル ＆ 対戦バランサー',
  description: 'パーソナルコーチ、5v5チーム分けバランサー、173体チャンピオン攻略辞典、対戦履歴を一元管理するSovereignポータル',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6 md:p-8 flex flex-col justify-between selection:bg-amber-300/40">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* トップブランドヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md border border-stone-200/90 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="text-4xl p-3 bg-gradient-to-br from-amber-50 to-amber-100/80 rounded-2xl border border-amber-300/80 shadow-xs shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900">
                  KTM SOVEREIGN COMMAND CENTER
                </h1>
                <span className="text-[10px] bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  v6.0 Unified
                </span>
              </div>
              <p className="text-xs text-stone-500 font-bold mt-1">
                LoL完全勝利サイクル (ドラフト ➔ リアルタイム戦術 ➔ 5大分析) ＆ 5v5対戦バランサー
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/admin/dashboard"
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              title="開発者用 Sovereign OS 監視センター"
            >
              <Shield className="w-3.5 h-3.5 text-stone-500" /> OS管理
            </Link>
          </div>
        </header>

        {/* 4大コアゲートウェイ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. パーソナルコーチ */}
          <Link
            href="/coach"
            className="group relative bg-white/90 backdrop-blur-md border-2 border-amber-400/80 hover:border-amber-500 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🏆
                </div>
                <span className="text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-600 animate-pulse" />
                  ソロQ完全勝利サイクル
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 group-hover:text-amber-800 transition-colors">
                  パーソナルコーチ (SoloQ Victory Loop)
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed mt-1 font-medium">
                  即死キルライン境界計算 ➔ 3段階フェーズ手順書 ➔ 5大ディープアナリティクス ➔ 過去の反省遺言自動ポップアップ。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-amber-700 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 pt-3">
              <span>コーチング司令塔を起動</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 2. チーム分けバランサー */}
          <Link
            href="/balancer"
            className="group relative bg-white/90 backdrop-blur-md border-2 border-emerald-400/80 hover:border-emerald-500 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ⚖️
                </div>
                <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-600" />
                  MMR対面格差最適化
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 group-hover:text-emerald-800 transition-colors">
                  チーム分けバランサー (5v5 Custom Match)
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed mt-1 font-medium">
                  10人〜24人リアルタイム参加集計。対面MMR格差を最小化し、AI勝敗予想＆5v5シミュレータと一発連動。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-emerald-700 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 pt-3">
              <span>チーム分けを実行する</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 3. チャンピオン攻略辞典 */}
          <Link
            href="/champions"
            className="group relative bg-white/90 backdrop-blur-md border border-stone-200/90 hover:border-sky-400 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-sky-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  👑
                </div>
                <span className="text-[11px] font-black text-sky-800 bg-sky-100 border border-sky-300 px-2.5 py-1 rounded-full">
                  173体 DataDragon確定値
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 group-hover:text-sky-800 transition-colors">
                  チャンピオン攻略辞典 ＆ 戦術ライブラリ
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed mt-1 font-medium">
                  全チャンピオンのスキル倍率・基礎ステータス・カウンター相性・レーンマクロ攻略を即時検索。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-sky-700 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 pt-3">
              <span>チャンピオン辞典を開く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 4. 対戦履歴 */}
          <Link
            href="/history"
            className="group relative bg-white/90 backdrop-blur-md border border-stone-200/90 hover:border-purple-400 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📊
                </div>
                <span className="text-[11px] font-black text-purple-800 bg-purple-100 border border-purple-300 px-2.5 py-1 rounded-full">
                  集団戦分析 ＆ 全履歴
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 group-hover:text-purple-800 transition-colors">
                  過去の試合履歴 ＆ アナリティクス
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed mt-1 font-medium">
                  全カスタムマッチのKDA・MMR増減・集団戦勝敗ログを詳細追跡。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-purple-700 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 pt-3">
              <span>試合履歴を確認する</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* サブ機能クイックグリッド */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-stone-900">⚡ コミュニティ ＆ 統計ツール</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                title: 'プレイヤー名簿',
                sub: 'OP.GG & カルテ',
                href: '/player',
                icon: <Users className="w-5 h-5 text-indigo-600" />,
                bg: 'hover:border-indigo-400',
              },
              {
                title: '順位表',
                sub: 'ロール別MMR',
                href: '/leaderboard',
                icon: <Trophy className="w-5 h-5 text-amber-600" />,
                bg: 'hover:border-amber-400',
              },
              {
                title: '勝敗予想',
                sub: 'コイン ＆ ショップ',
                href: '/casino',
                icon: <Coins className="w-5 h-5 text-amber-600" />,
                bg: 'hover:border-amber-400',
              },
              {
                title: 'チーム相性',
                sub: 'デュオ・シナジー',
                href: '/synergy',
                icon: <HeartHandshake className="w-5 h-5 text-fuchsia-600" />,
                bg: 'hover:border-fuchsia-400',
              },
              {
                title: 'はじめに',
                sub: '参加スタートガイド',
                href: '/guide',
                icon: <BookOpen className="w-5 h-5 text-emerald-600" />,
                bg: 'hover:border-emerald-400',
              },
              {
                title: '更新情報',
                sub: 'アップデート履歴',
                href: '/changelog',
                icon: <ScrollText className="w-5 h-5 text-cyan-600" />,
                bg: 'hover:border-cyan-400',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`bg-white/80 backdrop-blur-sm border border-stone-200/90 rounded-2xl p-4 transition-all duration-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between space-y-2 group ${item.bg}`}
              >
                <div className="p-2 rounded-xl bg-stone-100 group-hover:scale-110 transition-transform w-fit">
                  {item.icon}
                </div>
                <div>
                  <div className="font-extrabold text-xs text-stone-900 group-hover:text-amber-800 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-stone-500 font-bold mt-0.5">
                    {item.sub}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* フッター */}
        <footer className="text-center text-[11px] text-stone-500 font-bold border-t border-stone-200/80 pt-6">
          <p>© 2026 KTM Sovereign Command Center. All Rights Reserved.</p>
        </footer>

      </div>
    </div>
  );
}
