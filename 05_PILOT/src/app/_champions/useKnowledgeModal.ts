"use client";

import { useState } from "react";
import type { KnowledgeDetail } from "./types";

// 📒 攻略知見詳細ポップアップの状態と記事取得。2026-10-07 app/page.tsx から分離（処理は分離前と同じ）。
export function useKnowledgeModal() {
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | number | null>(null);
  const [knowledgeDetail, setKnowledgeDetail] = useState<KnowledgeDetail | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeCopied, setKnowledgeCopied] = useState(false);

  const openKnowledgeModal = async (id: string | number) => {
    setSelectedKnowledgeId(id);
    setKnowledgeLoading(true);
    setKnowledgeCopied(false);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.article) {
        setKnowledgeDetail(data.article);
      }
    } catch (e) {
      console.error("知見詳細取得失敗:", e);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  return {
    selectedKnowledgeId, setSelectedKnowledgeId,
    knowledgeDetail, setKnowledgeDetail,
    knowledgeLoading,
    knowledgeCopied, setKnowledgeCopied,
    openKnowledgeModal,
  };
}
