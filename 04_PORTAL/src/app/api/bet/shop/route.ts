import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { SHOP_ITEMS } from '../../../../lib/shopItems';
import { findOrCreatePlayer, getPlayerCoins, getPlayerInventory, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

// 商品一覧は lib/shopItems.ts（カジノ画面と共通。2026-10-07）

// ユーザーの所持インベントリ取得
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const discordId = searchParams.get('discordId');
    const name = searchParams.get('name');

    if (!discordId && !name) {
      return NextResponse.json({ inventory: [] });
    }

    const player = await findOrCreatePlayer({
      discordId,
      name,
      autoCreate: false,
    });

    const inventory = player ? getPlayerInventory(player) : [];

    return NextResponse.json({
      success: true,
      inventory
    });
  } catch (error: any) {
    console.error('Shop API GET error:', error);
    return NextResponse.json({ inventory: [] });
  }
}

// アイテム購入
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, itemId, quantity = 1 } = body;
    const parsedQty = Math.max(1, Math.min(100, Math.floor(Number(quantity) || 1)));

    const item = SHOP_ITEMS[itemId];
    if (!item) {
      return NextResponse.json({ error: '無効なアイテムIDです。' }, { status: 400 });
    }

    if (!discordId && !playerName) {
      return NextResponse.json({ error: 'Discordログインが必要です。' }, { status: 401 });
    }

    // 他者のコインを勝手に使わないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(discordId || playerName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    // プレイヤーの特定（未登録なら初期化）
    const player = await findOrCreatePlayer({
      discordId,
      name: playerName,
      autoCreate: true,
    });

    if (!player) {
      return NextResponse.json({ error: 'プレイヤー情報の取得に失敗しました。' }, { status: 404 });
    }

    const totalPrice = item.price * parsedQty;
    const currentCoins = getPlayerCoins(player);
    if (currentCoins < totalPrice) {
      return NextResponse.json({ 
        error: `所持コインが不足しています（現在: ${currentCoins}コイン / 必要: ${totalPrice}コイン [${item.price}コイン × ${parsedQty}口]）。` 
      }, { status: 400 });
    }

    const newCoins = currentCoins - totalPrice;
    const currentInventory = getPlayerInventory(player);
    const addedItems = Array.from({ length: parsedQty }).map(() => ({
      id: item.id,
      name: item.name,
      icon: item.icon,
      boughtAt: new Date().toISOString()
    }));
    const newInventory = [...currentInventory, ...addedItems];

    const updateRes = await updatePlayerCoinsAndInventory({
      player,
      newCoins,
      newInventory,
      reason: 'shop_purchase',
      reasonMetadata: { itemId: item.id, itemName: item.name, price: item.price },
    });

    if (!updateRes.success) {
      return NextResponse.json({ error: '購入処理（コイン控除）に失敗しました。' }, { status: 500 });
    }

    // Discordへの特権発動アナウンス（指定チャンネル: 1545806575770276061 / #ショップ通知 へ送信）
    const { sendShopNotification } = await import('../../../../lib/discordNotify');
    const isBulk = parsedQty > 1;
    const titleText = isBulk
      ? `🛒【まとめ買い】${player.name} さんが ${parsedQty} 口まとめ買い！`
      : `🛒【特権アイテム購入】${player.name} さんが購入！`;
    const descText = isBulk
      ? `**${item.icon} ${item.name}** × **${parsedQty}口** をまとめ買いしました！\n${item.desc}\n\n🪙 **総額:** ${totalPrice.toLocaleString()}コイン (${item.price}コイン × ${parsedQty}口 / 残高: ${newCoins.toLocaleString()}pt)`
      : `**${item.name}** を購入しました！\n${item.desc}\n\n🪙 **購入価格:** ${item.price}コイン (残高: ${newCoins.toLocaleString()}pt)`;

    await sendShopNotification({
      embeds: [{
        title: titleText,
        description: descText,
        color: isBulk ? 0x8b5cf6 : 0xf59e0b,
        footer: { text: 'KTM Sovereign Shop' },
        timestamp: new Date().toISOString()
      }]
    });

    const successMsg = isBulk
      ? `🎉 **【まとめ買い完了】** 「${item.name}」を **${parsedQty}口** まとめ買いしました！（合計: ${totalPrice.toLocaleString()}コイン / 残り: ${newCoins.toLocaleString()}コイン）`
      : `🎉 **【購入完了】** 「${item.name}」を購入しました！（残り: ${newCoins.toLocaleString()}コイン）\n※次回のカスタム開始時に進行役へ発動をお伝えください！`;

    return NextResponse.json({
      success: true,
      item,
      quantity: parsedQty,
      totalPrice,
      remainingCoins: newCoins,
      inventory: newInventory,
      message: successMsg
    });
  } catch (error: any) {
    console.error('Shop API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
