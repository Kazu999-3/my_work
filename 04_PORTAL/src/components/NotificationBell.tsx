"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, AlertTriangle, Info, XCircle, CheckCircle2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

// 通知の型定義
interface Notification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  message: string;
  timestamp: string;
  source: string;
}

// 通知タイプに応じたアイコンと色
const NOTIF_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  info:    { icon: Info,          color: "text-[#00cfef]",  bg: "bg-[#00cfef]/10" },
  warning: { icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-400/10" },
  error:   { icon: XCircle,      color: "text-red-400",    bg: "bg-red-400/10" },
  success: { icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

// 既読管理用のlocalStorageキー
const READ_KEY = "sovereign_notifications_read";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markAllAsRead(ids: string[]) {
  try {
    const existing = getReadIds();
    ids.forEach(id => existing.add(id));
    // 古い既読IDは100件まで保持
    const arr = Array.from(existing).slice(-100);
    localStorage.setItem(READ_KEY, JSON.stringify(arr));
  } catch {}
}

// YouTube吸収や再試行などのノイズ通知を除外する判定
const isNoiseLog = (message: string, source: string): boolean => {
  const src = (source || "").toLowerCase();
  const msg = (message || "").toLowerCase();
  
  if (src.includes("youtube") || src.includes("absorber")) {
    return true;
  }
  if (
    msg.includes("youtube") ||
    msg.includes("吸収") ||
    msg.includes("queue") ||
    msg.includes("キュー") ||
    msg.includes("retry") ||
    msg.includes("再試行") ||
    msg.includes("duplicate key")
  ) {
    return true;
  }
  return false;
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shake, setShake] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Supabaseから通知データを取得
  const fetchNotifications = useCallback(async () => {
    try {
      // SYSTEM_METRICSから最新のシステムログを取得
      const { data } = await supabase
        .from("matchup_sentinel")
        .select("raw_data, created_at")
        .eq("enemy", "GLOBAL")
        .eq("champion", "SYSTEM_METRICS")
        .single();

      if (!data?.raw_data) return;

      const rd = data.raw_data;
      const items: Notification[] = [];
      const now = new Date();

      // システムログから通知を生成（YouTube・再試行ノイズは除外）
      if (rd.system_logs && Array.isArray(rd.system_logs)) {
        rd.system_logs.slice(-20).forEach((log: any, idx: number) => {
          const message = log.message || log.msg || String(log);
          const source = log.source || "SRE Daemon";
          if (isNoiseLog(message, source)) return;

          const level = (log.level || "INFO").toUpperCase();
          let type: Notification["type"] = "info";
          if (level === "ERROR") type = "error";
          else if (level === "WARNING") type = "warning";
          else if (level.includes("SUCCESS") || message.includes("完了")) type = "success";

          items.push({
            id: `log_${idx}_${log.timestamp || idx}`,
            type,
            message,
            timestamp: log.timestamp || data.created_at,
            source,
          });
        });
      }

      // エラー詳細があれば通知に追加（YouTube・再試行ノイズは除外）
      if (rd.error_details && Array.isArray(rd.error_details)) {
        rd.error_details.forEach((err: any, idx: number) => {
          const message = err.error || err.message || String(err);
          const source = err.source || "YouTube Absorber";
          if (isNoiseLog(message, source)) return;

          items.push({
            id: `err_${idx}_${err.timestamp || idx}`,
            type: "error",
            message,
            timestamp: err.timestamp || data.created_at,
            source,
          });
        });
      }

      // YouTubeキュー状態の通知はユーザーの要望により除外（コード自体を削除）

      // API Quota警告
      if (rd.api_quota) {
        const used = rd.api_quota.used || 0;
        const limit = rd.api_quota.limit || 1500;
        if (used / limit > 0.8) {
          items.push({
            id: `quota_warn_${data.created_at}`,
            type: "warning",
            message: `API Quota: ${used}/${limit} (${Math.round(used / limit * 100)}% 使用中)`,
            timestamp: data.created_at,
            source: "API Monitor",
          });
        }
      }

      // 新しい順にソート、最大15件
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latest = items.slice(0, 15);
      setNotifications(latest);

      // 未読数の計算
      const readIds = getReadIds();
      const unread = latest.filter(n => !readIds.has(n.id)).length;
      if (unread > unreadCount && unreadCount >= 0) {
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
      setUnreadCount(unread);
    } catch (err) {
      console.error("通知の取得に失敗:", err);
    }
  }, [unreadCount]);

  // 初回 + 30秒ごとの自動フェッチ
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // パネル外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // パネルを開いたら既読にする
  const handleToggle = () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) {
      markAllAsRead(notifications.map(n => n.id));
      setUnreadCount(0);
    }
  };

  // 経過時間の表示
  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}時間前`;
    return `${Math.floor(hrs / 24)}日前`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ベルボタン */}
      <button
        onClick={handleToggle}
        className={`relative p-2 rounded-xl transition-all duration-300 hover:bg-white/10 ${
          isOpen ? "bg-white/10" : ""
        } ${shake ? "animate-[bell-shake_0.5s_ease-in-out]" : ""}`}
        title="通知"
      >
        <Bell
          size={20}
          className={`transition-colors ${unreadCount > 0 ? "text-[#00cfef]" : "text-gray-400"}`}
        />
        {/* 未読バッジ */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 通知ドロップダウン */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 max-h-[480px] bg-[#0e1018]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.8)] overflow-hidden z-[100]">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Bell size={14} className="text-[#00cfef]" /> 通知センター
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* 通知リスト */}
          <div className="overflow-y-auto max-h-[400px] divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                通知はありません
              </div>
            ) : (
              notifications.map((n) => {
                const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.info;
                const Icon = style.icon;
                return (
                  <div
                    key={n.id}
                    className="px-4 py-3 hover:bg-white/[0.03] transition-colors flex gap-3 items-start"
                  >
                    <div className={`${style.bg} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                      <Icon size={14} className={style.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-gray-500 font-mono">{n.source}</span>
                        <span className="text-[10px] text-gray-600">·</span>
                        <span className="text-[10px] text-gray-500">{timeAgo(n.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ベル揺れアニメーション用CSS */}
      <style jsx>{`
        @keyframes bell-shake {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(12deg); }
          30% { transform: rotate(-10deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-6deg); }
          75% { transform: rotate(3deg); }
        }
      `}</style>
    </div>
  );
}
