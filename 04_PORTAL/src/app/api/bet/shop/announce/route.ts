import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerInventory, updatePlayerCoinsAndInventory } from '../../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, itemId, itemName, itemIcon, itemDesc } = body;

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
    const targetIndex = currentInventory.findIndex(item => item.id === itemId || item.name === itemName);

    if (targetIndex === -1) {
      return NextResponse.json({
        error: `「${itemName}」を所持していません。ショップで購入後に発動してください。`
      }, { status: 400 });
    }

    currentInventory.splice(targetIndex, 1); // 1枚消費
    await updatePlayerCoinsAndInventory({
      player,
      newInventory: currentInventory,
    });

    // Discordへ公式発動アナウンス送信（指定チャンネル: 1545806575770276061 / #ショップ通知 へ送信）
    const { sendShopNotification } = await import('../../../../../lib/discordNotify');
    await sendShopNotification({
      embeds: [{
        title: `📣【特権発動宣言】${playerName || player?.name} さんが発動しました！`,
        description: `**${itemIcon || '🎟️'} ${itemName}**\n${itemDesc || '次回カスタム試合でこの特権が適用されます！'}\n\n進行役・対戦相手の皆様はルールのご確認をお願いします🔥`,
        color: 0xec4899,
        footer: { text: 'KTM Sovereign Shop' },
        timestamp: new Date().toISOString()
      }]
    });

    return NextResponse.json({
      success: true,
      message: `📢 **【発動完了】** 「${itemName}」の発動をDiscordに宣言しました！次回の試合でルールが適用されます！`
    });
  } catch (error: any) {
    console.error('Announce API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
