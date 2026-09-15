import Link from 'next/link';
import { 
  Swords, 
  Users, 
  BookOpen, 
  Trophy, 
  ChevronRight, 
  Coins, 
  HeartHandshake, 
  ScrollText, 
  Sparkles,
  ShieldAlert
} from 'lucide-react';

export const metadata = {
  title: 'KTM カスタムポータル | チーム分けバランサー ＆ 師弟掲示板・公式カルテ',
  description: '週末定期カスタム対戦のチーム分けバランサー、師弟マッチング自己紹介掲示板、MMR個人戦績カルテ、勝敗予想ポータル',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6 md:p-8 flex flex-col justify-between selection:bg-amber-300/40">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        {/* トップヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border border-stone-200/90 dark:border-[#3f4147] rounded-3xl p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="text-3xl sm:text-4xl p-3 bg-gradient-to-br from-amber-50 to-amber-100/80 dark:from-amber-500/20 dark:to-amber-500/10 rounded-2xl border border-amber-300/80 dark:border-amber-500/30 shadow-xs shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 dark:text-white">
                  KTM カスタムポータル
                </h1>
                <span className="text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  Official
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 font-bold mt-1">
                週末定期カスタム対戦の公平なチーム分け ＆ 師弟マッチング・個人戦績カルテ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/guide"
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-[#1e1f22] dark:hover:bg-[#35373c] text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-[#3f4147] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>利用ガイド</span>
            </Link>
          </div>
        </header>

        {/* 4大コア機能カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* 1. マイページ / 希望レーン */}
          <Link
            href="/mypage"
            className="group relative bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border-2 border-amber-400/80 hover:border-amber-500 dark:border-amber-500/30 dark:hover:border-amber-500 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  👤
                </div>
                <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  公式カルテ
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  マイページ ＆ 希望レーン設定
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mt-1 font-medium">
                  あなた専用の戦績カルテ。希望レーン・NGレーンの変更、プレイスタイル診断、所持コイン管理が可能です。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-amber-700 dark:text-amber-400 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 dark:border-[#3f4147] pt-3">
              <span>マイカルテを開く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 2. 師弟自己紹介掲示板 */}
          <Link
            href="/mentorship"
            className="group relative bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border-2 border-emerald-400/80 hover:border-emerald-500 dark:border-emerald-500/30 dark:hover:border-emerald-500 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-emerald-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🤝
                </div>
                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <HeartHandshake className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  初回+500pt進呈中
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  師弟自己紹介掲示板
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mt-1 font-medium">
                  「もっと上達したい弟子」と「優しく教えたい師匠」を結ぶ掲示板。自己紹介カードの作成・オファー申請が可能です。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-emerald-700 dark:text-emerald-400 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 dark:border-[#3f4147] pt-3">
              <span>師弟掲示板を見る</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 3. チーム分けバランサー */}
          <Link
            href="/balancer"
            className="group relative bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border border-stone-200/90 hover:border-rose-400 dark:border-[#3f4147] dark:hover:border-rose-500 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-rose-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ⚔️
                </div>
                <span className="text-[11px] font-black text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Swords className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  公平チーム分け
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                  チーム分けバランサー (5v5 Custom)
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mt-1 font-medium">
                  参加メンバーの代表MMRと希望レーンに基づき、対面実力格差が最も小さくなる均等なチーム編成を自動生成します。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-rose-700 dark:text-rose-400 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 dark:border-[#3f4147] pt-3">
              <span>バランサーを開く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 4. 勝敗予想 (カジノ) */}
          <Link
            href="/casino"
            className="group relative bg-white/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border border-stone-200/90 hover:border-amber-400 dark:border-[#3f4147] dark:hover:border-amber-500 p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-amber-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🪙
                </div>
                <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  コイン ＆ ショップ
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  勝敗予想 ＆ KTMショップ
                </h2>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mt-1 font-medium">
                  カスタム対戦の勝敗にコインをベットして配当を獲得！貯まったコインで特殊アイテム（ロール指定など）を購入できます。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-amber-700 dark:text-amber-400 group-hover:translate-x-1 transition-transform border-t border-stone-200/80 dark:border-[#3f4147] pt-3">
              <span>勝敗予想へ行く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

        </div>

        {/* サブ機能クイックグリッド */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-stone-900 dark:text-white">⚡ コミュニティ ＆ 統計情報</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                title: '順位表 ＆ 名簿',
                sub: 'ロール別MMR・長者番付',
                href: '/leaderboard',
                icon: <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
                borderHover: 'hover:border-yellow-400',
              },
              {
                title: 'デュオ・チーム相性',
                sub: '勝率マトリクス・シナジー',
                href: '/leaderboard?tab=synergy',
                icon: <HeartHandshake className="w-5 h-5 text-fuchsia-600 dark:text-fuchsia-400" />,
                borderHover: 'hover:border-fuchsia-400',
              },
              {
                title: '使い方 ＆ ルール',
                sub: '参加ガイド・対戦仕様',
                href: '/guide',
                icon: <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
                borderHover: 'hover:border-emerald-400',
              },
              {
                title: '更新情報ログ',
                sub: '最新アップデート履歴',
                href: '/changelog',
                icon: <ScrollText className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
                borderHover: 'hover:border-sky-400',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`bg-white/80 dark:bg-[#2b2d31]/80 backdrop-blur-sm border border-stone-200/90 dark:border-[#3f4147] rounded-2xl p-4 transition-all duration-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between space-y-2 group cursor-pointer ${item.borderHover}`}
              >
                <div className="p-2 rounded-xl bg-stone-100 dark:bg-[#1e1f22] group-hover:scale-110 transition-transform w-fit">
                  {item.icon}
                </div>
                <div>
                  <div className="font-extrabold text-xs text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-bold mt-0.5">
                    {item.sub}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* フッター */}
        <footer className="text-center text-[11px] text-stone-500 dark:text-stone-400 font-bold border-t border-stone-200/80 dark:border-[#3f4147] pt-6">
          <p>© 2026 KTM Custom Portal. All Rights Reserved.</p>
        </footer>

      </div>
    </div>
  );
}

