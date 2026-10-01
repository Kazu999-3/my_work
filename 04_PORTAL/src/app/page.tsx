import Link from 'next/link';
import MatchNewsTicker from './components/MatchNewsTicker';
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
    <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6 md:p-8 flex flex-col justify-between selection:bg-primary-300/40">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        {/* トップヘッダー */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border border-border/90 dark:border-[#3f4147] rounded-3xl p-6 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="text-3xl sm:text-4xl p-3 bg-gradient-to-br from-primary-50 to-primary-100/80 dark:from-primary-500/20 dark:to-primary-500/10 rounded-2xl border border-primary-edge/80 dark:border-primary-edge-strong/30 shadow-xs shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground dark:text-white">
                  KTM カスタムポータル
                </h1>
                <span className="text-[10px] bg-gradient-to-r from-primary-500 to-primary-600 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  Official
                </span>
              </div>
              <p className="text-xs text-muted font-bold mt-1">
                週末定期カスタム対戦の公平なチーム分け ＆ 師弟マッチング・個人戦績カルテ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/guide"
              className="px-3.5 py-2 bg-surface-subtle hover:bg-surface-hover dark:bg-[#1e1f22] dark:hover:bg-[#35373c] text-foreground-subtle dark:text-stone-200 border border-border dark:border-[#3f4147] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-success-600 dark:text-success-400" />
              <span>利用ガイド</span>
            </Link>
          </div>
        </header>

        {/* 📰 月刊KTMスポーツ速報 (直近内戦のAIハイライト実況ニュース) */}
        <MatchNewsTicker />

        {/* 4大コア機能カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* 1. マイページ / 希望レーン */}
          <Link
            href="/mypage"
            className="group relative bg-surface/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border-2 border-primary-edge/80 hover:border-primary-edge-strong dark:border-primary-edge-strong/30 dark:hover:border-primary-edge-strong p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-primary-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-primary-500/15 border border-primary-edge-strong/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  👤
                </div>
                <span className="text-[11px] font-black text-primary-800 dark:text-primary-300 bg-primary-100 dark:bg-primary-500/20 border border-primary-edge dark:border-primary-edge-strong/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                  公式カルテ
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-foreground dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  マイページ ＆ 希望レーン設定
                </h2>
                <p className="text-xs text-muted leading-relaxed mt-1 font-medium">
                  あなた専用の戦績カルテ。希望レーン・NGレーンの変更、プレイスタイル診断、所持コイン管理が可能です。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-primary-700 dark:text-primary-400 group-hover:translate-x-1 transition-transform border-t border-border/80 dark:border-[#3f4147] pt-3">
              <span>マイカルテを開く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 2. 師弟自己紹介掲示板 */}
          <Link
            href="/mentorship"
            className="group relative bg-surface/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border-2 border-success-edge/80 hover:border-success-edge-strong dark:border-success-edge-strong/30 dark:hover:border-success-edge-strong p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-success-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-success-500/15 border border-success-edge-strong/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🤝
                </div>
                <span className="text-[11px] font-black text-success-800 dark:text-success-300 bg-success-100 dark:bg-success-500/20 border border-success-edge dark:border-success-edge-strong/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <HeartHandshake className="w-3 h-3 text-success-600 dark:text-success-400" />
                  初回+500pt進呈中
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-foreground dark:text-white group-hover:text-success-600 dark:group-hover:text-success-400 transition-colors">
                  師弟自己紹介掲示板
                </h2>
                <p className="text-xs text-muted leading-relaxed mt-1 font-medium">
                  「もっと上達したい弟子」と「優しく教えたい師匠」を結ぶ掲示板。自己紹介カードの作成・オファー申請が可能です。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-success-700 dark:text-success-400 group-hover:translate-x-1 transition-transform border-t border-border/80 dark:border-[#3f4147] pt-3">
              <span>師弟掲示板を見る</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 3. チーム分けバランサー */}
          <Link
            href="/balancer"
            className="group relative bg-surface/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border border-border/90 hover:border-danger-edge dark:border-[#3f4147] dark:hover:border-danger-edge-strong p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-danger-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-danger-500/15 border border-danger-edge-strong/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ⚔️
                </div>
                <span className="text-[11px] font-black text-danger-800 dark:text-danger-300 bg-danger-100 dark:bg-danger-500/20 border border-danger-edge dark:border-danger-edge-strong/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Swords className="w-3 h-3 text-danger-600 dark:text-danger-400" />
                  公平チーム分け
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-foreground dark:text-white group-hover:text-danger-600 dark:group-hover:text-danger-400 transition-colors">
                  チーム分けバランサー (5v5 Custom)
                </h2>
                <p className="text-xs text-muted leading-relaxed mt-1 font-medium">
                  参加メンバーの代表MMRと希望レーンに基づき、対面実力格差が最も小さくなる均等なチーム編成を自動生成します。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-danger-700 dark:text-danger-400 group-hover:translate-x-1 transition-transform border-t border-border/80 dark:border-[#3f4147] pt-3">
              <span>バランサーを開く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* 4. 勝敗予想 (カジノ) */}
          <Link
            href="/casino"
            className="group relative bg-surface/90 dark:bg-[#2b2d31]/90 backdrop-blur-md border border-border/90 hover:border-primary-edge dark:border-[#3f4147] dark:hover:border-primary-edge-strong p-6 rounded-3xl transition-all duration-300 shadow-xs hover:shadow-lg hover:shadow-primary-500/10 flex flex-col justify-between space-y-5 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-primary-500/15 border border-primary-edge-strong/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🪙
                </div>
                <span className="text-[11px] font-black text-primary-800 dark:text-primary-300 bg-primary-100 dark:bg-primary-500/20 border border-primary-edge dark:border-primary-edge-strong/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Coins className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                  コイン ＆ ショップ
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-foreground dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  勝敗予想 ＆ KTMショップ
                </h2>
                <p className="text-xs text-muted leading-relaxed mt-1 font-medium">
                  カスタム対戦の勝敗にコインをベットして配当を獲得！貯まったコインで特殊アイテム（ロール指定など）を購入できます。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-black text-primary-700 dark:text-primary-400 group-hover:translate-x-1 transition-transform border-t border-border/80 dark:border-[#3f4147] pt-3">
              <span>勝敗予想へ行く</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

        </div>

        {/* サブ機能クイックグリッド */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-foreground dark:text-white">⚡ コミュニティ ＆ 統計情報</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                title: '順位表 ＆ 名簿',
                sub: 'ロール別MMR・長者番付',
                href: '/leaderboard',
                icon: <Trophy className="w-5 h-5 text-primary-600 dark:text-primary-400" />,
                borderHover: 'hover:border-primary-edge',
              },
              {
                title: 'デュオ・チーム相性',
                sub: '勝率マトリクス・シナジー',
                href: '/leaderboard?tab=synergy',
                icon: <HeartHandshake className="w-5 h-5 text-primary-600 dark:text-primary-400" />,
                borderHover: 'hover:border-primary-edge',
              },
              {
                title: '使い方 ＆ ルール',
                sub: '参加ガイド・対戦仕様',
                href: '/guide',
                icon: <BookOpen className="w-5 h-5 text-success-600 dark:text-success-400" />,
                borderHover: 'hover:border-success-edge',
              },
              {
                title: '更新情報ログ',
                sub: '最新アップデート履歴',
                href: '/changelog',
                icon: <ScrollText className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />,
                borderHover: 'hover:border-secondary-edge',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`bg-surface/80 dark:bg-[#2b2d31]/80 backdrop-blur-sm border border-border/90 dark:border-[#3f4147] rounded-2xl p-4 transition-all duration-200 shadow-2xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between space-y-2 group cursor-pointer ${item.borderHover}`}
              >
                <div className="p-2 rounded-xl bg-surface-subtle dark:bg-[#1e1f22] group-hover:scale-110 transition-transform w-fit">
                  {item.icon}
                </div>
                <div>
                  <div className="font-extrabold text-xs text-foreground dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-muted-strong font-bold mt-0.5">
                    {item.sub}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* フッター */}
        <footer className="text-center text-[11px] text-muted-strong font-bold border-t border-border/80 dark:border-[#3f4147] pt-6">
          <p>© 2026 KTM Custom Portal. All Rights Reserved.</p>
        </footer>

      </div>
    </div>
  );
}

