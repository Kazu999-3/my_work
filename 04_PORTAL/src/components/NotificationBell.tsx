"use client";

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

interface AdminNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

// 管理者専用の通知ベル(#63)。ブラウザのプッシュ通知は見逃すと消えるため、
// ポータル内でも履歴を後から見返せるようにする。管理者ログイン中のみ表示。
export default function NotificationBell({ collapsed = false, align = 'left' }: { collapsed?: boolean; align?: 'left' | 'right' }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // タスクバー/DockのバッジをService Worker側(push受信時)だけでなく、
  // ページを開いて既読にした時点でも同期する(#63)。未対応ブラウザ/
  // 未インストール環境では 'setAppBadge' が無いので何もしない。
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (unreadCount > 0) {
      (navigator as any).setAppBadge(unreadCount).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/admin/notifications/read', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch {}
  };

  const handleClickItem = async (n: AdminNotification) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await fetch('/api/admin/notifications/read', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: n.id }),
        });
      } catch {}
    }
    if (n.url) window.location.href = n.url;
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${collapsed ? '' : 'w-full'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="通知"
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all hover:bg-white/5 hover:text-white text-gray-400 relative ${
          collapsed ? 'justify-center' : 'w-full'
        }`}
      >
        <span className="relative">
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {!collapsed && <span>通知{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>}
      </button>

      {open && (
        <div className={`absolute top-full z-50 mt-2 w-80 max-w-[85vw] max-h-96 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0f16] shadow-2xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-xs font-black text-gray-300">通知</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300">
                すべて既読にする
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500">通知はありません</div>
          ) : (
            <div className="divide-y divide-white/5">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`block w-full px-4 py-3 text-left transition-colors hover:bg-white/5 ${!n.read ? 'bg-cyan-500/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-gray-200 line-clamp-2">{n.title}</div>
                      {n.body && <div className="mt-0.5 text-[10px] text-gray-500 line-clamp-2 whitespace-pre-wrap">{n.body}</div>}
                      <div className="mt-1 text-[9px] text-gray-600">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
