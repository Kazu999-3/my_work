import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { sendShopNotification } from '../../../../lib/discordNotify';

export const dynamic = 'force-dynamic';

const CRASH_SECRET = process.env.CRASH_GAME_SECRET || process.env.SESSION_SECRET || 'ktm_poro_crash_secret_key_2026';

function signCrashPayload(payload: any): string {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', CRASH_SECRET).update(dataStr).digest('hex');
  return `${dataStr}.${sig}`;
}

function verifyCrashToken(token: string): any | null {
  try {
    const [dataStr, sig] = token.split('.');
    if (!dataStr || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', CRASH_SECRET).update(dataStr).digest('hex');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf-8'));
    return payload;
  } catch {
    return null;
  }
}

/**
 * クラッシュ倍率の計算 (ハウスエッジ 約6%)
 */
function generateCrashPoint(): number {
  const r = Math.random();
  // 3%の確率で即死 (1.00x)
  if (r < 0.03) {
    return 1.0;
  }
  // 指数関数的カーブ (RTP約94%)
  const raw = 100 / (100 - r * 94);
  const capped = Math.min(100, raw);
  return Math.floor(capped * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: 'クラッシュを遊ぶにはDiscordログインが必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || 'START';

    // プレイヤーの取得
    const player = await findOrCreatePlayer({
      discordId: session.discordId,
      name: session.displayName || session.username,
      autoCreate: true,
    });

    if (!player) {
      return NextResponse.json({ ok: false, error: 'プレイヤー情報の取得に失敗しました。' }, { status: 404 });
    }

    // ==========================================
    // 1. 発射（ゲーム開始・ベット減額）
    // ==========================================
    if (action === 'START') {
      const betAmount = parseInt(body.betAmount, 10);
      const ALLOWED_BETS = [50, 100, 300, 500, 1000];

      if (isNaN(betAmount) || !ALLOWED_BETS.includes(betAmount)) {
        return NextResponse.json({ ok: false, error: '不正なベット額です (50, 100, 300, 500, 1000コインから選択)' }, { status: 400 });
      }

      const currentCoins = getPlayerCoins(player);
      if (currentCoins < betAmount) {
        return NextResponse.json({ ok: false, error: `コインが不足しています (所持: ${currentCoins}🪙 / 必要: ${betAmount}🪙)` }, { status: 400 });
      }

      // ベット額を減額して保存
      const newBalance = currentCoins - betAmount;
      await updatePlayerCoinsAndInventory({
        player,
        newCoins: newBalance,
      });

      // クラッシュポイントを決定
      const crashPoint = generateCrashPoint();
      const payload = {
        discordId: session.discordId,
        betAmount,
        crashPoint,
        startedAt: Date.now(),
      };

      const gameToken = signCrashPayload(payload);

      return NextResponse.json({
        ok: true,
        gameToken,
        betAmount,
        newBalance,
      });
    }

    // ==========================================
    // 2. 利確（キャッシュアウト）
    // ==========================================
    if (action === 'CASHOUT') {
      const { gameToken, claimedMultiplier } = body;
      if (!gameToken || !claimedMultiplier) {
        return NextResponse.json({ ok: false, error: '無効なリクエストパラメータです。' }, { status: 400 });
      }

      const payload = verifyCrashToken(gameToken);
      if (!payload || payload.discordId !== session.discordId) {
        return NextResponse.json({ ok: false, error: '無効または改ざんされたゲームトークンです。' }, { status: 403 });
      }

      // 有効期限チェック (最大3分以内)
      if (Date.now() - payload.startedAt > 180000) {
        return NextResponse.json({ ok: false, error: 'ゲームセッションの有効期限が切れました。' }, { status: 400 });
      }

      const mult = parseFloat(claimedMultiplier);
      const actualCrash = payload.crashPoint;

      // クラッシュ判定: 利確申請倍率が実際のクラッシュポイント以下なら成功
      if (mult <= actualCrash) {
        const winCoins = Math.floor(payload.betAmount * mult);
        const currentCoins = getPlayerCoins(player);
        const newBalance = currentCoins + winCoins;

        await updatePlayerCoinsAndInventory({
          player,
          newCoins: newBalance,
        });

        // 10倍以上の超ファインプレー時はDiscord通知
        if (mult >= 10.0) {
          const playerName = player.name || session.displayName || '名無し';
          const mention = session.discordId ? `<@${session.discordId}>` : `**${playerName}**`;
          sendShopNotification({
            content: `🚀 **【ポロ・クラッシュ超高配当！】** ${mention} さんが **${mult}x** でロケットから無事脱出！ (+${winCoins}🪙獲得)`,
            embeds: [
              {
                title: '🎉 【神業脱出】ポロ・チキンレース大勝利！',
                description: `${mention} さんが **${payload.betAmount}コイン** を賭けて、脅威の **${mult}倍** で利確に成功！\n\n獲得コイン: **+${winCoins}🪙**\n実際のクラッシュ値: \`${actualCrash}x\``,
                color: 0x10b981,
                footer: { text: 'KTM カジノ | Poro Rocket Crash' },
                timestamp: new Date().toISOString(),
              },
            ],
          }).catch(() => {});
        }

        return NextResponse.json({
          ok: true,
          success: true,
          multiplier: mult,
          actualCrash,
          winCoins,
          newBalance,
          message: `🎉 利確成功！${mult}倍 (+${winCoins}🪙) 獲得！`,
        });
      } else {
        // クラッシュ後の遅延クリック
        return NextResponse.json({
          ok: true,
          success: false,
          actualCrash,
          winCoins: 0,
          newBalance: getPlayerCoins(player),
          message: `💥 クラッシュ！ロケットは ${actualCrash}x で爆発しました…`,
        });
      }
    }

    // ==========================================
    // 3. 爆発時の答え合わせ（クラッシュ値確認）
    // ==========================================
    if (action === 'VERIFY_CRASH') {
      const { gameToken } = body;
      const payload = verifyCrashToken(gameToken);
      if (!payload) {
        return NextResponse.json({ ok: false, error: '無効なトークンです。' }, { status: 400 });
      }
      return NextResponse.json({ ok: true, crashPoint: payload.crashPoint });
    }

    return NextResponse.json({ ok: false, error: '不明なアクションです。' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/bet/crash] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
