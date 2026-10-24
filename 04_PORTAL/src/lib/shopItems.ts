// KTMショップの商品一覧（価格・説明）。カジノ画面の表示と /api/bet/shop の購入処理の両方がここを読む。
// 2026-10-07: 以前は app/casino と app/api/bet/shop/route.ts に同じ11品が別々に定義されていた（価格がずれると表示と請求額が食い違う）。

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  badge: string;
  desc: string;
  maxHold?: number; // 最大所持数（未指定なら無制限）
}

export const SHOP_ITEM_LIST: ShopItem[] = [
  {
    id: 'lottery_ticket',
    name: '🎟️ 週末メガ宝くじ (1口)',
    price: 100,
    icon: '🎟️',
    badge: '1等キャリーオーバー制',
    desc: '【毎週日曜22:00抽選】🥇1等: ジャックポット総取り(8%抽選・キャリーオーバー制) / 🥈2等: 1,000コイン確約当選 / 🥉3等: 参加賞(1口30コイン還元)！'
  },
  {
    id: 'scratch_card',
    name: '🥠 闇のスクラッチくじ',
    price: 150,
    icon: '🥠',
    badge: '最大3,000🪙当選',
    desc: '【即時抽選スピードくじ】購入と同時に結果判明！\n[当選確率] 🥇特等(1%): 3,000🪙 / 🥈1等(4%): 800🪙 / 🥉2等(15%): 250🪙 / 🎖️3等(40%): 80🪙 / 🍃ハズレ(40%): 30🪙'
  },
  {
    id: 'bet_insurance',
    name: '💎 全損保険チケット',
    price: 100,
    icon: '💎',
    badge: '不的中時50%返還',
    desc: '【勝敗予想セーフティ】次回のカスタム勝敗予想がハズれた際、賭け金の50%を自動キャッシュバック返還！大胆な大穴狙いにも最適。'
  },
  {
    id: 'victory_bonus_doubler',
    name: '⚔️ 勝利ボーナス激闘チケット',
    price: 150,
    icon: '⚔️',
    badge: '勝利時 +600pt獲得 (上限3枚)',
    maxHold: 3,
    desc: '【選手専用ブースター / 最大所持3枚まで】次回カスタムに選手として出場し勝利した際、通常ボーナス(+250pt)が【合計+600pt】へ大幅爆増！(差引純利益 +450pt)'
  }
];

/** 購入処理用: id から商品を引く表 */
export const SHOP_ITEMS: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEM_LIST.map((item) => [item.id, item]));

/** 撤去された旧アイテムの定価一覧（10/14 DB復旧時の自動換金用） */
export const DEPRECATED_SHOP_ITEMS: Record<string, { name: string; price: number; icon: string }> = {
  force_champ_pick: { name: '👑 下剋上キャラ指定権', price: 500, icon: '👑' },
  lane_heavy_ban: { name: '🚫 特定レーン複数BAN権', price: 400, icon: '🚫' },
  force_enemy_roles: { name: '🔀 相手ロール強制配置権', price: 500, icon: '🔀' },
  all_offmeta_match: { name: '🤡 完全オフメタカスタム開催権', price: 400, icon: '🤡' },
  all_random_match: { name: '🎲 キャラランダムカスタム開催権', price: 400, icon: '🎲' },
  ultimate_bravery: { name: '🎲 全員ランダムビルド対決権', price: 300, icon: '🎲' },
  champ_protect: { name: '🛡️ チャンピオンプロテクト権', price: 500, icon: '🛡️' },
  ban_free: { name: '🚫 全員BAN禁止マッチ権', price: 400, icon: '🚫' },
  side_pick: { name: '🟦 サイド選択権', price: 500, icon: '🟦' },
  bounty_target: { name: '🎯 賞金首ターゲット指定権', price: 300, icon: '🎯' },
};
