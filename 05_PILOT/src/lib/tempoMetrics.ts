// レーン別・チャンピオン固有のテンポ指標とパワースパイク動的計算モジュール
import { ChampionArchetype } from "./archetype";

export interface LaneTempoMetrics {
  title: string;        // e.g. "⚡ MIDローム・テンポ指標"
  badge: string;        // e.g. "アサシン (MID)"
  subtitle: string;     // e.g. "序盤キルライン ＆ ローム展開"
  metric1: {
    label: string;
    value: string;
    color: string;
  };
  metric2: {
    label: string;
    value: string;
    color: string;
  };
}

interface ChampionTempoInput {
  id: string;
  jpName?: string;
  archetype: ChampionArchetype;
  role: string;
  spikeValues: { early: number; mid: number; late: number };
  powerSpikesText?: string;
  earlyStageText?: string;
}

/**
 * powerSpikes のテキストから要約バッジ文字列を抽出するヘルパー
 */
function extractSpikeKeyword(text?: string, fallback: string = "1コア完成時"): string {
  if (!text || text.includes("情報不足")) return fallback;

  // 既知の代表的キーワード探索
  if (text.includes("レベル16") || text.includes("Lv16")) return "Lv16 レートキャリー";
  if (text.includes("レベル11") || text.includes("Lv11")) return "Lv11+ 2コア完成";
  if (text.includes("レベル6") || text.includes("Lv6") || text.includes("アルティメット")) return "Lv6 ウルト解禁";
  if (text.includes("レベル3") || text.includes("Lv3") || text.includes("レベル2")) return "Lv2-3 序盤速攻";
  
  // アイテム名検知
  if (text.includes("ライアンドリー")) return "1コア (ライアンドリー)";
  if (text.includes("ロッド・オブ・エイジス") || text.includes("セラフ")) return "2コア (RoA+セラフ)";
  if (text.includes("ルナーン") || text.includes("インフィニティ")) return "2〜3コア (IE完成)";
  if (text.includes("狂風の刃") || text.includes("妖夢")) return "1コア (脅威完成)";
  if (text.includes("トリニティ") || text.includes("サンダード")) return "1コア (パワースパイク)";

  // 短い要約抽出（最初の句点まで）
  const firstSentence = text.split(/[。\n]/)[0].trim();
  if (firstSentence.length > 0 && firstSentence.length <= 16) {
    return firstSentence;
  }

  return fallback;
}

/**
 * 選択中チャンピオンとロールに応じた動的実戦指標を算出
 */
export function getLaneTempoMetrics(input: ChampionTempoInput): LaneTempoMetrics {
  const { id, jpName, archetype, role, spikeValues, powerSpikesText, earlyStageText } = input;
  const champId = (id || "").toLowerCase();
  const normalizedRole = (role || "MID").toUpperCase();
  const spikeSummary = extractSpikeKeyword(powerSpikesText);

  // -------------------------------------------------------------
  // 🌲 JUNGLE (JG)
  // -------------------------------------------------------------
  if (normalizedRole === "JG") {
    // 高速クリア系（ザイラ、カーサスなど、バイブルや実測値あり）
    const isUltraFast = champId === "zyra" || (earlyStageText && earlyStageText.includes("2:25"));
    const isGankHeavy = ["leesin", "elise", "xinzhao", "jarvaniv", "shaco", "reknai", "pantheon"].includes(champId) || spikeValues.early >= 8;
    const isLateFarm = ["karthus", "masteryi", "shyvana", "lillia", "belveth"].includes(champId) || spikeValues.late >= 9;

    if (isUltraFast) {
      return {
        title: "🌲 JG周回実戦基準",
        badge: `${jpName || "チャンプ"} (特化)`,
        subtitle: "2026仕様: キャンプ0:55湧き / 圧倒的先行ルート",
        metric1: {
          label: "最速フルクリア",
          value: "02:25〜02:30",
          color: "text-amber-400",
        },
        metric2: {
          label: "1stコア平均",
          value: "10:45",
          color: "text-emerald-400",
        },
      };
    }

    if (isGankHeavy) {
      return {
        title: "🌲 JG周回実戦基準",
        badge: "ガンク特化 (JG)",
        subtitle: "3キャンプ即ガンク ＆ レーン介入プレッシャー",
        metric1: {
          label: "初動展開",
          value: "Lv3 (02:35〜)",
          color: "text-amber-400",
        },
        metric2: {
          label: "1stコア平均",
          value: "11:00",
          color: "text-emerald-400",
        },
      };
    }

    if (isLateFarm) {
      return {
        title: "🌲 JG周回実戦基準",
        badge: "ファーム型 (JG)",
        subtitle: "6キャンプ最速周回 ＆ カニ争奪（2:55）",
        metric1: {
          label: "最速フルクリア",
          value: "03:10〜03:15",
          color: "text-amber-400",
        },
        metric2: {
          label: "1stリコール",
          value: "フルクリア後",
          color: "text-emerald-400",
        },
      };
    }

    // JG標準
    return {
      title: "🌲 JG周回実戦基準",
      badge: "JG標準",
      subtitle: "2026仕様: キャンプ0:55湧き / カニ2:55争奪",
      metric1: {
        label: "最速フルクリア",
        value: "02:45〜02:50",
        color: "text-amber-400",
      },
      metric2: {
        label: "1stコア平均",
        value: "11:20",
        color: "text-emerald-400",
      },
    };
  }

  // -------------------------------------------------------------
  // ⚡ MID
  // -------------------------------------------------------------
  if (normalizedRole === "MID") {
    // 1. アサシン / 序盤キル型
    const isAssassin = archetype === "ad_assassin" || archetype === "ap_assassin" || ["zed", "talon", "katarina", "fizz", "leblanc", "akali", "qiyana", "naafiri"].includes(champId) || spikeValues.early >= 8;
    // 2. スケーリング型（カサディン、ベイガー、ブラッドミア等）
    const isScaling = ["kassadin", "veigar", "vladimir", "ryze", "aurelionsol", "smolder", "kayle"].includes(champId) || spikeValues.late >= 9;
    // 3. メイジ / コントロール（オリアナ、シンドラ、ビクター等）
    const isControlMage = archetype === "ap_mage" || ["orianna", "syndra", "viktor", "xerath", "lux", "hwei", "zoe", "anivia", "ahri"].includes(champId);

    if (isAssassin) {
      return {
        title: "⚡ MIDローム・テンポ指標",
        badge: "アサシン (MID)",
        subtitle: "序盤キルライン ＆ ローム展開",
        metric1: {
          label: "ローム適期",
          value: "Lv3〜 / キャノン後",
          color: "text-amber-400",
        },
        metric2: {
          label: "パワースパイク",
          value: spikeSummary !== "1コア完成時" ? spikeSummary : "Lv6 バースト即死",
          color: "text-rose-400",
        },
      };
    }

    if (isScaling) {
      return {
        title: "⚡ MIDローム・テンポ指標",
        badge: "スケーリング (MID)",
        subtitle: "安全ファーム ＆ スケーリング優先",
        metric1: {
          label: "レーン方針",
          value: "自陣維持・後手寄り",
          color: "text-cyan-400",
        },
        metric2: {
          label: "パワースパイク",
          value: spikeSummary !== "1コア完成時" ? spikeSummary : "Lv11+ / 2コア完成",
          color: "text-emerald-400",
        },
      };
    }

    if (isControlMage) {
      return {
        title: "⚡ MIDローム・テンポ指標",
        badge: "メイジ (MID)",
        subtitle: "ウェーブ主導 ＆ オブジェクト寄り",
        metric1: {
          label: "主導権獲得",
          value: "プッシュ ＆ 視界確保",
          color: "text-amber-400",
        },
        metric2: {
          label: "パワースパイク",
          value: spikeSummary,
          color: "text-emerald-400",
        },
      };
    }

    // MID標準 / 近接ファイター
    return {
      title: "⚡ MIDローム・テンポ指標",
      badge: `${jpName || "MID"}標準`,
      subtitle: "キャノン押し込み ＆ オブジェクト寄り",
      metric1: {
        label: "ローム優先時",
        value: "キャノン波後",
        color: "text-amber-400",
      },
      metric2: {
        label: "パワースパイク",
        value: spikeSummary,
        color: "text-rose-400",
      },
    };
  }

  // -------------------------------------------------------------
  // ⚔️ TOP
  // -------------------------------------------------------------
  if (normalizedRole === "TOP") {
    const isLaneBully = ["darius", "renekton", "olaf", "sett", "garen", "illaoi", "warwick", "pantheon"].includes(champId) || spikeValues.early >= 8;
    const isTank = archetype === "tank" || ["malphite", "ornn", "sion", "shen", "chogath", "poppy", "maokai", "ksante"].includes(champId);
    const isSplitter = ["fiora", "camille", "jax", "tryndamere", "irelia", "gwen", "yone"].includes(champId);
    const isScaling = ["kayle", "nasus", "gangplank", "vladimir"].includes(champId) || spikeValues.late >= 9;

    if (isLaneBully) {
      return {
        title: "⚔️ TOPウェーブ管理指標",
        badge: "レーン強者 (TOP)",
        subtitle: "レーン圧倒 ＆ スロープッシュダイブ",
        metric1: {
          label: "仕掛け期",
          value: "Lv1-3 前方制圧",
          color: "text-rose-400",
        },
        metric2: {
          label: "1stリコール",
          value: "1,100G〜1,300G",
          color: "text-amber-400",
        },
      };
    }

    if (isTank) {
      return {
        title: "⚔️ TOPウェーブ管理指標",
        badge: "タンク (TOP)",
        subtitle: "ウェーブ受け ＆ TP集団戦参加",
        metric1: {
          label: "ウェーブ方針",
          value: "タワー前4体維持",
          color: "text-cyan-400",
        },
        metric2: {
          label: "パワースパイク",
          value: spikeSummary !== "1コア完成時" ? spikeSummary : "Lv6 / 防具完成",
          color: "text-emerald-400",
        },
      };
    }

    if (isSplitter) {
      return {
        title: "⚔️ TOPウェーブ管理指標",
        badge: "デュエリスト (TOP)",
        subtitle: "サイド管理 ＆ 1v1キルプレッシャー",
        metric1: {
          label: "サイド主導",
          value: "タワー前フリーズ",
          color: "text-emerald-400",
        },
        metric2: {
          label: "パワースパイク",
          value: spikeSummary !== "1コア完成時" ? spikeSummary : "1〜2コア スプリット",
          color: "text-rose-400",
        },
      };
    }

    if (isScaling) {
      return {
        title: "⚔️ TOPウェーブ管理指標",
        badge: "スケーリング (TOP)",
        subtitle: "引きウェーブ ＆ 耐久スケーリング",
        metric1: {
          label: "序盤方針",
          value: "CS最優先・ロスト回避",
          color: "text-cyan-400",
        },
        metric2: {
          label: "パワースパイク",
          value: spikeSummary !== "1コア完成時" ? spikeSummary : "Lv11+ / 2コア",
          color: "text-emerald-400",
        },
      };
    }

    // TOP標準
    return {
      title: "⚔️ TOPウェーブ管理指標",
      badge: "TOP標準",
      subtitle: "1stリコール目標 ＆ フリーズ基準",
      metric1: {
        label: "1stリコール",
        value: "1,200G",
        color: "text-amber-400",
      },
      metric2: {
        label: "フリーズ維持",
        value: "タワー前4体",
        color: "text-emerald-400",
      },
    };
  }

  // -------------------------------------------------------------
  // 🏹 BOT / ADC
  // -------------------------------------------------------------
  if (normalizedRole === "BOT" || normalizedRole === "ADC") {
    const isKillLane = ["draven", "samira", "lucian", "kalista", "tristana"].includes(champId) || spikeValues.early >= 8;
    const isHyperCarry = ["jinx", "kogmaw", "vayne", "kaisa", "aphelios", "zeri", "twitch"].includes(champId) || spikeValues.late >= 9;
    const isUtility = ["jhin", "ashe", "varus", "ezreal", "sivir", "missfortune"].includes(champId);

    if (isKillLane) {
      return {
        title: "🏹 BOTファーム ＆ スパイク指標",
        badge: "キルレーン (BOT)",
        subtitle: "Lv2オールイン ＆ スノーボール",
        metric1: {
          label: "キルライン",
          value: "Lv2先行オールイン",
          color: "text-rose-400",
        },
        metric2: {
          label: "1stコア目標",
          value: "10:00前 完成",
          color: "text-amber-400",
        },
      };
    }

    if (isHyperCarry) {
      return {
        title: "🏹 BOTファーム ＆ スパイク指標",
        badge: "ハイパーキャリー (BOT)",
        subtitle: "安全CS回収 ＆ 2-3コアスケーリング",
        metric1: {
          label: "目標CS",
          value: "8.5+ /分",
          color: "text-emerald-400",
        },
        metric2: {
          label: "真のスパイク",
          value: spikeSummary !== "1コア完成時" ? spikeSummary : "3コア / IE完成",
          color: "text-cyan-400",
        },
      };
    }

    if (isUtility) {
      return {
        title: "🏹 BOTファーム ＆ スパイク指標",
        badge: "ユーティリティ (BOT)",
        subtitle: "ポーク主導 ＆ 集団戦エンゲージ",
        metric1: {
          label: "仕掛け期",
          value: "Lv6 ウルト連携",
          color: "text-amber-400",
        },
        metric2: {
          label: "1stコア目標",
          value: "10:30 完成",
          color: "text-emerald-400",
        },
      };
    }

    // BOT標準
    return {
      title: "🏹 BOTファーム ＆ スパイク指標",
      badge: "BOT標準",
      subtitle: "1stコア目標 ＆ CSレート",
      metric1: {
        label: "1コア目標",
        value: "10:30",
        color: "text-emerald-400",
      },
      metric2: {
        label: "目標CS",
        value: "8.5+ /分",
        color: "text-amber-400",
      },
    };
  }

  // -------------------------------------------------------------
  // 🛡️ SUP
  // -------------------------------------------------------------
  if (normalizedRole === "SUP") {
    const isEngageTank = archetype === "tank" || ["thresh", "blitzcrank", "nautilus", "leona", "alistar", "rell", "rakan", "pyke"].includes(champId);
    const isEnchanter = archetype === "enchanter" || ["lulu", "nami", "janna", "soraka", "sona", "milio", "yuumi", "renataglasc"].includes(champId);
    const isMageSup = archetype === "ap_mage" || ["zyra", "brand", "velkoz", "lux", "xerath", "morgana", "swain"].includes(champId);

    if (isEngageTank) {
      return {
        title: "🛡️ SUP視界 ＆ レーン主導指標",
        badge: "エンゲージ (SUP)",
        subtitle: "Lv2先行オールイン ＆ ローム奇襲",
        metric1: {
          label: "Lv2先行",
          value: "2波目前衛3体",
          color: "text-amber-400",
        },
        metric2: {
          label: "ローム期",
          value: "帰投時 ➔ MID/JG寄り",
          color: "text-rose-400",
        },
      };
    }

    if (isEnchanter) {
      return {
        title: "🛡️ SUP視界 ＆ レーン主導指標",
        badge: "エンチャンター (SUP)",
        subtitle: "ADC防護 ＆ ショートトレード",
        metric1: {
          label: "レーン方針",
          value: "ショートトレード",
          color: "text-cyan-400",
        },
        metric2: {
          label: "目標視界(20分)",
          value: "40+ スコア",
          color: "text-emerald-400",
        },
      };
    }

    if (isMageSup) {
      return {
        title: "🛡️ SUP視界 ＆ レーン主導指標",
        badge: "メイジ (SUP)",
        subtitle: "ブッシュ支配 ＆ ゾーン制圧",
        metric1: {
          label: "仕掛け期",
          value: "Lv3 / Lv6 バースト",
          color: "text-rose-400",
        },
        metric2: {
          label: "パワースパイク",
          value: spikeSummary,
          color: "text-amber-400",
        },
      };
    }

    // SUP標準
    return {
      title: "🛡️ SUP視界 ＆ レーン主導指標",
      badge: "SUP標準",
      subtitle: "Lv2先行プッシュ ＆ 視界スコア目標",
      metric1: {
        label: "Lv2先行",
        value: "2波目前衛3体",
        color: "text-amber-400",
      },
      metric2: {
        label: "目標視界(20分)",
        value: "45+ スコア",
        color: "text-cyan-400",
      },
    };
  }

  // 汎用フォールバック
  return {
    title: `⚡ ${normalizedRole}実戦テンポ指標`,
    badge: `${jpName || "一般"} (${normalizedRole})`,
    subtitle: "レーンコントロール ＆ オブジェクト寄り",
    metric1: {
      label: "パワースパイク",
      value: spikeSummary,
      color: "text-amber-400",
    },
    metric2: {
      label: "レーン目標",
      value: "主導権確保",
      color: "text-emerald-400",
    },
  };
}
