import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

// 投げ銭 (Tip) 送信
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromDiscordId, fromName, toDiscordId, toName, amount, message } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '1コイン以上の金額を指定してください。' }, { status: 400 });
    }

    if (!fromDiscordId && !fromName) {
      return NextResponse.json({ error: '送信者情報が不足しています。' }, { status: 400 });
    }

    if (!toDiscordId && !toName) {
      return NextResponse.json({ error: '送信相手情報が不足しています。' }, { status: 400 });
    }

    // 他者のコインを勝手に送金しないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(fromDiscordId || fromName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    // 送信者の確認・取得
    const sender = await findOrCreatePlayer({
      discordId: fromDiscordId,
      name: fromName,
      autoCreate: true,
    });

    if (!sender) {
      return NextResponse.json({ error: '送信者プレイヤーの取得に失敗しました。' }, { status: 404 });
    }

    const senderCoins = getPlayerCoins(sender);
    if (senderCoins < amount) {
      return NextResponse.json({ error: `所持コインが不足しています（現在: ${senderCoins}コイン）。` }, { status: 400 });
    }

    // 受信者の確認・取得
    const receiver = await findOrCreatePlayer({
      discordId: toDiscordId,
      name: toName,
      autoCreate: true,
    });

    if (!receiver) {
      return NextResponse.json({ error: '送信相手が見つかりません。' }, { status: 404 });
    }

    // コイン移動
    const newSenderCoins = senderCoins - amount;
    const newReceiverCoins = getPlayerCoins(receiver) + amount;

    await updatePlayerCoinsAndInventory({
      player: sender,
      newCoins: newSenderCoins,
    });

    await updatePlayerCoinsAndInventory({
      player: receiver,
      newCoins: newReceiverCoins,
    });

    return NextResponse.json({
      success: true,
      from: sender.name,
      to: receiver.name,
      amount,
      message: message || 'ナイスプレイ！',
      remainingSenderCoins: newSenderCoins,
      announcement: `🎉 **【チップ送金】** **${sender.name}** さんが **${receiver.name}** さんに **${amount}コイン** を贈りました！\n💬 「${message || 'ナイスプレイ！'}」`
    });
  } catch (error: any) {
    console.error('Tip API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
