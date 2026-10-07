"use client";

import { Shield, Trees, Zap, Target, Heart } from "lucide-react";

// バランサー画面の共通小部品・ユーティリティ。2026-10-07 page.tsx から分離（内容は分離前と同じ）。

export const RoleIcon = ({ role, className = "w-3.5 h-3.5" }: { role: string; className?: string }) => {
  const r = role.toUpperCase();
  switch (r) {
    case 'TOP': return <Shield className={`${className} text-primary-700`} />;
    case 'JG': return <Trees className={`${className} text-success-700`} />;
    case 'MID': return <Zap className={`${className} text-danger-700`} />;
    case 'ADC': return <Target className={`${className} text-primary-700`} />;
    case 'SUP': return <Heart className={`${className} text-secondary-700`} />;
    default: return null;
  }
};

// ★ カジノ特典バッジ抽出ユーティリティ（※宝くじ等の非試合アイテムは除外、同アイテムは集約表示）
export function getPlayerCasinoBadges(player: any): Array<{ id: string; icon: string; label: string; count: number }> {
  const inv = (player?.inventory || player?.role_preferences?.inventory || []) as Array<{ id?: string; name?: string; icon?: string }>;
  if (!Array.isArray(inv) || inv.length === 0) return [];

  // 試合に関係のないアイテム（宝くじ等）はバランサーに表示しない。
  // ★ 2026-09-22: 以前は id の完全一致(`id !== 'lottery_ticket'`)だけで弾いていたため、
  // id が欠けている/異なる経路で付与された宝くじが素通りし、チーム分け画面に
  // 「週末メガ宝」バッジが大量に並んでプレイヤー名を画面外へ押し出していた。
  // 名前側でも判定して取りこぼさないようにする。
  const gameItems = inv.filter(item => {
    const id = String(item.id || '');
    const name = String(item.name || '');
    if (id.includes('lottery')) return false;
    if (name.includes('宝くじ')) return false;
    return true;
  });

  if (gameItems.length === 0) return [];

  // アイテムごとに集約
  const itemMap: Record<string, { id: string; icon: string; label: string; count: number }> = {};

  for (const item of gameItems) {
    // id が欠けている場合に全て同一バケットへ入れると、別アイテムなのに最初の1件の
    // 名前で一括表示されてしまうため、名前をフォールバックキーにする。
    const id = item.id || item.name || 'unknown';
    if (!itemMap[id]) {
      let label = (item.name || '').replace(/^[^\s]+\s*/, '').slice(0, 5) || 'アイテム';
      let icon = item.icon || '👑';
      if (id === 'force_champ_pick') { icon = '👑'; label = '下剋上'; }
      else if (id === 'lane_heavy_ban') { icon = '🚫'; label = '集中BAN'; }
      else if (id === 'champ_protect') { icon = '🛡️'; label = '保護'; }
      else if (id === 'force_enemy_roles') { icon = '🔀'; label = 'ロール指定'; }
      else if (id === 'all_offmeta_match') { icon = '🤡'; label = 'オフメタ'; }
      else if (id === 'side_pick') { icon = '🟦'; label = 'サイド指定'; }
      else if (id === 'bounty_target') { icon = '🎯'; label = '賞金首'; }
      else if (id === 'ban_free') { icon = '🚫'; label = 'BAN禁止'; }
      else if (id === 'all_random_match' || id === 'ultimate_bravery') { icon = '🎲'; label = 'ランダム'; }
      itemMap[id] = { id, icon, label, count: 0 };
    }
    itemMap[id].count += 1;
  }

  return Object.values(itemMap).map(b => ({
    ...b,
    label: b.count > 1 ? `${b.label}×${b.count}` : b.label
  }));
}

// チーム分け結果の1行に表示するカジノ特典バッジ。
// ★ 表示上限を設ける理由(2026-09-22): バッジは全て shrink-0 で、行内で唯一縮むのが
// プレイヤー名だったため、特典を多く持つ人がいると名前もMMRも画面外へ押し出されて
// 「誰の行か分からない」状態になっていた(実際のスクリーンショットで確認)。
// 行の主役は「誰がどのレーンでMMRいくつか」なので、バッジ側を畳む方針にする。
export const MAX_VISIBLE_BADGES = 2;

export function CasinoBadges({ player }: { player: any }) {
  const badges = getPlayerCasinoBadges(player);
  if (badges.length === 0) return null;

  const visible = badges.slice(0, MAX_VISIBLE_BADGES);
  const hidden = badges.slice(MAX_VISIBLE_BADGES);
  const allLabels = badges.map(b => `${b.icon}${b.label}`).join(' / ');

  return (
    <span className="flex items-center gap-1 shrink min-w-0 overflow-hidden" title={`カジノ特典: ${allLabels}`}>
      {visible.map(b => (
        <span key={b.id} className="text-[9px] bg-primary-100 border border-primary-edge text-primary-900 px-1.5 py-0.5 rounded font-black shrink-0 whitespace-nowrap">
          {b.icon}{b.label}
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="text-[9px] bg-primary-50 border border-primary-edge-soft text-primary-700 px-1.5 py-0.5 rounded font-black shrink-0 whitespace-nowrap">
          +{hidden.length}
        </span>
      )}
    </span>
  );
}

// ★ グループ判定ユーティリティ（固定0 > 通常参加1 > 見学固定2 > 不参加3）
export function getGroup(p: any): number {
  if (p.is_fixed) return 0;
  if (p.is_active && !p.is_spectator_fixed) return 1;
  if (p.is_spectator_fixed) return 2;
  return 3;
}
