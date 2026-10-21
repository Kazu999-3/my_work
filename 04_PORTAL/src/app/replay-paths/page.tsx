"use client";

import { useEffect, useState, Suspense } from "react";
import ReplayPathsPanel from "../ktm-admin/ReplayPathsPanel";
import { KeyRound, ShieldAlert, Map as MapIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";

function ReplayPathsViewer() {
  const [viewKey, setViewKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // 1. URLクエリから key を取得
    const params = new URLSearchParams(window.location.search);
    const keyFromUrl = params.get("key");
    const savedKey = localStorage.getItem("ktm_replay_view_key") || "";

    const activeKey = keyFromUrl || savedKey;
    if (activeKey) {
      setViewKey(activeKey);
      localStorage.setItem("ktm_replay_view_key", activeKey);
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, []);

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    const cleanKey = inputKey.trim();
    setViewKey(cleanKey);
    localStorage.setItem("ktm_replay_view_key", cleanKey);
    setIsAuthorized(true);
    setErrorMsg(null);
  };

  const handleKeyError = () => {
    setIsAuthorized(false);
    setErrorMsg("合言葉が正しくないか、有効期限が切れています。");
    localStorage.removeItem("ktm_replay_view_key");
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-strong text-sm">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 簡易ヘッダー */}
      <header className="border-b border-border bg-surface/80 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-muted-strong hover:text-foreground text-xs flex items-center gap-1 transition">
            <ArrowLeft className="h-3.5 w-3.5" /> ポータルトップ
          </Link>
          <span className="text-border">/</span>
          <div className="flex items-center gap-1.5 font-black text-sm text-foreground">
            <MapIcon className="h-4 w-4 text-primary-600" /> リプレイ道筋マップ
          </div>
        </div>
        {viewKey && (
          <button
            onClick={() => {
              localStorage.removeItem("ktm_replay_view_key");
              setViewKey("");
              setIsAuthorized(false);
            }}
            className="text-[11px] text-muted-strong hover:text-danger-600 transition cursor-pointer"
          >
            合言葉をリセット
          </button>
        )}
      </header>

      {/* メインエリア */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {!isAuthorized ? (
          <div className="max-w-md mx-auto my-16 bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary-500/10 text-primary-600">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">閲覧用の合言葉が必要です</h2>
                <p className="text-xs text-muted-strong">共有された合言葉、またはURLのキーを入力してください。</p>
              </div>
            </div>

            <form onSubmit={handleKeySubmit} className="space-y-3 pt-2">
              <input
                type="password"
                placeholder="合言葉を入力"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:border-primary-500"
              />
              <button
                type="submit"
                disabled={!inputKey.trim()}
                className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer"
              >
                認証してマップを見る
              </button>
            </form>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-danger-100 border border-danger-edge-soft text-danger-700 text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        ) : (
          <ReplayPathsPanel viewKey={viewKey} onKeyError={handleKeyError} />
        )}
      </main>
    </div>
  );
}

export default function ReplayPathsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-muted-strong">読み込み中…</div>}>
      <ReplayPathsViewer />
    </Suspense>
  );
}
