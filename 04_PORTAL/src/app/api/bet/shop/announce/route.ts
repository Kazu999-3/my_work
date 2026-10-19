import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerInventory, consumeInventoryItems } from '../../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

// 自動で効く物（宝くじ・保険・激闘チケット等）は発動宣言の対象外。宣言で消費されると効果が無くなる
const AUTO_APPLIED_ITEM_IDS = new Set(['lottery_ticket', 'scratch_card', 'bet_insurance', 'victory_bonus_doubler']);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, itemId, itemName } = body;

    if (!playerName && !discordId) {
      return NextResponse.json({ error: 'プレイヤー情報が不足しています。' }, { status: 400 });
    }

    if (!itemName) {
      return NextResponse.json({ error: 'アイテム情報が不足しています。' }, { status: 400 });
    }

    // 他者のチケットを勝手に発動しないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(discordId || playerName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    // プレイヤーの特定
    const player = await findOrCreatePlayer({
      discordId,
      name: playerName,
      autoCreate: false,
    });

    if (!player) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 404 });
    }

    const currentInventory = getPlayerInventory(player);
    if (itemId && AUTO_APPLIED_ITEM_IDS.has(itemId)) {
      return NextResponse.json({ error: 'このアイテムは自動で適用されるため、発動宣言は不要です。' }, { status: 400 });
    }
    const targetIndex = currentInventory.findIndex(
      item => (itemId ? item.id === itemId : item.name === itemName) && !AUTO_APPLIED_ITEM_IDS.has(item.id)
    );

    if (targetIndex === -1) {
      return NextResponse.json({
        error: `「${itemName}」を所持していません。ショップで購入後に発動してください。`
      }, { status: 400 });
    }

    // 1枚消費は DB 上で行い、実際に減らせた時だけ発動する。以前は読んだ持ち物から抜いて上書きしており、
    // 2回連続で押すと同じ1枚で2回発動（通知も2回）し、同時に買った物も消えていた（2026-10-19）
    const consumed = await consumeInventoryItems(player, currentInventory[targetIndex].id, 1);
    if (consumed < 1) {
      return NextResponse.json({
        error: `「${itemName}」を所持していません（既に使用済みの可能性があります）。`
      }, { status: 409 });
    }

    // 通知に出す名前・アイコンは、画面から送られた文字ではなく実際に消費した持ち物のものを使う。
    // 以前は送られた itemName / itemDesc をそのまま載せており、1枚あれば任意の文面を「公式発動宣言」として流せた（2026-10-19）
    const usedItem = currentInventory[targetIndex];
    const shownName = usedItem.name || itemName;
    const shownIcon = usedItem.icon || '🎟️';

    // Discordへ公式発動アナウンス送信（指定チャンネル: 1545806575770276061 / #ショップ通知 へ送信）
    const { sendShopNotification } = await import('../../../../../lib/discordNotify');
    await sendShopNotification({
      embeds: [{
        title: `📣【特権発動宣言】${player?.name || playerName} さんが発動しました！`,
        description: `**${shownIcon} ${shownName}**\n次回カスタム試合でこの特権が適用されます！\n\n進行役・対戦相手の皆様はルールのご確認をお願いします🔥`,
        color: 0xec4899,
        footer: { text: 'KTM Sovereign Shop' },
        timestamp: new Date().toISOString()
      }]
    });

    return NextResponse.json({
      success: true,
      message: `📢 **【発動完了】** 「${shownName}」の発動をDiscordに宣言しました！次回の試合でルールが適用されます！`
    });
  } catch (error: any) {
    console.error('Announce API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
