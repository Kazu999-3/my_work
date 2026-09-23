import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';
import { sendShopNotification } from '../../../../lib/discordNotify';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// ネットワーク遅延・許容マージン(秒)。クライアント→サーバー到達までの遅延で
// 「本来は間に合っていた利確」が理不尽にクラッシュ判定されるのを防ぐ。
const LATENCY_MARGIN_SEC = 0.5;

// ★ セキュリティ設計:
// crashPointはクライアントへ一切渡さず、crash_sessionsテーブル(サーバー側のみ)で保持する。
// クライアントに渡す「gameId」は完全に不透明な乱数文字列で、デコードしても何の情報も
// 得られない(以前はHMAC署名付きトークンにcrashPointを平文JSONで同梱していたため、
// base64urlデコードするだけで誰でも事前にクラッシュ値を読めてしまっていた)。

interface CrashSession {
  game_id: string;
  discord_id: string;
  bet_amount: number;
  crash_point: number;
  started_at: string;
  status: 'pending' | 'settled';
}

async function getCrashSession(gameId: string, discordId: string): Promise<CrashSession | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('crash_sessions')
    .select('*')
    .eq('game_id', gameId)
    .eq('discord_id', discordId)
    .maybeSingle();
  return data || null;
}

/**
 * 多重利確防止: pending -> settled への遷移をUNIQUE制約ベースで一度だけ許可する。
 * 既にsettled済み(=WHERE句に一致する行が無い)なら更新0件でfalseを返す。
 */
async function claimCrashSession(gameId: string, discordId: string): Promise<boolean> {
  if (!supabaseAdmin) return true; // DB未接続時はフォールバックで許可(ローカル開発用)
  const { data, error } = await supabaseAdmin
    .from('crash_sessions')
    .update({ status: 'settled' })
    .eq('game_id', gameId)
    .eq('discord_id', discordId)
    .eq('status', 'pending')
    .select('game_id');
  if (error) {
    console.error('[crash] claimCrashSession error:', error);
    return false;
  }
  return !!data && data.length > 0;
}

/** クラッシュのRTP。どの倍率で利確しても一律この還元率になる */
export const CRASH_RTP = 0.96;
/**
 * 取りうる最大倍率。
 * 上限で頭打ちにしても「上限以上の値はすべて上限に丸められる＝上限狙いは必ず当たる」ため
 * P(クラッシュ値 >= m) = RTP / m の関係は m <= 上限 の範囲で保たれ、RTPは一定のままになる。
 * 総流通量が約15,000コインしかない経済で青天井の払い戻しを出さないよう50倍で止めている
 * （1000コインベットで最大50,000コイン。到達率は 0.96/50 = 約1.9%）。
 */
export const CRASH_MAX_MULTIPLIER = 50;

/**
 * クラッシュ倍率の計算（ハウスエッジ 4% = 全利確目標で一定）
 *
 * 2026-09-22 是正:
 * 旧実装は「3%の確率で即死 + `100/(100 - r*94)` のカーブ」という組み合わせで、
 * コメントには「ハウスエッジ約6%」とあったが、それが成立するのは2.0倍で利確した場合だけだった。
 * 実際のRTPは利確目標mに対して `(100 - 6m) / 94` と線形に劣化し、200万回の実測で
 *   1.05x→99.67% / 2x→93.63% / 5x→74.45% / 10x→42.53% / 15x→10.47%
 * と、低倍率で刻めばほぼ無リスク・高倍率狙いは一方的に搾取される構造になっていた。
 *
 * 現在は一般的なクラッシュゲームと同じ逆関数サンプリング `RTP / (1 - r)` を使う。
 * P(クラッシュ値 >= m) = RTP / m となるため、期待値は m * RTP / m = RTP で
 * **利確目標によらず常に一定**になる。
 */
function generateCrashPoint(): number {
  // r は [0, 1) のため 1-r は (0, 1]。ゼロ除算は起きない。
  const r = Math.random();
  const raw = CRASH_RTP / (1 - r);

  // 1.00倍未満（= 即クラッシュ）になる確率は 1 - RTP = 4%
  if (raw < 1.0) {
    return 1.0;
  }

  const capped = Math.min(CRASH_MAX_MULTIPLIER, raw);
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

      if (!supabaseAdmin) {
        return NextResponse.json({ ok: false, error: 'サーバー設定エラー（DB未接続）。' }, { status: 500 });
      }

      // ベット額を減額して保存
      const newBalance = currentCoins - betAmount;
      await updatePlayerCoinsAndInventory({
        player,
        newCoins: newBalance,
        reason: 'crash',
        reasonMetadata: { phase: 'bet', betAmount },
      });

      // クラッシュポイントを決定し、サーバー側のみに保持する(クライアントには渡さない)
      const crashPoint = generateCrashPoint();
      const gameId = crypto.randomUUID();

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('crash_sessions')
        .insert({
          game_id: gameId,
          discord_id: session.discordId,
          bet_amount: betAmount,
          crash_point: crashPoint,
          status: 'pending',
        })
        .select('started_at')
        .single();

      if (insErr) {
        console.error('[crash] session insert error:', insErr);
        // ベット控除をロールバックしてエラーを返す
        await updatePlayerCoinsAndInventory({ player, newCoins: currentCoins });
        return NextResponse.json({ ok: false, error: 'ゲームセッションの作成に失敗しました。' }, { status: 500 });
      }

      // ⚠️ 2026-09-23: クライアントの時計合わせ用。
      // started_at は DEFAULT now() なので「insertした瞬間」＝認証・プレイヤー取得・
      // コイン減算がすべて終わったあとに打たれる。つまりサーバーの計時開始は
      // ボタン押下より0.3秒ほど遅い。クライアントが押下時刻から計時していると
      // 画面の倍率だけがサーバーより先行し、**まだ飛んで見えるのに利確が
      // 「もう爆発済み」で弾かれる**という食い違いが起きる。
      // そこで「サーバー側で既に何ms経過しているか」を返し、クライアント側の
      // 起点をこれに合わせ直させる。タイムスタンプそのものではなく経過時間を
      // 返すので、利用者PCの時計がずれていても影響を受けない。
      const serverElapsedMs = inserted?.started_at
        ? Math.max(0, Date.now() - new Date(inserted.started_at).getTime())
        : 0;

      return NextResponse.json({
        ok: true,
        gameToken: gameId, // ★ 中身は不透明なgameIdのみ。crashPointは含まれない。
        betAmount,
        newBalance,
        serverElapsedMs,
      });
    }

    // ==========================================
    // 2. 利確（キャッシュアウト）
    // ==========================================
    if (action === 'CASHOUT') {
      const { gameToken: gameId, claimedMultiplier } = body;
      if (!gameId || !claimedMultiplier) {
        return NextResponse.json({ ok: false, error: '無効なリクエストパラメータです。' }, { status: 400 });
      }

      const crashSession = await getCrashSession(gameId, session.discordId);
      if (!crashSession) {
        return NextResponse.json({ ok: false, error: '無効または存在しないゲームセッションです。' }, { status: 403 });
      }

      const startedAtMs = new Date(crashSession.started_at).getTime();

      // 有効期限チェック (最大3分以内)
      if (Date.now() - startedAtMs > 180000) {
        return NextResponse.json({ ok: false, error: 'ゲームセッションの有効期限が切れました。' }, { status: 400 });
      }

      // 多重利確防止: 同一セッションでのCASHOUTは1回のみ受理する(pending->settledの原子的遷移)
      const claimed = await claimCrashSession(gameId, session.discordId);
      if (!claimed) {
        return NextResponse.json({ ok: false, error: 'このゲームは既に利確・処理済みです。' }, { status: 409 });
      }

      const mult = parseFloat(claimedMultiplier);
      const actualCrash = Number(crashSession.crash_point);

      // サーバー側時間検証: multに対応する経過時間 (elapsed = ln(mult) / 0.22)
      // クライアントが瞬時に高倍率をPOSTしてくるチートを防ぐ
      const now = Date.now();
      const clientElapsedSec = (now - startedAtMs) / 1000;
      // ネットワーク遅延・許容マージンを考慮した、その経過秒数で到達可能な最大倍率
      const maxPossibleMult = Math.floor(Math.pow(Math.E, (clientElapsedSec + LATENCY_MARGIN_SEC) * 0.22) * 100) / 100;

      if (mult > maxPossibleMult) {
        return NextResponse.json({ ok: false, error: '不正な利確タイミングが検出されました。' }, { status: 400 });
      }

      // クラッシュ判定: 実際のクラッシュ倍率に達していなければ成功、超えていればクラッシュ
      // ※経過時間から計算した倍率がクラッシュ値を超えていた場合もアウト
      // 通信遅延で「本来は間に合っていた利確」が理不尽にクラッシュ判定されないよう、
      // 上のmaxPossibleMult同様に同じ許容マージンを引いた時点の倍率で判定する。
      const marginedElapsedSec = Math.max(0, clientElapsedSec - LATENCY_MARGIN_SEC);
      const currentServerMult = Math.floor(Math.pow(Math.E, marginedElapsedSec * 0.22) * 100) / 100;
      const isCrashed = mult > actualCrash || currentServerMult >= actualCrash;

      if (!isCrashed) {
        const winCoins = Math.floor(crashSession.bet_amount * mult);
        const currentCoins = getPlayerCoins(player);
        const newBalance = currentCoins + winCoins;

        await updatePlayerCoinsAndInventory({
          player,
          newCoins: newBalance,
          reason: 'crash',
          reasonMetadata: { phase: 'cashout', multiplier: mult, betAmount: crashSession.bet_amount, actualCrash },
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
                description: `${mention} さんが **${crashSession.bet_amount}コイン** を賭けて、脅威の **${mult}倍** で利確に成功！\n\n獲得コイン: **+${winCoins}🪙**\n実際のクラッシュ値: \`${actualCrash}x\``,
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
        // クラッシュ後の遅延クリックまたはクラッシュ到達
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
    // 3. 爆発時の答え合わせ（※ゲーム終了・爆発確認時のみ開示）
    // ==========================================
    if (action === 'VERIFY_CRASH') {
      const { gameToken: gameId, wait } = body;
      const crashSession = await getCrashSession(gameId, session.discordId);
      if (!crashSession) {
        return NextResponse.json({ ok: false, error: '無効なトークンです。' }, { status: 400 });
      }

      // ★ セキュリティ:
      // ゲーム開始から十分な時間（クラッシュ到達予定時刻）が経過する前には
      // VERIFY_CRASH で事前にクラッシュポイントを開示しない！
      const actualCrash = Number(crashSession.crash_point);
      const startedAtMs = new Date(crashSession.started_at).getTime();
      const crashTimeSec = Math.log(Math.max(1.0, actualCrash)) / 0.22;
      const crashAtMs = startedAtMs + crashTimeSec * 1000;

      // ⚠️ 2026-09-23: ロングポーリング対応。
      // 従来はクライアントが0.3秒間隔で「爆発した？」と問い合わせていたため、
      // 爆発から画面に反映されるまで最大 0.3秒(待ち) + 0.4秒(往復) = 0.7秒かかり、
      // その間クライアントは倍率を伸ばし続けていた。結果、**画面はまだ飛んでいるのに
      // 利確が弾かれる**空白時間が生まれていた（倍率換算で最大16%ぶん）。
      // wait:true のときは爆発の瞬間までサーバー側で待ってから応答する。
      // 反映の遅れは片道のネットワーク遅延だけ（0.2秒程度）に縮む。
      // ・待ちの上限は6秒。Vercel Functionの実行時間上限（Hobbyで10秒）に収める。
      //   超えたぶんはクライアントが即座に次のロングポーリングを張り直す。
      // ・1ラウンドあたりの呼び出しは最大3回程度になり、従来の約59回から激減する。
      if (wait) {
        const WAIT_BUDGET_MS = 6000;
        const waitMs = Math.min(crashAtMs - Date.now(), WAIT_BUDGET_MS);
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      // まだ爆発していない（飛行中）なら「まだ飛行中」として開示拒否
      if (Date.now() < crashAtMs) {
        return NextResponse.json({
          ok: true,
          crashed: false,
        });
      }

      // すでに爆発時刻を過ぎた場合のみ、答え合わせとして開示
      return NextResponse.json({
        ok: true,
        crashed: true,
        crashPoint: actualCrash,
      });
    }

    return NextResponse.json({ ok: false, error: '不明なアクションです。' }, { status: 400 });
  } catch (err: any) {
    console.error('[api/bet/crash] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || '内部エラーが発生しました' }, { status: 500 });
  }
}
