"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import championsSummary from "@/data/champions_summary.json";
import { getChampIcon } from "@/lib/ddragonClient";
import {
  ArrowLeft, Search, Save, RotateCcw, Sparkles, Check, AlertTriangle,
  Layers, BookOpen, Crown, Wrench, ExternalLink, History, Clock, Trash2, Edit3
} from "lucide-react";

interface ChampionSummary {
  id: string;
  name: string;
  jpName: string;
  title: string;
  roles: string[];
}

const AVAILABLE_ROLES = ["TOP", "JG", "MID", "ADC", "SUP"] as const;

function DictMaintenanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChampParam = searchParams.get("c") || "Viego";

  const [selectedChampId, setSelectedChampId] = useState(initialChampParam);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // データState
  const [roles, setRoles] = useState<string[]>([]);
  const [globalTitle, setGlobalTitle] = useState("");
  const [globalStrategy, setGlobalStrategy] = useState("");
  const [strengthsText, setStrengthsText] = useState("");
  const [weaknessesText, setWeaknessesText] = useState("");
  const [countersText, setCountersText] = useState("");
  const [mustBanText, setMustBanText] = useState("");
  const [revisions, setRevisions] = useState<any[]>([]);

  // プレビュー切り替え
  const [activeTab, setActiveTab] = useState<"global" | "roles" | "facts" | "history">("global");

  // チャンピオン一覧
  const champions = useMemo(() => championsSummary as ChampionSummary[], []);
  const currentChamp = useMemo(() => {
    return champions.find((c) => c.id.toLowerCase() === selectedChampId.toLowerCase()) || champions[0];
  }, [champions, selectedChampId]);

  // 検索フィルター
  const filteredChamps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return champions;
    return champions.filter(
      (c) => c.id.toLowerCase().includes(q) || c.jpName.toLowerCase().includes(q)
    );
  }, [champions, search]);

  // データロード
  const loadChampionData = async (champId: string) => {
    setLoading(true);
    setSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/dict-maintenance?champion=${encodeURIComponent(champId)}`);
      const resData = await res.json();
      if (res.ok && resData.success && resData.data) {
        const d = resData.data;
        // roles
        setRoles(d.roles && d.roles.length > 0 ? d.roles : currentChamp.roles || ["TOP"]);

        // globalGuide
        if (d.globalGuide) {
          setGlobalTitle(d.globalGuide.title || `${champId} 基本戦略・トレンド`);
          setGlobalStrategy(d.globalGuide.strategy || "");
        } else {
          setGlobalTitle(`${champId} 基本戦略・トレンド`);
          setGlobalStrategy("");
        }

        // facts
        if (d.facts) {
          setStrengthsText(Array.isArray(d.facts.strengths) ? d.facts.strengths.join("\n") : (d.facts.strengths || ""));
          setWeaknessesText(Array.isArray(d.facts.weaknesses) ? d.facts.weaknesses.join("\n") : (d.facts.weaknesses || ""));
          setCountersText(Array.isArray(d.facts.counter_champions) ? d.facts.counter_champions.join("\n") : (d.facts.counter_champions || ""));
          setMustBanText(Array.isArray(d.facts.must_ban_champions) ? d.facts.must_ban_champions.join("\n") : (d.facts.must_ban_champions || ""));
        } else {
          setStrengthsText("");
          setWeaknessesText("");
          setCountersText("");
          setMustBanText("");
        }

        // revisions
        setRevisions(d.revisions || []);
      }
    } catch (err) {
      console.error("データロード失敗:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChampId) {
      loadChampionData(selectedChampId);
    }
  }, [selectedChampId]);

  // レーントグル
  const toggleRole = (r: string) => {
    setRoles((prev) => {
      if (prev.includes(r)) {
        if (prev.length === 1) return prev; // 最低1つは維持
        return prev.filter((x) => x !== r);
      } else {
        return [...prev, r];
      }
    });
  };

  // メインロール設定
  const setPrimaryRole = (r: string) => {
    setRoles((prev) => {
      const rest = prev.filter((x) => x !== r);
      return [r, ...rest];
    });
  };

  // レーン保存
  const handleSaveRoles = async () => {
    try {
      const res = await fetch("/api/champions/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ champion: currentChamp.id, roles }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess("所属レーンを正常に保存しました");
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        alert(`保存失敗: ${data.error}`);
      }
    } catch (e: any) {
      alert(`通信エラー: ${e.message}`);
    }
  };

  // 統合マスター教本の保存
  const handleSaveGlobalGuide = async () => {
    try {
      const res = await fetch("/api/admin/dict-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_global",
          champion: currentChamp.id,
          title: globalTitle,
          strategy: globalStrategy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess("👑 統合マスター教本をDBに正常保存しました（履歴作成完了）");
        setTimeout(() => setSaveSuccess(null), 3500);
        loadChampionData(currentChamp.id);
      } else {
        alert(`保存失敗: ${data.error}`);
      }
    } catch (e: any) {
      alert(`通信エラー: ${e.message}`);
    }
  };

  // 基本戦術情報の保存
  const handleSaveFacts = async () => {
    try {
      const parseLines = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/admin/dict-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_facts",
          champion: currentChamp.id,
          strengths: parseLines(strengthsText),
          weaknesses: parseLines(weaknessesText),
          counter_champions: parseLines(countersText),
          must_ban_champions: parseLines(mustBanText),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess("基本戦術情報を正常保存しました");
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        alert(`保存失敗: ${data.error}`);
      }
    } catch (e: any) {
      alert(`通信エラー: ${e.message}`);
    }
  };

  // ロールバック
  const handleRollback = async (revId: number) => {
    if (!confirm("過去バージョンに復元しますか？（現在の内容は上書きされます）")) return;
    try {
      const res = await fetch("/api/admin/dict-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          champion: currentChamp.id,
          revision_id: revId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess("過去バージョンへ復元しました");
        setTimeout(() => setSaveSuccess(null), 3000);
        loadChampionData(currentChamp.id);
      } else {
        alert(`復元失敗: ${data.error}`);
      }
    } catch (e: any) {
      alert(`通信エラー: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 flex flex-col font-sans">
      {/* 上部ヘッダーバー */}
      <header className="border-b border-zinc-800 bg-[#121216] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href={`/?c=${encodeURIComponent(currentChamp.id)}`}
            className="p-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition border border-zinc-700"
            title="辞典メインへ戻る"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Layers size={16} />
            </span>
            <h1 className="text-sm sm:text-base font-black text-zinc-100">
              ⚙️ チャンピオン辞典 統合メンテナンス管理
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin/dict-health"
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold border border-zinc-700 transition"
          >
            🏥 辞典監査
          </Link>
          <Link
            href="/admin/youtube"
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold border border-zinc-700 transition"
          >
            📺 YouTube管理
          </Link>
        </div>
      </header>

      {/* メインレイアウト */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-3 sm:p-5 gap-4">
        {/* 左サイドバー: チャンピオン選択 */}
        <div className="w-full md:w-64 bg-[#121216] border border-zinc-800 rounded-2xl p-3 flex flex-col shrink-0 h-[300px] md:h-[calc(100vh-100px)] sticky top-16">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="チャンプ検索..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {filteredChamps.map((c) => {
              const isSelected = c.id.toLowerCase() === currentChamp.id.toLowerCase();
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedChampId(c.id);
                    router.push(`/admin/dict-maintenance?c=${encodeURIComponent(c.id)}`);
                  }}
                  className={`w-full p-2 rounded-xl flex items-center gap-2.5 text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold"
                      : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <img
                    src={getChampIcon(c.id)}
                    alt={c.jpName}
                    className="w-7 h-7 rounded-lg object-cover shrink-0 border border-zinc-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate leading-tight">{c.jpName}</p>
                    <p className="text-[10px] text-zinc-500 font-mono truncate">{c.id}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右メインエリア: 編集フォーム */}
        <div className="flex-1 bg-[#121216] border border-zinc-800 rounded-2xl p-4 sm:p-6 flex flex-col space-y-5">
          {/* 選択中チャンプの概要ヘッダー */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={getChampIcon(currentChamp.id)}
                alt={currentChamp.jpName}
                className="w-12 h-12 rounded-xl object-cover border border-amber-500/40 shadow-md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-zinc-100">{currentChamp.jpName}</h2>
                  <span className="text-xs text-zinc-500 font-mono">({currentChamp.id})</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{currentChamp.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/?c=${encodeURIComponent(currentChamp.id)}`}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition flex items-center gap-1.5"
                title="辞典画面でプレビュー"
              >
                <span>辞典で開く</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          {/* 保存完了バナー */}
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check size={16} />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* 編集セクション切り替えタブ */}
          <div className="flex items-center gap-1 border-b border-zinc-800 pb-2 overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setActiveTab("global")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "global"
                  ? "bg-amber-500 text-zinc-950 font-black shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Crown size={14} />
              <span>👑 統合マスター教本 ({globalStrategy.length.toLocaleString()}文字)</span>
            </button>

            <button
              onClick={() => setActiveTab("roles")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "roles"
                  ? "bg-amber-500 text-zinc-950 font-black shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Wrench size={14} />
              <span>🛠️ 所属レーン設定</span>
            </button>

            <button
              onClick={() => setActiveTab("facts")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "facts"
                  ? "bg-amber-500 text-zinc-950 font-black shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <BookOpen size={14} />
              <span>📋 強み・弱み・BAN</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "history"
                  ? "bg-amber-500 text-zinc-950 font-black shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <History size={14} />
              <span>📜 改定履歴 ({revisions.length}件)</span>
            </button>
          </div>

          {/* タブ 1: 👑 統合戦術マスター教本 (enemy=GLOBAL) */}
          {activeTab === "global" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                    <span>👑 統合戦術マスター教本（原本全文）</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono">
                      {globalStrategy.length.toLocaleString()} 文字
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Supabase <code>matchup_sentinel</code> (enemy=GLOBAL) に保存され、辞典のバイブルタブ最上部に表示されます。
                  </p>
                </div>

                <button
                  onClick={handleSaveGlobalGuide}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Save size={14} />
                  <span>教本をDBへ保存</span>
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">教本タイトル</label>
                <input
                  type="text"
                  value={globalTitle}
                  onChange={(e) => setGlobalTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-bold focus:outline-none focus:border-amber-500/50"
                  placeholder="例: ヴィエゴ 基本戦略・トレンド"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">教本本文 (Markdown)</label>
                <textarea
                  value={globalStrategy}
                  onChange={(e) => setGlobalStrategy(e.target.value)}
                  rows={18}
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-amber-500/50 resize-y"
                  placeholder="統合された戦術ガイドの全文を入力..."
                />
              </div>
            </div>
          )}

          {/* タブ 2: 🛠️ 所属レーン設定 */}
          {activeTab === "roles" && (
            <div className="space-y-4 max-w-xl">
              <div>
                <h3 className="text-sm font-black text-zinc-100">🛠️ 所属レーン・優先度設定</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  このチャンピオンの対象レーンを選択してください。先頭のレーンがメインロール（第1候補）になります。
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                {AVAILABLE_ROLES.map((r) => {
                  const isActive = roles.includes(r);
                  const isPrimary = roles[0] === r;
                  return (
                    <div
                      key={r}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition min-w-[140px] ${
                        isActive
                          ? "bg-zinc-950 border-amber-500/50"
                          : "bg-zinc-950/40 border-zinc-800 opacity-60"
                      }`}
                    >
                      <button
                        onClick={() => toggleRole(r)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isActive
                              ? "bg-amber-500 border-amber-400 text-zinc-950"
                              : "border-zinc-700"
                          }`}
                        >
                          {isActive && <Check size={12} className="stroke-[3]" />}
                        </div>
                        <span className="font-black text-xs text-zinc-200">{r}</span>
                      </button>

                      {isActive && (
                        <button
                          onClick={() => setPrimaryRole(r)}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            isPrimary
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                          title="第1メインロールにする"
                        >
                          {isPrimary ? "★ メイン" : "メイン化"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveRoles}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  <span>所属レーンをDBへ保存</span>
                </button>
              </div>
            </div>
          )}

          {/* タブ 3: 📋 基本戦術情報 (Facts) */}
          {activeTab === "facts" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-zinc-100">📋 強み・弱み・BAN・相性設定</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    各項目は改行ごとに1つの項目としてパース・保存されます。
                  </p>
                </div>
                <button
                  onClick={handleSaveFacts}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Save size={14} />
                  <span>基本情報を保存</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-emerald-400 block mb-1">💪 有利な強み・ストロングポイント</label>
                  <textarea
                    value={strengthsText}
                    onChange={(e) => setStrengthsText(e.target.value)}
                    rows={6}
                    placeholder="改行区切りで入力..."
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-rose-400 block mb-1">⚠️ 弱点・不利な状況・ウィークポイント</label>
                  <textarea
                    value={weaknessesText}
                    onChange={(e) => setWeaknessesText(e.target.value)}
                    rows={6}
                    placeholder="改行区切りで入力..."
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-rose-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-cyan-400 block mb-1">🎯 有利カウンター・カモ</label>
                  <textarea
                    value={countersText}
                    onChange={(e) => setCountersText(e.target.value)}
                    rows={4}
                    placeholder="改行区切りで入力..."
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-amber-400 block mb-1">⛔ マストBAN推奨・天敵</label>
                  <textarea
                    value={mustBanText}
                    onChange={(e) => setMustBanText(e.target.value)}
                    rows={4}
                    placeholder="改行区切りで入力..."
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* タブ 4: 📜 改定履歴 (Revisions) */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                  <History size={16} className="text-amber-400" />
                  <span>改定履歴・ロールバック</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  過去の教本更新履歴が保存されています。誤った上書きをした場合、過去バージョンに復元できます。
                </p>
              </div>

              {revisions.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 bg-zinc-950/60 rounded-xl border border-zinc-800">
                  まだ改定履歴がありません（本画面で教本を編集・保存すると履歴が自動生成されます）。
                </div>
              ) : (
                <div className="space-y-3">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-200">{rev.source_title || "手動編集"}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(rev.created_at).toLocaleString("ja-JP")}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                          {rev.before_text ? `更新前: ${rev.before_text.slice(0, 80)}...` : "初回保存"}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRollback(rev.id)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold border border-zinc-700 transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                        title="この更新前の内容に戻す"
                      >
                        <RotateCcw size={13} />
                        <span>復元する</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 下部注意書き・再ビルド案内 */}
          <div className="mt-auto pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-500">
            <p>
              ※ DB保存した内容は即座にSupabaseに永続化されます。05辞典の静的コンパイルデータへ反映するには次回デプロイまたはビルドを実行してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DictMaintenancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-400 text-xs">読み込み中...</div>}>
      <DictMaintenanceContent />
    </Suspense>
  );
}
