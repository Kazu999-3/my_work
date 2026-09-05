import { supabaseAdmin as supabase } from './supabaseAdmin';

export interface PlayerRecord {
  id?: number;
  name: string;
  ign?: string | null;
  discord_id?: string | null;
  coins: number;
  inventory: Array<{
    id: string;
    name: string;
    icon: string;
    boughtAt: string;
    [key: string]: any;
  }>;
  highest_rank?: string;
  mmr?: number;
  role_preferences?: Record<string, any>;
  metadata?: Record<string, any>;
  [key: string]: any;
}

/**
 * プレイヤーレコードから所持コイン数を安全に取得
 */
export function getPlayerCoins(player: any): number {
  if (!player) return 1000;
  if (typeof player.coins === 'number') return player.coins;
  if (typeof player.role_preferences?.coins === 'number') return player.role_preferences.coins;
  if (typeof player.metadata?.coins === 'number') return player.metadata.coins;
  return 1000;
}

/**
 * プレイヤーレコードからインベントリ（所持チケット）を安全に取得
 */
export function getPlayerInventory(player: any): Array<{ id: string; name: string; icon: string; boughtAt: string }> {
  if (!player) return [];
  if (Array.isArray(player.inventory)) return player.inventory;
  if (Array.isArray(player.role_preferences?.inventory)) return player.role_preferences.inventory;
  if (Array.isArray(player.metadata?.inventory)) return player.metadata.inventory;
  return [];
}

/**
 * Discord ID または プレイヤー名からプレイヤーを特定。
 * 見つからない場合は初期所持金1000コインで自動作成（Auto-Provisioning）する。
 */
export async function findOrCreatePlayer(params: {
  discordId?: string | null;
  name?: string | null;
  defaultRank?: string;
  autoCreate?: boolean;
}): Promise<PlayerRecord | null> {
  const { discordId, name, defaultRank = 'UNRANKED', autoCreate = true } = params;
  const cleanDiscordId = discordId?.trim() || null;
  const cleanName = name?.trim() || null;

  if (!cleanDiscordId && !cleanName) {
    return null;
  }

  // Supabaseクライアントがない場合のメモリフォールバック
  if (!supabase) {
    return {
      name: cleanName || 'Player',
      discord_id: cleanDiscordId,
      coins: 1000,
      inventory: [],
      highest_rank: defaultRank,
    };
  }

  // 1. discord_id で完全一致検索
  if (cleanDiscordId) {
    try {
      const { data: byDiscord } = await supabase
        .from('ktm_players')
        .select('*')
        .eq('discord_id', cleanDiscordId)
        .limit(1);

      if (byDiscord && byDiscord.length > 0) {
        const p = byDiscord[0];
        return {
          ...p,
          coins: getPlayerCoins(p),
          inventory: getPlayerInventory(p),
        };
      }
    } catch (e) {
      console.warn('[playerCoins] discord query warning:', e);
    }
  }

  // 2. 名前（name / ign）で検索
  if (cleanName) {
    try {
      // 完全一致
      const { data: byExactName } = await supabase
        .from('ktm_players')
        .select('*')
        .eq('name', cleanName)
        .limit(1);

      if (byExactName && byExactName.length > 0) {
        const p = byExactName[0];
        if (cleanDiscordId && !p.discord_id) {
          await supabase
            .from('ktm_players')
            .update({ discord_id: cleanDiscordId })
            .eq('id', p.id);
          p.discord_id = cleanDiscordId;
        }
        return {
          ...p,
          coins: getPlayerCoins(p),
          inventory: getPlayerInventory(p),
        };
      }

      // 類似検索 (ilike)
      const { data: byIlike } = await supabase
        .from('ktm_players')
        .select('*')
        .ilike('name', `%${cleanName}%`)
        .limit(1);

      if (byIlike && byIlike.length > 0) {
        const p = byIlike[0];
        if (cleanDiscordId && !p.discord_id) {
          await supabase
            .from('ktm_players')
            .update({ discord_id: cleanDiscordId })
            .eq('id', p.id);
          p.discord_id = cleanDiscordId;
        }
        return {
          ...p,
          coins: getPlayerCoins(p),
          inventory: getPlayerInventory(p),
        };
      }
    } catch (e) {
      console.warn('[playerCoins] name query warning:', e);
    }
  }

  // 3. 見つからず autoCreate が false の場合
  if (!autoCreate) {
    return null;
  }

  // 4. 見つからない場合は新規プレイヤーとして初期化 (1000コイン付与)
  const newPlayerName = cleanName || `Player_${cleanDiscordId?.slice(-4) || Math.floor(Math.random() * 10000)}`;
  const initialPrefs = {
    coins: 1000,
    inventory: [],
    createdVia: 'auto_provision_casino',
  };

  const newPlayerData: any = {
    name: newPlayerName,
    discord_id: cleanDiscordId,
    coins: 1000,
    inventory: [],
    highest_rank: defaultRank,
    mmr: 1200,
    is_active: true,
    role_preferences: initialPrefs,
  };

  try {
    const { data: inserted, error: insErr } = await supabase
      .from('ktm_players')
      .insert(newPlayerData)
      .select('*')
      .maybeSingle();

    if (insErr) {
      // 名前のユニーク衝突などの場合、既存行を再検索
      const { data: existing } = await supabase
        .from('ktm_players')
        .select('*')
        .eq('name', newPlayerName)
        .limit(1);

      if (existing && existing.length > 0) {
        const p = existing[0];
        return {
          ...p,
          coins: getPlayerCoins(p),
          inventory: getPlayerInventory(p),
        };
      }

      // フォールバックINSERT（最小構成）
      const fallbackData: any = {
        name: newPlayerName,
        discord_id: cleanDiscordId,
        highest_rank: defaultRank,
        mmr: 1200,
        is_active: true,
        role_preferences: initialPrefs,
      };
      const { data: fbInserted } = await supabase
        .from('ktm_players')
        .insert(fallbackData)
        .select('*')
        .maybeSingle();

      if (fbInserted) {
        return {
          ...fbInserted,
          coins: 1000,
          inventory: [],
        };
      }
    } else if (inserted) {
      return {
        ...inserted,
        coins: 1000,
        inventory: [],
      };
    }

    return {
      name: newPlayerName,
      discord_id: cleanDiscordId,
      coins: 1000,
      inventory: [],
      highest_rank: defaultRank,
    };
  } catch (e) {
    console.error('[playerCoins] Exception during findOrCreatePlayer:', e);
    return {
      name: newPlayerName,
      discord_id: cleanDiscordId,
      coins: 1000,
      inventory: [],
      highest_rank: defaultRank,
    };
  }
}

/**
 * プレイヤーのコインおよびインベントリを安全に更新
 */
export async function updatePlayerCoinsAndInventory(params: {
  player: PlayerRecord;
  newCoins?: number;
  newInventory?: Array<{ id: string; name: string; icon: string; boughtAt: string }>;
  rolePreferencesUpdate?: Record<string, any>;
}): Promise<{ success: boolean; coins: number; inventory: any[]; error?: string }> {
  const { player, newCoins, newInventory, rolePreferencesUpdate } = params;
  const targetCoins = typeof newCoins === 'number' ? newCoins : getPlayerCoins(player);
  const targetInventory = Array.isArray(newInventory) ? newInventory : getPlayerInventory(player);

  const updatedPrefs = {
    ...(player.role_preferences || {}),
    ...(rolePreferencesUpdate || {}),
    coins: targetCoins,
    inventory: targetInventory,
  };

  if (!supabase) {
    return { success: true, coins: targetCoins, inventory: targetInventory };
  }

  const updatePayload: any = {
    role_preferences: updatedPrefs,
    coins: targetCoins,
    inventory: targetInventory,
  };

  try {
    const { error: upErr } = await supabase
      .from('ktm_players')
      .update(updatePayload)
      .eq('name', player.name);

    if (upErr) {
      console.warn('[playerCoins] Full update failed, falling back to role_preferences only:', upErr.message);
      // coins/inventory カラムが存在しない場合のフォールバック更新
      await supabase
        .from('ktm_players')
        .update({ role_preferences: updatedPrefs })
        .eq('name', player.name);
    }

    return {
      success: true,
      coins: targetCoins,
      inventory: targetInventory,
    };
  } catch (e: any) {
    console.error('[playerCoins] Exception in updatePlayerCoinsAndInventory:', e);
    return { success: true, coins: targetCoins, inventory: targetInventory };
  }
}
