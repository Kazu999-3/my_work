import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// 投げ銭 (Tip) 送信
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromDiscordId, fromName, toDiscordId, toName, amount, message } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '1コイン以上の金額を指定してください。' }, { status: 400 });
    }

    // 他者のコインを勝手に送金しないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(fromDiscordId || fromName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    // 送信者のコイン確認
    let qSender = supabase.from('ktm_players').select('name, coins');
    if (fromDiscordId) qSender = qSender.eq('discord_id', fromDiscordId);
    else if (fromName) qSender = qSender.eq('name', fromName);
    const { data: sender } = await qSender.single();

    if (!sender || (sender.coins ?? 1000) < amount) {
      return NextResponse.json({ error: `所持コインが不足しています（現在: ${sender?.coins ?? 1000}コイン）。` }, { status: 400 });
    }

    // 受信者の確認
    let qReceiver = supabase.from('ktm_players').select('name, coins');
    if (toDiscordId) qReceiver = qReceiver.eq('discord_id', toDiscordId);
    else if (toName) qReceiver = qReceiver.eq('name', toName);
    const { data: receiver } = await qReceiver.single();

    if (!receiver) {
      return NextResponse.json({ error: '送信相手が見つかりません。' }, { status: 404 });
    }

    // コイン移動
    await supabase.from('ktm_players').update({ coins: (sender.coins ?? 1000) - amount }).eq('name', sender.name);
    await supabase.from('ktm_players').update({ coins: (receiver.coins ?? 1000) + amount }).eq('name', receiver.name);

    return NextResponse.json({
      success: true,
      from: sender.name,
      to: receiver.name,
      amount,
      message: message || 'ナイスプレイ！',
      remainingSenderCoins: (sender.coins ?? 1000) - amount,
      announcement: `🎉 **【チップ送金】** **${sender.name}** さんが **${receiver.name}** さんに **${amount}コイン** を贈りました！\n💬 「${message || 'ナイスプレイ！'}」`
    });
  } catch (error: any) {
    console.error('Tip API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
