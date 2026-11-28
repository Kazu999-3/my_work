/**
 * 募集台帳 (recruitment_participants) の DB 操作ユーティリティ
 *
 * 週末定期カスタムの参加者名簿を PostgreSQL (Supabase) で正規管理し、
 * アトミックな UPSERT による同時押し耐性と SSoT (Single Source of Truth) を実現する。
 */

import { fetchSupabase } from './supabase.js';
import { getKtmRank, getRepresentativeMmr, getPlayerExperienceBadge, getPlayerActiveMark } from './ktmRank.js';
import { RANK_SHORT_JP_MAP, RANK_JP_MAP, normalizeTierPromotionPref, getNormalizedTier } from './recruitmentStatus.js';

export const BAND_BOUNDARY_MMR = 1450;
export const PLAYER_SELECT = 'discord_id,mmr,mmr_top,mmr_jg,mmr_mid,mmr_adc,mmr_sup,role_preferences,name,games_top,games_jg,games_mid,games_adc,games_sup,metadata,allow_higher,tier_promotion_pref,allow_lower_support';

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
    const mmr = getRepresentativeMmr(playerRow);
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

  // 経験バッジ（初参加🔰・ライト層🌱を表示、常連や復帰勢は非表示でスッキリ化）
  const expBadge = getPlayerExperienceBadge(playerRow);
  const expBadgeStr = expBadge?.tier === 'new' ? ' 🔰' : expBadge?.tier === 'light' ? ' 🌱' : '';

  // ランク表記（土曜のみ）
  let rankStr = '';
  if (def.showRank) {
    const tierName = participant.rank_tier;
    if (tierName) {
      const shortName = RANK_SHORT_JP_MAP[tierName] || RANK_JP_MAP[tierName] || tierName;
      rankStr = ` 【${shortName}】`;
    } else if (playerRow) {
      const tier = getKtmRank(getRepresentativeMmr(playerRow) ?? 1200);
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

  // 指示文42: 中初級帯の参加者行に、繰り上げ拒否（tier_promotion_pref='never'）の人だけ「（上の帯NG）」を付与
  let promotionPrefStr = '';
  if (def.key === 'sat' && style !== 'spectator') {
    const mmr = playerRow ? (getRepresentativeMmr(playerRow) ?? Number(playerRow.mmr)) : null;
    let isLowBand = true;
    if (mmr != null && Number.isFinite(Number(mmr))) {
      isLowBand = Number(mmr) < BAND_BOUNDARY_MMR;
    } else if (participant.rank_tier) {
      const norm = getNormalizedTier(`【${participant.rank_tier}】`);
      isLowBand = norm !== 'プラチナ';
    } else if (playerRow) {
      const tier = getKtmRank(getRepresentativeMmr(playerRow) ?? 1200);
      const norm = getNormalizedTier(`【${tier?.name || ''}】`);
      isLowBand = norm !== 'プラチナ';
    }
    const pref = normalizeTierPromotionPref(playerRow?.tier_promotion_pref ?? participant.tier_promotion_pref);
    if (isLowBand && pref === 'never') {
      promotionPrefStr = '（上の帯NG）';
    }
  }

  return `- <@${discordId}>${styleBadge}${expBadgeStr}${rankStr}${lanePrefStr}${promotionPrefStr}`;
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
 * 複数の Discord ID から ktm_players レコードを一括取得し、
 * ktm_match_participants の集計値（total_games, recent_games_30d, days_since_last_match）をマージして Map で返す。
 * 集計定義は Portal (/api/players/list) と完全に同一の SSoT。
 */
export async function fetchPlayerRowsMap(env, discordIds) {
  if (!discordIds || discordIds.length === 0) return new Map();
  const uniqueIds = [...new Set(discordIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  try {
    const [playerRows, participantRows] = await Promise.all([
      fetchSupabase(
        env,
        'ktm_players',
        `discord_id=in.(${uniqueIds.join(',')})&select=${PLAYER_SELECT}`
      ),
      fetchSupabase(
        env,
        'ktm_match_participants',
        `discord_id=in.(${uniqueIds.join(',')})&select=discord_id,player_name,created_at`
      ).catch((err) => {
        console.warn('fetch match_participants error:', err);
        return null;
      }),
    ]);

    if (!playerRows || !Array.isArray(playerRows)) return new Map();

    // 試合履歴取得に失敗した場合は、フォールバックとして生の行を返す（games_* による判定が動く）
    if (!participantRows) {
      return new Map(playerRows.map((r) => [r.discord_id, r]));
    }

    // Portal (/api/players/list) と同一の集計ロジック
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const statsByDiscord = new Map();
    const statsByNameLower = new Map();

    const updateStats = (map, key, time) => {
      let stat = map.get(key);
      if (!stat) {
        stat = { total: 0, recent30d: 0, lastPlayedAt: null };
        map.set(key, stat);
      }
      stat.total += 1;
      if (time >= thirtyDaysAgo) {
        stat.recent30d += 1;
      }
      if (!stat.lastPlayedAt || time > stat.lastPlayedAt) {
        stat.lastPlayedAt = time;
      }
    };

    (participantRows || []).forEach((row) => {
      const matchTime = row.created_at ? new Date(row.created_at).getTime() : 0;
      if (row.discord_id) {
        updateStats(statsByDiscord, String(row.discord_id).trim(), matchTime);
      }
      if (row.player_name) {
        updateStats(statsByNameLower, String(row.player_name).trim().toLowerCase(), matchTime);
      }
    });

    const enrichedRows = playerRows.map((p) => {
      let historyStat = null;
      if (p.discord_id && statsByDiscord.has(String(p.discord_id).trim())) {
        historyStat = statsByDiscord.get(String(p.discord_id).trim());
      } else if (p.name && statsByNameLower.has(String(p.name).trim().toLowerCase())) {
        historyStat = statsByNameLower.get(String(p.name).trim().toLowerCase());
      }

      const totalGames = historyStat ? historyStat.total : 0;
      const recent30d = historyStat ? historyStat.recent30d : 0;
      const daysSinceLast = historyStat?.lastPlayedAt
        ? Math.floor((now - historyStat.lastPlayedAt) / (24 * 60 * 60 * 1000))
        : null;

      return {
        ...p,
        total_games: totalGames,
        games: totalGames,
        recent_games_30d: recent30d,
        last_played_at: historyStat?.lastPlayedAt ? new Date(historyStat.lastPlayedAt).toISOString() : null,
        days_since_last_match: daysSinceLast,
      };
    });

    return new Map(enrichedRows.map((r) => [r.discord_id, r]));
  } catch (err) {
    console.warn('fetchPlayerRowsMap error:', err);
    return new Map();
  }
}

/**
 * 単一の Discord ID から ktm_players レコードを取得（集計値マージ済み）
 */
export async function fetchPlayerRow(env, discordId) {
  if (!discordId) return null;
  const map = await fetchPlayerRowsMap(env, [discordId]);
  return map.get(discordId) || null;
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


