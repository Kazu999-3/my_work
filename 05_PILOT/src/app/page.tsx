"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
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
  X, Check, Flame, Sparkles, Plus, Download, Bot, Target, ExternalLink, Video, Eye, Waves, Compass, Wrench, Edit3
} from "lucide-react";
import KnowledgeIngestModal from "@/components/KnowledgeIngestModal";
import { MatchupPicker } from "@/components/MatchupPicker";
import LaneMaintenanceModal from "@/components/LaneMaintenanceModal";
import ItemDictionaryModal from "@/components/ItemDictionaryModal";
import { translateItem } from "@/lib/itemTranslator";

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

  const [activeTab, setActiveTab] = useState<"build" | "matchup" | "bible">("build");
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

  // 📥 戦術取込モーダル状態
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // localStorage からお気に入り、カスタムレーン設定、アイテム辞書を読み込み
  useEffect(() => {
    try {
      const storedFav = localStorage.getItem("pilot_fav_champions");
      if (storedFav) {
        setFavorites(JSON.parse(storedFav));
      }
      const storedRoles = localStorage.getItem("pilot_custom_roles");
      if (storedRoles) {
        setCustomRoles(JSON.parse(storedRoles));
      }
      const storedItemDict = localStorage.getItem("pilot_custom_item_dict");
      if (storedItemDict) {
        setCustomItemDict(JSON.parse(storedItemDict));
      }
    } catch {}

    // サーバーからも最新のカスタムレーン設定をバックグラウンド取得
    fetch("/api/champions/roles")
      .then((res) => res.json())
      .then((data) => {
        if (data?.customRoles && Object.keys(data.customRoles).length > 0) {
          setCustomRoles((prev) => {
            const merged = { ...prev, ...data.customRoles };
            try {
              localStorage.setItem("pilot_custom_roles", JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});

    // サーバーからも最新のアイテム辞書設定をバックグラウンド取得
    fetch("/api/items/dictionary")
      .then((res) => res.json())
      .then((data) => {
        if (data?.dictionary && Object.keys(data.dictionary).length > 0) {
          setCustomItemDict((prev) => {
            const merged = { ...prev, ...data.dictionary };
            try {
              localStorage.setItem("pilot_custom_item_dict", JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
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

  // 選択中チャンピオンのロール
  const [currentRole, setCurrentRole] = useState<string>("TOP");
  useEffect(() => {
    if (selectedDetail) {
      const roles = selectedDetail.tags || [];
      if (roles.includes("Fighter")) setCurrentRole("TOP");
      else if (roles.includes("Assassin")) setCurrentRole("MID");
      else if (roles.includes("Mage")) setCurrentRole("MID");
      else if (roles.includes("Marksman")) setCurrentRole("BOT");
      else if (roles.includes("Support")) setCurrentRole("SUP");
      else if (roles.includes("Tank")) setCurrentRole("TOP");
    }
  }, [selectedDetail]);

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
    return getPresetBuildDetails(archetype, buildPreset, trendItems, trendKeystone, customItemDict);
  }, [archetype, buildPreset, selectedDetail, customItemDict]);

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

  // チャンピオン一覧フィルタ（通称エイリアス辞書 ＆ お気に入り ＆ カスタムレーン対応）
  const filteredChampions = useMemo(() => {
    return displayChampions.filter((c) => {
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
  }, [displayChampions, search, roleFilter, showFavoritesOnly, favorites]);

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
            <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-xs"
                style={{ backgroundImage: `url(${getChampSplash(selectedDetail.id)})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />

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
                      {selectedDetail.facts?.tier && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                          Tier: {selectedDetail.facts.tier}
                        </span>
                      )}
                      {selectedDetail.facts?.winRate && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                          勝率: {selectedDetail.facts.winRate}%
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

                  {/* 📒 攻略ライブラリ記事へジャンプ */}
                  <Link
                    href={`/library?q=${encodeURIComponent(selectedDetail.jpName)}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition"
                    title="このチャンピオンのプロ解説・チャレンジャー記事を検索"
                  >
                    <BookOpen size={14} className="text-amber-400" />
                    <span>📒 解説記事</span>
                  </Link>

                  {/* CD早見表トグル */}
                  <button
                    onClick={() => setShowCdTable(!showCdTable)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition cursor-pointer"
                  >
                    <Timer size={14} className="text-amber-400" />
                    <span>{showCdTable ? "CD表を閉じる" : "全スキルCD表"}</span>
                    {showCdTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* 📥 このチャンピオンの知見を取込 */}
                  <button
                    onClick={() => setIsIngestOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/40 transition cursor-pointer"
                    title={`${selectedDetail.jpName}のメモ・URLを取込`}
                  >
                    <Plus size={14} />
                    <span>知見取込</span>
                  </button>

                  {/* 🛠️ 所属レーン編集 */}
                  <button
                    onClick={() => {
                      setFocusedLaneChampId(selectedDetail.id);
                      setIsLaneModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition cursor-pointer"
                    title={`${selectedDetail.jpName}の所属レーン（TOP/JG/MID/ADC/SUP）を編集`}
                  >
                    <Wrench size={14} className="text-amber-400" />
                    <span>レーンメンテ</span>
                  </button>

                  {/* レーンセレクター */}
                  <div className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 font-bold px-1.5">レーン:</span>
                    {["TOP", "JG", "MID", "BOT", "SUP"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setCurrentRole(r)}
                        className={`px-2 py-0.5 rounded-lg text-xs font-black transition cursor-pointer ${
                          currentRole === r
                            ? "bg-amber-500 text-zinc-950 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
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
                              {selectedDetail.bible?.killCombo || selectedDetail.facts?.strengths?.[0] || 'Lv6からのバーストコンボで有利獲得'}
                            </p>
                          </div>

                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">⚡ 自分のパワースパイク</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {selectedDetail.facts?.powerSpikes ? selectedDetail.facts.powerSpikes.split('\n')[0] : '1stコア完成時に最大スパイク'}
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
                                : 'スキル空振り後のCD中、および低マナ時の仕掛けが有効。'}
                            </p>
                          </div>

                          {/* 相手のパワースパイク・警戒タイミング */}
                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-amber-400 block mb-0.5">💥 相手のパワースパイク・警戒タイミング</span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {vsEnemyDetail.facts?.powerSpikes ? vsEnemyDetail.facts.powerSpikes.split('\n')[0] : 'Lv6ウルト取得時および主要1コア完成時に警戒。'}
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
                        {currentRole === "JG" ? "🌲 JG周回実戦基準" :
                         currentRole === "SUP" ? "🛡️ SUP視界・初動指標" :
                         currentRole === "TOP" ? "⚔️ TOPウェーブ管理指標" :
                         currentRole === "MID" ? "⚡ MIDローム・テンポ指標" :
                         "🏹 BOT/ADC指標"}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold border border-zinc-700">
                        {currentRole}標準
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {currentRole === "JG" ? "2026仕様: キャンプ0:55湧き / カニ2:55争奪" :
                       currentRole === "SUP" ? "Lv2先行プッシュ ＆ 視界スコア目標" :
                       currentRole === "TOP" ? "1stリコール目標 ＆ フリーズ基準" :
                       currentRole === "MID" ? "キャノン押し込み ＆ オブジェクト寄り" :
                       "1stコア目標 ＆ CSレート"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  {currentRole === "JG" ? (
                    <>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">フルクリア</span>
                        <span className="text-xs font-black text-amber-400 font-mono">03:10</span>
                      </div>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">1stコア平均</span>
                        <span className="text-xs font-black text-emerald-400 font-mono">11:20</span>
                      </div>
                    </>
                  ) : currentRole === "TOP" ? (
                    <>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">1stリコール</span>
                        <span className="text-xs font-black text-amber-400 font-mono">1,200G</span>
                      </div>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">フリーズ維持</span>
                        <span className="text-xs font-black text-emerald-400 font-mono">タワー前4体</span>
                      </div>
                    </>
                  ) : currentRole === "SUP" ? (
                    <>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">Lv2先行</span>
                        <span className="text-xs font-black text-amber-400 font-mono">2波目前衛3体</span>
                      </div>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">目標視界(20分)</span>
                        <span className="text-xs font-black text-cyan-400 font-mono">45+ スコア</span>
                      </div>
                    </>
                  ) : currentRole === "MID" ? (
                    <>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">ローム優先時</span>
                        <span className="text-xs font-black text-amber-400 font-mono">キャノン波後</span>
                      </div>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">パワースパイク</span>
                        <span className="text-xs font-black text-rose-400 font-mono">Lv6 即死</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">1コア目標</span>
                        <span className="text-xs font-black text-emerald-400 font-mono">10:30</span>
                      </div>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">目標CS</span>
                        <span className="text-xs font-black text-amber-400 font-mono">8.5+ /分</span>
                      </div>
                    </>
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
            {selectedDetail.pickGuide && (
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
                          selectedDetail.pickGuide.blindPick?.rating === "S"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : selectedDetail.pickGuide.blindPick?.rating === "A"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        }`}>
                          ランク {selectedDetail.pickGuide.blindPick?.rating || "A"} : {selectedDetail.pickGuide.blindPick?.label || "先出し安定"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {selectedDetail.pickGuide.blindPick?.reason}
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
                        {selectedDetail.pickGuide.counterPick?.situation}
                      </p>
                    </div>
                    {selectedDetail.pickGuide.counterPick?.targets && selectedDetail.pickGuide.counterPick.targets.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-zinc-900">
                        <span className="text-[10px] text-zinc-500">有利:</span>
                        {selectedDetail.pickGuide.counterPick.targets.map((tgt, i) => (
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
                        {selectedDetail.pickGuide.whenToPick?.teamSynergy}
                      </p>
                    </div>
                    {selectedDetail.pickGuide.whenToPick?.winCondition && (
                      <div className="text-[10px] text-zinc-500 bg-zinc-900/60 p-1.5 rounded-lg border border-zinc-900">
                        🎯 勝ち筋: <span className="text-zinc-300">{selectedDetail.pickGuide.whenToPick.winCondition}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. 🧭 3大タブナビゲーション */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto">
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
                      <span className="font-black text-amber-400 block mb-1">Lv1〜3 (序盤レーン戦)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {selectedDetail.facts?.powerSpikes ? selectedDetail.facts.powerSpikes.split('\n')[0] : 'スキルを当てて主導権を取り、Lv2先行でウェーブをフリーズ。'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-emerald-400 block mb-1">1コア〜Lv9 (中盤ローム)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        最も戦闘力が高いパワースパイク。ヘラルド・ドラゴン前にプッシュして視界制圧。
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="font-black text-cyan-400 block mb-1">集団戦 (終盤)</span>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        正面から突っ込まず、側道から敵キャリーにCCを合わせ、耐久を活かして前線を維持。
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
                  {/* カモ（有利） */}
                  <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <h3 className="text-sm font-black text-emerald-300">
                        🟢 有利な相手 (カモ TOP5)
                      </h3>
                    </div>
                    {selectedDetail.facts?.strengths && selectedDetail.facts.strengths.length > 0 ? (
                      <ul className="space-y-1.5 text-xs">
                        {selectedDetail.facts.strengths.map((s, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 text-zinc-300">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-500">強み・カモ情報登録なし</p>
                    )}
                  </div>

                  {/* 天敵（不利・マストBAN） */}
                  <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert size={16} className="text-rose-400" />
                      <h3 className="text-sm font-black text-rose-300">
                        🔴 不利・天敵 (カウンター ＆ マストBAN)
                      </h3>
                    </div>
                    <div className="space-y-2 text-xs">
                      {selectedDetail.facts?.mustBan && selectedDetail.facts.mustBan.length > 0 && (
                        <div className="bg-rose-950/30 p-2 rounded-lg border border-rose-500/40 text-rose-200">
                          <span className="font-bold block text-[10px] text-rose-400 uppercase">マストBAN推奨:</span>
                          <span className="font-bold">{selectedDetail.facts.mustBan.join(" / ")}</span>
                        </div>
                      )}
                      {selectedDetail.facts?.counters && selectedDetail.facts.counters.length > 0 && (
                        <ul className="space-y-1.5">
                          {selectedDetail.facts.counters.map((c, idx) => (
                            <li key={idx} className="flex items-start gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 text-zinc-300">
                              <span className="text-rose-400 font-bold">✕</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
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

            {/* タブ 3: 実戦バイブル ＆ 罠・没理由 */}
            {activeTab === "bible" && (
              <div className="space-y-4">
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

                {/* 動画バイブルがない場合のライブラリ逆引きバナー */}
                {(!selectedDetail.videoBibles || selectedDetail.videoBibles.length === 0) && (
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
                )}

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
                {selectedDetail.bible?.stages && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-black text-zinc-100 mb-3 flex items-center gap-2">
                      <Layers size={16} className="text-amber-400" /> ゲーム展開 3段階手順書
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-amber-400 block mb-1">【序盤・レーン戦】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible.stages.early || "Lv2/3先行で有利トレード。"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-emerald-400 block mb-1">【中盤・オブジェクト】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible.stages.mid || "1コア完成でドラゴン・ヘラルド主導。"}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                        <span className="font-black text-cyan-400 block mb-1">【終盤・集団戦】</span>
                        <p className="text-zinc-300 leading-relaxed text-[11px]">
                          {selectedDetail.bible.stages.late || "側面・後方からキャリーにCC合わせ。"}
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
          </div>
        ) : (
          /* =========================================================
             👑 チャンピオン一覧 (エイリアス検索・お気に入り対応)
             ========================================================= */
          <div className="space-y-3">
            {/* 検索 ＆ フィルターバー */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-zinc-900/90 p-2.5 rounded-2xl border border-zinc-800 shadow-sm">
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

                {/* 🛠️ レーン所属メンテボタン */}
                <button
                  onClick={() => {
                    setFocusedLaneChampId(undefined);
                    setIsLaneModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-950 text-zinc-300 border border-zinc-800 hover:border-amber-500/50 hover:text-amber-400 transition cursor-pointer shrink-0 shadow-sm"
                  title="全チャンピオンの所属レーン（TOP/JG/MID/ADC/SUP）を編集"
                >
                  <Wrench size={13} className="text-amber-400" />
                  <span className="hidden sm:inline">レーン編集</span>
                </button>
              </div>

              {/* ロールタブ */}
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-zinc-950 rounded-xl border border-zinc-800">
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

                      {/* サブロール一覧 ＆ AIコーチ直結（スキルのCD表示は完全排除） */}
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-800/40 text-[9px]">
                        <div className="flex items-center gap-1 overflow-hidden">
                          {c.roles.slice(1).map((r) => (
                            <span key={r} className="text-[8px] px-1 rounded bg-zinc-800/80 text-zinc-400 font-mono">
                              {r}
                            </span>
                          ))}
                        </div>
                        <Link
                          href={`/coach?my=${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-1.5 py-0.2 rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 font-sans font-bold hover:scale-105 transition text-[10px] ml-auto flex items-center gap-0.5"
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
