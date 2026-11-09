"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Check, Save, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "../../../components/Toaster";
import {
  SundayFestivalTheme,
  DEFAULT_SUNDAY_THEMES,
} from "../../../lib/sundayFestivalTheme";

interface SundayThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeSaved?: (theme: SundayFestivalTheme) => void;
}

export default function SundayThemeModal({
  isOpen,
  onClose,
  onThemeSaved,
}: SundayThemeModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("undecided");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [presets, setPresets] = useState<SundayFestivalTheme[]>(DEFAULT_SUNDAY_THEMES);
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // API側でも検証

  // 開いたときに現在のテーマを取得
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/festival/theme")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.theme) {
          const t: SundayFestivalTheme = data.theme;
          setTitle(t.title || "");
          setDescription(t.description || "");
          setSelectedPresetId(t.id || "undecided");
        }
        if (data.presets && Array.isArray(data.presets)) {
          setPresets(data.presets);
        }
      })
      .catch((err) => {
        console.error("テーマ取得エラー:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  // プリセット変更時
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const target = presets.find((p) => p.id === presetId);
    if (target) {
      setTitle(target.title);
      setDescription(target.description);
    }
  };

  // 保存処理
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("お題のタイトルを入力してください。");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/festival/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPresetId,
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "保存に失敗しました。");
      }
      toast.success("今週の日曜お題を保存しました！Discordのリマインドに反映されます。");
      if (onThemeSaved && data.theme) {
        onThemeSaved(data.theme);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "保存に失敗しました。管理者でログインしているか確認してください。");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface-elevated border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-500 text-lg">🎪</span>
            <div>
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                日曜お祭りカスタム 今週のお題設定
              </h2>
              <p className="text-[11px] text-muted-strong">
                設定したお題はDiscordの週末募集・リマインド通知に自動連動します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-subtle transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ボディ */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-strong">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span>お題設定を読み込み中...</span>
            </div>
          ) : (
            <>
              {/* プリセット選択 */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>🎯 お題テンプレートから選ぶ</span>
                  {selectedPresetId === "undecided" && (
                    <span className="text-[10px] bg-muted/20 text-muted-strong px-2 py-0.5 rounded-full font-bold">
                      現在: 未定扱い
                    </span>
                  )}
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-border text-foreground font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* タイトル入力 */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center gap-1">
                  <span>📢 告知用タイトル</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">（Discord通知の見出し）</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 🎪 未定（当日集まったメンバーで決定！）"
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-border text-foreground font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* 説明文 */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground">
                  📝 ルール詳細・補足メッセージ
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="参加者へのルール説明やひとことを入力..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-border text-foreground resize-none focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* プレビュー案内 */}
              <div className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1.5">
                <div className="font-bold text-muted-strong flex items-center gap-1 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Discordでの見え方プレビュー:</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-foreground leading-relaxed">
                  <p className="text-amber-700 dark:text-amber-400 font-bold">
                    🎪 今週のお題: <span className="underline">{title || "（未入力）"}</span>
                  </p>
                  {description && (
                    <p className="text-muted-strong text-[10px] mt-1 whitespace-pre-wrap">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-surface-subtle">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-border text-muted-strong hover:text-foreground text-xs font-bold transition cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !title.trim()}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? "保存中..." : "今週のお題を保存 💾"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
