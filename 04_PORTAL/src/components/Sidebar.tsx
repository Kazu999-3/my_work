"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Swords,
  BookOpen,
  BookHeart,
  Trophy,
  Users,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Menu as MenuIcon,
  X as XIcon,
  TrendingUp,
  Coins,
  LogIn,
  LogOut,
  UserCheck,
  Home
} from 'lucide-react';
import FavoritesPanel from './FavoritesPanel';
import PushOptIn from './PushOptIn';
import NotificationBell from './NotificationBell';
import TaskStatusDrawer from './TaskStatusDrawer';
import ThemeToggle from './ThemeToggle';
import { useCurrentUser } from '../hooks/useCurrentUser';

function UserAuthWidget({ collapsed, inDrawer }: { collapsed?: boolean; inDrawer?: boolean }) {
  const { user, loading, loginWithDiscord, logout } = useCurrentUser();

  if (loading) return null;

  if (user) {
    return (
      <div
        className={`p-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex items-center gap-2.5 transition ${
          collapsed && !inDrawer ? 'justify-center' : ''
        }`}
      >
        <Link href="/mypage" className="flex items-center gap-2.5 min-w-0 flex-1 group">
          <img
            src={user.avatar}
            alt={user.displayName}
            className="w-8 h-8 rounded-full border border-amber-500/40 shrink-0 group-hover:scale-105 transition"
          />
          {(!collapsed || inDrawer) && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                {user.displayName}
              </div>
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span>🪙</span>
                <span>{(user.coins ?? 1000).toLocaleString()} pt</span>
              </div>
            </div>
          )}
        </Link>
        {(!collapsed || inDrawer) && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logout();
            }}
            title="ログアウト"
            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-500/10 transition"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => loginWithDiscord()}
      className={`w-full py-2.5 px-3 rounded-2xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
        collapsed && !inDrawer ? 'px-0' : ''
      }`}
      title="Discordアカウントでログイン"
    >
      <LogIn size={15} />
      {(!collapsed || inDrawer) && <span>Discordでログイン</span>}
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
  adminOnly?: boolean;
}

// 🌐 一般ユーザー向けメニュー（7大機能）
const GENERAL_MENU_ITEMS: MenuItem[] = [
  // メイン
  { id: 'home', label: 'ホーム / トップ', shortLabel: 'ホーム', icon: Home, href: '/', color: 'text-amber-500', activeBg: 'bg-amber-500/15', section: 'メイン' },
  // ユーザー・師弟
  { id: 'mypage', label: 'マイページ / 希望レーン', shortLabel: 'マイページ', icon: Users, href: '/mypage', color: 'text-amber-500', activeBg: 'bg-amber-500/15', section: 'ユーザー' },
  { id: 'mentorship', label: '師弟自己紹介掲示板', shortLabel: '師弟掲示板', icon: HeartHandshake, href: '/mentorship', color: 'text-emerald-500', activeBg: 'bg-emerald-500/15', section: 'ユーザー' },
  // 対戦・大会
  { id: 'balancer', label: 'チーム分けバランサー', shortLabel: 'チーム分け', icon: Swords, href: '/balancer', color: 'text-rose-600', activeBg: 'bg-rose-500/15', section: '対戦 ＆ 大会' },
  { id: 'casino', label: '勝敗予想 (カジノ)', shortLabel: '勝敗予想', icon: Coins, href: '/casino', color: 'text-amber-600', activeBg: 'bg-amber-500/15', section: '対戦 ＆ 大会' },
  // コミュニティ・戦績
  { id: 'leaderboard', label: '順位表 ＆ 名簿', shortLabel: '順位・名簿', icon: Trophy, href: '/leaderboard', color: 'text-yellow-600', activeBg: 'bg-yellow-500/15', section: 'コミュニティ' },
  // ガイド
  { id: 'guide', label: '使い方 ＆ 更新情報', shortLabel: 'ガイド', icon: BookOpen, href: '/guide', color: 'text-emerald-600', activeBg: 'bg-emerald-500/15', section: 'ガイド' },
];

// 🛡️ 管理者向け追加メニュー（攻略辞典・パーソナルコーチ・大会管理・運用）
const ADMIN_EXTRA_ITEMS: MenuItem[] = [
  { id: 'champions', label: 'チャンピオン攻略辞典', shortLabel: '攻略辞典', icon: BookHeart, href: '/champions', color: 'text-amber-600', activeBg: 'bg-amber-500/15', section: '管理者専用', adminOnly: true },
  { id: 'coach', label: 'パーソナルコーチ', shortLabel: 'コーチ', icon: Sparkles, href: '/coach', color: 'text-purple-600', activeBg: 'bg-purple-500/15', section: '管理者専用', adminOnly: true },
  { id: 'ktm-admin', label: 'KTM大会管理', shortLabel: '大会管理', icon: Shield, href: '/ktm-admin', color: 'text-indigo-600', activeBg: 'bg-indigo-500/15', section: '管理者専用', adminOnly: true },
  { id: 'dashboard', label: 'システム運用', shortLabel: '運用設定', icon: LayoutDashboard, href: '/admin/dashboard', color: 'text-stone-800 dark:text-stone-200', activeBg: 'bg-black/10 dark:bg-white/10', section: '管理者専用', adminOnly: true },
  { id: 'analytics', label: 'note分析', shortLabel: 'note分析', icon: TrendingUp, href: '/admin/analytics', color: 'text-teal-600', activeBg: 'bg-teal-500/15', section: '管理者専用', adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'admin'>('general');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sovereign_sidebar_collapsed');
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }
    const savedTab = localStorage.getItem('sovereign_sidebar_tab') as 'general' | 'admin';
    if (savedTab) {
      setActiveTab(savedTab);
    }

    // 厳格な管理者判定（Discord ID または API検証結果）
    const isOwnerId = user?.discordId === '697220229964759130';
    if (user && (user.isAdmin || isOwnerId)) {
      setIsAdminUser(true);
    }

    // サーバー認証状態の確認
    fetch("/api/auth/verify", { method: "POST", credentials: "include", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setIsAdminUser(true);
        }
      })
      .catch(() => {});
  }, [user]);

  // モバイルドロワー開閉時の背景スクロール制御
  useEffect(() => {
    if (showMobileDrawer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileDrawer]);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sovereign_sidebar_collapsed', String(nextState));
  };

  const handleTabChange = (tab: 'general' | 'admin') => {
    setActiveTab(tab);
    localStorage.setItem('sovereign_sidebar_tab', tab);
  };

  // デスクトップメニュー項目
  const desktopItems = isAdminUser
    ? (activeTab === 'admin' ? [...GENERAL_MENU_ITEMS, ...ADMIN_EXTRA_ITEMS] : GENERAL_MENU_ITEMS)
    : GENERAL_MENU_ITEMS;

  // スマホ用ボトムバー固定5項目（主要画面）
  const mobileBottomBarItems: MenuItem[] = [
    { id: 'mypage', label: 'マイページ', shortLabel: 'マイページ', icon: Users, href: '/mypage', color: 'text-amber-500', activeBg: 'bg-amber-500/15' },
    { id: 'mentorship', label: '師弟掲示板', shortLabel: '師弟掲示板', icon: HeartHandshake, href: '/mentorship', color: 'text-emerald-500', activeBg: 'bg-emerald-500/15' },
    { id: 'balancer', label: 'チーム分け', shortLabel: 'チーム分け', icon: Swords, href: '/balancer', color: 'text-rose-600', activeBg: 'bg-rose-500/15' },
    { id: 'leaderboard', label: '順位表', shortLabel: '順位・名簿', icon: Trophy, href: '/leaderboard', color: 'text-yellow-600', activeBg: 'bg-yellow-500/15' },
  ];

  return (
    <>
      {/* 💻 デスクトップ用 サイドバー */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-[#f7f5f0] dark:bg-[#1e1f22] border-r border-stone-200/80 dark:border-[#3f4147] transition-all duration-300 z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-200/80 dark:border-[#3f4147]">
          {!isCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-stone-900 dark:text-white tracking-tight">KTM PORTAL</span>
            </Link>
          )}
          <div className="flex items-center gap-1">
            {!isCollapsed && <ThemeToggle variant="compact" />}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl hover:bg-stone-200/60 dark:hover:bg-[#35373c] text-stone-600 dark:text-stone-300 transition cursor-pointer"
            >
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>

        {/* 🛡️ 管理者の場合のみ表示されるタブ切り替え */}
        {isAdminUser && !isCollapsed && (
          <div className="p-3 border-b border-stone-200/80 dark:border-[#3f4147]">
            <div className="flex bg-stone-200/60 dark:bg-[#2b2d31] p-1 rounded-xl">
              <button
                onClick={() => handleTabChange('general')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  activeTab === 'general' ? 'bg-white dark:bg-[#1e1f22] text-stone-900 dark:text-white shadow-sm' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                一般
              </button>
              <button
                onClick={() => handleTabChange('admin')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  activeTab === 'admin' ? 'bg-white dark:bg-[#1e1f22] text-stone-900 dark:text-white shadow-sm' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                管理者
              </button>
            </div>
          </div>
        )}

        {/* メニューリスト */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {desktopItems.map((item: MenuItem, idx) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const showSection = !isCollapsed && item.section && (idx === 0 || desktopItems[idx - 1]?.section !== item.section);

            return (
              <React.Fragment key={item.id}>
                {showSection && (
                  <div className="px-3 pt-3.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    {item.section}
                  </div>
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive ? `${item.activeBg} ${item.color}` : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-[#2b2d31] hover:text-stone-900 dark:hover:text-white'
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

        {/* 下部ウィジェット */}
        <div className="p-3 border-t border-stone-200/80 dark:border-[#3f4147] space-y-2">
          {isCollapsed && (
            <div className="flex justify-center pb-1">
              <ThemeToggle variant="compact" />
            </div>
          )}
          <UserAuthWidget collapsed={isCollapsed} />
          {isAdminUser && (
            <>
              <TaskStatusDrawer collapsed={isCollapsed} />
              <NotificationBell collapsed={isCollapsed} />
              <FavoritesPanel isCollapsed={isCollapsed} />
              <PushOptIn collapsed={isCollapsed} />
            </>
          )}
        </div>
      </aside>

      {/* 📱 スマホ用 ボトム固定ナビゲーションバー (5項目) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#f7f5f0]/95 dark:bg-[#1e1f22]/95 backdrop-blur-md border-t border-stone-200 dark:border-[#3f4147] z-40 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg">
        {mobileBottomBarItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 touch-manipulation select-none ${
                isActive
                  ? `${item.color} font-black scale-105`
                  : 'text-stone-500 dark:text-stone-400 active:bg-black/5 dark:active:bg-white/5 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${isActive ? item.activeBg : ''}`}>
                <Icon size={20} className={isActive ? item.color : 'text-stone-400 dark:text-stone-500'} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 leading-none">{item.shortLabel || item.label}</span>
            </Link>
          );
        })}

        {/* ☰ メニューボタン（全機能ドロワー展開） */}
        <button
          type="button"
          onClick={() => setShowMobileDrawer(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 rounded-xl text-stone-500 dark:text-stone-400 active:bg-black/5 dark:active:bg-white/5 font-medium touch-manipulation select-none"
        >
          <div className="p-1 rounded-xl">
            <MenuIcon size={20} className="text-stone-400 dark:text-stone-500" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 leading-none">メニュー</span>
        </button>
      </nav>

      {/* 📱 スマホ用 全機能ボトムシートドロワー */}
      {showMobileDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end transition-opacity duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowMobileDrawer(false)}
          />
          <div className="relative bg-[#f7f5f0] dark:bg-[#1e1f22] rounded-t-3xl p-5 border-t border-stone-200 dark:border-[#3f4147] max-h-[85vh] overflow-y-auto shadow-2xl z-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            
            {/* ドロワーヘッダー */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-stone-200 dark:border-[#3f4147]">
              <Link
                href="/"
                onClick={() => setShowMobileDrawer(false)}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <span className="text-lg">👑</span>
                <span className="font-extrabold text-base text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                  KTM ポータル
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <ThemeToggle variant="compact" />
                <button
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-2 rounded-full bg-stone-200/60 dark:bg-[#2b2d31] text-stone-600 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-[#35373c] transition"
                  aria-label="閉じる"
                >
                  <XIcon size={18} />
                </button>
              </div>
            </div>

            {/* ユーザーアカウント情報 */}
            <div className="mb-4">
              <UserAuthWidget inDrawer />
            </div>

            {/* 🛡️ 管理者の場合のみ表示する切り替えスイッチ */}
            {isAdminUser && (
              <div className="mb-4 bg-stone-200/60 dark:bg-[#2b2d31] p-1 rounded-xl flex">
                <button
                  onClick={() => handleTabChange('general')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                    activeTab === 'general' ? 'bg-white dark:bg-[#1e1f22] text-stone-900 dark:text-white shadow-sm' : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  一般メニュー
                </button>
                <button
                  onClick={() => handleTabChange('admin')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                    activeTab === 'admin' ? 'bg-white dark:bg-[#1e1f22] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Shield size={13} />
                  <span>管理者専用</span>
                </button>
              </div>
            )}

            {/* 全機能メニュー一覧 */}
            <div className="space-y-4">
              {/* 一般機能セクション */}
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2 px-1">
                  メイン機能
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {GENERAL_MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setShowMobileDrawer(false)}
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                          isActive
                            ? `${item.activeBg} ${item.color} border-current font-black shadow-sm`
                            : 'bg-white dark:bg-[#2b2d31] border-stone-200/80 dark:border-[#3f4147] text-stone-700 dark:text-stone-200 hover:border-amber-500/40 font-bold'
                        }`}
                      >
                        <div className={`p-1.5 rounded-xl ${isActive ? 'bg-white/20' : item.activeBg}`}>
                          <Icon size={18} className={item.color} />
                        </div>
                        <span className="text-xs truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* 🛡️ 管理者専用セクション (管理者かつAdminタブ選択時のみ表示) */}
              {isAdminUser && activeTab === 'admin' && (
                <div className="pt-2 border-t border-stone-200 dark:border-[#3f4147]">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-2 px-1 flex items-center gap-1">
                    <Shield size={12} />
                    <span>管理者コントロール</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {ADMIN_EXTRA_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setShowMobileDrawer(false)}
                          className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                            isActive
                              ? `${item.activeBg} ${item.color} border-current font-black shadow-sm`
                              : 'bg-white dark:bg-[#2b2d31] border-indigo-200/60 dark:border-indigo-900/40 text-stone-700 dark:text-stone-200 hover:border-indigo-500 font-bold'
                          }`}
                        >
                          <div className={`p-1.5 rounded-xl ${item.activeBg}`}>
                            <Icon size={18} className={item.color} />
                          </div>
                          <span className="text-xs truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

