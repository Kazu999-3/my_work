"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Shield, LogIn, Sparkles, AlertTriangle } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get('returnTo');
  const returnTo = (rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//'))
    ? rawReturnTo
    : '/ktm-admin';

  // 2026-10-19: 管理画面は Discord ログインだけで入る（ユーザー判断）。以前は管理者パスワードの入力欄もあり、
  // パスワードを総当たりされる入口になっていた
  const { user, loginWithDiscord } = useCurrentUser();
  const [checking, setChecking] = useState(true);
  const authError = searchParams.get('auth_error');

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

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#eae4d4] dark:bg-background">
        <div className="w-10 h-10 border-3 border-stone-800/10 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#f5f1e6] via-[#eae4d4] to-[#ded5be] dark:from-background dark:via-background dark:to-surface text-foreground">
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
            管理機能へは、管理者の Discord アカウントでログインして入ります。
          </p>
        </div>

        {/* 方法1: 🎮 Discord管理者アカウントで1秒ログイン */}
        <div className="p-5 rounded-2xl bg-primary-50/80 border border-primary-edge-soft/80 space-y-3">
          <div className="text-left">
            <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary-600" />
              Discordアカウントで認証
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

        {/* Discord でログイン済みだが管理者ではない／ログインに失敗した時の案内 */}
        {(authError || (user && !user.isAdmin)) && (
          <div className="p-3 rounded-xl bg-danger-50 border border-danger-edge-soft text-danger-800 text-xs font-bold flex items-center gap-2 text-left">
            <AlertTriangle size={15} className="shrink-0 text-danger-600" />
            {authError
              ? `Discord ログインに失敗しました（${authError}）。もう一度お試しください。`
              : `${user?.displayName || user?.username || 'このアカウント'} は管理者として登録されていません。管理者の Discord アカウントでログインしてください。`}
          </div>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#eae4d4] dark:bg-background">
          <div className="w-10 h-10 border-3 border-stone-800/10 border-t-amber-600 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
