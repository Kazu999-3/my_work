import { supabaseAdmin as supabase } from './supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from './playerCoins';

export interface JackpotData {
  amount: number;
  lastWinner: string | null;
  lastPayout: number;
  lastWonAt: string | null;
}

const DEFAULT_JACKPOT = 12800;
const RESET_JACKPOT = 10000;

/**
 * 現在のジャックポット金庫情報を取得
 */
export async function getJackpotPool(): Promise<JackpotData> {
  try {
    const { data, error } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', 'casino_jackpot_pool')
      .maybeSingle();

    if (data && data.value) {
      return {
        amount: Number(data.value.amount) || DEFAULT_JACKPOT,
        lastWinner: data.value.lastWinner || null,
        lastPayout: Number(data.value.lastPayout) || 0,
        lastWonAt: data.value.lastWonAt || null,
      };
    }

    // 初回初期化
    const initialData: JackpotData = {
      amount: DEFAULT_JACKPOT,
      lastWinner: null,
      lastPayout: 0,
      lastWonAt: null,
    };

    await supabase
      .from('ktm_settings')
      .upsert({
        key: 'casino_jackpot_pool',
        value: initialData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    return initialData;
  } catch (err) {
    console.warn('[jackpot] getJackpotPool error:', err);
    return {
      amount: DEFAULT_JACKPOT,
      lastWinner: null,
      lastPayout: 0,
      lastWonAt: null,
    };
  }
}

/**
 * ジャックポット金庫にコインを積立加算（ベット手数料や試合開催ボーナス）
 */
export async function addToJackpot(amountToAdd: number): Promise<number> {
  if (amountToAdd <= 0) return (await getJackpotPool()).amount;
  try {
    const current = await getJackpotPool();
    const newAmount = current.amount + Math.floor(amountToAdd);

    await supabase
      .from('ktm_settings')
      .upsert({
        key: 'casino_jackpot_pool',
        value: {
          ...current,
          amount: newAmount,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    return newAmount;
  } catch (err) {
    console.warn('[jackpot] addToJackpot error:', err);
    return DEFAULT_JACKPOT;
  }
}

/**
 * ペンタキル達成時のジャックポット総取り払い戻し処理
 */
export async function claimJackpot(winnerName: string, discordId?: string | null): Promise<{ success: boolean; payout: number; newJackpot: number }> {
  try {
    const current = await getJackpotPool();
    const payout = current.amount;

    // 当選プレイヤーへコイン全額付与
    const player = await findOrCreatePlayer({
      discordId,
      name: winnerName,
      autoCreate: true,
    });

    if (player) {
      const curCoins = getPlayerCoins(player);
      await updatePlayerCoinsAndInventory({
        player,
        newCoins: curCoins + payout,
      });
    }

    // ジャックポット金庫を初期値へリセット & 記録更新
    const updatedData: JackpotData = {
      amount: RESET_JACKPOT,
      lastWinner: winnerName,
      lastPayout: payout,
      lastWonAt: new Date().toISOString(),
    };

    await supabase
      .from('ktm_settings')
      .upsert({
        key: 'casino_jackpot_pool',
        value: updatedData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    return { success: true, payout, newJackpot: RESET_JACKPOT };
  } catch (err) {
    console.error('[jackpot] claimJackpot error:', err);
    return { success: false, payout: 0, newJackpot: DEFAULT_JACKPOT };
  }
}
