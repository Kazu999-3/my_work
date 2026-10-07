"use client";

import { useState, useEffect } from "react";
import opggLaneMetaDefault from "@/data/opgg_lane_meta.json";

// チャンピオン辞典の個人設定（お気に入り・レーン所属・アイテム翻訳辞書）と OP.GG レーンメタ。
// 端末(localStorage)とDB(/api/pilot/settings)を同期する。2026-10-07 app/page.tsx から分離（処理は分離前と同じ）。
export function usePilotSettings() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customRoles, setCustomRoles] = useState<Record<string, string[]>>({});
  const [customItemDict, setCustomItemDict] = useState<Record<string, string>>({});
  // 📊 OP.GG 公式メタデータ (全レーンの勝率・Tier・BAN率・順位)
  const [opggMeta, setOpggMeta] = useState<any>(opggLaneMetaDefault);

  // localStorage および DB(ktm_settings / champion_lane_roles) からお気に入り・レーン設定・アイテム辞書を同期
  useEffect(() => {
    let localFav: string[] = [];
    let localRoles: Record<string, string[]> = {};
    let localItemDict: Record<string, string> = {};

    try {
      const storedFav = localStorage.getItem("pilot_fav_champions");
      if (storedFav) {
        localFav = JSON.parse(storedFav);
        setFavorites(localFav);
      }
      const storedRoles = localStorage.getItem("pilot_custom_roles");
      if (storedRoles) {
        localRoles = JSON.parse(storedRoles);
        setCustomRoles(localRoles);
      }
      const storedItemDict = localStorage.getItem("pilot_custom_item_dict");
      if (storedItemDict) {
        localItemDict = JSON.parse(storedItemDict);
        setCustomItemDict(localItemDict);
      }
    } catch {}

    // DBから最新の設定を一括取得＆初回移行（端末ローカルとDBの和集合マージ）
    fetch("/api/pilot/settings")
      .then((res) => res.json())
      .then(async (data) => {
        if (!data?.success) return;

        const isMigrated = localStorage.getItem("pilot_settings_migrated_v1") === "true";
        let finalFav = data.favorites || [];
        let finalItemDict = data.itemDict || {};
        const finalRoles = data.laneRoles || {};

        if (!isMigrated) {
          // 初回のみ: 端末のお気に入りとDBの和集合を計算
          if (localFav.length > 0) {
            finalFav = Array.from(new Set([...finalFav, ...localFav]));
            // DBへマージ結果を保存
            fetch("/api/pilot/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: "favorites", value: finalFav }),
            }).catch(() => {});
          }

          // 初回のみ: 端末のアイテム辞書とDBの辞書をマージ
          if (Object.keys(localItemDict).length > 0) {
            finalItemDict = { ...finalItemDict, ...localItemDict };
            fetch("/api/pilot/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: "itemDict", value: finalItemDict }),
            }).catch(() => {});
          }

          try {
            localStorage.setItem("pilot_settings_migrated_v1", "true");
          } catch {}
        }

        // 最新のDBデータ（または初回マージ結果）を反映
        if (finalFav.length > 0 || isMigrated) {
          setFavorites(finalFav);
          try {
            localStorage.setItem("pilot_fav_champions", JSON.stringify(finalFav));
          } catch {}
        }

        if (Object.keys(finalRoles).length > 0) {
          setCustomRoles((prev) => {
            const merged = { ...prev, ...finalRoles };
            try {
              localStorage.setItem("pilot_custom_roles", JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        if (Object.keys(finalItemDict).length > 0 || isMigrated) {
          setCustomItemDict(finalItemDict);
          try {
            localStorage.setItem("pilot_custom_item_dict", JSON.stringify(finalItemDict));
          } catch {}
        }

        if (data.opggMeta && typeof data.opggMeta === 'object') {
          setOpggMeta(data.opggMeta);
        }
      })
      .catch((err) => {
        console.warn("DB設定同期スキップ（オフライン/通信エラー）:", err);
      });
  }, []);

  const handleRolesSaved = (newRoles: Record<string, string[]>) => {
    setCustomRoles(newRoles);
    try {
      localStorage.setItem("pilot_custom_roles", JSON.stringify(newRoles));
    } catch {}
  };

  const handleDictionarySaved = (newDict: Record<string, string>) => {
    setCustomItemDict(newDict);
    try {
      localStorage.setItem("pilot_custom_item_dict", JSON.stringify(newDict));
    } catch {}
  };

  const toggleFavorite = (champId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(champId)
        ? prev.filter((id) => id !== champId)
        : [...prev, champId];
      try {
        localStorage.setItem("pilot_fav_champions", JSON.stringify(next));
      } catch {}

      // DBへ即時非同期保存
      fetch("/api/pilot/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "favorites", value: next }),
      }).catch((err) => {
        console.warn("お気に入りのDB保存に失敗しました:", err);
      });

      return next;
    });
  };

  return { favorites, customRoles, customItemDict, opggMeta, handleRolesSaved, handleDictionarySaved, toggleFavorite };
}
