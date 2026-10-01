"use client";

import React, { useState, useEffect } from "react";
import { 
  X, Sparkles, Link as LinkIcon, FileText, Check, 
  AlertTriangle, RefreshCw, Swords, ShieldAlert, ArrowRight, Save,
  Film, MessageSquare, Clock, Trash2, ExternalLink, Play
} from "lucide-react";
import { getChampIcon } from "@/lib/ddragonClient";

interface KnowledgeIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaultChampion?: string;
}

interface QueueItem {
  id: string;
  title: string;
  url: string;
  status: string;
  retry_count: number;
  priority?: string;
  date_added?: string;
}

export default function KnowledgeIngestModal({
  isOpen,
  onClose,
  onSaved,
  defaultChampion = "",
}: KnowledgeIngestModalProps) {
  // メインタブ ('instant' | 'youtube_queue')
  const [activeTab, setActiveTab] = useState<"instant" | "youtube_queue">("instant");

  // 即時解析のサブモード ('url' | 'memo' | 'discord')
  const [subMode, setSubMode] = useState<"url" | "memo" | "discord">("url");
  const [url, setUrl] = useState("");
  const [memo, setMemo] = useState("");
  const [discordLog, setDiscordLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // YouTube キューの状態
  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [newQueueUrl, setNewQueueUrl] = useState("");
  const [queueAdding, setQueueAdding] = useState(false);

  // AI解析プレビュー
  const [preview, setPreview] = useState<{
    champion: string;
    target_enemy: string;
    role: string;
    title: string;
    strategy: string;
    weakness: string;
    trap: string;
    power_spike: string;
    source: string;
  } | null>(null);

  // キュー一覧取得
  const fetchQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/youtube/queue?limit=25");
      const d = await res.json();
      if (res.ok && d.items) {
        setQueueList(d.items);
      }
    } catch {}
    finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "youtube_queue") {
      fetchQueue();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // 即時解析ハンドラ
  const handleParse = async (overrideText?: string, overrideUrl?: string) => {
    setError(null);
    setSuccessMsg(null);
    setPreview(null);

    const targetUrl = overrideUrl !== undefined ? overrideUrl : url;
    let targetMemo = memo;
    if (overrideText !== undefined) targetMemo = overrideText;
    else if (subMode === "discord") targetMemo = discordLog;

    if (subMode === "url" && !overrideText && !targetUrl.trim()) {
      setError("URLを入力してください");
      return;
    }
    if ((subMode === "memo" || subMode === "discord") && !targetMemo.trim()) {
      setError("テキスト本文を入力してください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "parse",
          type: subMode,
          url: targetUrl,
          memo: defaultChampion ? `[対象チャンピオン: ${defaultChampion}]\n${targetMemo}` : targetMemo,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "解析に失敗しました");
      }

      setPreview(data.preview);
    } catch (e: any) {
      setError(e.message || "解析中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 辞典への保存ハンドラ
  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          type: subMode,
          url,
          parsedData: preview,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "保存に失敗しました");
      }

      setSuccessMsg("✅ 辞典へ保存しました！");
      setTimeout(() => {
        setPreview(null);
        setUrl("");
        setMemo("");
        setDiscordLog("");
        onClose();
        if (onSaved) onSaved();
      }, 1200);
    } catch (e: any) {
      setError(e.message || "保存中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // YouTubeキュー追加
  const handleAddQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueUrl.trim()) return;

    setQueueAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newQueueUrl }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        throw new Error(d.error || "キュー登録に失敗しました");
      }
      setNewQueueUrl("");
      fetchQueue();
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setQueueAdding(false);
    }
  };

  // YouTubeキュー削除
  const handleDeleteQueue = async (id: string) => {
    try {
      await fetch(`/api/youtube/queue?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setQueueList(prev => prev.filter(item => item.id !== id));
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-100 flex items-center gap-1.5">
                <span>📥 戦術取込・解析センター</span>
              </h2>
              <p className="text-[10px] text-zinc-400">
                YouTube動画・X投稿・Discord相談ログ・反省メモをAIで構造化蓄積
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 最上位タブログ（即時AI取込 vs YouTube解析キュー） */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-zinc-800/80 bg-zinc-950/40">
          <button
            onClick={() => { setActiveTab("instant"); setError(null); }}
            className={`pb-2.5 px-3 text-xs font-black transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "instant"
                ? "text-amber-400 border-amber-400"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            <Sparkles size={13} /> 🚀 即時AI取込 (URL / メモ / Discord)
          </button>
          <button
            onClick={() => { setActiveTab("youtube_queue"); setError(null); }}
            className={`pb-2.5 px-3 text-xs font-black transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "youtube_queue"
                ? "text-rose-400 border-rose-400"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            <Film size={13} /> 🎬 YouTube解析キュー
            {queueList.length > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-zinc-800 text-zinc-300">
                {queueList.length}
              </span>
            )}
          </button>
        </div>

        {/* コンテンツ本体 */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* =========================================================
             タブ 1: 即時AI取込 (URL / メモ / Discord)
             ========================================================= */}
          {activeTab === "instant" && (
            <div className="space-y-4">
              {/* 入力サブモード切替 */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-center">
                <button
                  onClick={() => { setSubMode("url"); setError(null); }}
                  className={`py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                    subMode === "url"
                      ? "bg-amber-500 text-zinc-950 font-black shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <LinkIcon size={12} /> URL (YouTube/X)
                </button>
                <button
                  onClick={() => { setSubMode("memo"); setError(null); }}
                  className={`py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                    subMode === "memo"
                      ? "bg-amber-500 text-zinc-950 font-black shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <FileText size={12} /> 反省・殴り書きメモ
                </button>
                <button
                  onClick={() => { setSubMode("discord"); setError(null); }}
                  className={`py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                    subMode === "discord"
                      ? "bg-amber-500 text-zinc-950 font-black shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <MessageSquare size={12} /> Discordログ
                </button>
              </div>

              {/* フォーム入力 */}
              {subMode === "url" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-300 block">
                    攻略動画・記事のURL:
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... または X / note のURL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
                  />
                  <textarea
                    placeholder="（任意）補足や気になったタイムスタンプ、メモがあれば..."
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 text-xs"
                  />
                </div>
              )}

              {subMode === "memo" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-300 block">
                    試合後の反省・気付き・立ち回りメモ:
                  </label>
                  <textarea
                    placeholder="例: エイトロックス使ったけど、ダリウス相手にLv2でE使って突っ込んだら引っ張られて即死した。Lv3まではQの先端当てだけで耐えるべき。"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 text-xs leading-relaxed"
                  />
                </div>
              )}

              {subMode === "discord" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-300 block">
                    Discord / チャットログ（会話テキストをそのままコピペ）:
                  </label>
                  <textarea
                    placeholder="Discordのコーチングや戦術相談チャンネルのやりとりをそのまま貼り付けてください。AIが有用な戦術・対面ミクロのみを抽出します。"
                    value={discordLog}
                    onChange={(e) => setDiscordLog(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 text-xs leading-relaxed font-mono"
                  />
                </div>
              )}

              {/* エラー / 成功通知 */}
              {error && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-2">
                  <Check size={14} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* 解析実行ボタン */}
              {!preview && (
                <button
                  onClick={() => handleParse()}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Gemini AIが戦術を解析・構造化中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>AIで戦術エッセンスを抽出・プレビュー</span>
                    </>
                  )}
                </button>
              )}

              {/* AI解析プレビュー画面 */}
              {preview && (
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-amber-500/40 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <span className="text-[10px] font-black text-amber-400 uppercase flex items-center gap-1">
                      <Check size={12} /> AI解析結果プレビュー
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                      {preview.role}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={getChampIcon(preview.champion)}
                        alt={preview.champion}
                        className="w-8 h-8 rounded-lg object-cover border border-amber-500/50"
                      />
                      <div>
                        <span className="text-[9px] text-zinc-500 block">対象</span>
                        <span className="font-black text-zinc-100">{preview.champion}</span>
                      </div>
                    </div>

                    {preview.target_enemy && preview.target_enemy !== "GLOBAL" && (
                      <>
                        <span className="text-zinc-600 font-bold">vs</span>
                        <div className="flex items-center gap-2">
                          <img
                            src={getChampIcon(preview.target_enemy)}
                            alt={preview.target_enemy}
                            className="w-8 h-8 rounded-lg object-cover border border-rose-500/50"
                          />
                          <div>
                            <span className="text-[9px] text-zinc-500 block">対面</span>
                            <span className="font-black text-zinc-100">{preview.target_enemy}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-bold text-zinc-200 block text-xs">
                      {preview.title}
                    </span>
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 leading-relaxed text-[11px] whitespace-pre-wrap">
                      {preview.strategy}
                    </div>
                  </div>

                  {preview.trap && (
                    <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-[11px]">
                      <span className="font-bold mr-1">⚠️ 地雷行動:</span>
                      <span>{preview.trap}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>保存中...</span>
                        </>
                      ) : (
                        <>
                          <Save size={13} />
                          <span>この知見を辞典へ正式保存する</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setPreview(null)}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
                    >
                      やり直す
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
             タブ 2: 🎬 YouTube解析キュー (Queue)
             ========================================================= */}
          {activeTab === "youtube_queue" && (
            <div className="space-y-4">
              {/* キュー追加フォーム */}
              <form onSubmit={handleAddQueue} className="flex gap-2">
                <input
                  type="url"
                  placeholder="追加したいYouTube URL (watch?v=... や /shorts/...)"
                  value={newQueueUrl}
                  onChange={(e) => setNewQueueUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={queueAdding}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {queueAdding ? <RefreshCw size={13} className="animate-spin" /> : <Film size={13} />}
                  <span>キュー追加</span>
                </button>
              </form>

              {/* キュー一覧 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
                  <span>登録済み動画一覧 ({queueList.length}件)</span>
                  <button onClick={fetchQueue} className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
                    <RefreshCw size={11} className={queueLoading ? "animate-spin" : ""} /> 更新
                  </button>
                </div>

                {queueLoading && queueList.length === 0 && (
                  <div className="py-8 text-center text-zinc-500">キューを読み込み中...</div>
                )}

                {!queueLoading && queueList.length === 0 && (
                  <div className="py-8 text-center text-zinc-500 bg-zinc-950 rounded-xl border border-zinc-800">
                    登録されている動画はありません。
                  </div>
                )}

                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {queueList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                            item.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : item.status === "failed"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}>
                            {item.status}
                          </span>
                          <span className="font-bold text-xs text-zinc-200 truncate block">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-zinc-300 flex items-center gap-0.5 truncate"
                          >
                            <span>{item.url}</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>

                      {/* アクションボタン */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 今すぐこの動画をAI解析 */}
                        <button
                          onClick={() => {
                            setActiveTab("instant");
                            setSubMode("url");
                            setUrl(item.url);
                            handleParse("", item.url);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-[11px] border border-zinc-700 flex items-center gap-1 transition cursor-pointer"
                          title="この動画をAIで今すぐ解析する"
                        >
                          <Sparkles size={11} />
                          <span>即時解析</span>
                        </button>

                        <button
                          onClick={() => handleDeleteQueue(item.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                          title="キューから削除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
