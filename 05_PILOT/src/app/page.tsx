"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import championsSummary from "@/data/champions_summary.json";
import championsDetailMap from "@/data/champions_detail_map.json";
import { getChampIcon, getChampSplash } from "@/lib/ddragonClient";
import { detectChampionArchetype, getPresetBuildDetails, type ChampionArchetype } from "@/lib/archetype";
import { 
  Search, ShieldAlert, Swords, Zap, Skull, Shield, BookOpen, 
  ArrowLeft, ArrowRight, Clock, Activity, AlertTriangle, Layers,
  CheckCircle2, ChevronDown, ChevronUp, Timer, Star,
  X, Check, Flame, Sparkles, Plus, Download, Bot, Target, ExternalLink, Video, Eye, Waves, Compass, Wrench, Edit3, Copy, Crown
} from "lucide-react";
import KnowledgeIngestModal from "@/components/KnowledgeIngestModal";
import { MatchupPicker } from "@/components/MatchupPicker";
import LaneMaintenanceModal from "@/components/LaneMaintenanceModal";
import ItemDictionaryModal from "@/components/ItemDictionaryModal";
import { translateItem } from "@/lib/itemTranslator";
import { getLaneTempoMetrics, getStageTactics } from "@/lib/tempoMetrics";
import { getDynamicPickGuide } from "@/lib/pickGuideDynamic";
import opggLaneMetaDefault from "@/data/opgg_lane_meta.json";

// 通称・略称・エイリアス辞書
const CHAMP_ALIASES: Record<string, string[]> = {
  TwistedFate: ['tf', 'ツイフェイ', 'カード', 'ついふぇい'],
  MissFortune: ['mf', 'ミスフォ', 'みすふぉ'],
  AurelionSol: ['asol', 'エーソル', 'えーそる', 'ドラゴン', '宇宙'],
  JarvanIV: ['j4', 'ジャーヴァン', 'じゃーゔぁん', 'おうじ', '王子'],
  Warwick: ['ww', 'ワーウィック', 'わーうぃっく', 'オオカミ', '狼'],
  MasterYi: ['yi', 'イー', 'いー', 'マスターイー', 'ますたーいー'],
  Gangplank: ['gp', 'ガングプランク', 'ガンプラ', 'みかん'],
  LeBlanc: ['lb', 'ルブラン', 'るぶらん'],
  Katarina: ['kata', 'カタ', 'かた', 'カタリナ', 'かたりな'],
  Mordekaiser: ['morde', 'モルデ', 'もるで', '鉄'],
  Nocturne: ['noc', 'ノク', 'のく', '暗闇'],
  Pantheon: ['panth', 'パンテ', 'ぱんて', 'パン'],
  Kaisa: ['カイサ', 'かいさ', '虚空'],
  KogMaw: ['kog', 'コグ', 'こぐ', 'ゲロ'],
  Renata: ['レナータ', 'れなーた'],
  XinZhao: ['xin', 'シンジャオ', 'しんじゃお'],
  TahmKench: ['tahm', 'タム', 'たむ', 'カエル', 'なまず'],
  Vladimir: ['vlad', 'ブラッド', 'ぶらっど', '吸血鬼'],
  Cassiopeia: ['cass', 'カシオペア', 'かしおぺあ', 'ヘビ'],
  Heimerdinger: ['heimer', 'ハイマー', 'はいまー', 'タレット'],
  Sejuani: ['seju', 'セジュ', 'せじゅ', 'イノシシ'],
  Tryndamere: ['trynd', 'トリン', 'とりん', '不死身'],
  DrMundo: ['mundo', 'ムンド', 'むんど'],
  Blitzcrank: ['blitz', 'ブリッツ', 'ぶりっつ', 'フック'],
  Nautilus: ['naut', 'ノーチ', 'のーち', 'いかり'],
  LeeSin: ['lee', 'リー', 'りー', '盲目'],
  MonkeyKing: ['wukong', 'ウーコン', 'うーこん', 'サル', '猿'],
  Ambessa: ['アンベッサ', 'あんべっさ', 'ambessa', '母', 'メルの母'],
};

interface ChampionSummary {
  id: string;
  name: string;
  jpName: string;
  title: string;
  roles: string[];
  skills: {
    passive?: { name: string; description: string; imageFull?: string };
    q?: { name: string; cooldown: number[]; imageFull?: string };
    w?: { name: string; cooldown: number[]; imageFull?: string };
    e?: { name: string; cooldown: number[]; imageFull?: string };
    r?: { name: string; cooldown: number[]; imageFull?: string };
  };
  hasBible: boolean;
  videoBibleCount?: number;
  libraryKnowledgeCount?: number;
  tier?: string;
  winRate?: number;
}

interface MatchupItem {
  id: string;
  enemy: string;
  note: string;
  result?: string;
  trap?: string;
}

interface ChampionDetail {
  id: string;
  jpName: string;
  title: string;
  tags: string[];
  info: { attack: number; defense: number; magic: number; difficulty: number };
  spells: Array<{
    id: string;
    name: string;
    description: string;
    cooldown: number[];
    cooldownBurn: string;
    costBurn?: string;
    imageFull?: string;
  }>;
  passive: {
    name: string;
    description: string;
    imageFull?: string;
  };
  facts?: {
    strengths?: string[];
    weaknesses?: string[];
    counters?: string[];
    mustBan?: string[];
    tier?: string;
    winRate?: number;
    trendItems?: string[];
    trendRunes?: { keystone?: string; primary?: string[]; secondary?: string[] };
    gameplayGuide?: string;
    powerSpikes?: string;
    skillOrder?: string[];
  };
  bible?: {
    playstyleSummary?: string;
    killCombo?: string;
    stages?: {
      early?: string;
      mid?: string;
      late?: string;
    };
    traps?: string[];
    rawMarkdown?: string;
  };
  pickGuide?: {
    blindPick?: {
      rating: string;
      label: string;
      reason: string;
    };
    counterPick?: {
      targets: string[];
      situation: string;
    };
    whenToPick?: {
      teamSynergy: string;
      winCondition: string;
    };
  };
  matchups?: MatchupItem[];
  videoBibles?: VideoBibleItem[];
  libraryKnowledge?: LibraryKnowledgeItem[];
  globalGuide?: {
    id: number | string;
    title: string;
    strategy: string;
    sections?: any[];
    noteDraft?: string;
    createdAt?: string;
  };
}

interface LibraryKnowledgeItem {
  id: string | number;
  title: string;
  snippet: string;
  tags?: string[];
  sourceUrl?: string;
  createdAt?: string;
  channel?: string;
  charCount?: number;
}

interface VideoBibleItem {
  id: string;
  title: string;
  videoTitle?: string;
  videoUrl?: string;
  videoId?: string;
  killerQuote?: string;
  keyTactics: {
    cameraWork?: string;
    smiteRule?: string;
    waveRule?: string;
    shadowRule?: string;
    comebackRule?: string;
    pingsRule?: string;
    muteRule?: string;
  };
  traps?: string[];
  thoughtTrigger?: string;
}

function PilotApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawChampParam = searchParams.get("c");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [champSort, setChampSort] = useState<"tier" | "name_ja" | "name_en" | "win_rate" | "knowledge">("tier");

  // 詳細タブはURL(?t=)に持たせる。再読み込みやリンク共有でも同じタブが開くように(2026-10-05)。
  // チャンピオン詳細の中の小タブなので、履歴は積まずに置き換える(戻るボタンで一覧へ戻れるように)
  type DetailTab = "build" | "matchup" | "bible" | "library";
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
  const [buildPreset, setBuildPreset] = useState<"standard" | "tank" | "burst">("standard");
  const [showCdTable, setShowCdTable] = useState(false);

  // ⚔️ 対面VS直接比較モード (Split View)
  const [vsMode, setVsMode] = useState(false);
  const [vsEnemyId, setVsEnemyId] = useState("");

  // 🎯 対面相性チェッカー (Matchup Picker) モード
  const [showMatchupPicker, setShowMatchupPicker] = useState(false);

  // 🛠️ レーン所属メンテナンスモーダル
  const [isLaneModalOpen, setIsLaneModalOpen] = useState(false);
  const [focusedLaneChampId, setFocusedLaneChampId] = useState<string | undefined>(undefined);
  const [customRoles, setCustomRoles] = useState<Record<string, string[]>>({});

  // 📖 アイテム翻訳辞書モーダル
  const [isItemDictModalOpen, setIsItemDictModalOpen] = useState(false);
  const [dictFocusKey, setDictFocusKey] = useState<string | undefined>(undefined);
  const [dictFocusValue, setDictFocusValue] = useState<string | undefined>(undefined);
  const [customItemDict, setCustomItemDict] = useState<Record<string, string>>({});

  // 📊 OP.GG 公式メタデータ (全レーンの勝率・Tier・BAN率・順位)
  const [opggMeta, setOpggMeta] = useState<any>(opggLaneMetaDefault);

  // 📥 戦術取込モーダル状態
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // 👑 統合戦術マスター教本（GLOBAL本文）の展開・コピー状態
  const [isGlobalGuideExpanded, setIsGlobalGuideExpanded] = useState(false);
  const [globalGuideCopied, setGlobalGuideCopied] = useState(false);

  // ⚙️ ツール・管理クイックパレット モーダル開閉状態（絶対に見切れない中央モーダル）
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);

  // 📒 攻略知見詳細ポップアップモーダル状態
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | number | null>(null);
  const [knowledgeDetail, setKnowledgeDetail] = useState<{
    id: string | number;
    title: string;
    content?: string;
    raw_content?: string;
    source_url?: string;
    tags?: string[];
    created_at?: string;
  } | null>(null);
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

  // チャンピオン詳細データの取得
  const selectedDetail: ChampionDetail | null = useMemo(() => {
    if (!rawChampParam) return null;
    const map = championsDetailMap as unknown as Record<string, ChampionDetail>;
    const direct = map[rawChampParam];
    if (direct) return direct;
    const foundKey = Object.keys(map).find(
      (k) => k.toLowerCase() === rawChampParam.toLowerCase()
    );
    return foundKey ? map[foundKey] : null;
  }, [rawChampParam]);

  // VS敵チャンピオンの詳細データ
  const vsEnemyDetail: ChampionDetail | null = useMemo(() => {
    if (!vsEnemyId) return null;
    const map = championsDetailMap as unknown as Record<string, ChampionDetail>;
    return map[vsEnemyId] || null;
  }, [vsEnemyId]);

  // 選択中チャンピオンの利用可能レーン（ユーザーカスタム設定優先）
  const availableRoles = useMemo(() => {
    if (!selectedDetail) return ["MID"];
    const custom = customRoles[selectedDetail.id];
    if (custom && Array.isArray(custom) && custom.length > 0) return custom;
    if (selectedDetail.tags && Array.isArray(selectedDetail.tags) && selectedDetail.tags.length > 0) {
      return selectedDetail.tags;
    }
    return ["MID"];
  }, [selectedDetail, customRoles]);

  // 選択中チャンピオンのロール
  const [currentRole, setCurrentRole] = useState<string>("MID");
  useEffect(() => {
    if (availableRoles.length > 0) {
      if (!availableRoles.includes(currentRole)) {
        setCurrentRole(availableRoles[0]);
      }
    }
  }, [availableRoles, currentRole]);

  // 選択中レーンに対応する OP.GG 公式メタデータ
  const currentLaneMeta = useMemo(() => {
    if (!selectedDetail) return null;
    const laneKey = currentRole === "BOT" ? "ADC" : currentRole;
    return opggMeta?.lanes?.[laneKey]?.[selectedDetail.id] || null;
  }, [selectedDetail, currentRole, opggMeta]);

  // アーキタイプ判定
  const archetype: ChampionArchetype = useMemo(() => {
    if (!selectedDetail) return "ad_fighter";
    return detectChampionArchetype(
      selectedDetail.id,
      selectedDetail.tags || [],
      selectedDetail.info,
      "",
      currentRole
    );
  }, [selectedDetail, currentRole]);

  // シチュエーション別ビルド（アイテム辞書翻訳をリアルタイム適用）
  const currentBuild = useMemo(() => {
    const rawItems = selectedDetail?.facts?.trendItems || [];
    const trendItems = rawItems.map((it) => translateItem(it, customItemDict));
    const trendKeystone = selectedDetail?.facts?.trendRunes?.keystone || "";
    return getPresetBuildDetails(archetype, buildPreset, trendItems, trendKeystone, customItemDict, selectedDetail?.id);
  }, [archetype, buildPreset, selectedDetail, customItemDict]);

  // 対戦相手（VS）のアーキタイプ判定
  const vsEnemyArchetype: ChampionArchetype = useMemo(() => {
    if (!vsEnemyDetail) return "ad_fighter";
    return detectChampionArchetype(
      vsEnemyDetail.id,
      vsEnemyDetail.tags || [],
      vsEnemyDetail.info,
      "",
      currentRole
    );
  }, [vsEnemyDetail, currentRole]);

  // パワースパイク推定値
  const spikeValues = useMemo(() => {
    switch (archetype) {
      case "ad_assassin": return { early: 8, mid: 9, late: 5 };
      case "ap_mage": return { early: 5, mid: 8, late: 9 };
      case "tank": return { early: 6, mid: 8, late: 8 };
      case "marksman": return { early: 4, mid: 7, late: 10 };
      case "enchanter": return { early: 6, mid: 7, late: 8 };
      default: return { early: 7, mid: 9, late: 7 };
    }
  }, [archetype]);

  // ⚡ レーン別・チャンピオン固有のテンポ指標（動的算出）
  const laneTempo = useMemo(() => {
    if (!selectedDetail) return null;
    return getLaneTempoMetrics({
      id: selectedDetail.id,
      jpName: selectedDetail.jpName,
      archetype,
      role: currentRole,
      spikeValues,
      powerSpikesText: selectedDetail.facts?.powerSpikes,
      earlyStageText: selectedDetail.bible?.stages?.early,
    });
  }, [selectedDetail, archetype, currentRole, spikeValues]);

  // 📖 序盤・中盤・終盤の立ち回り指南（動的生成）
  const stageTactics = useMemo(() => {
    if (!selectedDetail) return null;
    return getStageTactics({
      id: selectedDetail.id,
      jpName: selectedDetail.jpName,
      role: currentRole,
      archetype,
      bibleStages: selectedDetail.bible?.stages,
      powerSpikesText: selectedDetail.facts?.powerSpikes,
      strengths: selectedDetail.facts?.strengths,
      weaknesses: selectedDetail.facts?.weaknesses,
    });
  }, [selectedDetail, currentRole, archetype]);

  // 🎯 ピック判断ガイド（先出し・後出し・勝ち筋の動的生成）
  const dynamicPickGuide = useMemo(() => {
    if (!selectedDetail) return null;
    return getDynamicPickGuide({
      id: selectedDetail.id,
      jpName: selectedDetail.jpName,
      archetype,
      role: currentRole,
      strengths: selectedDetail.facts?.strengths,
      weaknesses: selectedDetail.facts?.weaknesses,
      counters: selectedDetail.facts?.counters,
      mustBan: selectedDetail.facts?.mustBan,
      winRate: currentLaneMeta?.winRate,
      tier: currentLaneMeta?.tier,
      staticPickGuide: selectedDetail.pickGuide,
    });
  }, [selectedDetail, archetype, currentRole, currentLaneMeta]);

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
  const filteredChampions = useMemo(() => {
    const list = displayChampions.filter((c) => {
      const q = search.trim().toLowerCase();
      
      // 通称・エイリアス判定
      const aliases = CHAMP_ALIASES[c.id] || [];
      const matchAlias = aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));

      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.jpName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        matchAlias;

      const targetRoles = roleFilter === "ADC" ? ["ADC", "BOT"] : [roleFilter];
      const matchRole =
        roleFilter === "ALL" ||
        c.roles.some((r) => targetRoles.includes(r));

      const matchFav = !showFavoritesOnly || favorites.includes(c.id);

      return matchSearch && matchRole && matchFav;
    });

    // 選択中レーンのレーンキー（OP.GG連動）
    const getLaneKey = (role: string) => {
      if (role === "TOP") return "TOP";
      if (role === "JG") return "JUNGLE";
      if (role === "MID") return "MID";
      if (role === "ADC" || role === "BOT") return "ADC";
      if (role === "SUP") return "SUPPORT";
      return null;
    };
    const currentLaneKey = getLaneKey(roleFilter);

    // 各チャンピオンの該当レーン（または第1ロール）のTierと勝率を取得
    const getChampMeta = (c: ChampionSummary) => {
      if (!opggMeta?.lanes) return { tier: undefined, winRate: undefined, tierScore: 0 };
      const laneKey = currentLaneKey || getLaneKey(c.roles[0]) || "JUNGLE";
      const m = opggMeta.lanes[laneKey]?.[c.id];
      if (!m) return { tier: undefined, winRate: undefined, tierScore: 0 };

      let score = 10;
      const t = String(m.tier || "").toUpperCase();
      if (t === "OP") score = 100;
      else if (t === "1" || t === "T1") score = 90;
      else if (t === "2" || t === "T2") score = 80;
      else if (t === "3" || t === "T3") score = 70;
      else if (t === "4" || t === "T4") score = 60;
      else if (t === "5" || t === "T5") score = 50;

      return { tier: m.tier, winRate: m.winRate, tierScore: score };
    };

    list.sort((a, b) => {
      if (champSort === "tier") {
        const metaA = getChampMeta(a);
        const metaB = getChampMeta(b);
        if (metaB.tierScore !== metaA.tierScore) {
          return metaB.tierScore - metaA.tierScore;
        }
        return (metaB.winRate || 0) - (metaA.winRate || 0);
      } else if (champSort === "name_ja") {
        return a.jpName.localeCompare(b.jpName, "ja");
      } else if (champSort === "name_en") {
        return a.id.localeCompare(b.id);
      } else if (champSort === "win_rate") {
        const metaA = getChampMeta(a);
        const metaB = getChampMeta(b);
        return (metaB.winRate || 0) - (metaA.winRate || 0);
      } else if (champSort === "knowledge") {
        const countA = (a.videoBibleCount || 0) + (a.libraryKnowledgeCount || 0);
        const countB = (b.videoBibleCount || 0) + (b.libraryKnowledgeCount || 0);
        return countB - countA;
      }
      return 0;
    });

    return list;
  }, [displayChampions, search, roleFilter, showFavoritesOnly, favorites, champSort, opggMeta]);

  // 特定対面の特化メモ（Matchup Sentinelから検索）
  const matchedVsNote = useMemo(() => {
    if (!selectedDetail || !vsEnemyId) return null;
    const matchups = selectedDetail.matchups || [];
    return matchups.find(
      (m) => m.enemy.toLowerCase() === vsEnemyId.toLowerCase() ||
             m.note.toLowerCase().includes(vsEnemyId.toLowerCase())
    );
  }, [selectedDetail, vsEnemyId]);

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
            <div className="relative rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">
              {/* 背景スプラッシュ（角丸クリップ） */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-xs"
                  style={{ backgroundImage: `url(${getChampSplash(selectedDetail.id)})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
              </div>

              <div className="relative p-4 sm:p-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-amber-500/60 shadow-lg shrink-0">
                    <img
                      src={getChampIcon(selectedDetail.id)}
                      alt={selectedDetail.jpName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg sm:text-xl font-black text-zinc-100">
                        {selectedDetail.jpName}
                      </h1>
                      <span className="text-xs font-bold text-zinc-400">
                        ({selectedDetail.id})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold">
                        {selectedDetail.title}
                      </span>
                      {/* お気に入り星ボタン */}
                      <button
                        onClick={(e) => toggleFavorite(selectedDetail.id, e)}
                        className={`p-1 rounded-lg border transition cursor-pointer ${
                          favorites.includes(selectedDetail.id)
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                        }`}
                        title="お気に入り登録"
                      >
                        <Star size={15} fill={favorites.includes(selectedDetail.id) ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selectedDetail.tags?.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                          {t}
                        </span>
                      ))}
                      {/* 📊 OP.GG 公式メタデータ（選択中レーン連動） */}
                      {currentLaneMeta ? (
                        <>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-black border ${
                              currentLaneMeta.tierNum === 0 || currentLaneMeta.tierNum === 1
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs"
                                : currentLaneMeta.tierNum === 2
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : currentLaneMeta.tierNum === 3
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {currentLaneMeta.tier}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-200 font-bold border border-zinc-700/80">
                            {currentRole} {currentLaneMeta.rank}位
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                              currentLaneMeta.winRate >= 52
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : currentLaneMeta.winRate >= 50
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}
                          >
                            勝率: {currentLaneMeta.winRate}%
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium">
                            BAN: {currentLaneMeta.banRate}%
                          </span>
                          <a
                            href={`https://www.op.gg/champions/${selectedDetail.id.toLowerCase()}/build/${(currentRole === "BOT" ? "adc" : currentRole).toLowerCase()}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center gap-1 transition"
                            title={`OP.GG公式の${selectedDetail.jpName} (${currentRole}) ビルド・スタッツを開く`}
                          >
                            <span>出典: OP.GG</span>
                            <ExternalLink size={9} />
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400 border border-zinc-700/60 font-medium">
                          {currentRole}統計: 圏外 / データ僅少
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* アクションボタン群（VS直接比較 / CD表 / AIコーチ / ライブラリ / レーン切替） */}
                <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                  {/* ⚔️ VS直接比較モード トグルボタン */}
                  <button
                    onClick={() => setVsMode(!vsMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer shadow-sm ${
                      vsMode
                        ? "bg-rose-600 text-white border-rose-500 shadow-rose-950/50 scale-102"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                    }`}
                  >
                    <Swords size={14} className={vsMode ? "text-white" : "text-rose-400"} />
                    <span>{vsMode ? "VS比較を閉じる" : "⚔️ 対面VS直接比較"}</span>
                  </button>

                  {/* 🤖 AIコーチ設計図へジャンプ */}
                  <Link
                    href={`/coach?my=${selectedDetail.id}${vsEnemyId ? `&enemy=${vsEnemyId}` : ''}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs font-bold transition shadow-sm"
                    title="このチャンピオンの即死キルライン・初動JGルート・3段階手順を開く"
                  >
                    <Bot size={14} className="text-indigo-400" />
                    <span>🤖 AIコーチ設計図</span>
                  </Link>

                  {/* 📒 攻略ライブラリ記事・知見タブを開く */}
                  <button
                    onClick={() => {
                      setActiveTab("library");
                      setTimeout(() => {
                        const el = document.getElementById("champ-tabs-nav");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }, 50);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      activeTab === "library"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                    }`}
                    title="このチャンピオンのプロ解説・ライブラリ知見を表示"
                  >
                    <BookOpen size={14} className="text-amber-400" />
                    <span>📒 攻略知見</span>
                    {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-mono">
                        {selectedDetail.libraryKnowledge.length}
                      </span>
                    )}
                  </button>

                  {/* CD早見表トグル */}
                  <button
                    onClick={() => setShowCdTable(!showCdTable)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      showCdTable
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                    }`}
                    title="全スキルのCD秒数早見表を開閉"
                  >
                    <Timer size={14} className="text-amber-400" />
                    <span>{showCdTable ? "CD表を閉じる" : "CD表"}</span>
                    {showCdTable ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {/* レーンセレクター（対象チャンピオンの所属レーンのみ表示） */}
                  <div className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 font-bold px-1.5">レーン:</span>
                    {availableRoles.length === 1 ? (
                      <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {availableRoles[0]}
                      </span>
                    ) : (
                      availableRoles.map((r) => (
                        <button
                          key={r}
                          onClick={() => setCurrentRole(r)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-black transition cursor-pointer ${
                            currentRole === r
                              ? "bg-amber-500 text-zinc-950 shadow-sm"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          }`}
                        >
                          {r}
                        </button>
                      ))
                    )}
                  </div>

                  {/* ⚙️ ツール・管理メニュー起動ボタン */}
                  <button
                    type="button"
                    onClick={() => setIsToolModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-amber-300 border border-zinc-700 hover:border-amber-500/50 transition cursor-pointer shadow-sm"
                    title="知見取込・レーン設定・アイテム辞書・管理メニュー"
                  >
                    <Wrench size={13} className="text-amber-400" />
                    <span>ツール</span>
                  </button>
                </div>
              </div>

              {/* 全スキルCD早見表（トグル表示） */}
              {showCdTable && (
                <div className="border-t border-zinc-800 p-3 bg-zinc-950/90 overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-zinc-400 border-b border-zinc-800 text-[11px]">
                      <tr>
                        <th className="py-1.5 px-3">枠</th>
                        <th className="py-1.5 px-3">スキル名</th>
                        <th className="py-1.5 px-3">Lv1</th>
                        <th className="py-1.5 px-3">Lv2</th>
                        <th className="py-1.5 px-3">Lv3</th>
                        <th className="py-1.5 px-3">Lv4</th>
                        <th className="py-1.5 px-3">Lv5</th>
                        <th className="py-1.5 px-3">概要</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {selectedDetail.spells?.map((spell, idx) => {
                        const key = ["Q", "W", "E", "R"][idx];
                        const cds = spell.cooldown || [];
                        return (
                          <tr key={spell.id || idx} className="hover:bg-zinc-900/50">
                            <td className="py-1.5 px-3 font-black text-amber-400">{key}</td>
                            <td className="py-1.5 px-3 font-bold text-zinc-200">{spell.name}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[0] != null ? `${cds[0]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[1] != null ? `${cds[1]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[2] != null ? `${cds[2]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[3] != null ? `${cds[3]}s` : "-"}</td>
                            <td className="py-1.5 px-3 font-mono text-zinc-300">{cds[4] != null ? `${cds[4]}s` : "-"}</td>
                            <td className="py-1.5 px-3 text-zinc-400 text-[11px] max-w-xs truncate">{spell.description}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ⚔️ 対面VS直接比較パネル (Split View) */}
            {vsMode && (
              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-rose-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Swords size={18} className="text-rose-400" />
                    <h2 className="text-sm sm:text-base font-black text-zinc-100">⚔️ 対面VS直接比較 (Split View)</h2>
                    <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30">
                      リアルタイム攻略
                    </span>
                  </div>

                  {/* 敵チャンピオン選択セレクター */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-bold text-zinc-400 shrink-0">対戦相手:</span>
                    <select
                      value={vsEnemyId}
                      onChange={(e) => setVsEnemyId(e.target.value)}
                      className="bg-zinc-950 text-zinc-100 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-rose-500 w-full sm:w-60"
                    >
                      <option value="">-- 敵チャンピオンを選択 --</option>
                      {(championsSummary as ChampionSummary[])
                        .filter((c) => c.id !== selectedDetail.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.jpName} ({c.id})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {!vsEnemyId && (
                  <div className="py-6 text-center text-zinc-400 space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-zinc-200">対戦相手のチャンピオンを選択してください</p>
                    <p className="text-[11px] text-zinc-500">自チャンプの立ち回り・強みと、敵チャンプの弱み・パワースパイクを左右に並べて一目で有利不利を比較できます。</p>
                  </div>
                )}

                {vsEnemyId && vsEnemyDetail && (
                  <div className="space-y-4">
                    {/* 🤖 AI戦術コーチへのワンクリック直結バナー */}
                    <Link
                      href={`/coach?my=${selectedDetail.id}&enemy=${vsEnemyDetail.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border border-indigo-500/60 hover:border-indigo-400 text-white transition-all shadow-md group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow">
                          <Bot size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-white group-hover:text-indigo-200 transition">
                            🤖 この対面で「AI戦術コーチ（試合前設計図）」を開く
                          </span>
                          <p className="text-[10px] text-indigo-300">
                            Lv6即死境界キルライン ＋ 3段階手順書 ＋ 敵JG初動ルート（スカトル争奪）を即時計算
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-indigo-400 group-hover:translate-x-1 transition-transform shrink-0" />
                    </Link>

                    {/* 🎯 この対面専用の特化攻略メモ（存在する場合に最優先表示） */}
                    {matchedVsNote && (
                      <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-black text-amber-400 flex items-center gap-1.5">
                            <Sparkles size={14} /> 🎯 この対面の特化攻略メモ (Matchup Sentinel)
                          </span>
                          {matchedVsNote.result && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 font-bold">
                              {matchedVsNote.result}
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-200 leading-relaxed text-[11px]">
                          {matchedVsNote.note}
                        </p>
                        {matchedVsNote.trap && (
                          <div className="mt-1.5 text-[11px] text-rose-300 bg-rose-950/30 p-1.5 rounded border border-rose-500/30">
                            ⚠️ 罠: {matchedVsNote.trap}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 左右直接比較グリッド */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 左カラム：自分 (YOU) */}
                      <div className="bg-zinc-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
                          <img
                            src={getChampIcon(selectedDetail.id)}
                            alt={selectedDetail.jpName}
                            className="w-10 h-10 rounded-lg object-cover border border-emerald-500/50"
                          />
                          <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">自分 (YOU)</span>
                            <h3 className="text-sm font-black text-zinc-100">{selectedDetail.jpName}</h3>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">💥 自分の即死キルライン・強み</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {selectedDetail.bible?.killCombo || selectedDetail.facts?.strengths?.[0] || (
                                archetype.includes("assassin") ? "Lv6からのフルバーストで孤立ターゲットを確殺。" :
                                archetype === "marksman" ? "サポのCCに合わせて長射程から連続AAでキルライン到達。" :
                                archetype === "tank" ? "CCチェインからのタワーダイブまたは味方の追従でキル獲得。" :
                                "Lv6ウルト解禁からのスキルコンボで圧倒的有利を獲得。"
                              )}
                            </p>
                          </div>

                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">⚡ 自分のパワースパイク</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {selectedDetail.facts?.powerSpikes ? selectedDetail.facts.powerSpikes.split('\n')[0] : (
                                archetype === "marksman" ? "2〜3コア完成時およびIE獲得時に最大DPSを発揮。" :
                                archetype.includes("assassin") ? "1st脅威コア完成およびLv6到達時に最大スパイク。" :
                                "1stコア完成およびLv6到達時に最大パワースパイク。"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 右カラム：相手 (ENEMY) */}
                      <div className="bg-zinc-950/80 border border-rose-500/30 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
                          <img
                            src={getChampIcon(vsEnemyDetail.id)}
                            alt={vsEnemyDetail.jpName}
                            className="w-10 h-10 rounded-lg object-cover border border-rose-500/50"
                          />
                          <div>
                            <span className="text-[10px] font-bold text-rose-400 uppercase">対戦相手 (ENEMY)</span>
                            <h3 className="text-sm font-black text-zinc-100">{vsEnemyDetail.jpName}</h3>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          {/* 相手の弱み・突くべき隙 */}
                          <div className="bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/30">
                            <span className="text-[10px] font-bold text-rose-400 block mb-0.5">⚠️ 相手の弱み・突くべき隙</span>
                            <p className="text-zinc-200 text-[11px] leading-relaxed">
                              {vsEnemyDetail.facts?.weaknesses && vsEnemyDetail.facts.weaknesses.length > 0
                                ? vsEnemyDetail.facts.weaknesses.join(' / ')
                                : (
                                  vsEnemyArchetype.includes("assassin") ? "耐久が低いため、飛び込みに合わせてハードCCで即フォーカスして返り討ちにする。" :
                                  vsEnemyArchetype === "tank" ? "序盤の低火力・スキルCD中を狙い、割合ダメージで寄りを封じる。" :
                                  vsEnemyArchetype === "marksman" ? "単独行動中の接近戦に弱いため、死角からの急襲やエンゲージで即死を狙う。" :
                                  "スキル空振り後の長いCD中、および低マナ時の仕掛けが極めて有効。"
                                )}
                            </p>
                          </div>

                          {/* 相手のパワースパイク・警戒タイミング */}
                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-amber-400 block mb-0.5">💥 相手のパワースパイク・警戒タイミング</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {vsEnemyDetail.facts?.powerSpikes ? vsEnemyDetail.facts.powerSpikes.split('\n')[0] : (
                                vsEnemyArchetype.includes("assassin") ? "Lv6到達時および脅威1コア完成時の急襲に警戒。" :
                                vsEnemyArchetype === "marksman" ? "2コア完成以降の集団戦長射程DPSに警戒。" :
                                "Lv6ウルト取得時および主要1コア完成時に警戒。"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. ⏱️⚡ レーン別実戦指標 ＆ パワースパイク推移ミニHUD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* レーン別実戦指標 */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    {currentRole === "JG" ? <Clock size={16} /> :
                     currentRole === "SUP" ? <Shield size={16} /> :
                     currentRole === "TOP" ? <Swords size={16} /> :
                     currentRole === "MID" ? <Zap size={16} /> :
                     <Activity size={16} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-zinc-100">
                        {laneTempo?.title || (
                          currentRole === "JG" ? "🌲 JG周回実戦基準" :
                          currentRole === "SUP" ? "🛡️ SUP視界・初動指標" :
                          currentRole === "TOP" ? "⚔️ TOPウェーブ管理指標" :
                          currentRole === "MID" ? "⚡ MIDローム・テンポ指標" :
                          "🏹 BOT/ADC指標"
                        )}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
                        {laneTempo?.badge || `${currentRole}標準`}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {laneTempo?.subtitle || (
                        currentRole === "JG" ? "2026仕様: キャンプ0:55湧き / カニ2:55争奪" :
                        currentRole === "SUP" ? "Lv2先行プッシュ ＆ 視界スコア目標" :
                        currentRole === "TOP" ? "1stリコール目標 ＆ フリーズ基準" :
                        currentRole === "MID" ? "キャノン押し込み ＆ オブジェクト寄り" :
                        "1stコア目標 ＆ CSレート"
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  {laneTempo ? (
                    <>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">{laneTempo.metric1.label}</span>
                        <span className={`text-xs font-black ${laneTempo.metric1.color} font-mono`}>
                          {laneTempo.metric1.value}
                        </span>
                      </div>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">{laneTempo.metric2.label}</span>
                        <span className={`text-xs font-black ${laneTempo.metric2.color} font-mono`}>
                          {laneTempo.metric2.value}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block font-bold">指標読込中</span>
                      <span className="text-xs font-black text-zinc-500 font-mono">--:--</span>
                    </div>
                  )}
                </div>
              </div>

              {/* パワースパイク推移 */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-center gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={15} className="text-amber-400" />
                    <span className="text-xs font-black text-zinc-100">パワースパイク推移</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-bold">10段階指標</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1 px-0.5">
                      <span>序盤</span>
                      <span className="font-bold text-amber-400">{spikeValues.early}/10</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(spikeValues.early / 10) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1 px-0.5">
                      <span>中盤</span>
                      <span className="font-bold text-emerald-400">{spikeValues.mid}/10</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(spikeValues.mid / 10) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1 px-0.5">
                      <span>終盤</span>
                      <span className="font-bold text-cyan-400">{spikeValues.late}/10</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(spikeValues.late / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 🎯 ピック判断ガイド (先出し / 後出し / 構成マッチング) */}
            {dynamicPickGuide && (
              <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Target size={16} className="text-amber-400" />
                    <span className="text-xs sm:text-sm font-black text-zinc-100">
                      🎯 ピック判断ガイド（先出し・後出し・構成マッチング）
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">SOLOQ PICK STRATEGY</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* 1. 先出しおすすめ度 */}
                  <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-zinc-300 flex items-center gap-1.5">
                          🛡️ 先出し適性
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                          dynamicPickGuide.blindPick?.rating === "S"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : dynamicPickGuide.blindPick?.rating === "A"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        }`}>
                          ランク {dynamicPickGuide.blindPick?.rating || "A"} : {dynamicPickGuide.blindPick?.label || "先出し安定"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {dynamicPickGuide.blindPick?.reason}
                      </p>
                    </div>
                  </div>

                  {/* 2. 後出し刺さり条件 */}
                  <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-zinc-300 flex items-center gap-1.5">
                          ⚔️ 後出しカウンター
                        </span>
                        <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                          刺さる相手
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                        {dynamicPickGuide.counterPick?.situation}
                      </p>
                    </div>
                    {dynamicPickGuide.counterPick?.targets && dynamicPickGuide.counterPick.targets.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-zinc-900">
                        <span className="text-[10px] text-zinc-500">有利:</span>
                        {dynamicPickGuide.counterPick.targets.map((tgt, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-purple-300 font-bold">
                            {tgt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. こういう時にピックおすすめ */}
                  <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black text-zinc-300 flex items-center gap-1.5">
                          💡 こういう時に出す
                        </span>
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          味方構成トリガー
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 font-medium leading-relaxed mb-1.5">
                        {dynamicPickGuide.whenToPick?.teamSynergy}
                      </p>
                    </div>
                    {dynamicPickGuide.whenToPick?.winCondition && (
                      <div className="text-[10px] text-zinc-500 bg-zinc-900/60 p-1.5 rounded-lg border border-zinc-900">
                        🎯 勝ち筋: <span className="text-zinc-300">{dynamicPickGuide.whenToPick.winCondition}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. 🧭 4大タブナビゲーション */}
            <div id="champ-tabs-nav" className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto scroll-mt-4">
              <button
                onClick={() => setActiveTab("build")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "build"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <Swords size={14} /> ⚔️ 戦略・シチュエーション別ビルド
              </button>
              <button
                onClick={() => setActiveTab("matchup")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "matchup"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <ShieldAlert size={14} /> 🥊 対面相性 ＆ キルライン
                {selectedDetail.matchups && selectedDetail.matchups.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-amber-300 text-[10px]">
                    {selectedDetail.matchups.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("bible")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "bible"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <BookOpen size={14} /> 🧠 プロの思考録・バイブル
                {selectedDetail.videoBibles && selectedDetail.videoBibles.length > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold">
                    動画{selectedDetail.videoBibles.length}本
                  </span>
                ) : selectedDetail.bible ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ) : null}
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                  activeTab === "library"
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <BookOpen size={14} /> 📒 ライブラリ攻略知見
                {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 ? (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    activeTab === "library" ? "bg-zinc-950 text-amber-400" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {selectedDetail.libraryKnowledge.length}件
                  </span>
                ) : null}
              </button>
            </div>

            {/* 4. 📦 タブコンテンツ */}

            {/* タブ 1: 戦略・シチュエーション別ビルド */}
            {activeTab === "build" && (
              <div className="space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-zinc-100">
                        シチュエーション別ビルド分岐
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {archetype === "ap_mage" ? "⚡ APメイジ" :
                         archetype === "ap_assassin" ? "🗡️ APアサシン" :
                         archetype === "ad_assassin" ? "🗡️ 脅威アサシン" :
                         archetype === "tank" ? "🛡️ 耐久タンク" :
                         archetype === "marksman" ? "🏹 マークスマン" :
                         archetype === "enchanter" ? "✨ サポート" : "⚔️ ADファイター"}
                      </span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                        敵構成に合わせて即時選択
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                      <button
                        onClick={() => setBuildPreset("standard")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          buildPreset === "standard"
                            ? "bg-amber-500 text-zinc-950 font-black shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        標準コア
                      </button>
                      <button
                        onClick={() => setBuildPreset("tank")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          buildPreset === "tank"
                            ? "bg-rose-500 text-white font-black shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        対タンク (貫通)
                      </button>
                      <button
                        onClick={() => setBuildPreset("burst")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          buildPreset === "burst"
                            ? "bg-cyan-500 text-zinc-950 font-black shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        対バースト (高耐久)
                      </button>
                    </div>

                    {/* 📖 アイテム辞書モーダル起動ボタン */}
                    <button
                      onClick={() => {
                        setDictFocusKey(undefined);
                        setDictFocusValue(undefined);
                        setIsItemDictModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer shadow-xs ml-auto sm:ml-0"
                      title="アイテム名の翻訳・辞書登録を開く"
                    >
                      <BookOpen size={13} className="text-amber-400" />
                      <span>アイテム辞書</span>
                    </button>
                  </div>

                  {/* ビルド詳細3カラムカード */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-amber-500/40 transition">
                      <span className="text-[10px] font-black text-amber-400 uppercase block mb-1">
                        1コア (ファースト完成)
                      </span>
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-zinc-100 text-sm truncate">
                          {currentBuild.firstCore}
                        </p>
                        <button
                          onClick={() => {
                            setDictFocusKey(currentBuild.firstCore);
                            setDictFocusValue(currentBuild.firstCore);
                            setIsItemDictModalOpen(true);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition cursor-pointer shrink-0"
                          title="このアイテム名を辞書登録・編集"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        {currentBuild.firstCoreDesc}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-cyan-500/40 transition">
                      <span className="text-[10px] font-black text-cyan-400 uppercase block mb-1">
                        2〜3コア (集団戦スパイク)
                      </span>
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-bold text-zinc-100 text-sm truncate">
                          {currentBuild.coreSpike}
                        </p>
                        <button
                          onClick={() => {
                            setDictFocusKey(currentBuild.coreSpike);
                            setDictFocusValue(currentBuild.coreSpike);
                            setIsItemDictModalOpen(true);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition cursor-pointer shrink-0"
                          title="このアイテム名を辞書登録・編集"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        {currentBuild.coreSpikeDesc}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-emerald-500/40 transition">
                      <span className="text-[10px] font-black text-emerald-400 uppercase block mb-1">
                        キーストーン推奨ルーン
                      </span>
                      <p className="font-bold text-zinc-100 text-sm">
                        {currentBuild.runes}
                      </p>
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        {currentBuild.runesDesc}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 時間帯別パワースパイク分析 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-black text-zinc-100 mb-2.5 flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" /> 時間帯別パワースパイク ＆ 立ち回り
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-amber-400 block mb-1">Lv1〜3 (序盤・初動)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {stageTactics?.early || (selectedDetail.facts?.powerSpikes ? selectedDetail.facts.powerSpikes.split('\n')[0] : 'スキルを当てて主導権を取り、Lv2先行でウェーブをフリーズ。')}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-emerald-400 block mb-1">1コア〜Lv9 (中盤・主導権)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {stageTactics?.mid || '最も戦闘力が高いパワースパイク。ヘラルド・ドラゴン前にプッシュして視界制圧。'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-cyan-400 block mb-1">集団戦 (終盤・決戦)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {stageTactics?.late || '正面から突っ込まず、側道から敵キャリーにCCを合わせ、耐久を活かして前線を維持。'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* タブ 2: 対面相性 ＆ キルライン */}
            {activeTab === "matchup" && (
              <div className="space-y-4">
                {/* 即死キルライン・コンボ */}
                {selectedDetail.bible?.killCombo && (
                  <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-rose-300 mb-1 flex items-center gap-2">
                      <Skull size={16} className="text-rose-400" /> 即死キルライン ＆ コンボ手順
                    </h3>
                    <p className="text-xs text-zinc-200 leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-800 mt-2 font-mono">
                      {selectedDetail.bible.killCombo}
                    </p>
                  </div>
                )}

                {/* カモ vs 天敵 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* カモ（有利な展開・強み） */}
                  <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <h3 className="text-sm font-black text-emerald-300">
                          🟢 有利な展開 ＆ 活かすべき強み
                        </h3>
                      </div>
                      {selectedDetail.facts?.strengths && selectedDetail.facts.strengths.length > 0 ? (
                        <div className="space-y-2 text-xs">
                          {selectedDetail.facts.strengths.map((s, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 text-zinc-300 leading-relaxed">
                              <span className="text-emerald-400 font-black mt-0.5">✓</span>
                              <span className="leading-relaxed">{s}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">強み・カモ情報登録なし</p>
                      )}
                    </div>
                  </div>

                  {/* 天敵（不利・カウンター・マストBAN） */}
                  <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert size={16} className="text-rose-400" />
                        <h3 className="text-sm font-black text-rose-300">
                          🔴 不利・天敵 ＆ マストBAN推奨
                        </h3>
                      </div>

                      {/* マストBAN */}
                      {selectedDetail.facts?.mustBan && selectedDetail.facts.mustBan.length > 0 && (
                        <div className="bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/50 text-rose-200">
                          <span className="font-black block text-[10px] text-rose-400 uppercase mb-0.5">🚨 マストBAN推奨</span>
                          <span className="font-bold leading-relaxed">{selectedDetail.facts.mustBan.join(" / ")}</span>
                        </div>
                      )}

                      {/* 警戒すべきカウンタータイプ */}
                      {selectedDetail.facts?.counters && selectedDetail.facts.counters.length > 0 && (
                        <div className="space-y-1.5">
                          {selectedDetail.facts.counters.map((c, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-zinc-950 p-2.5 rounded-xl border border-rose-500/20 text-zinc-300 leading-relaxed">
                              <span className="text-rose-400 font-black mt-0.5">✕</span>
                              <span className="leading-relaxed">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 弱点・脆さ */}
                      {selectedDetail.facts?.weaknesses && selectedDetail.facts.weaknesses.length > 0 && (
                        <div className="mt-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80 text-zinc-400 text-[11px] leading-relaxed">
                          <span className="text-amber-400 font-bold block mb-0.5">⚠️ 立ち回りの注意点・弱点</span>
                          {selectedDetail.facts.weaknesses.join(" ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Matchup Sentinel 657件 対面相性メモ一覧 */}
                {selectedDetail.matchups && selectedDetail.matchups.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
                        <Swords size={16} className="text-amber-400" />
                        個別対面相性メモ ({selectedDetail.matchups.length}件)
                      </h3>
                      <span className="text-[10px] text-zinc-500">チャレンジャー実戦ログ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {selectedDetail.matchups.map((m) => (
                        <div key={m.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-black text-amber-400 text-xs">vs {m.enemy}</span>
                            {m.result && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-bold">
                                {m.result}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {m.note}
                          </p>
                          {m.trap && (
                            <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/20 p-1.5 rounded border border-rose-500/20">
                              ⚠️ 罠: {m.trap}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* タブ 3: 実戦バイブル ＆ 統合マスター戦術書 */}
            {activeTab === "bible" && (
              <div className="space-y-5">
                {/* 👑 統合戦術マスター教本 (enemy=GLOBAL 由来の原本全文) */}
                {selectedDetail.globalGuide && selectedDetail.globalGuide.strategy && (
                  <div className="bg-gradient-to-b from-amber-950/20 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          <Crown size={20} className="text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              👑 統合戦術マスター教本
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              約{selectedDetail.globalGuide.strategy.length.toLocaleString()}文字
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-black text-zinc-100 mt-1">
                            {selectedDetail.globalGuide.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <button
                          onClick={() => {
                            if (!selectedDetail.globalGuide?.strategy) return;
                            navigator.clipboard.writeText(selectedDetail.globalGuide.strategy);
                            setGlobalGuideCopied(true);
                            setTimeout(() => setGlobalGuideCopied(false), 2000);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition cursor-pointer"
                          title="教本全文をクリップボードにコピー"
                        >
                          {globalGuideCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          <span>{globalGuideCopied ? "コピー完了" : "教本をコピー"}</span>
                        </button>

                        <Link
                          href={`/admin/dict-maintenance?c=${encodeURIComponent(selectedDetail.id)}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 transition shadow-sm"
                          title="この教本を編集・節管理"
                        >
                          <Edit3 size={13} />
                          <span className="hidden sm:inline">メンテ編集 ↗</span>
                        </Link>
                      </div>
                    </div>

                    {/* 教本本文（折りたたみ・展開） */}
                    <div className="mt-4 relative">
                      <div
                        className={`text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap transition-all duration-300 ${
                          !isGlobalGuideExpanded ? "max-h-56 overflow-hidden mask-bottom" : ""
                        }`}
                      >
                        {selectedDetail.globalGuide.strategy}
                      </div>

                      {!isGlobalGuideExpanded && (
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent flex items-end justify-center pb-2 pointer-events-none">
                          <button
                            onClick={() => setIsGlobalGuideExpanded(true)}
                            className="pointer-events-auto px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg hover:shadow-amber-500/20 transition cursor-pointer flex items-center gap-2"
                          >
                            <span>📖 統合マスター教本を全文展開（約{selectedDetail.globalGuide.strategy.length.toLocaleString()}文字）</span>
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      )}

                      {isGlobalGuideExpanded && (
                        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex justify-center">
                          <button
                            onClick={() => setIsGlobalGuideExpanded(false)}
                            className="px-4 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold text-xs border border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <span>▲ 教本を折りたたむ</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 🎬 最新再蒸留：実戦動画 プロの思考録 (Video Bibles) */}
                {selectedDetail.videoBibles && selectedDetail.videoBibles.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Video size={18} className="text-rose-400" />
                        <h3 className="text-sm sm:text-base font-black text-zinc-100">
                          🎬 実戦動画 プロの思考録・生々しいWhy ({selectedDetail.videoBibles.length}本収録)
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/library?q=${encodeURIComponent(selectedDetail.id)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition shadow-sm"
                          title="ライブラリ全952件からこのチャンピオンの記事・動画を検索"
                        >
                          <BookOpen size={13} />
                          <span>📚 ライブラリで全件検索 ↗</span>
                        </Link>
                        <span className="hidden sm:inline-block text-[11px] text-zinc-400 font-bold bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                          YouTube高レート実戦から蒸留
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selectedDetail.videoBibles.map((vb, idx) => (
                        <div
                          key={vb.id || idx}
                          className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 relative overflow-hidden"
                        >
                          {/* 動画タイトル ＆ リンク */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-black">
                                #{idx + 1}
                              </span>
                              <h4 className="text-xs sm:text-sm font-black text-zinc-200">
                                {vb.videoTitle || vb.title}
                              </h4>
                            </div>
                            {vb.videoUrl && (
                              <a
                                href={vb.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 hover:text-rose-300 border border-zinc-700 text-xs font-bold transition w-fit"
                              >
                                <span>YouTubeで動画を見る</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          {/* 📌 キラーエピソード（特大名言カード） */}
                          {vb.killerQuote && (
                            <div className="bg-gradient-to-r from-amber-950/30 via-zinc-950/60 to-zinc-950/30 border-l-4 border-amber-500 p-3.5 rounded-r-xl space-y-1">
                              <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                                📌 実戦で使えるプロのキラー思考（Whyの言語化）
                              </span>
                              <p className="text-xs sm:text-sm text-zinc-200 font-medium leading-relaxed italic">
                                {vb.killerQuote}
                              </p>
                            </div>
                          )}

                          {/* 5大極意グリッド（言及がある項目のみ表示） */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {vb.keyTactics.cameraWork && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-sky-400 flex items-center gap-1 uppercase">
                                  <Eye size={12} /> モンスター狩り中のカメラワーク
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.cameraWork}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.waveRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 uppercase">
                                  <Waves size={12} /> ガンク後のウェーブ介入ルール
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.waveRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.smiteRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-amber-400 flex items-center gap-1 uppercase">
                                  <Zap size={12} /> スマイト50/50回避の鉄則
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.smiteRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.comebackRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-purple-400 flex items-center gap-1 uppercase">
                                  <Sparkles size={12} /> 劣勢・崩壊時の逆転シナリオ
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.comebackRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.shadowRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-indigo-400 flex items-center gap-1 uppercase">
                                  <Compass size={12} /> 14分以降の中盤シャドウ（迷子防止）
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.shadowRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.muteRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-rose-400 flex items-center gap-1 uppercase">
                                  🤫 冷徹なオペレーターメンタル（ミュート基準）
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.muteRule}
                                </p>
                              </div>
                            )}

                            {vb.keyTactics.pingsRule && (
                              <div className="bg-zinc-950/80 border border-zinc-800/80 p-3 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-teal-400 flex items-center gap-1 uppercase">
                                  📢 味方を動かすピン誘導術
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {vb.keyTactics.pingsRule}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* 思考トリガー */}
                          {vb.thoughtTrigger && (
                            <div className="bg-zinc-950/50 border border-zinc-800/60 p-2.5 rounded-xl text-[11px] text-zinc-400 flex items-center gap-2">
                              <span className="text-amber-400 font-black shrink-0">💡 思考トリガー:</span>
                              <span className="text-zinc-300 italic">{vb.thoughtTrigger}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 📒 プロ・チャレンジャー実戦思考録（最新ナレッジ連携） */}
                {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-amber-400" />
                        <h3 className="text-sm sm:text-base font-black text-zinc-100">
                          🧠 プロ・チャレンジャー実戦思考録（最新ナレッジ: {selectedDetail.libraryKnowledge.length}件）
                        </h3>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-bold bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                        個人ナレッジ連動
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedDetail.libraryKnowledge.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => openKnowledgeModal(item.id)}
                          className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer group flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-black text-zinc-200 group-hover:text-amber-400 transition leading-snug">
                                {item.title}
                              </h4>
                              {item.sourceUrl && (
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-zinc-500 hover:text-amber-400 shrink-0 p-1 rounded hover:bg-zinc-800"
                                  title="元ソースを開く"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>

                            {/* 📺 チャンネル ＆ 文字数バッジ */}
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 flex-wrap">
                              {item.channel && item.channel !== "その他・一般" && (
                                <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 font-bold border border-zinc-800">
                                  📺 {item.channel}
                                </span>
                              )}
                              {item.charCount && item.charCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-zinc-900 text-amber-400 font-mono border border-zinc-800 font-bold">
                                  約{item.charCount.toLocaleString()}字
                                </span>
                              )}
                            </div>

                            {item.snippet && (
                              <p className="text-[11px] text-zinc-400 leading-relaxed font-mono line-clamp-3">
                                {item.snippet}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-900 text-[10px]">
                            <span className="text-zinc-500">{item.tags?.slice(0, 3).map(t => `#${t}`).join(' ')}</span>
                            <span className="text-amber-400 font-bold group-hover:translate-x-0.5 transition">詳細を読む →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (!selectedDetail.videoBibles || selectedDetail.videoBibles.length === 0) ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <BookOpen size={16} className="text-zinc-400" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-zinc-200">
                          ライブラリから {selectedDetail.jpName} の過去記事・動画を探す
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          全952件のナレッジアーカイブから関連戦術を逆引き検索できます
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/library?q=${encodeURIComponent(selectedDetail.id)}`}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                    >
                      <Search size={13} />
                      <span>ライブラリで検索 ↗</span>
                    </Link>
                  </div>
                ) : null}

                {/* ⚠️ 絶対地雷行動（トラップ） */}
                {selectedDetail.bible?.traps && selectedDetail.bible.traps.length > 0 && (
                  <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-rose-400 mb-2 flex items-center gap-2">
                      <AlertTriangle size={16} /> ⚠️ やってはいけない絶対地雷行動（即負けトラップ）
                    </h3>
                    <ul className="space-y-2 text-xs">
                      {selectedDetail.bible.traps.map((t, idx) => (
                        <li key={idx} className="bg-rose-950/20 border border-rose-500/30 p-2.5 rounded-xl text-rose-200 flex items-start gap-2">
                          <span className="text-rose-400 font-black">【地雷】</span>
                          <span className="leading-relaxed">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3段階手順（序盤・中盤・終盤） */}
                {(selectedDetail.bible?.stages || stageTactics) && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-zinc-100 mb-3 flex items-center gap-2">
                      <Layers size={16} className="text-amber-400" /> ゲーム展開 3段階手順書
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-amber-400 block mb-1">【序盤・レーン戦】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible?.stages?.early || stageTactics?.early || "Lv2/3先行で有利トレード。"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-emerald-400 block mb-1">【中盤・オブジェクト】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible?.stages?.mid || stageTactics?.mid || "1コア完成でドラゴン・ヘラルド主導。"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-cyan-400 block mb-1">【終盤・集団戦】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible?.stages?.late || stageTactics?.late || "側面・後方からキャリーにCC合わせ。"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Markdown戦術バイブル全文 */}
                {selectedDetail.bible?.rawMarkdown && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-zinc-100 mb-2 flex items-center gap-2">
                      <BookOpen size={16} className="text-amber-400" /> 実戦バイブル原本全文
                    </h3>
                    <div className="p-4 rounded-xl bg-zinc-950 text-xs text-zinc-300 leading-relaxed border border-zinc-800 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {selectedDetail.bible.rawMarkdown}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* タブ 4: 📒 ライブラリ攻略知見 (個人ナレッジ連動) */}
            {activeTab === "library" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-zinc-100 flex items-center gap-2">
                        <span>📒 {selectedDetail.jpName} の実戦ナレッジ・攻略知見</span>
                        {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                            {selectedDetail.libraryKnowledge.length}件
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        ライブラリ（personal_knowledge）から自動抽出された、OTP極意・負け筋回避・立ち回りメモ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsIngestOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>知見を追加</span>
                    </button>
                    <Link
                      href={`/library?q=${encodeURIComponent(selectedDetail.jpName)}`}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink size={13} />
                      <span>ライブラリで全体検索</span>
                    </Link>
                  </div>
                </div>

                {selectedDetail.libraryKnowledge && selectedDetail.libraryKnowledge.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {selectedDetail.libraryKnowledge.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => openKnowledgeModal(item.id)}
                        className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-amber-500/60 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3 transition group cursor-pointer"
                        title="クリックしてこの知見の全文・詳細を読む"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-black text-zinc-200 group-hover:text-amber-400 transition leading-snug">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {item.sourceUrl && (
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-500 hover:text-amber-400 transition p-1.5 rounded-lg hover:bg-zinc-800"
                                  title="元動画・元ソースを開く"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              <Link
                                href={`/library?id=${item.id}`}
                                className="text-zinc-500 hover:text-indigo-400 transition p-1.5 rounded-lg hover:bg-zinc-800"
                                title="ライブラリ専用ページで開く"
                              >
                                <BookOpen size={13} />
                              </Link>
                            </div>
                          </div>

                          {item.snippet && (
                            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-900 font-mono whitespace-pre-wrap group-hover:border-zinc-800 transition">
                              {item.snippet}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
                          <div className="flex flex-wrap items-center gap-1">
                            {item.tags?.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openKnowledgeModal(item.id);
                            }}
                            className="text-[11px] font-bold text-amber-400 group-hover:text-amber-300 flex items-center gap-1 ml-auto hover:underline cursor-pointer"
                          >
                            <span>詳細を読む</span>
                            <span>→</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-500">
                      <BookOpen size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-300">
                        {selectedDetail.jpName} に関する直接紐づく知見はまだありません
                      </h4>
                      <p className="text-xs text-zinc-500 max-w-md mx-auto">
                        実戦動画やノートから得たOTPの立ち回り・負け筋メモを取込ボタンから追加すると、ここに即座に反映されます。
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => setIsIngestOpen(true)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>{selectedDetail.jpName}の知見をインポート</span>
                      </button>
                      <Link
                        href={`/library?q=${encodeURIComponent(selectedDetail.jpName)}`}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition flex items-center gap-1.5"
                      >
                        <Search size={14} />
                        <span>ライブラリ全件から検索</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================
             👑 チャンピオン一覧 (エイリアス検索・お気に入り対応)
             ========================================================= */
          <div className="space-y-3">
            {/* 検索 ＆ フィルターバー */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-sm relative">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                <div className="relative w-full sm:w-80">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="チャンピオン検索 (日本語 / 英語 / 略称: tf, mf, ww...)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* お気に入りのみトグル */}
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 ${
                    showFavoritesOnly
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  }`}
                  title="お気に入りのみ表示"
                >
                  <Star size={13} fill={showFavoritesOnly ? "currentColor" : "none"} className={showFavoritesOnly ? "text-amber-400" : ""} />
                  <span className="hidden sm:inline">お気に入り</span>
                  {favorites.length > 0 && (
                    <span className="text-[10px] px-1 rounded bg-zinc-800 font-mono text-zinc-300">
                      {favorites.length}
                    </span>
                  )}
                </button>

                {/* 🎯 対面相性チェッカートグル */}
                <button
                  onClick={() => setShowMatchupPicker(!showMatchupPicker)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 shadow-sm ${
                    showMatchupPicker
                      ? "bg-rose-500 text-white border-rose-400 shadow-rose-500/20"
                      : "bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/50"
                  }`}
                  title="相手JGを選択して最適ピックを逆引き"
                >
                  <Target size={14} />
                  <span>🎯 対面チェッカー</span>
                </button>

                {/* ⚙️ ツール・管理メニュー起動ボタン（一覧側） */}
                <button
                  type="button"
                  onClick={() => setIsToolModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer shrink-0 shadow-sm"
                  title="知見取込・レーン設定・アイテム辞書・管理メニュー"
                >
                  <Wrench size={13} className="text-amber-400" />
                  <span>ツール</span>
                </button>
              </div>

              {/* ロールタブ ＆ ソートセレクター */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                  {["ALL", "TOP", "JG", "MID", "ADC", "SUP"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        roleFilter === r
                          ? "bg-amber-500 text-zinc-950 shadow-sm font-black scale-102"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 shrink-0">
                  <span className="text-[11px] font-bold text-zinc-400 pl-1.5 hidden sm:inline">⇅ 並び替え:</span>
                  <select
                    value={champSort}
                    onChange={(e) => setChampSort(e.target.value as any)}
                    className="bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="tier">👑 ティア順 (OP.GG)</option>
                    <option value="name_ja">🔤 名前順 (五十音)</option>
                    <option value="name_en">🔤 英語名 (A-Z)</option>
                    <option value="win_rate">📈 勝率順</option>
                    <option value="knowledge">📚 ナレッジ数順</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 一覧カウンター */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>全 <strong className="text-zinc-200">{filteredChampions.length}</strong> 体</span>
              <span>通称エイリアス・お気に入り・レーン所属カスタム対応</span>
            </div>

            {/* コンパクトなチャンピオンカードグリッド */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredChampions.map((c) => {
                const isFav = favorites.includes(c.id);
                const cardRole = roleFilter !== "ALL" ? (roleFilter === "BOT" ? "ADC" : roleFilter) : (c.roles[0] === "BOT" ? "ADC" : c.roles[0] || "TOP");
                const cardMeta = opggMeta?.lanes?.[cardRole]?.[c.id];

                return (
                  <div
                    key={c.id}
                    onClick={() => selectChampion(c.id)}
                    className="group relative rounded-xl bg-zinc-900 border border-zinc-800/80 hover:border-amber-500/50 p-2 flex items-center gap-2.5 transition cursor-pointer hover:shadow-md hover:bg-zinc-850"
                  >
                    {/* コンパクトなアイコン画像 (w-9 h-9) */}
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-zinc-700/80 shrink-0">
                      <img
                        src={getChampIcon(c.id)}
                        alt={c.jpName}
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                        loading="lazy"
                      />
                      {c.hasBible && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-zinc-950" title="バイブルあり" />
                      )}
                    </div>

                    {/* チャンピオン情報 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-zinc-100 truncate group-hover:text-amber-400 transition">
                          {c.jpName}
                        </span>
                        {/* お気に入り星ボタン */}
                        <button
                          onClick={(e) => toggleFavorite(c.id, e)}
                          aria-label={isFav ? "お気に入りを解除" : "お気に入りに追加"}
                          className={`p-1 rounded hover:scale-110 transition shrink-0 cursor-pointer ${
                            isFav ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Star size={13} fill={isFav ? "currentColor" : "none"} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-[10px] text-zinc-500 font-mono truncate">
                          {c.id}
                        </span>
                        {/* レーンバッジ（クリックでクイックメンテ可能） */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusedLaneChampId(c.id);
                            setIsLaneModalOpen(true);
                          }}
                          className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-300 border border-zinc-800 hover:border-amber-500/50 hover:text-amber-400 transition shrink-0 cursor-pointer flex items-center gap-0.5 font-bold"
                          title={`${c.jpName}のレーン所属を編集`}
                        >
                          <span>{c.roles[0] || "TOP"}</span>
                          {c.roles.length > 1 && (
                            <span className="text-[8px] text-zinc-500">+{c.roles.length - 1}</span>
                          )}
                        </button>
                      </div>

                      {/* OP.GGメタ指標 ＆ サブロール ＆ AIコーチ */}
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-800/40 text-[9px] gap-1">
                        {cardMeta ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`px-1 py-0.2 rounded font-black text-[9px] ${
                                cardMeta.tierNum === 0 || cardMeta.tierNum === 1
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : cardMeta.tierNum === 2
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                              }`}
                            >
                              {cardMeta.tier === "OP" ? "OP" : `T${cardMeta.tierNum}`}
                            </span>
                            <span className="text-[9px] text-zinc-400 font-medium">
                              {cardMeta.winRate}%
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 overflow-hidden">
                            {c.roles.slice(1).map((r) => (
                              <span key={r} className="text-[8px] px-1 rounded bg-zinc-800/80 text-zinc-400 font-mono">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                        <Link
                          href={`/coach?my=${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-1.5 py-0.2 rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 font-sans font-bold hover:scale-105 transition text-[10px] ml-auto flex items-center gap-0.5 shrink-0"
                          title={`${c.jpName}のAI戦術コーチを開く`}
                        >
                          <span>🤖</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedKnowledgeId(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-950/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <BookOpen size={18} />
                </div>
                <h3 className="text-sm sm:text-base font-black text-zinc-100 truncate">
                  {knowledgeDetail?.title || "攻略知見の詳細"}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href={`/library?id=${selectedKnowledgeId}`}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition flex items-center gap-1"
                  title="ライブラリ専用ページで開く"
                >
                  <ExternalLink size={12} />
                  <span className="hidden sm:inline">ライブラリで開く</span>
                </Link>
                <button
                  onClick={() => setSelectedKnowledgeId(null)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* モーダル本文 */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
              {knowledgeLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-amber-400">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-zinc-400 font-bold">知見を読み込み中...</span>
                </div>
              ) : knowledgeDetail ? (
                <>
                  {/* メタ情報バー */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {knowledgeDetail.tags?.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    {knowledgeDetail.source_url && (
                      <a
                        href={knowledgeDetail.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition"
                      >
                        <span>元ソース・動画を見る</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  {/* 本文コピーボタン */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const body = knowledgeDetail.content || knowledgeDetail.raw_content || "";
                        navigator.clipboard.writeText(`# ${knowledgeDetail.title}\n\n${body}`).then(() => {
                          setKnowledgeCopied(true);
                          setTimeout(() => setKnowledgeCopied(false), 2000);
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition cursor-pointer"
                    >
                      {knowledgeCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{knowledgeCopied ? "コピー完了！" : "本文をコピー"}</span>
                    </button>
                  </div>

                  {/* 本文 */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap text-xs sm:text-sm">
                    {knowledgeDetail.content || knowledgeDetail.raw_content || "本文がありません"}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-zinc-500">知見の取得に失敗しました。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ ツール・管理クイックパレット モーダル（中央表示・完全非見切れUI） */}
      {isToolModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsToolModalOpen(false)}
        >
          <div
            className="bg-[#141418] border border-zinc-700/90 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                  <Wrench size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-zinc-100">
                      ツール ＆ 管理パレット
                    </h3>
                    {selectedDetail && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        {selectedDetail.jpName}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    戦術取込・レーン設定・辞書・全体管理
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsToolModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* パレットアクション一覧 */}
            <div className="p-4 sm:p-5 space-y-2.5">
              {/* 1. 知見取込 */}
              <button
                type="button"
                onClick={() => {
                  setIsToolModalOpen(false);
                  setIsIngestOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition shrink-0">
                  <Plus size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-zinc-200 group-hover:text-amber-300 transition">
                    {selectedDetail ? `📥 ${selectedDetail.jpName} の戦術知見を取込` : "📥 新規戦術の知見取込"}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    メモや動画URLからAIが戦術を自動分析・抽出
                  </p>
                </div>
              </button>

              {/* 2. 所属レーン編集 */}
              <button
                type="button"
                onClick={() => {
                  setIsToolModalOpen(false);
                  setFocusedLaneChampId(selectedDetail ? selectedDetail.id : undefined);
                  setIsLaneModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition shrink-0">
                  <Wrench size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-zinc-200 group-hover:text-amber-300 transition">
                    {selectedDetail ? `🛠️ ${selectedDetail.jpName} の所属レーン編集` : "🛠️ 所属レーン編集"}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    TOP / JG / MID / ADC / SUP の所属設定を変更
                  </p>
                </div>
              </button>

              {/* 3. アイテム翻訳辞書 */}
              <button
                type="button"
                onClick={() => {
                  setIsToolModalOpen(false);
                  setDictFocusKey(undefined);
                  setDictFocusValue(undefined);
                  setIsItemDictModalOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition shrink-0">
                  <BookOpen size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-zinc-200 group-hover:text-amber-300 transition">
                    📖 アイテム翻訳辞書
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    英語・略称 ➔ 日本語アイテム名の対応辞書を管理
                  </p>
                </div>
              </button>

              <div className="border-t border-zinc-800/80 my-1" />

              {/* 4. 辞典メンテナンス管理 */}
              <Link
                href={selectedDetail ? `/admin/dict-maintenance?c=${encodeURIComponent(selectedDetail.id)}` : "/admin/dict-maintenance"}
                onClick={() => setIsToolModalOpen(false)}
                className="w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-left transition flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shrink-0">
                  <Layers size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <span>⚙️ 辞典メンテナンス管理</span>
                    <ExternalLink size={12} className="opacity-80" />
                  </div>
                  <p className="text-[11px] text-amber-400/80 mt-0.5 truncate">
                    チャンピオン事実・対面相性・本文の直接編集
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
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
