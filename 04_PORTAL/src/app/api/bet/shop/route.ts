import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export const SHOP_ITEMS: Record<string, { id: string; name: string; price: number; icon: string; desc: string }> = {
  first_role_pass: {
    id: 'first_role_pass',
    name: '📍 第一希望レーン確約チケット',
    price: 1500,
    icon: '📍',
    desc: '次のカスタムで絶対にオフロールにならず第一希望でプレイできる権利！'
  },
  bounty_target: {
    id: 'bounty_target',
    name: '🎯 賞金首ターゲット指定権',
    price: 500,
    icon: '🎯',
    desc: '次の試合で「相手の〇〇選手を最初に倒した人に懸賞金」を掛けて試合を白熱させる！'
  },
  ultimate_bravery: {
    id: 'ultimate_bravery',
    name: '🎲 全員アルティメット・ブレイバリー発動権',
    price: 1000,
    icon: '🎲',
    desc: '10人全員がランダム抽選ビルドで戦う爆笑お祭りマッチを開催できる！'
  },
  side_pick: {
    id: 'side_pick',
    name: '🟦 サイド選択権 (BLUE / RED指定)',
    price: 1000,
    icon: '🟦',
    desc: 'ドラフトで勝率の高いBLUEサイド、またはREDサイドを自チームで確定選択！'
  },
  lottery_ticket: {
    id: 'lottery_ticket',
    name: '🎟️ 週末メガ宝くじ (1口)',
    price: 100,
    icon: '🎟️',
    desc: '毎週日曜22:00に抽選！当選者にジャックポット総取り（数万コイン）のチャンス！'
  }
};

// アイテム購入
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, itemId } = body;

    const item = SHOP_ITEMS[itemId];
    if (!item) {
      return NextResponse.json({ error: '無効なアイテムIDです。' }, { status: 400 });
    }

    // 他者のコインを勝手に使わないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(discordId || playerName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    let q = supabase.from('ktm_players').select('name, coins');
    if (discordId) q = q.eq('discord_id', discordId);
    else if (playerName) q = q.eq('name', playerName);
    const { data: player } = await q.single();

    if (!player || (player.coins ?? 1000) < item.price) {
      return NextResponse.json({ error: `所持コインが不足しています（現在: ${player?.coins ?? 1000}コイン / 必要: ${item.price}コイン）。` }, { status: 400 });
    }

    const newCoins = (player.coins ?? 1000) - item.price;
    await supabase.from('ktm_players').update({ coins: newCoins }).eq('name', player.name);

    return NextResponse.json({
      success: true,
      item,
      remainingCoins: newCoins,
      message: `🎉 **【購入完了】** 「${item.name}」を購入しました！（残り: ${newCoins}コイン）`
    });
  } catch (error: any) {
    console.error('Shop API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
