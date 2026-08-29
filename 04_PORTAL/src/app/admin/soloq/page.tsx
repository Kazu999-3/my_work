"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ソロキュー偵察機能（旧スカウトタブ）は廃止。
// このページ自体は後方互換のリダイレクトとしてのみ残す（ブックマーク・外部リンク対策）。
export default function SoloqScoutRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/coach");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-stone-900 text-sm">
      ソロQコーチへ移動中...
    </div>
  );
}
