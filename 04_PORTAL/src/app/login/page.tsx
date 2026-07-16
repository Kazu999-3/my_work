"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // HttpOnly Cookie(admin_session)ベースの検証に統一。
    // Cookieはサーバー側(/api/auth/login)がセットするため、ここではJSから読めない
    // （それが目的＝XSS耐性）。/api/auth/verifyがCookieを見て判定する。
    fetch("/api/auth/verify", { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.ok) {
          const next = searchParams.get("next") || "/ktm-admin";
          router.replace(next);
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [searchParams, router]);

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
        // サーバーがHttpOnly Cookieをセット済み。localStorageは使わない。
        const next = searchParams.get("next") || "/ktm-admin";
        router.replace(next);
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
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#06070a"
      }}>
        <div className="spinner" />
        <style>{`
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.05);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="login-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
        
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100%;
          background: radial-gradient(circle at 50% 50%, #0c0f17 0%, #06070a 100%);
          color: white;
          padding: 20px;
          font-family: 'Outfit', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* 背景のアニメーションオーブ */
        .orb-1 {
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(0,0,0,0) 70%);
          top: -100px;
          right: -100px;
          filter: blur(80px);
          animation: float 10s ease-in-out infinite alternate;
        }
        .orb-2 {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, rgba(0,0,0,0) 70%);
          bottom: -150px;
          left: -150px;
          filter: blur(100px);
          animation: float 12s ease-in-out infinite alternate-reverse;
        }

        @keyframes float {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(30px) scale(1.1); }
        }

        .login-card {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(24px);
          border-radius: 28px;
          padding: 56px 48px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.1);
          text-align: center;
          animation: cardAppear 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes cardAppear {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-logo {
          font-size: 48px;
          margin-bottom: 24px;
          filter: drop-shadow(0 10px 15px rgba(59, 130, 246, 0.3));
        }

        .login-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.04em;
          background: linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 12px;
        }

        .login-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          line-height: 1.6;
          margin-bottom: 40px;
        }

        .input-group {
          position: relative;
          margin-bottom: 24px;
        }

        .input-field {
          width: 100%;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          font-size: 16px;
          color: white;
          font-family: 'JetBrains Mono', monospace;
          text-align: center;
          letter-spacing: 0.1em;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .input-field:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.05);
          border-color: #3b82f6;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        }

        .input-field::placeholder {
          font-family: 'Outfit', sans-serif;
          letter-spacing: normal;
          color: rgba(255, 255, 255, 0.25);
        }

        .error-message {
          font-size: 13px;
          color: #f87171;
          background: rgba(248, 113, 113, 0.06);
          border: 1px solid rgba(248, 113, 113, 0.15);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 24px;
          text-align: left;
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }

        .submit-btn {
          width: 100%;
          padding: 16px 28px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 20px rgba(29, 78, 216, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(59, 130, 246, 0.4);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .submit-btn-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div className="orb-1" />
      <div className="orb-2" />

      <div className="login-card">
        <div className="login-logo">🔒</div>
        <h1 className="login-title">Sovereign Portal</h1>
        <p className="login-subtitle">
          管理コントロールパネルおよびパーソナルコーチへアクセスするには、管理者用パスコードを入力してください。
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="password"
              placeholder="管理者パスコードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="error-message">
              ⚠️ {errorMsg}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="submit-btn">
            {isLoading ? (
              <>
                <div className="submit-btn-spinner" />
                <span>検証中...</span>
              </>
            ) : (
              <span>ゲートを通過する ➔</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#06070a" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.05)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
