"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, Swords, BookOpen, BookHeart, Trophy, History, Users } from 'lucide-react';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard, href: '/', color: 'text-white', activeBg: 'bg-white/10' },
  { id: 'leaderboard', label: 'リーダーボード', icon: Trophy, href: '/leaderboard', color: 'text-amber-400', activeBg: 'bg-amber-400/15' },
  { id: 'balancer',    label: 'チーム分け',       icon: Users, href: '/balancer', color: 'text-emerald-400', activeBg: 'bg-emerald-400/15' },
  { id: 'matchups',  label: 'バトルサーチ',   icon: Swords,          href: '/matchups', color: 'text-[#00cfef]', activeBg: 'bg-[#00cfef]/15' },
  { id: 'champions', label: 'チャンピオン辞典', icon: BookHeart,     href: '/champions', color: 'text-[#c89b3c]', activeBg: 'bg-[#c89b3c]/15' },
  { id: 'library',   label: '攻略ライブラリ', icon: BookOpen,        href: '/library', color: 'text-[#a78bfa]', activeBg: 'bg-[#a78bfa]/15' },
  { id: 'ktm-admin',   label: '⚙️ 管理者専用',     icon: Shield, href: '/ktm-admin', color: 'text-indigo-400', activeBg: 'bg-indigo-400/15' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
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
          const isPublicPage = pathname.startsWith('/balancer') || pathname.startsWith('/leaderboard') || pathname.startsWith('/player');
          const isPublicMenu = item.id === 'balancer' || item.id === 'leaderboard';
          
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
  );
}
