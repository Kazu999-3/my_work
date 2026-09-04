"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LayoutDashboard, Swords, BookOpen, BookHeart, Trophy, Users, HeartHandshake, ScrollText, ChevronLeft, ChevronRight, Sparkles, MoreHorizontal, X as XIcon, TrendingUp, Coins, LogIn, LogOut, Flame } from 'lucide-react';
import FavoritesPanel from './FavoritesPanel';
import PushOptIn from './PushOptIn';
import NotificationBell from './NotificationBell';
import TaskStatusDrawer from './TaskStatusDrawer';
import { useCurrentUser } from '../hooks/useCurrentUser';

function UserAuthWidget({ collapsed }: { collapsed?: boolean }) {
  const { user, loading, loginWithDiscord, logout } = useCurrentUser();

  if (loading) return null;

  if (user) {
    return (
      <div className={`p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
        <img
          src={user.avatar}
          alt={user.displayName}
          className="w-7 h-7 rounded-full border border-amber-500/40 shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black text-stone-900 truncate">
              {user.displayName}
            </div>
            <div className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
              <span>🪙</span>
              <span>{(user.coins ?? 1000).toLocaleString()} pt</span>
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={logout}
            title="ログアウト"
            className="p-1 text-stone-400 hover:text-stone-700 transition"
          >
            <LogOut size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => loginWithDiscord()}
      className={`w-full py-2 px-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
        collapsed ? 'px-0' : ''
      }`}
      title="Discordアカウントでログイン"
    >
      <LogIn size={14} />
      {!collapsed && <span>Discordログイン</span>}
    </button>
  );
}

interface MenuItem {
  id: string;
  label: string;
  shortLabel?: string;
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
      className={`flex flex-col items-center justify-center flex-1 px-1 py-1 rounded-xl transition-colors duration-100 touch-manipulation select-none ${lit ? `${item.activeBg} ${item.color}` : 'text-stone-500 active:bg-black/10'
        } ${pending && !active ? 'opacity-70' : ''}`}
    >
      <Icon size={19} className={`mb-0.5 ${pending && !active ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] font-black tracking-tight whitespace-nowrap leading-none">{item.shortLabel || item.label}</span>
    </Link>
  );
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'guide', label: 'はじめに', shortLabel: 'ガイド', icon: BookOpen, href: '/guide', color: 'text-amber-500', activeBg: 'bg-amber-500/15' },
  { id: 'balancer', label: 'チーム分け', shortLabel: 'チーム', icon: Swords, href: '/balancer', color: 'text-rose-500', activeBg: 'bg-rose-500/15' },
  { id: 'casino', label: '勝敗予想', shortLabel: 'カジノ', icon: Coins, href: '/casino', color: 'text-amber-400', activeBg: 'bg-amber-400/15' },
  { id: 'player', label: 'プレイヤー名簿', shortLabel: 'カルテ', icon: Users, href: '/player', color: 'text-indigo-500', activeBg: 'bg-indigo-500/15' },
  { id: 'leaderboard', label: '順位表', shortLabel: '順位', icon: Trophy, href: '/leaderboard', color: 'text-yellow-400', activeBg: 'bg-yellow-400/15' },
  { id: 'synergy', label: 'チームシナジー', shortLabel: '相性', icon: HeartHandshake, href: '/synergy', color: 'text-fuchsia-400', activeBg: 'bg-fuchsia-400/15' },
  { id: 'history', label: '試合履歴', shortLabel: '履歴', icon: Swords, href: '/history', color: 'text-orange-400', activeBg: 'bg-orange-400/15' },
  { id: 'changelog', label: '更新情報', shortLabel: '更新', icon: ScrollText, href: '/changelog', color: 'text-cyan-400', activeBg: 'bg-cyan-400/15' },
  { id: 'login', label: 'ログイン', shortLabel: '認証', icon: Shield, href: '/login', color: 'text-indigo-400', activeBg: 'bg-indigo-400/15' },
];

const ADMIN_ONLY_MENU_ITEMS: MenuItem[] = [
  // ── 🎮 プレイ ＆ コーチ ──
  { id: 'coach', label: 'ソロQコーチ', shortLabel: 'コーチ', icon: Sparkles, href: '/coach', color: 'text-indigo-500', activeBg: 'bg-indigo-500/15', section: 'プレイ ＆ コーチ' },
  // ── 📖 攻略・ナレッジ ──
  { id: 'champions', label: '攻略ナレッジハブ', shortLabel: '辞典', icon: BookHeart, href: '/champions', color: 'text-[#c89b3c]', activeBg: 'bg-[#c89b3c]/15', section: '攻略・ナレッジ' },
  // ── 📊 大会 ＆ コミュニティ ──
  { id: 'balancer', label: 'チーム分け', shortLabel: 'チーム', icon: Swords, href: '/balancer', color: 'text-rose-500', activeBg: 'bg-rose-500/15', section: '大会 ＆ コミュニティ' },
  { id: 'casino', label: '勝敗予想', shortLabel: 'カジノ', icon: Coins, href: '/casino', color: 'text-amber-500', activeBg: 'bg-amber-500/15', section: '大会 ＆ コミュニティ' },
  { id: 'ktm-admin', label: 'KTM大会管理', shortLabel: '大会管理', icon: Shield, href: '/ktm-admin', color: 'text-indigo-400', activeBg: 'bg-indigo-400/15', section: '大会 ＆ コミュニティ' },
  { id: 'leaderboard', label: 'リーダーボード', shortLabel: '順位', icon: Trophy, href: '/leaderboard', color: 'text-yellow-500', activeBg: 'bg-yellow-500/15', section: '大会 ＆ コミュニティ' },
  { id: 'player', label: 'プレイヤー名簿', shortLabel: 'カルテ', icon: Users, href: '/player', color: 'text-sky-500', activeBg: 'bg-sky-500/15', section: '大会 ＆ コミュニティ' },
  // ── ⚙️ システム ＆ 分析 ──
  { id: 'dashboard', label: 'システム運用', shortLabel: '設定', icon: LayoutDashboard, href: '/admin/dashboard', color: 'text-stone-800', activeBg: 'bg-black/10', section: 'システム ＆ 分析' },
  { id: 'analytics', label: 'note分析', shortLabel: '分析', icon: TrendingUp, href: '/admin/analytics', color: 'text-teal-500', activeBg: 'bg-teal-500/15', section: 'システム ＆ 分析' },
];

const ADMIN_GENERAL_MENU_ITEMS: MenuItem[] = [
  { id: 'guide', label: 'はじめに', shortLabel: 'ガイド', icon: BookOpen, href: '/guide', color: 'text-amber-500', activeBg: 'bg-amber-500/15' },
  { id: 'balancer', label: 'チーム分け', shortLabel: 'チーム', icon: Swords, href: '/balancer', color: 'text-rose-500', activeBg: 'bg-rose-500/15' },
  { id: 'casino', label: '勝敗予想', shortLabel: 'カジノ', icon: Coins, href: '/casino', color: 'text-amber-400', activeBg: 'bg-amber-400/15' },
  { id: 'player', label: 'プレイヤー名簿', shortLabel: 'カルテ', icon: Users, href: '/player', color: 'text-indigo-500', activeBg: 'bg-indigo-500/15' },
  { id: 'leaderboard', label: 'リーダーボード', shortLabel: '順位', icon: Trophy, href: '/leaderboard', color: 'text-yellow-400', activeBg: 'bg-yellow-400/15' },
  { id: 'synergy', label: 'チームシナジー', shortLabel: '相性', icon: HeartHandshake, href: '/synergy', color: 'text-fuchsia-400', activeBg: 'bg-fuchsia-400/15' },
  { id: 'history', label: '試合履歴', shortLabel: '履歴', icon: Swords, href: '/history', color: 'text-orange-400', activeBg: 'bg-orange-400/15' },
  { id: 'changelog', label: '更新情報', shortLabel: '更新', icon: ScrollText, href: '/changelog', color: 'text-cyan-400', activeBg: 'bg-cyan-400/15' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => { setPendingHref(null); }, [pathname]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'admin' | 'general'>('admin');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sovereign_sidebar_collapsed');
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }
    const savedTab = localStorage.getItem('sovereign_sidebar_tab') as 'admin' | 'general';
    if (savedTab) {
      setActiveTab(savedTab);
    }

    // ユーザー情報からの管理者即時判定
    if (user && (user.isAdmin || user.discordId === '697220229964759130' || user.displayName?.includes('かずき'))) {
      setIsAdminUser(true);
      if (!savedTab) setActiveTab('admin');
    }

    // サーバー認証状態の確認
    fetch("/api/auth/verify", { method: "POST", credentials: "include", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => {
        const authed = !!data.valid;
        if (authed) {
          setIsAdminUser(true);
          if (!savedTab) {
            setActiveTab('admin');
          }
        }
      })
      .catch(() => {});

    setMounted(true);
  }, [user]);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sovereign_sidebar_collapsed', String(nextState));
  };

  const handleTabChange = (tab: 'admin' | 'general') => {
    setActiveTab(tab);
    localStorage.setItem('sovereign_sidebar_tab', tab);
  };

  const isAdminGatedPage = pathname.startsWith('/admin') || ['/ktm-admin', '/champions', '/coach', '/lane-guides'].some(p => pathname.startsWith(p));
  const showAdminToggle = isAdminUser || isAdminGatedPage;

  const items = showAdminToggle
    ? (activeTab === 'admin' ? ADMIN_ONLY_MENU_ITEMS : ADMIN_GENERAL_MENU_ITEMS)
    : MENU_ITEMS;

  const primaryMobileItems = items.slice(0, 5);
  const overflowMobileItems = items.slice(5);

  return (
    <>
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-[#f7f5f0] border-r border-stone-200/80 transition-all duration-300 z-30 ${isCollapsed ? 'w-20' : 'w-64'
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

        {showAdminToggle && !isCollapsed && (
          <div className="p-3 border-b border-stone-200/80">
            <div className="flex bg-stone-200/60 p-1 rounded-xl">
              <button
                onClick={() => handleTabChange('admin')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${activeTab === 'admin' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
              >
                管理者
              </button>
              <button
                onClick={() => handleTabChange('general')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${activeTab === 'general' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${isActive ? `${item.activeBg} ${item.color}` : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
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
          {/* Discord ユーザープロフィール / ログイン */}
          <UserAuthWidget collapsed={isCollapsed} />
          {showAdminToggle && (
            <>
              <TaskStatusDrawer collapsed={isCollapsed} />
              <NotificationBell collapsed={isCollapsed} />
              <FavoritesPanel isCollapsed={isCollapsed} />
              <PushOptIn collapsed={isCollapsed} />
            </>
          )}
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#f7f5f0]/95 backdrop-blur-md border-t border-stone-200 z-40 px-2 py-2 min-h-[52px] flex items-center justify-around">
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
            className="flex flex-col items-center justify-center min-w-[3.75rem] px-2 py-2 rounded-xl text-stone-600 active:bg-black/10 touch-manipulation select-none"
          >
            <MoreHorizontal size={20} className="mb-0.5" />
            <span className="text-[10px] font-extrabold tracking-wider truncate w-full text-center">その他</span>
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

            {/* スマホ用 管理者 / 一般 切り替えタブ */}
            {showAdminToggle && (
              <div className="flex bg-stone-200/60 p-1 rounded-xl mb-4">
                <button
                  onClick={() => handleTabChange('admin')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === 'admin' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  管理者
                </button>
                <button
                  onClick={() => handleTabChange('general')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === 'general' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  一般
                </button>
              </div>
            )}
            {showAdminToggle && (
              <div className="flex items-center gap-2 mb-4">
                <TaskStatusDrawer />
                <NotificationBell />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {overflowMobileItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setShowMobileMore(false)}
                    className={`flex flex-col items-center p-3 rounded-2xl border text-center transition ${isActive ? `${item.activeBg} ${item.color} border-current` : 'bg-white border-stone-200 text-stone-700'
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
