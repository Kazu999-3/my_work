/**
 * 募集台帳 (recruitment_participants) の DB 操作ユーティリティ
 *
 * 週末定期カスタムの参加者名簿を PostgreSQL (Supabase) で正規管理し、
 * アトミックな UPSERT による同時押し耐性と SSoT (Single Source of Truth) を実現する。
 */

import { fetchSupabase } from './supabase.js';
import { getKtmRank, getHighestLaneMmr, getPlayerExperienceBadge, getPlayerActiveMark } from './ktmRank.js';
import { RANK_SHORT_JP_MAP, RANK_JP_MAP } from './recruitmentStatus.js';

export const BAND_BOUNDARY_MMR = 1450;
export const PLAYER_SELECT = 'discord_id,mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup,role_preferences,name,games_top,games_jg,games_mid,games_adc,games_sup,total_games,metadata,days_since_last_match,allow_higher';

/**
 * プレイヤー情報と参加形態から、DB（recruitment_participants）に保存する属性を決定する純粋関数
 * @param {object|null} playerRow - ktm_players レコード
 * @param {string} participationStyle - 'full' | 'single' | 'late' | 'spectator'
 * @param {string|null} dayKey - 'sat' | 'sun' | 'all' | null (null/'all' の場合は都度募集扱い)
 * @param {object} [overrides] - 明示的な上書きプロパティ ({ lobby, primaryLane })
 */
export function determineParticipantAttributes(playerRow, participationStyle, dayKey = 'sat', overrides = {}) {
  const style = ['full', 'single', 'late', 'spectator'].includes(participationStyle)
    ? participationStyle
    : 'full';

  let estimatedMmr = null;
  let rankTier = null;
  let primaryLane = overrides.primaryLane || null;
  let secondaryLane = null;

  if (playerRow) {
    const mmr = getHighestLaneMmr(playerRow);
    if (typeof mmr === 'number' && !Number.isNaN(mmr)) {
      estimatedMmr = mmr;
      const tier = getKtmRank(mmr);
      if (tier?.name) {
        rankTier = tier.name;
      }
    }

    try {
      let pref = playerRow.role_preferences;
      if (typeof pref === 'string') {
        try { pref = JSON.parse(pref); } catch {}
      }
      if (pref) {
        const normalize = (v) => {
          if (!v || v === '指定なし' || v === 'なし' || v === '-') return null;
          const u = String(v).toUpperCase();
          return u === 'FILL' || u === 'ANY' ? 'ALL' : u;
        };
        if (!primaryLane) primaryLane = normalize(pref.primary);
        secondaryLane = normalize(pref.secondary);
        if (secondaryLane === primaryLane || primaryLane === 'ALL') {
          secondaryLane = null;
        }
      }
    } catch {}
  }

  // 帯ロビーの決定:
  // 土曜: 推定MMR 1450以上なら 'high'、1450未満または未設定なら 'low'
  // 日曜: 帯分けなし（'low' に統一）
  // 都度募集 (dayKey === 'all' または null): 'all'
  let lobby = 'low';
  if (overrides.lobby) {
    lobby = overrides.lobby;
  } else if (!dayKey || dayKey === 'all') {
    lobby = 'all';
  } else if (dayKey === 'sat') {
    if (estimatedMmr !== null && estimatedMmr >= BAND_BOUNDARY_MMR) {
      lobby = 'high';
    } else {
      lobby = 'low';
    }
  }

  return {
    style,
    lobby,
    estimatedMmr,
    rankTier,
    primaryLane,
    secondaryLane,
  };
}

/**
 * Discord メッセージID から recruitments レコードを取得する
 */
export async function getRecruitmentByMessageId(env, messageId) {
  if (!messageId) return null;
  const rows = await fetchSupabase(env, 'recruitments', `discord_message_id=eq.${messageId}&select=*`);
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * 参加・参加形態の変更（UPSERT）
 */
export async function recordParticipant(env, {
  recruitmentId, discordId, userName, playerRow, style, dayKey, lobby, primaryLane
}) {
  const attrs = determineParticipantAttributes(playerRow, style, dayKey, { lobby, primaryLane });
  const now = new Date().toISOString();

  const payload = {
    recruitment_id: recruitmentId,
    discord_id: discordId,
    user_name: userName || null,
    style: attrs.style,
    lobby: attrs.lobby,
    primary_lane: attrs.primaryLane,
    secondary_lane: attrs.secondaryLane,
    rank_tier: attrs.rankTier,
    estimated_mmr: attrs.estimatedMmr,
    is_cancelled: false,
    updated_at: now,
  };

  // PostgREST の ON CONFLICT (recruitment_id, discord_id) DO UPDATE
  return fetchSupabase(
    env,
    'recruitment_participants',
    'on_conflict=recruitment_id,discord_id',
    'POST',
    payload,
    { Prefer: 'resolution=merge-duplicates,return=representation' }
  );
}

/**
 * 参加辞退（論理削除: is_cancelled = true）
 */
export async function cancelParticipant(env, { recruitmentId, discordId }) {
  const now = new Date().toISOString();
  return fetchSupabase(
    env,
    'recruitment_participants',
    `recruitment_id=eq.${recruitmentId}&discord_id=eq.${discordId}`,
    'PATCH',
    {
      is_cancelled: true,
      updated_at: now,
    }
  );
}

/**
 * 有効な（辞退していない）参加者一覧を取得する
 */
export async function fetchActiveParticipants(env, recruitmentId) {
  if (!recruitmentId) return [];
  const rows = await fetchSupabase(
    env,
    'recruitment_participants',
    `recruitment_id=eq.${recruitmentId}&is_cancelled=eq.false&order=created_at.asc`
  );
  return rows || [];
}

/**
 * 1人の参加者レコードから名簿表示行（- <@id> 🟢フル ...）を生成する
 */
export function formatParticipantDisplayLine(participant, playerRow, def) {
  const discordId = participant.discord_id;
  const style = participant.style;

  let styleBadge = ' 🟢フル';
  if (style === 'single') styleBadge = ' ⏱️1戦のみ';
  else if (style === 'late') styleBadge = ' 🌙途中参加(2戦目〜)';
  else if (style === 'spectator') styleBadge = ' 👀観戦希望';

  // 経験バッジ
  const expBadgeStr = ` ${getPlayerExperienceBadge(playerRow).short}`;

  // ランク表記（土曜のみ）
  let rankStr = '';
  if (def.showRank) {
    const tierName = participant.rank_tier;
    if (tierName) {
      const shortName = RANK_SHORT_JP_MAP[tierName] || RANK_JP_MAP[tierName] || tierName;
      rankStr = ` 【${shortName}】`;
    } else if (playerRow) {
      const tier = getKtmRank(getHighestLaneMmr(playerRow) ?? 0);
      if (tier?.name) {
        const shortName = RANK_SHORT_JP_MAP[tier.name] || RANK_JP_MAP[tier.name] || tier.name;
        rankStr = ` 【${shortName}】`;
      }
    }
  }

  // 希望レーン表記
  let lanePrefStr = '';
  const p1 = participant.primary_lane;
  const p2 = participant.secondary_lane;
  if (p1 && p2) {
    lanePrefStr = ` 【${p1}/${p2}】`;
  } else if (p1) {
    lanePrefStr = ` 【${p1}】`;
  }

  return `- <@${discordId}>${styleBadge}${expBadgeStr}${rankStr}${lanePrefStr}`;
}

/**
 * DBの参加者一覧と名簿情報から、カード描画用の entryLines 配列を生成する
 */
export function buildDisplayLinesFromDb(participants, playerRowsMap, def) {
  return (participants || []).map((p) => {
    const playerRow = playerRowsMap instanceof Map
      ? (playerRowsMap.get(p.discord_id) || null)
      : (playerRowsMap?.[p.discord_id] || null);
    return formatParticipantDisplayLine(p, playerRow, def);
  });
}

/**
 * 複数の Discord ID から ktm_players レコードを一括取得して Map で返す
 */
export async function fetchPlayerRowsMap(env, discordIds) {
  if (!discordIds || discordIds.length === 0) return new Map();
  const uniqueIds = [...new Set(discordIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  try {
    const rows = await fetchSupabase(
      env,
      'ktm_players',
      `discord_id=in.(${uniqueIds.join(',')})&select=${PLAYER_SELECT}`
    );
    if (!rows || !Array.isArray(rows)) return new Map();
    return new Map(rows.map((r) => [r.discord_id, r]));
  } catch (err) {
    console.warn('fetchPlayerRowsMap error:', err);
    return new Map();
  }
}

/**
 * 都度募集の metadata を DB の activeParticipants から再構築する
 */
export function rebuildAdhocMetadataFromDb(metadata, activeParticipants, playerMap = new Map()) {
  const nextMeta = { ...metadata };
  const joined = [];
  const spectating = [];
  const roles = { ...nextMeta.roles };
  // 既存の roles を初期化（DBをSSoTにするため）
  Object.keys(roles).forEach((r) => { roles[r] = null; });
  const names = { ...nextMeta.names };
  const badges = { ...nextMeta.badges };
  const lanes = { ...nextMeta.lanes };

  for (const p of activeParticipants) {
    const id = p.discord_id;
    if (p.user_name) names[id] = p.user_name;
    const playerRow = playerMap instanceof Map ? playerMap.get(id) : playerMap?.[id];

    if (!badges[id] && playerRow) {
      badges[id] = getPlayerActiveMark(playerRow);
    }
    if (!lanes[id]) {
      lanes[id] = p.primary_lane || 'ALL';
    }

    if (p.style === 'spectator') {
      spectating.push(id);
    } else {
      joined.push(id);
      // ロール参加の場合
      if (p.primary_lane && roles[p.primary_lane] === null) {
        roles[p.primary_lane] = id;
      }
    }
  }

  nextMeta.joined = joined;
  nextMeta.spectating = spectating;
  nextMeta.roles = roles;
  nextMeta.names = names;
  nextMeta.badges = badges;
  nextMeta.lanes = lanes;

  // カスタム募集の場合、希望レーン順にソート
  if (nextMeta.mode === 'カスタム' && Array.isArray(nextMeta.joined) && nextMeta.joined.length > 1) {
    const lanePriority = { TOP: 1, JG: 2, MID: 3, ADC: 4, BOT: 4, SUP: 5, ALL: 6 };
    nextMeta.joined.sort((a, b) => {
      const lA = lanePriority[nextMeta.lanes?.[a]] || 6;
      const lB = lanePriority[nextMeta.lanes?.[b]] || 6;
      return lA - lB;
    });
  }

  return nextMeta;
}


