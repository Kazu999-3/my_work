'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell, Check, Trash2, ChevronDown, ChevronUp, ExternalLink,
  Trophy, RefreshCw, Video, AlertCircle, Info, Sparkles, HeartPulse
} from 'lucide-react';

export interface AdminNotification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  data?: Record<string, any> | null;
  url: string | null;
  read: boolean;
  created_at: string;
}

// 通知は旧ポータル(04)と同じ admin_notifications を共有しており、url は04のページを前提にした相対パスが混ざる
// （/history /balancer /admin/knowledge 等）。05に無いページはそのままだと404になるため、旧ポータルの絶対URLへ振り替える。
const LEGACY_PORTAL_URL = 'https://my-work-8jbd.vercel.app';
const PILOT_PATHS = ['/coach', '/library', '/lane-guides', '/admin/dict-health', '/admin/dict-maintenance', '/admin/review', '/admin/youtube', '/admin/dashboard'];

function resolveNotificationUrl(url: string): { href: string; external: boolean } {
  if (/^https?:\/\//.test(url)) return { href: url, external: true };
  const path = url.split(/[?#]/)[0];
  // 05の辞典はトップ。?c=<チャンピオン> 等のクエリは残して、そのチャンピオンの詳細まで開く
  if (path === '/' || path === '/champions') return { href: `/${url.slice(path.length)}`, external: false };
  if (PILOT_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return { href: url, external: false };
  return { href: `${LEGACY_PORTAL_URL}${url}`, external: true };
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

interface HealthItem {
  status: 'FAIL' | 'WARN' | 'OK';
  title: string;
  detail: string;
}

function parseHealthBody(body: string): { fails: HealthItem[]; warns: HealthItem[]; oks: HealthItem[] } {
  const fails: HealthItem[] = [];
  const warns: HealthItem[] = [];
  const oks: HealthItem[] = [];

  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    let status: 'FAIL' | 'WARN' | 'OK' | null = null;
    let clean = line.replace(/^-\s*/, '');
    if (clean.includes('🚨')) {
      status = 'FAIL';
      clean = clean.replace(/🚨\s*/, '');
    } else if (clean.includes('⚠️')) {
      status = 'WARN';
      clean = clean.replace(/⚠️\s*/, '');
    } else if (clean.includes('✅')) {
      status = 'OK';
      clean = clean.replace(/✅\s*/, '');
    }

    if (!status) continue;

    // "**タイトル**: 詳細" または "タイトル: 詳細"
    const m = clean.match(/^\**([^*:：]+)\**[:：]\s*(.*)$/);
    const title = m ? m[1].trim() : clean;
    const detail = m ? m[2].trim() : '';

    const item: HealthItem = { status, title, detail };
    if (status === 'FAIL') fails.push(item);
    else if (status === 'WARN') warns.push(item);
    else oks.push(item);
  }

  return { fails, warns, oks };
}

function HealthReportBody({ body, isExpanded }: { body: string; isExpanded: boolean }) {
  const [showOks, setShowOks] = useState(false);
  const parsed = React.useMemo(() => parseHealthBody(body), [body]);

  // パースできなかった場合の安全フォールバック
  if (parsed.fails.length === 0 && parsed.warns.length === 0 && parsed.oks.length === 0) {
    return (
      <p className={`text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
        {body}
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-1">
      {/* 📊 サマリーピルバッジ */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
        {parsed.fails.length > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            🚨 異常 {parsed.fails.length}件
          </span>
        )}
        {parsed.warns.length > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            ⚠️ 注意 {parsed.warns.length}件
          </span>
        )}
        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
          ✅ 正常 {parsed.oks.length}項目
        </span>
      </div>

      {/* 🚨 異常項目（最優先・赤枠ハイライトで詳細表示） */}
      {parsed.fails.map((f, i) => (
        <div key={i} className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-black text-rose-300">
            <AlertCircle size={14} className="shrink-0 text-rose-400" />
            <span>{f.title}</span>
          </div>
          {f.detail && (
            <p className="text-[11px] text-rose-200/90 leading-relaxed font-sans pl-5 break-words">
              {f.detail}
            </p>
          )}
        </div>
      ))}

      {/* ⚠️ 注意項目 */}
      {parsed.warns.map((w, i) => (
        <div key={i} className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-black text-amber-300">
            <AlertCircle size={14} className="shrink-0 text-amber-400" />
            <span>{w.title}</span>
          </div>
          {w.detail && (
            <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans pl-5 break-words">
              {w.detail}
            </p>
          )}
        </div>
      ))}

      {/* ✅ 正常項目（コンパクトなトグル展開） */}
      {parsed.oks.length > 0 && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowOks(!showOks);
            }}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 font-bold flex items-center gap-1 py-0.5 cursor-pointer"
          >
            <span>{showOks ? '▼ 正常項目を閉じる' : `▶ 正常項目（全${parsed.oks.length}件）の内訳を表示`}</span>
          </button>

          {showOks && (
            <div className="mt-1.5 space-y-1 bg-zinc-950/60 p-2 rounded-xl border border-zinc-800/80 animate-in fade-in duration-100">
              {parsed.oks.map((ok, i) => (
                <div key={i} className="text-[10px] text-zinc-300 flex items-start gap-1.5 py-0.5">
                  <Check size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-bold text-zinc-200">{ok.title}:</span>{' '}
                    <span className="text-zinc-400">{ok.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getNotificationMeta(n: AdminNotification) {
  if (n.type === 'coach_review') {
    return {
      icon: Trophy,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      label: 'ソロQ診断',
      defaultUrl: '/coach',
    };
  }
  if (n.type === 'dict_review') {
    return {
      icon: RefreshCw,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      label: '辞典鮮度',
      defaultUrl: '/admin/dict-health',
    };
  }
  if (n.type === 'edge_task') {
    return {
      icon: Video,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      label: '動画解析',
      defaultUrl: '/admin/youtube',
    };
  }
  if (n.type === 'system_health') {
    // 毎朝の健康診断（scripts/production_health_report.py）。異常があれば赤、無ければ緑で出す
    const bad = (n.data as any)?.worst && (n.data as any).worst !== 'OK';
    return {
      icon: HeartPulse,
      color: bad ? 'text-rose-400' : 'text-emerald-400',
      bg: bad ? 'bg-rose-500/10' : 'bg-emerald-500/10',
      border: bad ? 'border-rose-500/30' : 'border-emerald-500/30',
      label: '健康診断',
      defaultUrl: '/admin/dashboard',
    };
  }
  return {
    icon: Info,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    label: 'システム',
    defaultUrl: null,
  };
}


export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [onlyUnread, setOnlyUnread] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (id: number) => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const deleteAll = async () => {
    if (!confirm('すべての通知を削除しますか？')) return;
    try {
      await fetch('/api/admin/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  };

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayedList = onlyUnread
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 ベルボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition border cursor-pointer ${
          isOpen
            ? 'bg-zinc-800 text-amber-300 border-zinc-600 shadow-md'
            : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-800 hover:text-zinc-100'
        }`}
        title="通知センター（ソロQ診断・鮮度レビュー・動画解析）"
        aria-label="通知センター"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black border-2 border-slate-950 shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 📋 通知一覧ドロップダウンパネル */}
      {isOpen && (
        <div className="absolute -right-12 sm:right-0 top-full mt-2 w-[calc(100vw-24px)] max-w-[360px] sm:max-w-md max-h-[82vh] rounded-2xl bg-[#141418] border border-zinc-700/80 shadow-2xl flex flex-col z-50 animate-in fade-in duration-150 backdrop-blur-md overflow-hidden">
          {/* パネルヘッダー */}
          <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-zinc-100 flex items-center gap-1.5">
                <Bell size={14} className="text-amber-400" />
                通知センター
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                  未読 {unreadCount}件
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOnlyUnread(!onlyUnread)}
                className={`text-[10px] px-2 py-0.8 rounded-lg font-bold transition cursor-pointer ${
                  onlyUnread
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {onlyUnread ? '全件表示' : '未読のみ'}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[10px] px-2 py-0.8 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 font-bold transition cursor-pointer"
                  title="すべて既読にする"
                >
                  <Check size={12} className="inline mr-0.5" />
                  既読化
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={deleteAll}
                  className="text-[10px] p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                  title="すべての通知を削除"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* 通知リスト */}
          <div className="overflow-y-auto divide-y divide-zinc-800/60 flex-1 max-h-[60vh]">
            {displayedList.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 space-y-1">
                <Bell size={24} className="mx-auto opacity-30 text-zinc-400 mb-2" />
                <p className="text-xs font-bold text-zinc-400">新しい通知はありません</p>
                <p className="text-[10px] text-zinc-600">
                  ソロQ試合終了後の診断や辞典更新アラートがここに届きます
                </p>
              </div>
            ) : (
              displayedList.map((n) => {
                const meta = getNotificationMeta(n);
                const Icon = meta.icon;
                const isExpanded = expandedIds.has(n.id);
                const targetUrl = n.url || meta.defaultUrl;

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markAsRead(n.id);
                    }}
                    className={`p-3 transition cursor-pointer flex flex-col gap-1.5 ${
                      n.read
                        ? 'bg-transparent hover:bg-zinc-900/50 opacity-75'
                        : 'bg-zinc-900/80 hover:bg-zinc-850 opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${meta.bg} ${meta.border} border ${meta.color} shrink-0`}>
                          <Icon size={13} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${meta.bg} ${meta.color} border ${meta.border}`}>
                              {meta.label}
                            </span>
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                            )}
                            <span className="text-[10px] text-zinc-500 font-medium">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-zinc-200 mt-0.5 leading-snug">
                            {n.title}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* 本文（健康診断は構造化UI、その他はテキスト） */}
                    {n.body && (
                      <div className="pl-7">
                        {n.type === 'system_health' ? (
                          <HealthReportBody body={n.body} isExpanded={isExpanded} />
                        ) : (
                          <>
                            <p
                              className={`text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed ${
                                !isExpanded ? 'line-clamp-2' : ''
                              }`}
                            >
                              {n.body}
                            </p>
                            {n.body.length > 80 && (
                              <button
                                type="button"
                                onClick={(e) => toggleExpand(n.id, e)}
                                className="text-[10px] text-amber-400/80 hover:text-amber-300 font-bold mt-1 inline-flex items-center gap-0.5"
                              >
                                <span>{isExpanded ? '閉じる' : '続きを読む'}</span>
                                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}


                    {/* 直行アクションリンク */}
                    {targetUrl && (
                      <div className="pl-7 pt-1 flex justify-end">
                        <Link
                          href={resolveNotificationUrl(targetUrl).href}
                          {...(resolveNotificationUrl(targetUrl).external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          onClick={() => {
                            if (!n.read) markAsRead(n.id);
                            setIsOpen(false);
                          }}
                          className="text-[10px] px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-300 border border-zinc-700 flex items-center gap-1 font-bold transition"
                        >
                          <span>該当画面を開く</span>
                          <ExternalLink size={10} />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
