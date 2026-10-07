"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import championsSummary from "@/data/champions_summary.json";
import { ArrowLeft, Target } from "lucide-react";
import KnowledgeIngestModal from "@/components/KnowledgeIngestModal";
import { MatchupPicker } from "@/components/MatchupPicker";
import LaneMaintenanceModal from "@/components/LaneMaintenanceModal";
import ItemDictionaryModal from "@/components/ItemDictionaryModal";
import RevisionHistoryModal from "@/components/RevisionHistoryModal";
import { CHAMP_ALIASES } from "@/lib/champAliases";
import { usePilotSettings } from "./_champions/usePilotSettings";
import { useKnowledgeModal } from "./_champions/useKnowledgeModal";
import { useChampionDetailData } from "./_champions/useChampionDetailData";
import { filterAndSortChampions } from "@/lib/tierScoreCalculator";
import type { ChampionSummary, DetailTab, ChampSort, BuildPreset } from "./_champions/types";
import ChampionHeroBanner from "./_champions/ChampionHeroBanner";
import VsComparePanel from "./_champions/VsComparePanel";
import LaneTempoHud from "./_champions/LaneTempoHud";
import PickGuideCard from "./_champions/PickGuideCard";
import DetailTabsNav from "./_champions/DetailTabsNav";
import BuildTab from "./_champions/BuildTab";
import MatchupTab from "./_champions/MatchupTab";
import BibleTab from "./_champions/BibleTab";
import LibraryTab from "./_champions/LibraryTab";
import ChampionListView from "./_champions/ChampionListView";
import KnowledgeDetailModal from "./_champions/KnowledgeDetailModal";
import ToolPaletteModal from "./_champions/ToolPaletteModal";


function PilotApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawChampParam = searchParams.get("c");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [champSort, setChampSort] = useState<ChampSort>("tier");

  // 詳細タブはURL(?t=)に持たせる。再読み込みやリンク共有でも同じタブが開くように(2026-10-05)。
  // チャンピオン詳細の中の小タブなので、履歴は積まずに置き換える(戻るボタンで一覧へ戻れるように)
  const tabParam = searchParams.get("t");
  const activeTab: DetailTab =
    tabParam === "matchup" || tabParam === "bible" || tabParam === "library" ? tabParam : "build";
  const setActiveTab = (tab: DetailTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "build") params.delete("t");
    else params.set("t", tab);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };
  const [buildPreset, setBuildPreset] = useState<BuildPreset>("standard");
  const [showCdTable, setShowCdTable] = useState(false);

  // ⚔️ 対面VS直接比較モード (Split View)
  const [vsMode, setVsMode] = useState(false);
  const [vsEnemyId, setVsEnemyId] = useState("");

  // 🎯 対面相性チェッカー (Matchup Picker) モード
  const [showMatchupPicker, setShowMatchupPicker] = useState(false);

  // 🛠️ レーン所属メンテナンスモーダル
  const [isLaneModalOpen, setIsLaneModalOpen] = useState(false);
  const [focusedLaneChampId, setFocusedLaneChampId] = useState<string | undefined>(undefined);

  // 📖 アイテム翻訳辞書モーダル
  const [isItemDictModalOpen, setIsItemDictModalOpen] = useState(false);
  const [dictFocusKey, setDictFocusKey] = useState<string | undefined>(undefined);
  const [dictFocusValue, setDictFocusValue] = useState<string | undefined>(undefined);

  // 📥 戦術取込モーダル状態
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // 👑 統合戦術マスター教本（GLOBAL本文）の展開・コピー状態
  const [isGlobalGuideExpanded, setIsGlobalGuideExpanded] = useState(false);
  const [globalGuideCopied, setGlobalGuideCopied] = useState(false);

  // ⚙️ ツール・管理クイックパレット モーダル開閉状態（絶対に見切れない中央モーダル）
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);

  // 📜 編集・統合履歴モーダル状態
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

  // 📒 攻略知見詳細ポップアップモーダル状態
  const {
    selectedKnowledgeId, setSelectedKnowledgeId, knowledgeDetail, setKnowledgeDetail,
    knowledgeLoading, knowledgeCopied, setKnowledgeCopied, openKnowledgeModal,
  } = useKnowledgeModal();

  // お気に入り・レーン所属・アイテム辞書・OP.GGメタ（端末とDBを同期）
  const { favorites, customRoles, customItemDict, opggMeta, handleRolesSaved, handleDictionarySaved, toggleFavorite } = usePilotSettings();

  // 選択中チャンピオンの詳細・レーン・アーキタイプ・ビルド・テンポ指標・ピック判断
  const {
    selectedDetail, vsEnemyDetail, availableRoles, currentRole, setCurrentRole, currentLaneMeta,
    archetype, currentBuild, vsEnemyArchetype, spikeValues, laneTempo, stageTactics, dynamicPickGuide, matchedVsNote,
  } = useChampionDetailData({ rawChampParam, vsEnemyId, customRoles, customItemDict, buildPreset, opggMeta });

  // カスタムレーン設定を反映したチャンピオン一覧
  const displayChampions = useMemo(() => {
    const list = championsSummary as ChampionSummary[];
    return list.map((c) => {
      const override = customRoles[c.id];
      if (override && Array.isArray(override) && override.length > 0) {
        return { ...c, roles: override };
      }
      return c;
    });
  }, [customRoles]);

  // チャンピオン一覧フィルタ ＆ ソート（Tier・名前・勝率・ナレッジ数対応）
  const filteredChampions = useMemo(
    () => filterAndSortChampions(displayChampions, { search, roleFilter, showFavoritesOnly, favorites, champSort, opggMeta, aliases: CHAMP_ALIASES }),
    [displayChampions, search, roleFilter, showFavoritesOnly, favorites, champSort, opggMeta],
  );


  const selectChampion = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("c", id);
    router.push(`/?${params.toString()}`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const clearSelection = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("c");
    params.delete("t");
    setVsMode(false);
    setVsEnemyId("");
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#101012] text-zinc-100 flex flex-col font-sans">
      {/* 👑 詳細表示時の戻るサブバー */}
      {selectedDetail && (
        <div className="bg-[#16161a] border-b border-zinc-800/80 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              onClick={clearSelection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition border border-zinc-700 cursor-pointer shadow-sm"
            >
              <ArrowLeft size={14} /> <span>← チャンピオン一覧へ戻る</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMatchupPicker(!showMatchupPicker)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shadow-sm ${
                  showMatchupPicker
                    ? "bg-rose-500 text-white border-rose-400"
                    : "bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/50"
                }`}
                title="相手JGを選択して最適ピックを逆引き"
              >
                <Target size={13} /> <span>🎯 対面チェッカー</span>
              </button>
              <div className="text-xs font-bold text-amber-400">
                {selectedDetail.jpName}（{selectedDetail.title}）
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📖 メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4">
        {/* 🎯 対面相性チェッカー (Matchup Picker) */}
        {showMatchupPicker && (
          <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <MatchupPicker
              favorites={favorites}
              onSelectMyChampion={(champId) => {
                selectChampion(champId);
              }}
            />
          </div>
        )}

        {selectedDetail ? (
          /* =========================================================
             👑 チャンピオン詳細ビュー (VS直接比較機能搭載)
             ========================================================= */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* 1. ヒーローバナー＆基本情報 */}
            <ChampionHeroBanner favorites={favorites} activeTab={activeTab} setActiveTab={setActiveTab} showCdTable={showCdTable} setShowCdTable={setShowCdTable} vsMode={vsMode} setVsMode={setVsMode} vsEnemyId={vsEnemyId} setIsToolModalOpen={setIsToolModalOpen} setIsRevisionModalOpen={setIsRevisionModalOpen} toggleFavorite={toggleFavorite} selectedDetail={selectedDetail} availableRoles={availableRoles} currentRole={currentRole} setCurrentRole={setCurrentRole} currentLaneMeta={currentLaneMeta} />

            {/* ⚔️ 対面VS直接比較パネル (Split View) */}
            {vsMode && (
              <VsComparePanel vsEnemyId={vsEnemyId} setVsEnemyId={setVsEnemyId} selectedDetail={selectedDetail} vsEnemyDetail={vsEnemyDetail} archetype={archetype} vsEnemyArchetype={vsEnemyArchetype} matchedVsNote={matchedVsNote} />
            )}

            {/* 2. ⏱️⚡ レーン別実戦指標 ＆ パワースパイク推移ミニHUD */}
            <LaneTempoHud currentRole={currentRole} spikeValues={spikeValues} laneTempo={laneTempo} />

            {/* 🎯 ピック判断ガイド (先出し / 後出し / 構成マッチング) */}
            {dynamicPickGuide && (
              <PickGuideCard dynamicPickGuide={dynamicPickGuide} />
            )}

            {/* 3. 🧭 4大タブナビゲーション */}
            <DetailTabsNav activeTab={activeTab} setActiveTab={setActiveTab} selectedDetail={selectedDetail} />

            {/* 4. 📦 タブコンテンツ */}

            {/* タブ 1: 戦略・シチュエーション別ビルド */}
            {activeTab === "build" && (
              <BuildTab buildPreset={buildPreset} setBuildPreset={setBuildPreset} setIsItemDictModalOpen={setIsItemDictModalOpen} setDictFocusKey={setDictFocusKey} setDictFocusValue={setDictFocusValue} selectedDetail={selectedDetail} archetype={archetype} currentBuild={currentBuild} stageTactics={stageTactics} />
            )}

            {/* タブ 2: 対面相性 ＆ キルライン */}
            {activeTab === "matchup" && (
              <MatchupTab selectedDetail={selectedDetail} />
            )}

            {/* タブ 3: 実戦バイブル ＆ 統合マスター戦術書 */}
            {activeTab === "bible" && (
              <BibleTab isGlobalGuideExpanded={isGlobalGuideExpanded} setIsGlobalGuideExpanded={setIsGlobalGuideExpanded} globalGuideCopied={globalGuideCopied} setGlobalGuideCopied={setGlobalGuideCopied} openKnowledgeModal={openKnowledgeModal} selectedDetail={selectedDetail} stageTactics={stageTactics} />
            )}

            {/* タブ 4: 📒 ライブラリ攻略知見 (個人ナレッジ連動) */}
            {activeTab === "library" && (
              <LibraryTab setIsIngestOpen={setIsIngestOpen} openKnowledgeModal={openKnowledgeModal} selectedDetail={selectedDetail} />
            )}
          </div>
        ) : (
          /* =========================================================
             👑 チャンピオン一覧 (エイリアス検索・お気に入り対応)
             ========================================================= */
          <ChampionListView search={search} setSearch={setSearch} roleFilter={roleFilter} setRoleFilter={setRoleFilter} showFavoritesOnly={showFavoritesOnly} setShowFavoritesOnly={setShowFavoritesOnly} favorites={favorites} champSort={champSort} setChampSort={setChampSort} showMatchupPicker={showMatchupPicker} setShowMatchupPicker={setShowMatchupPicker} setIsLaneModalOpen={setIsLaneModalOpen} setFocusedLaneChampId={setFocusedLaneChampId} opggMeta={opggMeta} setIsToolModalOpen={setIsToolModalOpen} toggleFavorite={toggleFavorite} filteredChampions={filteredChampions} selectChampion={selectChampion} />
        )}
      </main>

      {/* 📥 戦術取込モーダル */}
      <KnowledgeIngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        defaultChampion={selectedDetail?.id || ""}
        onSaved={() => {
          // 保存完了時にクエリ再読み込みや通知
        }}
      />

      {/* 🛠️ レーン所属メンテナンスモーダル */}
      <LaneMaintenanceModal
        isOpen={isLaneModalOpen}
        onClose={() => setIsLaneModalOpen(false)}
        champions={displayChampions}
        focusedChampionId={focusedLaneChampId}
        currentCustomRoles={customRoles}
        onRolesSaved={handleRolesSaved}
      />

      {/* 📖 アイテム翻訳辞書モーダル */}
      <ItemDictionaryModal
        isOpen={isItemDictModalOpen}
        onClose={() => setIsItemDictModalOpen(false)}
        initialKey={dictFocusKey}
        initialValue={dictFocusValue}
        currentCustomDict={customItemDict}
        onDictionarySaved={handleDictionarySaved}
      />

      {/* 📒 攻略知見詳細ポップアップモーダル */}
      {selectedKnowledgeId && (
        <KnowledgeDetailModal selectedKnowledgeId={selectedKnowledgeId} setSelectedKnowledgeId={setSelectedKnowledgeId} knowledgeDetail={knowledgeDetail} knowledgeLoading={knowledgeLoading} knowledgeCopied={knowledgeCopied} setKnowledgeCopied={setKnowledgeCopied} />
      )}

      {/* ⚙️ ツール・管理クイックパレット モーダル（中央表示・完全非見切れUI） */}
      {isToolModalOpen && (
        <ToolPaletteModal setIsLaneModalOpen={setIsLaneModalOpen} setFocusedLaneChampId={setFocusedLaneChampId} setIsItemDictModalOpen={setIsItemDictModalOpen} setDictFocusKey={setDictFocusKey} setDictFocusValue={setDictFocusValue} setIsIngestOpen={setIsIngestOpen} setIsToolModalOpen={setIsToolModalOpen} setIsRevisionModalOpen={setIsRevisionModalOpen} selectedDetail={selectedDetail} />
      )}

      {/* 📜 チャンピオン各項目 編集・統合履歴モーダル */}
      <RevisionHistoryModal
        championId={selectedDetail?.id || ""}
        championName={selectedDetail?.jpName || ""}
        isOpen={isRevisionModalOpen}
        onClose={() => setIsRevisionModalOpen(false)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#101012] flex items-center justify-center text-amber-400">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PilotApp />
    </Suspense>
  );
}
