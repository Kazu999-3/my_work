// チャンピオン辞典（app/page.tsx と app/_champions/*）で共有する型。2026-10-07 page.tsx から分離

export interface ChampionSummary {
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

export interface MatchupItem {
  id: string;
  enemy: string;
  note: string;
  result?: string;
  trap?: string;
}

export interface ChampionDetail {
  /** JGのタイミング実測（compile_champions.mjs が付与） */
  jungleTiming?: JungleTiming | null;
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
    /** 項目ごとの出典付き記述（champion_fact_claims）。無い項目は従来の文字列だけを表示する */
    claims?: Partial<Record<'strengths' | 'weaknesses' | 'counters' | 'mustBan' | 'powerSpikes', FactClaim[]>>;
    /** 実測ビルド（champion_build_samples の集計）。キーは TOP/JG/MID/BOT/SUP */
    measuredBuilds?: Partial<Record<string, MeasuredBuild>>;
    /** 試合時間帯別の勝率（ロール別、migration 92） */
    measuredSpikes?: Partial<Record<string, MeasuredSpikes>>;
    /** おすすめアイテム・ルーンの根拠になった検索結果の件数（0 なら出典なしの AI 推定） */
    buildSourceCount?: number;
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

export interface LibraryKnowledgeItem {
  id: string | number;
  title: string;
  snippet: string;
  tags?: string[];
  sourceUrl?: string;
  createdAt?: string;
  channel?: string;
  charCount?: number;
}

export interface VideoBibleItem {
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

/** 詳細タブ（URL の ?t= に保存） */
export type DetailTab = "build" | "matchup" | "bible" | "library";

export type ChampSort = "tier" | "name_ja" | "name_en" | "win_rate" | "knowledge";

export type BuildPreset = "standard" | "tank" | "burst";

/** 攻略知見の詳細ポップアップで表示する記事 */
export interface KnowledgeDetail {
  id: string | number;
  title: string;
  content?: string;
  raw_content?: string;
  source_url?: string;
  tags?: string[];
  created_at?: string;
}

/** 辞典の記述1件と、その出典 */
export interface FactClaim {
  text: string;
  origin: 'library' | 'library_mixed' | 'web_search' | 'manual' | 'ai_estimate';
  sourceTitle?: string;
  sourceUrl?: string;
  needsReview: boolean;
  date: string;
}

/** 実測ビルド（直近30日・同じロールの試合から集計。rate は %） */
/** 序盤・中盤・終盤（25分未満 / 25〜32分 / 32分以上で終わった試合）の勝率 */
/** JGのタイミング実測（champion_jungle_timing_agg。最速クリアは junglepedia、コア完成は収集した試合の平均） */
export interface JungleTiming {
  sampleCount?: number | null;
  avgFirstCoreSec?: number | null;
  avgSecondCoreSec?: number | null;
  tier?: string | null;
  fastestClearSec?: number | null;
}

export interface MeasuredSpikes {
  early: { games: number; winRate: number };
  mid: { games: number; winRate: number };
  late: { games: number; winRate: number };
}

export interface MeasuredBuild {
  samples: number;
  winRate: number;
  core: { name: string; rate: number }[];
  boots?: { name: string; rate: number };
  keystone?: { name: string; rate: number };
  primaryStyle?: string;
  subStyle?: string;
  perks: string[];
  perksRate?: number;
  skillOrder?: string[];
  skillRate?: number;
  patches: string[];
  tiers: string[];
}
