import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, getPlayerInventory, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

export const SHOP_ITEMS: Record<string, { id: string; name: string; price: number; icon: string; badge: string; desc: string }> = {
  force_champ_pick: {
    id: 'force_champ_pick',
    name: '👑 下剋上キャラ指定権 (高レート使用キャラ強制)',
    price: 500,
    icon: '👑',
    badge: '下剋上 (MMR -400)',
    desc: '低レート側が、相手の高レートプレイヤーが使うチャンピオンを1体強制指定！苦手キャラを押し付けて下剋上を起こそう！ (対象実効MMR -400補正)'
  },
  lane_heavy_ban: {
    id: 'lane_heavy_ban',
    name: '🚫 特定レーン複数BAN権 (レーン集中封鎖)',
    price: 400,
    icon: '🚫',
    badge: 'ドラフト (MMR -200)',
    desc: 'あらかじめ特定のレーン（TOPやMIDなど）の使用禁止キャラを事前に複数体指定して徹底封鎖！ (対象実効MMR -200補正)'
  },
  force_enemy_roles: {
    id: 'force_enemy_roles',
    name: '🔀 相手ロール強制配置権 (ポジション指定)',
    price: 500,
    icon: '🔀',
    badge: 'お祭り (戦績ノーカウント)',
    desc: 'チーム分け確定後、相手チームの誰がどのレーン（TOP/JG/MID/ADC/SUP）を担当するかをこちらが勝手に指定！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  all_offmeta_match: {
    id: 'all_offmeta_match',
    name: '🤡 完全オフメタカスタム開催権',
    price: 400,
    icon: '🤡',
    badge: 'お祭り (戦績ノーカウント)',
    desc: '通常のメタピックは全面禁止！10人全員が普段絶対に見られない未開拓オフメタ構成で戦う爆笑マッチ！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  all_random_match: {
    id: 'all_random_match',
    name: '🎲 キャラランダムカスタム開催権 (ALL RANDOM)',
    price: 400,
    icon: '🎲',
    badge: 'お祭り (戦績ノーカウント)',
    desc: '10人全員がランダム抽選されたチャンピオンで戦う完全運ゲーお祭り対決！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  ultimate_bravery: {
    id: 'ultimate_bravery',
    name: '🎲 全員ランダムビルド対決権',
    price: 300,
    icon: '🎲',
    badge: 'お祭り (戦績ノーカウント)',
    desc: '10人全員がランダム抽選のアイテムビルドで戦う爆笑お祭りマッチ！ ※お祭りマッチのため公式戦績・MMR変動には反映されません（完全保護）。'
  },
  champ_protect: {
    id: 'champ_protect',
    name: '🛡️ チャンピオンプロテクト権 (マイチャンプ保護)',
    price: 500,
    icon: '🛡️',
    badge: 'BAN保護 (MMR +150)',
    desc: '相手チームからのBANを1体絶対に阻止し、自分の得意チャンピオンを必ず使える権利！ (使用者実効MMR +150補正)'
  },
  ban_free: {
    id: 'ban_free',
    name: '🚫 全員BAN禁止マッチ権 (自由ピック対決)',
    price: 400,
    icon: '🚫',
    badge: 'ドラフト',
    desc: '次の試合で両チームのBAN枠を全撤廃し、お互い好きなチャンピオンを完全自由に使って対決！'
  },
  bounty_target: {
    id: 'bounty_target',
    name: '🎯 賞金首ターゲット指定権',
    price: 300,
    icon: '🎯',
    badge: '懸賞金',
    desc: '次の試合で「相手の〇〇選手を最初に倒した人に懸賞金」を掛けて試合を白熱させる！'
  },
  side_pick: {
    id: 'side_pick',
    name: '🟦 サイド選択権 (BLUE / RED指定)',
    price: 500,
    icon: '🟦',
    badge: 'ドラフト',
    desc: 'ドラフトで勝率の高いBLUEサイド、またはREDサイドを自チームで確定選択！'
  },
  lottery_ticket: {
    id: 'lottery_ticket',
    name: '🎟️ 週末メガ宝くじ (1口)',
    price: 100,
    icon: '🎟️',
    badge: '定期抽選',
    desc: '毎週日曜22:00に抽選！当選者にジャックポット総取り（数万コイン）のチャンス！'
  }
};

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
    const { discordId, playerName, itemId } = body;

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

    const currentCoins = getPlayerCoins(player);
    if (currentCoins < item.price) {
      return NextResponse.json({ error: `所持コインが不足しています（現在: ${currentCoins}コイン / 必要: ${item.price}コイン）。` }, { status: 400 });
    }

    const newCoins = currentCoins - item.price;
    const currentInventory = getPlayerInventory(player);
    const newInventory = [
      ...currentInventory,
      {
        id: item.id,
        name: item.name,
        icon: item.icon,
        boughtAt: new Date().toISOString()
      }
    ];

    const updateRes = await updatePlayerCoinsAndInventory({
      player,
      newCoins,
      newInventory,
    });

    if (!updateRes.success) {
      return NextResponse.json({ error: '購入処理（コイン控除）に失敗しました。' }, { status: 500 });
    }

    // Discordへの特権発動アナウンス（Webhookがあれば通知）
    const webhookUrl = process.env.DISCORD_KTM_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: `🛒【特権アイテム購入】${player.name} さんが購入！`,
              description: `**${item.name}** を購入しました！\n${item.desc}\n\n🪙 **購入価格:** ${item.price}コイン (残高: ${newCoins}pt)`,
              color: 0xf59e0b,
              timestamp: new Date().toISOString()
            }]
          })
        });
      } catch (e) {
        console.error('Failed to send discord webhook for shop purchase:', e);
      }
    }

    return NextResponse.json({
      success: true,
      item,
      remainingCoins: newCoins,
      inventory: newInventory,
      message: `🎉 **【購入完了】** 「${item.name}」を購入しました！（残り: ${newCoins}コイン）\n※次回のカスタム開始時に進行役へ発動をお伝えください！`
    });
  } catch (error: any) {
    console.error('Shop API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
