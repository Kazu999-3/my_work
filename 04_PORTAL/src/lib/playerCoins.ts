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
  const colCoins = typeof player.coins === 'number' ? player.coins : null;
  const prefCoins = typeof player.role_preferences?.coins === 'number' ? player.role_preferences.coins : null;
  const metaCoins = typeof player.metadata?.coins === 'number' ? player.metadata.coins : null;

  // colCoins が 1000 以外で存在する場合はカラムの最新値を優先
  if (colCoins !== null && colCoins !== 1000) return colCoins;
  // 過去のJSONにコイン記録（デイリー報酬やベット等）がある場合はそれを優先
  if (prefCoins !== null) return prefCoins;
  if (metaCoins !== null) return metaCoins;
  if (colCoins !== null) return colCoins;
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

      // 大文字小文字無視の完全一致 (ilike はワイルドカードなし)
      const { data: byIlike } = await supabase
        .from('ktm_players')
        .select('*')
        .ilike('name', cleanName)
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

    return null;
  } catch (e) {
    console.error('[playerCoins] Exception during findOrCreatePlayer:', e);
    return null;
  }
}

/**
 * プレイヤーのコインおよびインベントリを安全に更新
 * ★ 重要: 希望レーン（primary / secondary / ignore_role 等）の設定を絶対に消さないよう厳重プロテクト
 */
export async function updatePlayerCoinsAndInventory(params: {
  player: PlayerRecord;
  newCoins?: number;
  newInventory?: Array<{ id: string; name: string; icon: string; boughtAt: string }>;
  /** 今の持ち物の末尾に追加する（DB 上で追加するので同時購入でも消えない。2026-10-19 ショップ用） */
  appendInventory?: Array<{ id: string; name: string; icon: string; boughtAt: string }>;
  rolePreferencesUpdate?: Record<string, any>;
  /**
   * コイン増減の理由。渡すと coin_transactions へ台帳記録される（2026-09-22 新設）。
   * 省略しても動作は変わらないが、コインが動く経路では必ず渡すこと。
   * 渡し忘れると「収支が追えない」という元の問題に戻る。
   */
  reason?: import('./coinLedger').CoinReason;
  /** 倍率・オッズ・購入アイテムなど、台帳へ残す補足情報 */
  reasonMetadata?: Record<string, any>;
}): Promise<{ success: boolean; coins: number; inventory: any[]; error?: string }> {
  const { player, newCoins, newInventory, appendInventory, rolePreferencesUpdate, reason, reasonMetadata } = params;
  const previousCoins = getPlayerCoins(player);
  const targetCoins = typeof newCoins === 'number' ? newCoins : previousCoins;
  const targetInventory = Array.isArray(newInventory)
    ? newInventory
    : Array.isArray(appendInventory) ? [...getPlayerInventory(player), ...appendInventory] : getPlayerInventory(player);

  if (!supabase) {
    return { success: true, coins: targetCoins, inventory: targetInventory };
  }

  try {
    // 2026-10-19: コインは DB 上の足し算（apply_player_coin_delta、migration 106）で更新する。
    // 以前は「呼び出し側が読んだ残高から計算した値」で上書きしており、同じ人の処理が同時に走ると
    // 後から書いた1回分だけが残っていた（プリンコ連打で負けが消え、台帳と残高が +24,842 ずれていた）。
    // 呼び出し側の newCoins は「読んだ時点の残高からの増減」として扱う。
    const delta = targetCoins - previousCoins;
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('apply_player_coin_delta', {
      p_name: player.name,
      p_delta: delta,
      p_inventory: Array.isArray(newInventory) ? newInventory : null,
      p_prefs_patch: rolePreferencesUpdate || null,
      p_inventory_append: !Array.isArray(newInventory) && Array.isArray(appendInventory) ? appendInventory : null,
    });
    // 関数がまだ無い（マイグレーション適用前）時だけ、従来の上書き方式で続ける
    const rpcMissing = !!rpcErr && (rpcErr.code === 'PGRST202' || /apply_player_coin_delta/.test(rpcErr.message || ''));
    if (!rpcMissing) {
      if (rpcErr) {
        console.error('[playerCoins] apply_player_coin_delta failed:', rpcErr.message);
        return { success: false, coins: previousCoins, inventory: getPlayerInventory(player), error: rpcErr.message };
      }
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row) {
        // 減らす時に残高が足りない（同時に別の賭けで減った等）、またはプレイヤーが見つからない
        return { success: false, coins: previousCoins, inventory: getPlayerInventory(player), error: 'コインが不足しています。' };
      }
      const appliedCoins = Number(row.new_coins);
      if (reason && delta !== 0) {
        const { recordCoinTransaction } = await import('./coinLedger');
        await recordCoinTransaction({
          player,
          delta,
          balanceAfter: appliedCoins,
          reason,
          metadata: reasonMetadata,
        });
      }
      return { success: true, coins: appliedCoins, inventory: targetInventory };
    }

    // ── 以下は apply_player_coin_delta が無い時の従来方式 ──
    // 1. DBから最新の role_preferences を取得（希望レーンの破壊を完全防止）
    let currentDbPrefs: Record<string, any> = {};
    const { data: dbCurrent } = await supabase
      .from('ktm_players')
      .select('role_preferences')
      .eq('name', player.name)
      .limit(1)
      .maybeSingle();

    if (dbCurrent && dbCurrent.role_preferences && typeof dbCurrent.role_preferences === 'object') {
      currentDbPrefs = dbCurrent.role_preferences;
    } else if (player.role_preferences && typeof player.role_preferences === 'object') {
      currentDbPrefs = player.role_preferences;
    }

    // 2. 既存の希望レーン情報（primary, secondary, ignore_role 等）を完全保護してマージ
    const updatedPrefs = {
      ...currentDbPrefs,
      ...(rolePreferencesUpdate || {}),
      coins: targetCoins,
      inventory: targetInventory,
    };

    const updatePayload: any = {
      role_preferences: updatedPrefs,
      coins: targetCoins,
      inventory: targetInventory,
    };

    const { error: upErr } = await supabase
      .from('ktm_players')
      .update(updatePayload)
      .eq('name', player.name);

    if (upErr) {
      console.warn('[playerCoins] Full update failed, falling back to role_preferences only:', upErr.message);
      // coins/inventory カラムが存在しない場合のフォールバック更新
      const { error: fbErr } = await supabase
        .from('ktm_players')
        .update({ role_preferences: updatedPrefs })
        .eq('name', player.name);

      if (fbErr) {
        console.error('[playerCoins] Both full update and fallback update failed:', fbErr.message);
        return { success: false, coins: previousCoins, inventory: getPlayerInventory(player), error: fbErr.message };
      }
    }

    // コイン増減の台帳記録。失敗してもコイン更新自体は成立しているので握りつぶす。
    if (reason && targetCoins !== previousCoins) {
      const { recordCoinTransaction } = await import('./coinLedger');
      await recordCoinTransaction({
        player,
        delta: targetCoins - previousCoins,
        balanceAfter: targetCoins,
        reason,
        metadata: reasonMetadata,
      });
    }

    return {
      success: true,
      coins: targetCoins,
      inventory: targetInventory,
    };
  } catch (e: any) {
    console.error('[playerCoins] Exception in updatePlayerCoinsAndInventory:', e);
    return { success: false, coins: previousCoins, inventory: getPlayerInventory(player), error: e.message };
  }
}

/**
 * 持ち物から指定 id の物を最大 count 枚、DB 上で減らし、実際に減らせた枚数を返す（consume_player_items、migration 110）。
 * 以前は各所で「読んだ持ち物から抜いた配列」を丸ごと書いており、同時に買った物が消えたり、
 * 特権を2回連続で押すと1枚で2回発動したりしていた（2026-10-19）。
 * 0 が返ったら「持っていない（もう使われた）」として扱うこと。
 */
export async function consumeInventoryItems(player: PlayerRecord, itemId: string, count = 1): Promise<number> {
  if (!supabase || count <= 0) return 0;
  const { data, error } = await supabase.rpc('consume_player_items', {
    p_name: player.name,
    p_item_id: itemId,
    p_count: count,
  });
  const rpcMissing = !!error && (error.code === 'PGRST202' || /consume_player_items/.test(error.message || ''));
  if (!rpcMissing) {
    if (error) {
      console.error('[playerCoins] consume_player_items failed:', error.message);
      return 0;
    }
    return Number(data) || 0;
  }

  // ── 関数がまだ無い（マイグレーション適用前）時の従来方式: 読み直して抜いた配列で上書き ──
  const { data: fresh } = await supabase
    .from('ktm_players')
    .select('inventory, role_preferences, metadata')
    .eq('name', player.name)
    .limit(1)
    .maybeSingle();
  const inv = [...getPlayerInventory(fresh || player)];
  let removed = 0;
  const next = inv.filter((it: any) => {
    if (removed < count && it?.id === itemId) { removed++; return false; }
    return true;
  });
  if (removed === 0) return 0;
  const prefs = fresh?.role_preferences && typeof fresh.role_preferences === 'object' ? fresh.role_preferences : {};
  const { error: upErr } = await supabase
    .from('ktm_players')
    .update({ inventory: next, role_preferences: { ...prefs, inventory: next } })
    .eq('name', player.name);
  return upErr ? 0 : removed;
}
