import { NextResponse } from 'next/server';
import { randomInt, randomUUID } from 'node:crypto';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { sendShopNotification } from '../../../../lib/discordNotify';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import {
  MINES_GRID_SIZE,
  MINES_MAX_PAYOUT,
  isValidBetAmount,
  isValidMineCount,
  isValidTileIndex,
  maxRevealCount,
  payoutCoins,
  payoutMultiplier,
} from '../../../../lib/minesMath';

export const dynamic = 'force-dynamic';

/**
 * ブッシュ・スカウト（Mines型ミニゲーム）。
 *
 * 【なぜこの作りなのか】
 * ポロ・クラッシュは「時間が経つほど倍率が上がる」ゲームだったため、クライアントの画面と
 * サーバーの判定が通信遅延ぶんだけ必ずズレ、どう直しても「画面では飛んでいるのに利確が
 * 爆発扱いになる」状態を消せずに削除した。
 *
 * このゲームは時間の概念を一切持たない。倍率が動くのは「プレイヤーがマスを開けたとき」だけで、
 * その判定はサーバーが受け取った1回のリクエストの中で完結する。通信に何秒かかっても、
 * 結果は1ミリも変わらない。
 *
 * 【守っていること】
 * - 地雷（キノコ）の位置はDBだけが持ち、決着するまでクライアントへは一切返さない
 * - ベット額は開始時に引き、利確できたときだけ払い戻す（二重払いは status の遷移で防ぐ）
 * - 「開ける」「引き返す」はどちらも条件付きUPDATEが1行成功したときだけ有効とする
 *   （連打・並行リクエストでは2件目以降が0行更新になって弾かれる）
 */

export type MinesStatus = 'pending' | 'lost' | 'settled';

/** クライアントへ返してよい情報だけを詰めた状態。キノコの位置は決着後にしか入らない */
export interface MinesPublicState {
  gameId: string;
  betAmount: number;
  mineCount: number;
  /** 開封済みのマス（安全だったマス、および踏んだキノコ） */
  revealed: number[];
  revealCount: number;
  status: MinesStatus;
  /** 今の倍率（0マスなら0） */
  multiplier: number;
  /** 今すぐ引き返した場合に受け取れる総額 */
  payout: number;
  /** もう1マス開けられる場合の次の倍率。上限に達していれば null */
  nextMultiplier: number | null;
  /** このラウンドで開けられる上限マス数（払い戻し上限で決まる） */
  maxReveal: number;
  /** 決着後のみ: キノコの位置 */
  minePositions?: number[];
  /** 決着後のみ: 踏んでしまったマス */
  hitTile?: number;
  /** 現在のコイン残高 */
  balance: number;
  message: string;
}

interface MinesRow {
  game_id: string;
  discord_id: string;
  bet_amount: number;
  mine_count: number;
  mine_positions: number[];
  revealed: number[];
  reveal_count: number;
  status: MinesStatus;
  payout: number | null;
}

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** 0〜24 を暗号論的乱数で Fisher-Yates シャッフルし、先頭 mineCount 個をキノコにする */
function generateMinePositions(mineCount: number): number[] {
  const tiles = Array.from({ length: MINES_GRID_SIZE }, (_, i) => i);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.slice(0, mineCount).sort((a, b) => a - b);
}

/** 進行中ラウンドの状態を組み立てる（キノコの位置は含めない） */
function buildPendingState(row: MinesRow, balance: number, message: string): MinesPublicState {
  const max = maxRevealCount(row.mine_count, row.bet_amount);
  const canRevealMore = row.reveal_count < max;
  return {
    gameId: row.game_id,
    betAmount: row.bet_amount,
    mineCount: row.mine_count,
    revealed: row.revealed || [],
    revealCount: row.reveal_count,
    status: 'pending',
    multiplier: payoutMultiplier(row.mine_count, row.reveal_count),
    payout: row.reveal_count > 0 ? payoutCoins(row.bet_amount, row.mine_count, row.reveal_count) : 0,
    nextMultiplier: canRevealMore ? payoutMultiplier(row.mine_count, row.reveal_count + 1) : null,
    maxReveal: max,
    balance,
    message,
  };
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return err('カジノを遊ぶにはDiscordログインが必要です。', 401);
    }
    if (!supabaseAdmin) {
      return err('ただいまサーバーが混み合っています。少し待ってからお試しください。', 503);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username,
      autoCreate: true,
    });
    if (!player) {
      return err('プレイヤー情報の取得に失敗しました。', 404);
    }

    switch (action) {
      case 'STATE':
        return await handleState(session.discordId, player);
      case 'START':
        return await handleStart(session.discordId, player, body);
      case 'REVEAL':
        return await handleReveal(session.discordId, player, body);
      case 'CASHOUT':
        return await handleCashout(session.discordId, player, body);
      default:
        return err('不正な操作です。');
    }
  } catch (e: any) {
    console.error('[api/bet/mines] Error:', e);
    return NextResponse.json({ ok: false, error: e?.message || '内部エラーが発生しました' }, { status: 500 });
  }
}

/** 進行中ラウンドを1件取得する */
async function findPendingRound(discordId: string): Promise<MinesRow | null> {
  const { data } = await supabaseAdmin!
    .from('mines_sessions')
    .select('*')
    .eq('discord_id', discordId)
    .eq('status', 'pending')
    .order('started_at', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? (data[0] as MinesRow) : null;
}

/**
 * 画面を開き直したときに、進行中のラウンドへ戻るための問い合わせ。
 * これが無いと、リロードした瞬間に「ベットしたコインだけ消えた」ように見えてしまう。
 */
async function handleState(discordId: string, player: any) {
  const balance = getPlayerCoins(player);
  const row = await findPendingRound(discordId);
  if (!row) {
    return NextResponse.json({ ok: true, state: null, balance });
  }
  return NextResponse.json({
    ok: true,
    state: buildPendingState(row, balance, '中断していたラウンドに戻りました。'),
    balance,
  });
}

async function handleStart(discordId: string, player: any, body: any) {
  const betAmount = Number(body?.betAmount);
  const mineCount = Number(body?.mineCount);

  if (!isValidBetAmount(betAmount)) {
    return err('不正なベット額です (100, 500, 1000コインから選択してください)');
  }
  if (!isValidMineCount(mineCount)) {
    return err('不正なキノコの数です (1, 3, 5, 10個から選択してください)');
  }

  // 進行中のラウンドがあるなら新しく始めさせず、そちらへ戻す（二重ベットの防止）
  const existing = await findPendingRound(discordId);
  if (existing) {
    return NextResponse.json({
      ok: true,
      state: buildPendingState(
        existing,
        getPlayerCoins(player),
        '進行中のラウンドがあります。先にこちらを終わらせてください。'
      ),
    });
  }

  const currentCoins = getPlayerCoins(player);
  if (currentCoins < betAmount) {
    return err(`コインが不足しています (所持: ${currentCoins}🪙 / 必要: ${betAmount}🪙)`);
  }

  // ★順序が重要: 先にラウンドを作り、成功してからコインを引く。
  //
  //   上の findPendingRound は読み取りなので、開始ボタンを連打して2つのリクエストが同時に
  //   来ると、両方とも「進行中なし」と判断してしまう（チェックしてから書き込むレース）。
  //   最終的な排他はDBの部分ユニークインデックス
  //   （uniq_mines_sessions_one_pending_per_player）だけが担保できる。
  //
  //   そのため insert を先に置き、負けた側のリクエストはコインに一切触らずに終わるようにする。
  //   逆順（先に引いてから insert）にすると、1ラウンドしか立たないのにベットが2回引かれる。
  //
  //   この順序の代償として、insert 成功後に減算だけが失敗するとベットを取り損ねる
  //   （updatePlayerCoinsAndInventory は台帳の記録も含めて例外を握りつぶす作りなので検知できない）。
  //   どちらも同じSupabaseへの書き込みで、片方だけが落ちる状況は考えにくいため、
  //   「プレイヤーのコインが余計に減る」リスクの方を潰す側を選んでいる。
  const gameId = randomUUID();
  const { error: insErr } = await supabaseAdmin!.from('mines_sessions').insert({
    game_id: gameId,
    discord_id: discordId,
    bet_amount: betAmount,
    mine_count: mineCount,
    mine_positions: generateMinePositions(mineCount),
    revealed: [],
    reveal_count: 0,
    status: 'pending',
  });

  if (insErr) {
    // 23505 = ユニーク制約違反。連打で先に立ったラウンドがあるので、そちらへ合流させる。
    // このリクエストではまだコインを引いていないため、返金は不要。
    if ((insErr as any)?.code === '23505') {
      const winner = await findPendingRound(discordId);
      if (winner) {
        return NextResponse.json({
          ok: true,
          state: buildPendingState(winner, currentCoins, '進行中のラウンドがあります。先にこちらを終わらせてください。'),
        });
      }
    }
    console.error('[api/bet/mines] START insert failed:', insErr);
    return err('ラウンドを開始できませんでした。コインは引かれていません。', 500);
  }

  const balanceAfterBet = currentCoins - betAmount;
  await updatePlayerCoinsAndInventory({
    player,
    newCoins: balanceAfterBet,
    reason: 'mines',
    reasonMetadata: { phase: 'bet', betAmount, mineCount, gameId },
  });

  const max = maxRevealCount(mineCount, betAmount);
  const state: MinesPublicState = {
    gameId,
    betAmount,
    mineCount,
    revealed: [],
    revealCount: 0,
    status: 'pending',
    multiplier: 0,
    payout: 0,
    nextMultiplier: payoutMultiplier(mineCount, 1),
    maxReveal: max,
    balance: balanceAfterBet,
    message: 'ブッシュを1つずつ開けよう。いつでも引き返せます。',
  };
  return NextResponse.json({ ok: true, state });
}

async function handleReveal(discordId: string, player: any, body: any) {
  const gameId = typeof body?.gameId === 'string' ? body.gameId : null;
  const tileIndex = Number(body?.tileIndex);

  if (!gameId) return err('ラウンドが指定されていません。');
  if (!isValidTileIndex(tileIndex)) return err('不正なマスです。');

  const { data: rows } = await supabaseAdmin!
    .from('mines_sessions')
    .select('*')
    .eq('game_id', gameId)
    .limit(1);

  const row = rows && rows.length > 0 ? (rows[0] as MinesRow) : null;
  if (!row) return err('ラウンドが見つかりません。', 404);
  if (row.discord_id !== discordId) return err('他の人のラウンドは操作できません。', 403);
  if (row.status !== 'pending') return err('このラウンドは既に終了しています。');

  const revealed = row.revealed || [];
  if (revealed.includes(tileIndex)) {
    return err('そのブッシュは既に開けています。');
  }

  const max = maxRevealCount(row.mine_count, row.bet_amount);
  if (row.reveal_count >= max) {
    return err('払い戻しの上限に達しているため、これ以上は開けられません。引き返してください。');
  }

  const balance = getPlayerCoins(player);
  const nextRevealed = [...revealed, tileIndex];
  const nextCount = row.reveal_count + 1;
  const hitMine = (row.mine_positions || []).includes(tileIndex);

  if (hitMine) {
    // 踏んだ場合。ベット額は開始時に引いてあるので、ここでのコイン移動は無い。
    const { data: lostRows } = await supabaseAdmin!
      .from('mines_sessions')
      .update({
        revealed: nextRevealed,
        reveal_count: nextCount,
        status: 'lost',
        settled_at: new Date().toISOString(),
        settle_note: {
          verdict: 'hit_mine',
          revealCount: row.reveal_count,
          hitTile: tileIndex,
          lostAmount: row.bet_amount,
        },
      })
      .eq('game_id', gameId)
      .eq('status', 'pending')
      .eq('reveal_count', row.reveal_count)
      .select();

    if (!lostRows || lostRows.length !== 1) {
      return err('操作が重複しました。画面を開き直してください。', 409);
    }

    const state: MinesPublicState = {
      gameId,
      betAmount: row.bet_amount,
      mineCount: row.mine_count,
      revealed: nextRevealed,
      revealCount: nextCount,
      status: 'lost',
      multiplier: 0,
      payout: 0,
      nextMultiplier: null,
      maxReveal: max,
      minePositions: row.mine_positions,
      hitTile: tileIndex,
      balance,
      message: `🍄 キノコを踏んだ！ ${row.bet_amount}コインの負けです。`,
    };
    return NextResponse.json({ ok: true, state });
  }

  // 安全だった場合。reveal_count を条件に入れることで、連打や並行リクエストの2件目を弾く
  const { data: okRows } = await supabaseAdmin!
    .from('mines_sessions')
    .update({ revealed: nextRevealed, reveal_count: nextCount })
    .eq('game_id', gameId)
    .eq('status', 'pending')
    .eq('reveal_count', row.reveal_count)
    .select();

  if (!okRows || okRows.length !== 1) {
    return err('操作が重複しました。画面を開き直してください。', 409);
  }

  // 上限マス数まで開けきったら、そのまま自動で引き返す（これ以上は伸ばせないため）
  if (nextCount >= max) {
    return await settleRound({
      row: { ...row, revealed: nextRevealed, reveal_count: nextCount },
      player,
      verdict: 'max_payout',
      autoMessage: '🏆 上限まで到達！自動で引き返しました。',
    });
  }

  const state: MinesPublicState = {
    gameId,
    betAmount: row.bet_amount,
    mineCount: row.mine_count,
    revealed: nextRevealed,
    revealCount: nextCount,
    status: 'pending',
    multiplier: payoutMultiplier(row.mine_count, nextCount),
    payout: payoutCoins(row.bet_amount, row.mine_count, nextCount),
    nextMultiplier: payoutMultiplier(row.mine_count, nextCount + 1),
    maxReveal: max,
    balance,
    message: `👁️ 安全！ 今引き返せば ${payoutCoins(row.bet_amount, row.mine_count, nextCount).toLocaleString()}🪙`,
  };
  return NextResponse.json({ ok: true, state });
}

async function handleCashout(discordId: string, player: any, body: any) {
  const gameId = typeof body?.gameId === 'string' ? body.gameId : null;
  if (!gameId) return err('ラウンドが指定されていません。');

  const { data: rows } = await supabaseAdmin!
    .from('mines_sessions')
    .select('*')
    .eq('game_id', gameId)
    .limit(1);

  const row = rows && rows.length > 0 ? (rows[0] as MinesRow) : null;
  if (!row) return err('ラウンドが見つかりません。', 404);
  if (row.discord_id !== discordId) return err('他の人のラウンドは操作できません。', 403);
  if (row.status !== 'pending') return err('このラウンドは既に終了しています。');
  if (row.reveal_count <= 0) {
    return err('まだ1つもブッシュを開けていません。1つ以上開けてから引き返せます。');
  }

  return await settleRound({ row, player, verdict: 'cashout' });
}

/**
 * 引き返し（利確）の確定。
 *
 * ★ここが二重払いの防止点。status が pending の行を settled へ移す UPDATE が
 *   「1行だけ」成功したときにしかコインを払わない。連打で複数のリクエストが同時に来ても、
 *   DBが直列化してくれるので2件目以降は0行更新になり、払い戻しは1回きりになる。
 */
async function settleRound(params: {
  row: MinesRow;
  player: any;
  verdict: 'cashout' | 'max_payout';
  autoMessage?: string;
}) {
  const { row, player, verdict, autoMessage } = params;

  const multiplier = payoutMultiplier(row.mine_count, row.reveal_count);
  const payout = payoutCoins(row.bet_amount, row.mine_count, row.reveal_count);

  const { data: settledRows } = await supabaseAdmin!
    .from('mines_sessions')
    .update({
      status: 'settled',
      payout,
      settled_at: new Date().toISOString(),
      settle_note: {
        verdict,
        revealCount: row.reveal_count,
        multiplier,
        payout,
        betAmount: row.bet_amount,
        mineCount: row.mine_count,
        cappedByMaxPayout: payout >= MINES_MAX_PAYOUT,
      },
    })
    .eq('game_id', row.game_id)
    .eq('status', 'pending')
    .select();

  if (!settledRows || settledRows.length !== 1) {
    return err('このラウンドは既に精算済みです。', 409);
  }

  const balanceBefore = getPlayerCoins(player);
  const newBalance = balanceBefore + payout;
  await updatePlayerCoinsAndInventory({
    player,
    newCoins: newBalance,
    reason: 'mines',
    reasonMetadata: {
      phase: 'cashout',
      betAmount: row.bet_amount,
      mineCount: row.mine_count,
      revealCount: row.reveal_count,
      multiplier,
      payout,
      verdict,
    },
  });

  // 大きく勝ったときだけDiscordへ通知する（スロットの15倍通知と同じ考え方）
  if (multiplier >= 20 || payout >= 10000) {
    const playerName = player?.name || 'プレイヤー';
    const mention = row.discord_id ? `<@${row.discord_id}>` : `**${playerName}**`;
    sendShopNotification({
      content: `🌿 **【ブッシュ・スカウト大勝利！】** ${mention} さんが **${multiplier}倍** で引き返しました！ (+${payout.toLocaleString()}🪙)`,
      embeds: [
        {
          title: '🌿 ブッシュ・スカウト ハイスコア',
          description:
            `${mention} さんが **${row.bet_amount}コイン** を賭けて、キノコ${row.mine_count}個の盤面で ` +
            `**${row.reveal_count}マス** 開けきりました！\n\n倍率: **${multiplier}倍**\n払い戻し: **+${payout.toLocaleString()}🪙**`,
          color: 0x10b981,
          footer: { text: 'KTM カジノ | ブッシュ・スカウト' },
          timestamp: new Date().toISOString(),
        },
      ],
    }).catch(() => {});
  }

  const state: MinesPublicState = {
    gameId: row.game_id,
    betAmount: row.bet_amount,
    mineCount: row.mine_count,
    revealed: row.revealed || [],
    revealCount: row.reveal_count,
    status: 'settled',
    multiplier,
    payout,
    nextMultiplier: null,
    maxReveal: maxRevealCount(row.mine_count, row.bet_amount),
    minePositions: row.mine_positions,
    balance: newBalance,
    message:
      autoMessage ||
      `🏆 ${row.reveal_count}マスで引き返して成功！ ${multiplier}倍 (+${(payout - row.bet_amount).toLocaleString()}🪙の利益)`,
  };
  return NextResponse.json({ ok: true, state });
}
