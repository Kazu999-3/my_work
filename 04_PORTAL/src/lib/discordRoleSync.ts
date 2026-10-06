import { supabaseAdmin } from './supabaseAdmin';
import { discordFetch } from './discordFetch';
import { getPlayerTier, ExperienceTier } from './playerTier';

export interface DiscordRoleConfig {
  enabled: boolean;
  roles: {
    new: string;          // 🔰 初参加
    light: string;        // 🌱 ライト
    regular: string;      // 👑 常連
    experienced: string;  // 🎖️ 経験者
    returning: string;    // ⏳ 復帰勢
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

    // 2. 設定を保存
    const newConfig: DiscordRoleConfig = {
      enabled: true,
      roles: roleIds,
    };
    await saveRoleSyncConfig(newConfig);

    return {
      success: true,
      roles: roleIds,
      message: '5種類のロールを正常にセットアップしました。',
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
  config?: DiscordRoleConfig
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
    // メンバーの現在情報を取得
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
    const currentRoles = new Set(memberData.roles || []);

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

  const config = await getRoleSyncConfig();
  if (!config.enabled) {
    return { total: 0, synced: 0, changed: 0, errors: 0, details: [] };
  }

  // 1. プレイヤー情報を取得
  let query = supabaseAdmin
    .from('ktm_players')
    .select('id, name, discord_id, total_games, recent_games_30d, days_since_last_match, metadata')
    .not('discord_id', 'is', null)
    .not('discord_id', 'eq', '');

  if (options?.playerIds && options.playerIds.length > 0) {
    query = query.in('id', options.playerIds);
  } else if (options?.discordIds && options.discordIds.length > 0) {
    query = query.in('discord_id', options.discordIds);
  }

  const { data: players, error } = await query;
  if (error || !players) {
    console.error('[discordRoleSync] プレイヤー一覧取得失敗:', error);
    return { total: 0, synced: 0, changed: 0, errors: 1, details: [] };
  }

  const results: Array<{ name: string; tier: ExperienceTier; changed: boolean; error?: string }> = [];
  let synced = 0;
  let changedCount = 0;
  let errors = 0;

  // Discord レート制限を避けるため、1人ずつ少しインターバルを挟んで処理
  for (const player of players) {
    const tierInfo = getPlayerTier(player);
    const syncRes = await syncMemberDiscordRole(player.discord_id, tierInfo.tier, config);

    if (syncRes.success) {
      synced++;
      if (syncRes.changed) changedCount++;
      results.push({ name: player.name, tier: tierInfo.tier, changed: syncRes.changed });
    } else {
      errors++;
      results.push({ name: player.name, tier: tierInfo.tier, changed: false, error: syncRes.message });
    }

    // 短いディレイ（100ms）
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    total: players.length,
    synced,
    changed: changedCount,
    errors,
    details: results,
  };
}
