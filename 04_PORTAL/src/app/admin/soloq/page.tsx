"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ソロキュー偵察機能（旧スカウトタブ）は廃止。
// このページ自体は後方互換のリダイレクトとしてのみ残す（ブックマーク・外部リンク対策）。
export default function SoloqScoutRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ktm-admin");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white text-sm">
      この機能は廃止されました。管理者ダッシュボードへ移動中...
    </div>
  );
}
