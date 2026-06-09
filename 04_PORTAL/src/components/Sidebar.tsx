"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, Swords, BookOpen, BookHeart, Trophy, History, Users, HeartHandshake, User } from 'lucide-react';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard, href: '/', color: 'text-white', activeBg: 'bg-white/10' },
  { id: 'mypage',    label: 'マイページ',     icon: User, href: '/mypage', color: 'text-blue-400', activeBg: 'bg-blue-400/15' },
  { id: 'history',   label: '過去の試合履歴', icon: History, href: '/history', color: 'text-orange-400', activeBg: 'bg-orange-400/15' },
  { id: 'leaderboard', label: 'リーダーボード', icon: Trophy, href: '/leaderboard', color: 'text-yellow-400', activeBg: 'bg-yellow-400/15' },
  { id: 'balancer',  label: 'チーム分け', icon: Swords, href: '/balancer', color: 'text-rose-500', activeBg: 'bg-rose-500/15' },
  { id: 'synergy',   label: '相性・ライバル', icon: HeartHandshake, href: '/synergy', color: 'text-fuchsia-400', activeBg: 'bg-fuchsia-400/15' },
  { id: 'matchups',  label: 'バトルサーチ',   icon: Swords,          href: '/matchups', color: 'text-[#00cfef]', activeBg: 'bg-[#00cfef]/15' },
  { id: 'champions', label: 'チャンピオン辞典', icon: BookHeart,     href: '/champions', color: 'text-[#c89b3c]', activeBg: 'bg-[#c89b3c]/15' },
  { id: 'library',   label: '攻略ライブラリ', icon: BookOpen,        href: '/library', color: 'text-[#a78bfa]', activeBg: 'bg-[#a78bfa]/15' },
  { id: 'ktm-admin',   label: '⚙️ 管理者専用',     icon: Shield, href: '/ktm-admin', color: 'text-indigo-400', activeBg: 'bg-indigo-400/15' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* PC用サイドバー */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-[#0a0b10]/60 backdrop-blur-2xl border-r border-white/10 p-8 shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-12">
        <div className="relative">
          <div className="absolute inset-0 bg-[#c89b3c] blur-lg opacity-50 rounded-full"></div>
          <Shield className="text-[#c89b3c] relative z-10" size={28} />
        </div>
        <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c89b3c] to-yellow-200 font-mono tracking-tight">SOVEREIGN</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-3">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.id === 'leaderboard' && pathname.startsWith('/player'));
          
          // 公開ページにいる時は、公開メニュー以外隠す
          const isPublicPage = pathname.startsWith('/balancer') || pathname.startsWith('/leaderboard') || pathname.startsWith('/synergy') || pathname.startsWith('/history') || pathname.startsWith('/mypage');
          const isPublicMenu = item.id === 'balancer' || item.id === 'leaderboard' || item.id === 'synergy' || item.id === 'ktm-admin' || item.id === 'history' || item.id === 'mypage';
          
          if (isPublicPage && !isPublicMenu) {
            return null; // 非表示
          }

          return (
            <Link 
              key={item.id} 
              href={item.href}
              prefetch={false}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 relative overflow-hidden group ${
                isActive 
                  ? `${item.activeBg} ${item.color} shadow-inner border border-white/5` 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {isActive && (
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full ${item.activeBg.replace('/15', '')} bg-current`}></div>
              )}
              <item.icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="mt-auto pt-8 border-t border-white/5">
        <div className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
          <div className="relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--color-success)] relative z-10"></div>
            <div className="absolute w-4 h-4 rounded-full bg-[var(--color-success)] animate-ping opacity-75"></div>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Status</p>
            <p className="text-xs text-[var(--color-success)] font-black">All Systems Go</p>
          </div>
        </div>
      </div>
      </aside>

      {/* スマホ用ボトムナビゲーション */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0b10]/90 backdrop-blur-xl border-t border-white/10 z-50 flex items-center overflow-x-auto no-scrollbar px-2 py-2 gap-2 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] pb-[env(safe-area-inset-bottom)]">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.id === 'leaderboard' && pathname.startsWith('/player'));
          
          const isPublicPage = pathname.startsWith('/balancer') || pathname.startsWith('/leaderboard') || pathname.startsWith('/synergy') || pathname.startsWith('/history') || pathname.startsWith('/mypage');
          const isPublicMenu = item.id === 'balancer' || item.id === 'leaderboard' || item.id === 'synergy' || item.id === 'ktm-admin' || item.id === 'history' || item.id === 'mypage';
          
          if (isPublicPage && !isPublicMenu) {
            return null; 
          }

          return (
            <Link 
              key={`mobile-${item.id}`} 
              href={item.href}
              prefetch={false}
              className={`flex flex-col items-center justify-center min-w-[4.5rem] p-2 rounded-xl transition-all duration-300 ${
                isActive 
                  ? `${item.activeBg} ${item.color} shadow-inner border border-white/5` 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon size={20} className={`mb-1 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] font-bold tracking-wider truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
