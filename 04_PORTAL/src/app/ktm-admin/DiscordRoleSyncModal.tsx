"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, RefreshCw, CheckCircle, AlertCircle, Shield, Award, Users } from "lucide-react";

interface RoleSyncConfig {
  enabled: boolean;
  roles: {
    new: string;
    light: string;
    regular: string;
    experienced: string;
    returning: string;
  };
  playstyle_roles?: Record<string, string>;
  beginner_lounge_role?: string;
  updated_at?: string;
}

interface RoleDefinition {
  name: string;
  color: number;
  description: string;
}

interface SyncSummary {
  total: number;
  synced: number;
  changed: number;
  errors: number;
  details: Array<{ name: string; tier: string; changed: boolean; error?: string }>;
}

export default function DiscordRoleSyncModal({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<RoleSyncConfig | null>(null);
  const [definitions, setDefinitions] = useState<Record<string, RoleDefinition>>({});
  const [playstyleDefinitions, setPlaystyleDefinitions] = useState<Record<string, RoleDefinition>>({});
  const [beginnerLoungeDefinition, setBeginnerLoungeDefinition] = useState<RoleDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  // レスポンスの安全なJSONパース（Safariの非JSON例外防止）
  const parseSafeJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`サーバーエラー (HTTP ${res.status})`);
    }
  };

  // 設定読み込み
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discord/role-sync", { credentials: "include" });
      const data = await parseSafeJson(res);
      if (res.ok) {
        setConfig(data.config);
        setDefinitions(data.definitions || {});
        setPlaystyleDefinitions(data.playstyleDefinitions || {});
        setBeginnerLoungeDefinition(data.beginnerLoungeDefinition || null);
      } else {
        setMessage({ type: "error", text: data.error || "設定の取得に失敗しました。" });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "通信エラーが発生しました。" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // 1. ロール自動セットアップ
  const handleSetup = async () => {
    if (!confirm("Discordサーバー上に5種類のロール（初参加・ライト・常連・経験者・復帰勢）を自動作成し、IDを登録します。実行しますか？\n※既に同名ロールが存在する場合はそのIDを再利用します。")) {
      return;
    }
    setActing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/discord/role-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "setup" }),
      });
      const data = await parseSafeJson(res);
      if (res.ok) {
        setMessage({ type: "success", text: "✨ " + data.message });
        await fetchConfig();
      } else {
        setMessage({ type: "error", text: "❌ " + (data.error || "セットアップに失敗しました。") });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: "❌ " + e.message });
    } finally {
      setActing(false);
    }
  };

  // 2. 全員一括同期
  const handleSyncAll = async () => {
    if (!confirm("全登録プレイヤーの戦績（試合数・最終参加日）を走査し、現在のDiscordロールを一括更新します。実行しますか？")) {
      return;
    }
    setActing(true);
    setMessage(null);
    setSyncSummary(null);
    try {
      const res = await fetch("/api/discord/role-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "sync_all" }),
      });
      const data = await parseSafeJson(res);
      if (res.ok) {
        setSyncSummary(data.summary);
        setMessage({
          type: "success",
          text: `🎉 全員の同期が完了しました！（対象: ${data.summary.total}名 / 成功: ${data.summary.synced}名 / 変更あり: ${data.summary.changed}名 / エラー: ${data.summary.errors}名）`,
        });
      } else {
        setMessage({ type: "error", text: "❌ " + (data.error || "同期に失敗しました。") });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: "❌ " + e.message });
    } finally {
      setActing(false);
    }
  };

  const tierKeys: Array<keyof RoleSyncConfig["roles"]> = ["new", "light", "regular", "experienced", "returning"];
  const playstyleKeys = ["soloq", "flex", "lane_practice", "champ_practice", "learner"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface-raised">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#5865F2]/10 text-[#5865F2] rounded-xl">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Discord メンバーロール連携</h2>
              <p className="text-xs text-faint">内戦の通算試合数・ブランク日数から5段階のDiscordロールを自動管理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={acting}
            className="text-muted-strong hover:text-foreground p-1.5 rounded-lg hover:bg-black/5 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {message && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                message.type === "success"
                  ? "bg-success-100 text-success-900 border-success-edge"
                  : message.type === "error"
                  ? "bg-danger-100 text-danger-900 border-danger-edge"
                  : "bg-surface-raised text-foreground border-border"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-success-700" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger-700" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* クイックアクション */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleSetup}
              disabled={acting || loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 text-xs"
            >
              <Sparkles className="h-4 w-4" />
              {acting ? "処理中..." : "✨ 11種類のロールを自動作成"}
            </button>

            <button
              onClick={handleSyncAll}
              disabled={acting || loading || !config?.roles?.regular}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 text-xs"
              title={!config?.roles?.regular ? "先にロールを作成してください" : ""}
            >
              <RefreshCw className={`h-4 w-4 ${acting ? "animate-spin" : ""}`} />
              {acting ? "同期実行中..." : "🔄 全員のロールを一括同期"}
            </button>
          </div>

          {/* ロール設定カード一覧 */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-foreground-subtle uppercase tracking-wider mb-2">
                🏆 経験度・参加頻度ロール (自動付与 / 5種)
              </h3>

              {loading ? (
                <div className="py-4 text-center text-xs text-faint">設定を読み込み中...</div>
              ) : (
                <div className="space-y-2">
                  {tierKeys.map((key) => {
                    const def = definitions[key] || { name: key, description: "" };
                    const roleId = config?.roles?.[key] || "";
                    const isSet = Boolean(roleId);

                    return (
                      <div
                        key={key}
                        className="p-3 bg-surface-raised border border-border rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{def.name}</span>
                            {isSet ? (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-success-100 text-success-800 border border-success-edge">
                                連携済み
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-surface text-faint border border-border">
                                未作成
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-faint">{def.description}</p>
                        </div>

                        <div className="text-right shrink-0">
                          {isSet ? (
                            <span className="font-mono text-[11px] text-faint bg-background px-2 py-1 rounded border border-border select-all">
                              ID: {roleId}
                            </span>
                          ) : (
                            <span className="text-[11px] text-faint italic">「自動作成」で生成されます</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-foreground-subtle uppercase tracking-wider mb-2">
                🎭 プレイスタイル・志向性ロール (メンバーがボタンでON/OFF / 5種)
              </h3>

              {!loading && (
                <div className="space-y-2">
                  {playstyleKeys.map((key) => {
                    const def = playstyleDefinitions[key] || { name: key, description: "" };
                    const roleId = (config as any)?.playstyle_roles?.[key] || "";
                    const isSet = Boolean(roleId);

                    return (
                      <div
                        key={key}
                        className="p-3 bg-surface-raised border border-border rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{def.name}</span>
                            {isSet ? (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary-100 text-primary-800 border border-primary-edge">
                                連携済み
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-surface text-faint border border-border">
                                未作成
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-faint">{def.description}</p>
                        </div>

                        <div className="text-right shrink-0">
                          {isSet ? (
                            <span className="font-mono text-[11px] text-faint bg-background px-2 py-1 rounded border border-border select-all">
                              ID: {roleId}
                            </span>
                          ) : (
                            <span className="text-[11px] text-faint italic">「自動作成」で生成されます</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 初中級限定部屋アクセス用ロール */}
            <div>
              <h3 className="text-xs font-bold text-foreground-subtle uppercase tracking-wider mb-2">
                🌱 初中級限定部屋アクセス用ロール (自動付与 / 1種)
              </h3>

              {loading ? (
                <div className="py-4 text-center text-xs text-faint">設定を読み込み中...</div>
              ) : (
                <div className="p-3 bg-surface-raised border border-border rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {beginnerLoungeDefinition?.name || "🌱 初中級交流"}
                      </span>
                      {config?.beginner_lounge_role ? (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-edge">
                          連携済み
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-surface text-faint border border-border">
                          未作成
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-faint">
                      {beginnerLoungeDefinition?.description ||
                        "初参加・ライト・復帰勢かつアイアン〜ゴールド帯の限定部屋アクセス用ロール"}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    {config?.beginner_lounge_role ? (
                      <span className="font-mono text-[11px] text-faint bg-background px-2 py-1 rounded border border-border select-all">
                        ID: {config.beginner_lounge_role}
                      </span>
                    ) : (
                      <span className="text-[11px] text-faint italic">「自動作成」で生成されます</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 直近の同期サマリー */}
          {syncSummary && (
            <div className="bg-background border border-border rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary-600" />
                同期実行結果詳細 ({syncSummary.synced}/{syncSummary.total}名)
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1 text-xs divide-y divide-border">
                {syncSummary.details.map((d, idx) => (
                  <div key={idx} className="pt-1.5 flex items-center justify-between">
                    <span className="font-medium text-foreground">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-faint">{d.tier}</span>
                      {d.error ? (
                        <span className="text-danger-600 text-[11px]">⚠️ {d.error}</span>
                      ) : d.changed ? (
                        <span className="text-primary-600 font-bold text-[11px]">ロール変更</span>
                      ) : (
                        <span className="text-faint text-[11px]">変更なし</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 運用ガイド */}
          <div className="bg-surface-raised border border-border rounded-xl p-3.5 space-y-1 text-xs text-foreground-subtle">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary-600" />
              運用のポイント
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-faint text-[11px] leading-relaxed">
              <li>試合記録時（内戦終了時）に、参加者10名のロールが自動で最新のTierに更新されます。</li>
              <li>Discordサーバー側で、<strong>KTM Bot の役職が上記ロールよりも上にあること</strong>をご確認ください。</li>
              <li>「全員同期」を押すと、ブランク期間（30日/60日）による常連・経験者・復帰勢の入れ替えも全員分一括反映されます。</li>
            </ul>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-border flex justify-end bg-surface-raised">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-background hover:bg-black/5 text-foreground border border-border rounded-xl text-xs font-bold transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
