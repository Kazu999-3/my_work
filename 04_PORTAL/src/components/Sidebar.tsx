"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, Swords, BookOpen, BookHeart, Trophy, Users, HeartHandshake, ScrollText, ListVideo, ChevronLeft, ChevronRight, Coins, Brain, Trees, Sparkles, Search, MoreHorizontal, X as XIcon, TrendingUp, Activity } from 'lucide-react';
import FavoritesPanel from './FavoritesPanel';
import PushOptIn from './PushOptIn';
import NotificationBell from './NotificationBell';
import SystemStatus from './SystemStatus';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  href: string;
  color: string;
  activeBg: string;
  section?: string;
}

function MobileNavItem({ item, active, pending, onClick }: { item: MenuItem; active: boolean; pending?: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  const lit = active || pending;
  const isAdminGated = item.href.startsWith('/admin');
  return (
    <Link
      href={item.href}
      prefetch={isAdminGated ? false : true}
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-1.5 rounded-xl transition-colors duration-100 touch-manipulation select-none ${
        lit ? `${item.activeBg} ${item.color}` : 'text-stone-500 active:bg-black/10'
      } ${pending && !active ? 'opacity-70' : ''}`}
    >
      <Icon size={18} className={`mb-1 ${pending && !active ? 'animate-pulse' : ''}`} />
      <span className="text-[9px] font-bold tracking-wider truncate w-full text-center">{item.label}</span>
    </Link>
  );
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'balancer',    label: 'チーム分け',     icon: Swords,         href: '/balancer',         color: 'text-rose-500',    activeBg: 'bg-rose-500/15' },
  { id: 'leaderboard', label: '順位表',         icon: Trophy,         href: '/leaderboard',      color: 'text-yellow-400',  activeBg: 'bg-yellow-400/15' },
  { id: 'synergy',     label: 'チームシナジー',     icon: HeartHandshake, href: '/synergy',          color: 'text-fuchsia-400', activeBg: 'bg-fuchsia-400/15' },
  { id: 'history',     label: '試合履歴',       icon: Swords,         href: '/history',          color: 'text-orange-400',  activeBg: 'bg-orange-400/15' },
  { id: 'changelog',   label: '更新情報',       icon: ScrollText,     href: '/changelog',        color: 'text-cyan-400',    activeBg: 'bg-cyan-400/15' },
  { id: 'login',       label: 'ログイン',       icon: Shield,         href: '/login',            color: 'text-indigo-400',  activeBg: 'bg-indigo-400/15' },
];

const ADMIN_ONLY_MENU_ITEMS: MenuItem[] = [
  // ── ⚙️ システム運用 ──
  { id: 'dashboard', label: 'システム運用', icon: LayoutDashboard, href: '/admin/dashboard', color: 'text-stone-900', activeBg: 'bg-black/10', section: 'システム運用' },
  // ── 📖 攻略ハブ ──
  { id: 'champions', label: '辞典', icon: BookHeart, href: '/champions', color: 'text-[#c89b3c]', activeBg: 'bg-[#c89b3c]/15', section: '攻略ハブ' },
  { id: 'dict-health', label: 'ヘルス診断', icon: Activity, href: '/admin/dict-health', color: 'text-amber-500', activeBg: 'bg-amber-500/15' },
  { id: 'knowledge-admin', label: 'ナレッジ', icon: Brain, href: '/admin/knowledge', color: 'text-pink-400', activeBg: 'bg-pink-400/15' },
  // ── 🔍 分析 ──
  { id: 'coach', label: 'コーチ', icon: Sparkles, href: '/coach', color: 'text-indigo-300', activeBg: 'bg-indigo-500/15', section: '分析・検索' },
  { id: 'search', label: '横断検索', icon: Search, href: '/search', color: 'text-[#a78bfa]', activeBg: 'bg-[#a78bfa]/15' },
  { id: 'analytics', label: 'note分析', icon: TrendingUp, href: '/admin/analytics', color: 'text-teal-400', activeBg: 'bg-teal-400/15' },
  // ── 📊 大会運営 ──
  { id: 'ktm-admin', label: 'KTM大会管理', icon: Shield, href: '/ktm-admin', color: 'text-indigo-400', activeBg: 'bg-indigo-400/15', section: '大会運営' },
];

const ADMIN_GENERAL_MENU_ITEMS: MenuItem[] = [
  { id: 'balancer',  label: 'チーム分け', icon: Swords, href: '/balancer', color: 'text-rose-500', activeBg: 'bg-rose-500/15' },
  { id: 'leaderboard', label: 'リーダーボード', icon: Trophy, href: '/leaderboard', color: 'text-yellow-400', activeBg: 'bg-yellow-400/15' },
  { id: 'synergy',   label: 'チームシナジー', icon: HeartHandshake, href: '/synergy', color: 'text-fuchsia-400', activeBg: 'bg-fuchsia-400/15' },
  { id: 'changelog', label: '更新情報', icon: ScrollText, href: '/changelog', color: 'text-cyan-400', activeBg: 'bg-cyan-400/15' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => { setPendingHref(null); }, [pathname]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'admin' | 'general'>('admin');
  const [mounted, setMounted] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sovereign_sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sovereign_sidebar_collapsed', String(nextState));
  };

  const isAdminGatedPage = pathname.startsWith('/admin') || ['/ktm-admin', '/champions', '/coach', '/search'].some(p => pathname.startsWith(p));

  const items = isAdminGatedPage
    ? (activeTab === 'admin' ? ADMIN_ONLY_MENU_ITEMS : ADMIN_GENERAL_MENU_ITEMS)
    : MENU_ITEMS;

  const primaryMobileItems = items.slice(0, 5);
  const overflowMobileItems = items.slice(5);

  return (
    <>
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-[#f7f5f0] border-r border-stone-200/80 transition-all duration-300 z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-200/80">
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-stone-900 tracking-tight">SOVEREIGN</span>
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl hover:bg-stone-200/60 text-stone-600 transition"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {isAdminGatedPage && !isCollapsed && (
          <div className="p-3 border-b border-stone-200/80">
            <div className="flex bg-stone-200/60 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  activeTab === 'admin' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                管理者
              </button>
              <button
                onClick={() => setActiveTab('general')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  activeTab === 'general' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                一般
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map((item: any, idx) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const showSection = !isCollapsed && item.section && (idx === 0 || items[idx - 1]?.section !== item.section);

            return (
              <React.Fragment key={item.id}>
                {showSection && (
                  <div className="px-3 pt-4 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
                    {item.section}
                  </div>
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive ? `${item.activeBg} ${item.color}` : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-3 border-t border-stone-200/80 space-y-2">
          <FavoritesPanel isCollapsed={isCollapsed} />
          <PushOptIn collapsed={isCollapsed} />
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#f7f5f0]/95 backdrop-blur-md border-t border-stone-200 z-40 px-2 py-1.5 flex items-center justify-around">
        {primaryMobileItems.map((item) => (
          <MobileNavItem
            key={item.id}
            item={item}
            active={pathname.startsWith(item.href)}
            pending={pendingHref === item.href}
            onClick={() => setPendingHref(item.href)}
          />
        ))}
        {overflowMobileItems.length > 0 && (
          <button
            onClick={() => setShowMobileMore(true)}
            className="flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-1.5 rounded-xl text-stone-500 active:bg-black/10 touch-manipulation select-none"
          >
            <MoreHorizontal size={18} className="mb-1" />
            <span className="text-[9px] font-bold tracking-wider truncate w-full text-center">その他</span>
          </button>
        )}
      </nav>

      {showMobileMore && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#f7f5f0] rounded-t-3xl p-5 border-t border-stone-200 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-200">
              <h3 className="font-extrabold text-sm text-stone-900">メニュー</h3>
              <button onClick={() => setShowMobileMore(false)} className="p-1.5 rounded-full hover:bg-stone-200">
                <XIcon size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {overflowMobileItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setShowMobileMore(false)}
                    className={`flex flex-col items-center p-3 rounded-2xl border text-center transition ${
                      isActive ? `${item.activeBg} ${item.color} border-current` : 'bg-white border-stone-200 text-stone-700'
                    }`}
                  >
                    <Icon size={20} className="mb-1.5" />
                    <span className="text-[10px] font-bold truncate w-full">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
