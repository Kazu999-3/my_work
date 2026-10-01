"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Shield, LogIn, Key, Sparkles, AlertTriangle } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo');
  const returnTo = (rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//'))
    ? rawReturnTo
    : '/admin/dashboard';

  const { user, loginWithDiscord } = useCurrentUser();
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setChecking(false), 2000);

    // 既存セッションの検証
    fetch("/api/auth/verify", {
      method: "POST",
      credentials: "include",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          router.replace(returnTo);
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false))
      .finally(() => clearTimeout(timer));

    return () => clearTimeout(timer);
  }, [router, user, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.replace(returnTo);
      } else {
        setErrorMsg(data.error || "パスワードが正しくありません。");
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(`通信エラーが発生しました: ${err.message}`);
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#eae4d4] dark:bg-[#1e1f22]">
        <div className="w-10 h-10 border-3 border-stone-800/10 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#f5f1e6] via-[#eae4d4] to-[#ded5be] text-foreground">
      <div className="w-full max-w-md bg-surface/80 backdrop-blur-xl border border-black/10 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
        
        {/* ロゴ ＆ タイトル */}
        <div className="space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-primary-500/10 text-primary-600 border border-primary-edge-strong/30 flex items-center justify-center mx-auto text-3xl shadow-sm">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Sovereign Portal 管理認証
          </h1>
          <p className="text-xs text-muted-strong max-w-xs mx-auto leading-relaxed">
            システムダッシュボードおよび管理機能へアクセスするには、ログインを行ってください。
          </p>
        </div>

        {/* 方法1: 🎮 Discord管理者アカウントで1秒ログイン */}
        <div className="p-5 rounded-2xl bg-primary-50/80 border border-primary-edge-soft/80 space-y-3">
          <div className="text-left">
            <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary-600" />
              おすすめ：Discordアカウントで認証
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              管理者Discordアカウント（かずき）でログインすると、パスワード不要で即座に開きます🔥
            </p>
          </div>
          <button
            type="button"
            onClick={() => loginWithDiscord(returnTo)}
            className="w-full py-3.5 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition-all shadow-md hover:shadow-primary-500/20 flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
          >
            <LogIn size={16} />
            Discordアカウントで管理者ログイン
          </button>
        </div>

        {/* 区切り線 */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-surface-hover" />
          <span className="text-[10px] font-bold text-faint">または パスコードで認証</span>
          <div className="flex-1 h-px bg-surface-hover" />
        </div>

        {/* 方法2: 🔑 パスワード認証フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-foreground-subtle mb-1.5 flex items-center gap-1">
              <Key size={13} className="text-muted-strong" />
              管理者パスコード
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary-edge-strong focus:bg-surface transition-all shadow-inner"
              disabled={isLoading}
              required
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-danger-50 border border-danger-edge-soft text-danger-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-danger-600" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-stone-900 hover:bg-primary-600 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? "検証中..." : "パスコードでゲートを通過する ➔"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#eae4d4] dark:bg-[#1e1f22]">
          <div className="w-10 h-10 border-3 border-stone-800/10 border-t-amber-600 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
