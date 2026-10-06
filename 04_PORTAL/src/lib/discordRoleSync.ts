import { supabaseAdmin } from './supabaseAdmin';
import { discordFetch } from './discordFetch';
import { fetchAllRows } from './fetchAll';
import { getPlayerTier, ExperienceTier } from './playerTier';

export type PlaystyleRoleKey = 'soloq' | 'flex' | 'lane_practice' | 'champ_practice' | 'learner';

export interface DiscordRoleConfig {
  enabled: boolean;
  roles: {
    new: string;          // 🔰 初参加
    light: string;        // 🌱 ライト
    regular: string;      // 👑 常連
    experienced: string;  // 🎖️ 経験者
    returning: string;    // ⏳ 復帰勢
  };
  playstyle_roles?: {
    soloq: string;          // 🥊 ソロキュー奮闘中
    flex: string;           // 🤝 フレックス希望
    lane_practice: string;  // 🛡️ 不慣れレーン練習中
    champ_practice: string; // 🧪 キャラ練習中
    learner: string;        // 📖 教わりたい
  };
  updated_at?: string;
}

export const ROLE_DEFINITIONS: Record<ExperienceTier, { name: string; color: number; description: string }> = {
  new: {
    name: '🔰 初参加',
    color: 0x2ecc71, // エメラルドグリーン
    description: '内戦通算0戦の初参加メンバー',
  },
  light: {
    name: '🌱 ライト',
    color: 0x1abc9c, // ターコイズ
    description: '内戦通算1〜4戦のライトメンバー',
  },
  regular: {
    name: '👑 常連',
    color: 0xf1c40f, // ゴールド
    description: '内戦通算5戦以上かつ直近30日以内に参加しているアクティブメンバー',
  },
  experienced: {
    name: '🎖️ 経験者',
    color: 0x3498db, // ブルー
    description: '内戦通算5戦以上かつブランク31〜59日の経験者メンバー',
  },
  returning: {
    name: '⏳ 復帰勢',
    color: 0x95a5a6, // シルバー
    description: '内戦通算5戦以上かつブランク60日以上の復帰メンバー',
  },
};

export const PLAYSTYLE_ROLE_DEFINITIONS: Record<PlaystyleRoleKey, { name: string; color: number; description: string }> = {
  soloq: {
    name: '🥊 ソロキュー奮闘中',
    color: 0xe74c3c, // レッド
    description: 'ソロランクを回したい・デュオ募集中のメンバー',
  },
  flex: {
    name: '🤝 フレックス希望',
    color: 0x9b59b6, // パープル
    description: 'フレックス（3〜5人）で遊びたいメンバー',
  },
  lane_practice: {
    name: '🛡️ 不慣れレーン練習中',
    color: 0xe67e22, // オレンジ
    description: 'メイン以外の新レーンを練習したいメンバー',
  },
  champ_practice: {
    name: '🧪 キャラ練習中',
    color: 0x1abc9c, // ターコイズ
    description: '不慣れな新チャンピオンを練習したいメンバー',
  },
  learner: {
    name: '📖 教わりたい',
    color: 0x3498db, // ブルー
    description: '立ち回りやアドバイスを教えてもらいたいメンバー',
  },
};

const SETTINGS_KEY = 'discord_role_sync';

/**
 * DB (ktm_settings) または環境変数からロール同期設定を取得
 */
export async function getRoleSyncConfig(): Promise<DiscordRoleConfig> {
  const fallbackConfig: DiscordRoleConfig = {
    enabled: true,
    roles: {
      new: process.env.DISCORD_ROLE_NEW || '',
      light: process.env.DISCORD_ROLE_LIGHT || '',
      regular: process.env.DISCORD_ROLE_REGULAR || '',
      experienced: process.env.DISCORD_ROLE_EXPERIENCED || '',
      returning: process.env.DISCORD_ROLE_RETURNING || '',
    },
  };

  if (!supabaseAdmin) return fallbackConfig;

  try {
    const { data } = await supabaseAdmin
      .from('ktm_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (data && data.value && typeof data.value === 'object') {
      return {
        enabled: data.value.enabled ?? true,
        roles: {
          new: data.value.roles?.new || fallbackConfig.roles.new,
          light: data.value.roles?.light || fallbackConfig.roles.light,
          regular: data.value.roles?.regular || fallbackConfig.roles.regular,
          experienced: data.value.roles?.experienced || fallbackConfig.roles.experienced,
          returning: data.value.roles?.returning || fallbackConfig.roles.returning,
        },
        playstyle_roles: data.value.playstyle_roles || {
          soloq: '',
          flex: '',
          lane_practice: '',
          champ_practice: '',
          learner: '',
        },
        updated_at: data.value.updated_at,
      };
    }
  } catch (err: any) {
    console.warn('[discordRoleSync] 設定の読み込みに失敗:', err?.message);
  }

  return fallbackConfig;
}

/**
 * DB (ktm_settings) にロール同期設定を保存
 */
export async function saveRoleSyncConfig(config: DiscordRoleConfig): Promise<boolean> {
  if (!supabaseAdmin) return false;

  try {
    const payload = {
      ...config,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from('ktm_settings')
      .upsert(
        {
          key: SETTINGS_KEY,
          value: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error('[discordRoleSync] 設定の保存に失敗:', err);
    return false;
  }
}

/**
 * Discordサーバー上に5つのロールを自動作成（または同名ロールを再利用）し、設定に保存する
 */
export async function setupDiscordRoles(): Promise<{
  success: boolean;
  roles: DiscordRoleConfig['roles'];
  playstyle_roles?: DiscordRoleConfig['playstyle_roles'];
  message: string;
}> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return {
      success: false,
      roles: { new: '', light: '', regular: '', experienced: '', returning: '' },
      message: 'DISCORD_BOT_TOKEN または DISCORD_GUILD_ID が設定されていません。',
    };
  }

  try {
    // 1. 既存のロール一覧を取得して同名ロールがあれば再利用
    const listRes = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`ロール一覧取得失敗: ${listRes.status} ${errText}`);
    }

    const existingRoles: Array<{ id: string; name: string }> = await listRes.json();
    const roleIds: Record<ExperienceTier, string> = {
      new: '',
      light: '',
      regular: '',
      experienced: '',
      returning: '',
    };

    const tiers: ExperienceTier[] = ['new', 'light', 'regular', 'experienced', 'returning'];

    for (const tier of tiers) {
      const def = ROLE_DEFINITIONS[tier];
      // 同名ロールが既に存在するか確認
      const found = existingRoles.find((r) => r.name === def.name);
      if (found) {
        roleIds[tier] = found.id;
        continue;
      }

      // 存在しなければ新規作成
      const createRes = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: def.name,
          color: def.color,
          hoist: false,
          mentionable: true,
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`ロール「${def.name}」の作成失敗: ${createRes.status} ${errText}`);
      }

      const newRole = await createRes.json();
      roleIds[tier] = newRole.id;
    }

    // 2. プレイスタイル志向性ロールの作成（または再利用）
    const playstyleRoleIds: Record<PlaystyleRoleKey, string> = {
      soloq: '',
      flex: '',
      lane_practice: '',
      champ_practice: '',
      learner: '',
    };
    const playstyleKeys: PlaystyleRoleKey[] = ['soloq', 'flex', 'lane_practice', 'champ_practice', 'learner'];

    for (const key of playstyleKeys) {
      const def = PLAYSTYLE_ROLE_DEFINITIONS[key];
      const found = existingRoles.find((r) => r.name === def.name);
      if (found) {
        playstyleRoleIds[key] = found.id;
        continue;
      }

      const createRes = await discordFetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: def.name,
          color: def.color,
          hoist: false,
          mentionable: true,
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`ロール「${def.name}」の作成失敗: ${createRes.status} ${errText}`);
      }

      const newRole = await createRes.json();
      playstyleRoleIds[key] = newRole.id;
    }

    // 3. 設定を保存
    const newConfig: DiscordRoleConfig = {
      enabled: true,
      roles: roleIds,
      playstyle_roles: playstyleRoleIds,
    };
    await saveRoleSyncConfig(newConfig);

    return {
      success: true,
      roles: roleIds,
      playstyle_roles: playstyleRoleIds,
      message: '経験度5種 ＆ プレイスタイル5種のロール（計10種）を正常にセットアップしました。',
    };
  } catch (err: any) {
    console.error('[discordRoleSync] セットアップエラー:', err);
    return {
      success: false,
      roles: { new: '', light: '', regular: '', experienced: '', returning: '' },
      message: err.message || 'ロールセットアップ中にエラーが発生しました。',
    };
  }
}

/**
 * 対象メンバーのDiscordロールを目標Tierに合わせて同期（付与・剥奪）する
 */
export async function syncMemberDiscordRole(
  discordId: string,
  targetTier: ExperienceTier,
  config?: DiscordRoleConfig,
  existingRoles?: Set<string>
): Promise<{ success: boolean; changed: boolean; message?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId || !discordId) {
    return { success: false, changed: false, message: '認証情報またはDiscord IDが不足しています。' };
  }

  const roleConfig = config || (await getRoleSyncConfig());
  if (!roleConfig.enabled) {
    return { success: true, changed: false, message: 'ロール同期は無効化されています。' };
  }

  const targetRoleId = roleConfig.roles[targetTier];
  if (!targetRoleId) {
    return { success: false, changed: false, message: `Tier「${targetTier}」に対応するロールIDが未設定です。` };
  }

  // 5種類の全ロールID
  const allManagedRoleIds = Object.values(roleConfig.roles).filter(Boolean);

  try {
    let currentRoles = existingRoles;

    // 既存ロールが渡されていない場合のみ個別取得
    if (!currentRoles) {
      const memberRes = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
        { headers: { Authorization: `Bot ${token}` } }
      );

      if (memberRes.status === 404) {
        return { success: false, changed: false, message: 'サーバーにユーザーが存在しません。' };
      }
      if (!memberRes.ok) {
        const errText = await memberRes.text();
        return { success: false, changed: false, message: `メンバー取得失敗: ${memberRes.status} ${errText}` };
      }

      const memberData: { roles: string[] } = await memberRes.json();
      currentRoles = new Set(memberData.roles || []);
    }

    let changed = false;

    // 1. 目標ロールが付いていなければ付与
    if (!currentRoles.has(targetRoleId)) {
      const addRes = await discordFetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${targetRoleId}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bot ${token}` },
        }
      );
      if (addRes.ok) {
        changed = true;
      } else {
        const errText = await addRes.text();
        console.warn(`[discordRoleSync] ロール付与失敗 (${discordId}, ${targetRoleId}):`, errText);
      }
    }

    // 2. 他の4つのTierロールが付いていれば剥奪
    for (const roleId of allManagedRoleIds) {
      if (roleId !== targetRoleId && currentRoles.has(roleId)) {
        const removeRes = await discordFetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bot ${token}` },
          }
        );
        if (removeRes.ok) {
          changed = true;
        } else {
          const errText = await removeRes.text();
          console.warn(`[discordRoleSync] 旧ロール剥奪失敗 (${discordId}, ${roleId}):`, errText);
        }
      }
    }

    return { success: true, changed };
  } catch (err: any) {
    console.error(`[discordRoleSync] 同期エラー (${discordId}):`, err);
    return { success: false, changed: false, message: err.message };
  }
}

/**
 * 指定プレイヤー（または全プレイヤー）の戦績を元にDiscordロールを一括同期する
 * N+1問題を根絶するため、Discordサーバーメンバー一覧を一括取得してローカルで突合し、
 * 変更が必要なメンバーのみ最小限のAPIコールで超高速同期する。
 */
export async function syncPlayersDiscordRoles(options?: {
  playerIds?: number[];
  discordIds?: string[];
}): Promise<{
  total: number;
  synced: number;
  changed: number;
  errors: number;
  details: Array<{ name: string; tier: ExperienceTier; changed: boolean; error?: string }>;
}> {
  if (!supabaseAdmin) {
    return { total: 0, synced: 0, changed: 0, errors: 0, details: [] };
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return { total: 0, synced: 0, changed: 0, errors: 1, details: [] };
  }

  const config = await getRoleSyncConfig();
  if (!config.enabled) {
    return { total: 0, synced: 0, changed: 0, errors: 0, details: [] };
  }

  // 1. プレイヤー情報と試合参加実績を並行取得
  let query = supabaseAdmin
    .from('ktm_players')
    .select('id, name, discord_id, metadata')
    .not('discord_id', 'is', null)
    .not('discord_id', 'eq', '');

  if (options?.playerIds && options.playerIds.length > 0) {
    query = query.in('id', options.playerIds);
  } else if (options?.discordIds && options.discordIds.length > 0) {
    query = query.in('discord_id', options.discordIds);
  }

  // サーバーメンバー一覧・DBプレイヤー・試合参加実績の3つを一気に並行取得！
  const [
    { data: players, error: pError },
    { data: participants, error: mError },
    guildMembersRes,
  ] = await Promise.all([
    query,
    fetchAllRows((from, to) =>
      supabaseAdmin
        .from('ktm_match_participants')
        .select('player_name, discord_id, created_at')
        .range(from, to)
    ),
    discordFetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${token}` },
    }).catch(() => null),
  ]);

  if (pError || !players) {
    console.error('[discordRoleSync] プレイヤー一覧取得失敗:', pError);
    return { total: 0, synced: 0, changed: 0, errors: 1, details: [] };
  }

  // Discord サーバーメンバー一覧のマップ作成 (discord_id -> Set of role IDs)
  const guildMembersMap = new Map<string, Set<string>>();
  if (guildMembersRes && guildMembersRes.ok) {
    try {
      const members: Array<{ user: { id: string }; roles: string[] }> = await guildMembersRes.json();
      for (const m of members) {
        if (m.user?.id) {
          guildMembersMap.set(m.user.id, new Set(m.roles || []));
        }
      }
    } catch (e: any) {
      console.warn('[discordRoleSync] メンバー一覧パース例外:', e?.message);
    }
  }

  // 2. 参加実績の集計（通算・直近30日・最終参加日）
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  interface PlayerHistoryStats {
    total: number;
    recent30d: number;
    lastPlayedAt: number | null;
  }

  const statsByDiscord = new Map<string, PlayerHistoryStats>();
  const statsByNameLower = new Map<string, PlayerHistoryStats>();

  const updateStats = (map: Map<string, PlayerHistoryStats>, key: string, time: number) => {
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

  (participants || []).forEach((row: any) => {
    const matchTime = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (row.discord_id) {
      updateStats(statsByDiscord, String(row.discord_id).trim(), matchTime);
    }
    if (row.player_name) {
      updateStats(statsByNameLower, String(row.player_name).trim().toLowerCase(), matchTime);
    }
  });

  const results: Array<{ name: string; tier: ExperienceTier; changed: boolean; error?: string }> = [];
  let synced = 0;
  let changedCount = 0;
  let errors = 0;

  const allManagedRoleIds = Object.values(config.roles).filter(Boolean);

  // 3. 各プレイヤーの処理（変更不要な人はAPI呼び出しゼロ！）
  for (const player of players) {
    const dId = String(player.discord_id).trim();
    let historyStat: PlayerHistoryStats = { total: 0, recent30d: 0, lastPlayedAt: null };

    if (statsByDiscord.has(dId)) {
      historyStat = statsByDiscord.get(dId)!;
    } else if (player.name && statsByNameLower.has(String(player.name).trim().toLowerCase())) {
      historyStat = statsByNameLower.get(String(player.name).trim().toLowerCase())!;
    }

    const daysSinceLast = historyStat.lastPlayedAt
      ? Math.floor((now - historyStat.lastPlayedAt) / (24 * 60 * 60 * 1000))
      : null;

    const enrichedStats = {
      total_games: historyStat.total,
      recent_games_30d: historyStat.recent30d,
      days_since_last_match: daysSinceLast,
      metadata: player.metadata,
    };

    const tierInfo = getPlayerTier(enrichedStats);
    const targetRoleId = config.roles[tierInfo.tier];

    // 一括取得できた場合、Discordサーバー内に存在するか確認
    const currentRoles = guildMembersMap.get(dId);
    if (guildMembersMap.size > 0 && !currentRoles) {
      results.push({ name: player.name, tier: tierInfo.tier, changed: false, error: 'サーバーに不在' });
      continue;
    }

    // 既に目標ロールが付いており、余分な管理ロールも付いていない場合は完全スキップ（APIコール0回！）
    if (currentRoles && targetRoleId && currentRoles.has(targetRoleId)) {
      const hasOtherManagedRole = allManagedRoleIds.some((rId) => rId !== targetRoleId && currentRoles.has(rId));
      if (!hasOtherManagedRole) {
        synced++;
        results.push({ name: player.name, tier: tierInfo.tier, changed: false });
        continue;
      }
    }

    // 変更が必要な場合のみ同期APIを実行
    const syncRes = await syncMemberDiscordRole(dId, tierInfo.tier, config, currentRoles);

    if (syncRes.success) {
      synced++;
      if (syncRes.changed) changedCount++;
      results.push({ name: player.name, tier: tierInfo.tier, changed: syncRes.changed });
    } else {
      errors++;
      results.push({ name: player.name, tier: tierInfo.tier, changed: false, error: syncRes.message });
    }

    // 変更実行時のみ短時間ディレイ
    if (syncRes.changed) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  return {
    total: players.length,
    synced,
    changed: changedCount,
    errors,
    details: results,
  };
}
