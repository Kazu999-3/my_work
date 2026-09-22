import { supabaseAdmin as supabase } from './supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from './playerCoins';

export interface JackpotData {
  amount: number;
  lastWinner: string | null;
  lastPayout: number;
  lastWonAt: string | null;
}

/**
 * ジャックポット金庫の設計（2026-09-22 是正）
 *
 * 【上限】JACKPOT_CAP
 * 2026-09-22時点で金庫は19,505コインまで育っており、**総流通量15,407コインを上回っていた**
 * （保有者19名 / 平均810 / 中央値601 / 最高保有者4,129）。この状態で誰かが引き当てると
 * 1人で通貨供給を2.3倍にし、2位の4.7倍の資産を持つことになる。
 * 上限に達している間は積立を停止し、経済規模に見合わない成長を止める。
 * ※ユーザー判断により、**既に積み上がっている超過分（約14,505）は据え置き**、
 *   上限は今後の積立停止にのみ適用する。当面は現在の金額のまま宝くじ・ペンタキルの対象になる。
 *
 * 【リセット額】
 * 旧実装は払い出しのたびに RESET_JACKPOT = 10000 を無条件で生成しており、
 * これが金庫がここまで育った主因のひとつだった（原資は全額が新規発行分で、
 * プレイヤーから集めたものではない。宝くじ券の購入実績は0枚だった）。
 * 払い出し後はゼロから積み直す。
 *
 * 【フォールバック値】
 * 旧実装は読み取り失敗時に 12800 を返していたため、DB障害時に存在しないコインを
 * 表示・積立の基準にしてしまう可能性があった。0 にして幻のコインを作らない。
 */
export const JACKPOT_CAP = 5000;
const DEFAULT_JACKPOT = 0;
const RESET_JACKPOT = 0;

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

    // 上限に達している間は積み立てない（経済規模に見合わない成長の停止）
    if (current.amount >= JACKPOT_CAP) {
      return current.amount;
    }

    // 上限をまたぐ場合は上限ちょうどで止める
    const newAmount = Math.min(JACKPOT_CAP, current.amount + Math.floor(amountToAdd));

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
        reason: 'jackpot_claim',
        reasonMetadata: { payout, trigger: 'pentakill' },
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
