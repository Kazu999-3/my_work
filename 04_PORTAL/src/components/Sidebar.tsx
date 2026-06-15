"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, Swords, BookOpen, BookHeart, Trophy, Users, HeartHandshake, ScrollText, ListVideo, ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import NotificationBell from './NotificationBell';
import FavoritesPanel from './FavoritesPanel';

// 一般ユーザー用 (管理者エリア外で表示)
const MENU_ITEMS = [
  { id: 'balancer',  label: 'チーム分け', icon: Swords, href: '/balancer', color: 'text-rose-500', activeBg: 'bg-rose-500/15' },
  { id: 'leaderboard', label: 'リーダーボード', icon: Trophy, href: '/leaderboard', color: 'text-yellow-400', activeBg: 'bg-yellow-400/15' },
  { id: 'history',   label: '過去の試合履歴', icon: Swords, href: '/history', color: 'text-orange-400', activeBg: 'bg-orange-400/15' },
  { id: 'synergy',   label: '相性・ライバル', icon: HeartHandshake, href: '/synergy', color: 'text-fuchsia-400', activeBg: 'bg-fuchsia-400/15' },
];

// 管理者ログイン時：管理者機能タブ用 (過去の試合履歴を除外)
const ADMIN_ONLY_MENU_ITEMS = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard, href: '/admin/dashboard', color: 'text-white', activeBg: 'bg-white/10' },
  { id: 'matchups',  label: 'バトルサーチ',   icon: Swords,          href: '/matchups', color: 'text-[#00cfef]', activeBg: 'bg-[#00cfef]/15' },
  { id: 'champions', label: 'チャンピオン辞典', icon: BookHeart,     href: '/champions', color: 'text-[#c89b3c]', activeBg: 'bg-[#c89b3c]/15' },
  { id: 'library',   label: '攻略ライブラリ', icon: BookOpen,        href: '/library', color: 'text-[#a78bfa]', activeBg: 'bg-[#a78bfa]/15' },
  { id: 'design',    label: 'システム設計書', icon: ScrollText,      href: '/design', color: 'text-cyan-400', activeBg: 'bg-cyan-400/15' },
  { id: 'youtube-admin', label: 'YouTube管理', icon: ListVideo,     href: '/admin/youtube', color: 'text-red-400', activeBg: 'bg-red-400/15' },
  { id: 'affiliate-admin', label: '副業管理', icon: Coins,           href: '/admin/affiliate', color: 'text-emerald-400', activeBg: 'bg-emerald-400/15' },
  { id: 'ktm-admin',   label: '⚙️ 管理者専用',     icon: Shield, href: '/ktm-admin', color: 'text-indigo-400', activeBg: 'bg-indigo-400/15' },
];

// 管理者ログイン時：一般機能タブ用 (過去の試合履歴を除外)
const ADMIN_GENERAL_MENU_ITEMS = [
  { id: 'balancer',  label: 'チーム分け', icon: Swords, href: '/balancer', color: 'text-rose-500', activeBg: 'bg-rose-500/15' },
  { id: 'leaderboard', label: 'リーダーボード', icon: Trophy, href: '/leaderboard', color: 'text-yellow-400', activeBg: 'bg-yellow-400/15' },
  { id: 'synergy',   label: '相性・ライバル', icon: HeartHandshake, href: '/synergy', color: 'text-fuchsia-400', activeBg: 'bg-fuchsia-400/15' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'admin' | 'general'>('admin');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sovereign_sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
    setMounted(true);
  }, []);

  const toggleCollapse = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem('sovereign_sidebar_collapsed', String(nextVal));
  };

  // 管理者エリアの判定
  const isAdminArea = 
    pathname === '/' ||
    pathname.startsWith('/ktm-admin') ||
    pathname.startsWith('/matchups') ||
    pathname.startsWith('/champions') ||
    pathname.startsWith('/library') ||
    pathname.startsWith('/design') ||
    pathname.startsWith('/admin');

  // 表示するメニュー項目の決定
  const activeMenuItems = isAdminArea 
    ? (activeTab === 'admin' ? ADMIN_ONLY_MENU_ITEMS : ADMIN_GENERAL_MENU_ITEMS) 
    : MENU_ITEMS;

  return (
    <>
      {/* PC用サイドバー */}
      <aside className={`hidden md:flex flex-col h-screen sticky top-0 bg-[#0a0b10]/60 backdrop-blur-2xl border-r border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-50 overflow-y-auto custom-scrollbar transition-all duration-300 relative ${
        isCollapsed ? 'w-20 px-3 py-6' : 'w-64 p-8'
      }`}>
        
        {/* トグルボタン */}
        <button 
          onClick={toggleCollapse}
          className="absolute top-8 -right-3 w-6 h-6 rounded-full bg-[#161922] border border-white/15 hover:border-amber-400/50 text-gray-400 hover:text-white flex items-center justify-center transition-all z-50 shadow-md cursor-pointer"
          title={isCollapsed ? "サイドバーを展開" : "サイドバーを最小化"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* ロゴと通知ベル */}
        <div className={`flex items-center justify-between mb-8 flex-shrink-0 ${isCollapsed ? 'flex-col gap-4' : 'flex-row'}`}>
          <Link href="/balancer" prefetch={false} className="flex items-center gap-3 group cursor-pointer">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-[#c89b3c] blur-lg opacity-50 rounded-full group-hover:opacity-80 transition-opacity"></div>
              <Shield className="text-[#c89b3c] relative z-10 group-hover:scale-110 transition-transform" size={26} />
            </div>
            <span className={`text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c89b3c] to-yellow-200 font-mono tracking-tight transition-all duration-300 overflow-hidden ${
              isCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-auto opacity-100'
            }`}>
              SOVEREIGN
            </span>
          </Link>
          {/* 通知ベル (展開時のみ表示) */}
          {!isCollapsed && <NotificationBell />}
        </div>

        {/* 管理者ログイン時のタブ切り替えUI */}
        {isAdminArea && (
          <div className="flex-shrink-0">
            {!isCollapsed ? (
              <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 mb-6">
                <button 
                  onClick={() => setActiveTab('admin')} 
                  className={`flex-1 text-center py-2 rounded-lg text-[11px] font-black transition-all ${
                    activeTab === 'admin' 
                      ? 'bg-[#c89b3c] text-black shadow' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  管理者機能
                </button>
                <button 
                  onClick={() => setActiveTab('general')} 
                  className={`flex-1 text-center py-2 rounded-lg text-[11px] font-black transition-all ${
                    activeTab === 'general' 
                      ? 'bg-white/10 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  一般機能
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setActiveTab(activeTab === 'admin' ? 'general' : 'admin')} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#c89b3c] hover:text-white transition-all mb-6 mx-auto cursor-pointer"
                title={activeTab === 'admin' ? "管理者機能表示中 (クリックで一般へ)" : "一般機能表示中 (クリックで管理者へ)"}
              >
                {activeTab === 'admin' ? <Shield size={18} /> : <Users size={18} />}
              </button>
            )}
          </div>
        )}

        {/* ナビゲーション */}
        <nav className="flex flex-col gap-2 flex-shrink-0">
          {activeMenuItems.map((item) => {
            const isActive = pathname === item.href || (item.id === 'leaderboard' && pathname.startsWith('/player'));

            return (
              <Link 
                key={item.id} 
                href={item.href}
                prefetch={false}
                className={`flex items-center gap-3 py-3 rounded-xl font-bold text-sm transition-all duration-300 relative overflow-hidden group ${
                  isCollapsed ? 'justify-center px-0' : 'px-4'
                } ${
                  isActive 
                    ? `${item.activeBg} ${item.color} shadow-inner border border-white/5` 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                {isActive && !isCollapsed && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full ${item.activeBg.replace('/15', '')} bg-current`}></div>
                )}
                <item.icon size={18} className={`transition-transform duration-300 shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className={`tracking-wide transition-all duration-300 ${
                  isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'
                }`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* お気に入りパネル */}
        <FavoritesPanel isCollapsed={isCollapsed} />

        {/* 管理者用ログインリンク（一般画面かつ展開時のみ表示） */}
        {!isAdminArea && !isCollapsed && (
          <div className="mt-4 text-center flex-shrink-0">
            <Link 
              href="/ktm-admin" 
              prefetch={false}
              className="inline-flex items-center justify-center gap-2 text-xs text-amber-400 hover:text-white transition-all duration-300 font-black py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 hover:border-amber-500/50 w-full shadow-lg shadow-amber-950/10"
            >
              <Shield size={14} className="text-amber-400 animate-pulse" />
              <span>管理者ダッシュボード 🔑</span>
            </Link>
          </div>
        )}

        {/* フッター システムステータス */}
        <div className={`mt-auto pt-6 border-t border-white/5 flex-shrink-0 w-full`}>
          <div className={`flex items-center gap-3 bg-black/40 rounded-2xl border border-white/5 ${isCollapsed ? 'justify-center p-3 w-10 h-10 mx-auto' : 'p-4'}`}>
            <div className="relative flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-[var(--color-success)] relative z-10"></div>
              <div className="absolute w-4 h-4 rounded-full bg-[var(--color-success)] animate-ping opacity-75"></div>
            </div>
            {!isCollapsed && (
              <div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Status</p>
                <p className="text-xs text-[var(--color-success)] font-black">All Systems Go</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* スマホ用ボトムナビゲーション */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0b10]/95 backdrop-blur-xl border-t border-white/10 z-50 flex items-center justify-around px-1 py-2 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] pb-[env(safe-area-inset-bottom)] overflow-x-auto custom-scrollbar">
        {/* 通常アイテムの表示 */}
        {activeMenuItems.slice(0, 4).map((item) => {
          const isActive = pathname === item.href || (item.id === 'leaderboard' && pathname.startsWith('/player'));

          return (
            <Link 
              key={`mobile-${item.id}`} 
              href={item.href}
              prefetch={false}
              className={`flex flex-col items-center justify-center min-w-[3.5rem] p-2 rounded-xl transition-all duration-300 ${
                isActive 
                  ? `${item.activeBg} ${item.color} shadow-inner border border-white/5` 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon size={18} className={`mb-1 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[9px] font-bold tracking-wider truncate w-full text-center">{item.label}</span>
            </Link>
          );
        })}

        {/* 管理者エリアで、項目数が溢れる場合の「一般/管理者」のスマホ切り替えトグルボタン */}
        {isAdminArea && (
          <button 
            onClick={() => setActiveTab(activeTab === 'admin' ? 'general' : 'admin')} 
            className="flex flex-col items-center justify-center min-w-[3.5rem] p-2 rounded-xl text-amber-400 hover:text-white bg-white/5 border border-white/10 transition-all cursor-pointer"
          >
            {activeTab === 'admin' ? <Users size={18} className="mb-1 text-amber-400" /> : <Shield size={18} className="mb-1 text-indigo-400" />}
            <span className="text-[9px] font-black tracking-wider text-center">{activeTab === 'admin' ? '一般へ' : '管理へ'}</span>
          </button>
        )}
      </nav>
    </>
  );
}
