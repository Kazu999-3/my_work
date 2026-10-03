// チャンピオン個別データに基づくピック判断ガイド（先出し・後出し・勝ち筋）動的生成モジュール
import { ChampionArchetype } from "./archetype";

export interface DynamicPickGuide {
  blindPick: {
    rating: "S" | "A" | "B";
    label: string;
    reason: string;
  };
  counterPick: {
    targets: string[];
    situation: string;
  };
  whenToPick: {
    teamSynergy: string;
    winCondition: string;
  };
}

interface PickGuideInput {
  id: string;
  jpName?: string;
  archetype: ChampionArchetype;
  role: string;
  strengths?: string[];
  weaknesses?: string[];
  counters?: string[];
  mustBan?: string[];
  winRate?: number;
  tier?: string;
  staticPickGuide?: any;
}

/**
 * チャンピオン固有の先出し適性・カウンター・構成マッチングを動的生成
 */
export function getDynamicPickGuide(input: PickGuideInput): DynamicPickGuide {
  const { id, jpName, archetype, role, strengths = [], weaknesses = [], counters = [], mustBan = [], winRate, tier, staticPickGuide } = input;
  const champId = (id || "").toLowerCase();

  // 1. 先出し適性スコアリング
  // 不利対面（counters/mustBan）の多さ、弱点数から判定
  const hasExtremeCounters = counters.length >= 3 || ["kassadin", "katarina", "masteryi", "vladimir", "kayle"].includes(champId);
  const isSafePusher = ["ahri", "orianna", "syndra", "malphite", "ornn", "jinx", "ashe", "nautilus", "thresh"].includes(champId) || archetype === "tank";

  let rating: "S" | "A" | "B" = "A";
  let label = "先出し安定";
  let reason = "";

  if (hasExtremeCounters) {
    rating = "B";
    label = "後出し推奨";
    const weakReason = weaknesses[0] || (mustBan[0] ? `${mustBan[0]}等の天敵` : "特定対面");
    reason = `敵に対策ピック（${weakReason}等）を取られると序盤から主導権を奪われやすいため、敵構成を見てからの後出し推奨。`;
  } else if (isSafePusher || (winRate && winRate >= 51.5)) {
    rating = "S";
    label = "先出し鉄板";
    const strengthReason = strengths[0] || "ウェーブ管理力と安定した立ち回り";
    reason = `極端な不利対面が少なく、${strengthReason}によって構成を選ばず最低限の役割を遂行可能。`;
  } else {
    rating = "A";
    label = "先出し安定";
    reason = `バランスの良いスキルセットを持ち、無理なトレードを避ければ対面を選ばずにパワースパイクまでゲームを作れる。`;
  }

  // 2. 後出しカウンター相手 & シチュエーション
  let targets: string[] = [];
  let situation = "";

  if (counters.length > 0) {
    // 自身がカウンターできる相手の逆引きやクラス
    targets = counters.slice(0, 3);
  }

  if (targets.length === 0) {
    switch (archetype) {
      case "ad_assassin":
      case "ap_assassin":
        targets = ["逃げ場のないADC", "低機動力メイジ"];
        situation = "敵のキャリーラインが薄く、一瞬のバーストで人数有利を作りやすい時。";
        break;
      case "ap_mage":
        targets = ["近接ファイター", "低射程タンク"];
        situation = "敵が接近戦を好む構成に対し、射程外からのポークや範囲CCが刺さる時。";
        break;
      case "tank":
        targets = ["瞬間火力アサシン", "低耐久構成"];
        situation = "敵にアサシンや瞬間火力職が多く、味方キャリーを守るピールやイニシエートが必要な時。";
        break;
      case "marksman":
        targets = ["低機動力タンク", "短射程ADC"];
        situation = "敵の前衛を安全圏から溶かせる時、または射程有利をレーンから押し付けられる時。";
        break;
      case "enchanter":
        targets = ["ポーク構成", "継続戦闘型"];
        situation = "味方ハイパーキャリーを全力育成したい時、または回復・シールドでの消耗戦に持ち込める時。";
        break;
      default:
        targets = ["低機動力ファイター", "特定対面"];
        situation = "1v1で主導権を握れるマッチアップ、または小規模戦で有利を取れる時。";
        break;
    }
  } else if (!situation) {
    situation = `敵構成に${targets.join(" / ")}が含まれる場合、スキルセットの相性有利を活かしてレーンから主導権を掌握可能。`;
  }

  // 3. 味方構成トリガー & 勝ち筋
  let teamSynergy = "";
  let winCondition = "";

  if (strengths && strengths.length > 0) {
    winCondition = strengths[0];
  }

  switch (archetype) {
    case "ad_assassin":
    case "ap_assassin":
      teamSynergy = teamSynergy || "味方にエンゲージ役（CC持ち前衛）がおり、暗殺後のフォーカス分散が可能な時。";
      winCondition = winCondition || "視界の外から敵主要キャリーを暗殺し、オブジェクト戦前に人数差を作る。";
      break;
    case "ap_mage":
      teamSynergy = teamSynergy || "味方にAP魔法ダメージが不足している時、またはオブジェクト周りのゾーン制圧力を高めたい時。";
      winCondition = winCondition || "オブジェクト前の牽制で敵の体力を削り、不用意に入ってきた敵をフォーカスして人数差を作る。";
      break;
    case "tank":
      teamSynergy = teamSynergy || "味方にフロントライン（前衛）やイニシエーター（仕掛け役）が不在の時。";
      winCondition = winCondition || "集団戦で敵の攻撃を受け止めつつCCを叩き込み、味方キャリーに安全に火力を出させる。";
      break;
    case "marksman":
      teamSynergy = teamSynergy || "チームに安定したフロントライン（盾）やピール役が揃っている時。";
      winCondition = winCondition || "中盤〜終盤までCSを落とさず成長し、アイテム完成後の集団戦で継続DPSを叩き出す。";
      break;
    case "enchanter":
      teamSynergy = teamSynergy || "味方ADCやファイターに十分な火力があり、生存能力を高めれば勝てる構成の時。";
      winCondition = winCondition || "集団戦で味方キャリーを徹底的にピール・強化し、敵のフォーカスを無力化して勝ち切る。";
      break;
    default:
      teamSynergy = teamSynergy || "小規模戦（2v2 / 3v3）を起こしやすく、サイドプッシュで敵を引きつけられる時。";
      winCondition = winCondition || "レーン戦で有利を築き、サイドレーンの圧力または裏回りエンゲージで集団戦を崩壊させる。";
      break;
  }

  // 静的ガイドに個別記述がある場合は尊重・マージ
  if (staticPickGuide) {
    if (staticPickGuide.blindPick?.reason && !staticPickGuide.blindPick.reason.includes("役割を果たせる")) {
      reason = staticPickGuide.blindPick.reason;
      rating = staticPickGuide.blindPick.rating || rating;
      label = staticPickGuide.blindPick.label || label;
    }
    if (staticPickGuide.counterPick?.targets?.length > 0 && !staticPickGuide.counterPick.targets.includes("アサシン全般")) {
      targets = staticPickGuide.counterPick.targets;
      situation = staticPickGuide.counterPick.situation || situation;
    }
  }

  return {
    blindPick: {
      rating,
      label,
      reason,
    },
    counterPick: {
      targets,
      situation,
    },
    whenToPick: {
      teamSynergy,
      winCondition,
    },
  };
}
