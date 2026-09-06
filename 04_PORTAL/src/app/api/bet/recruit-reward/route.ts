import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode, ownerDiscordId, ownerName, joinedDiscordIds, joinedNames } = body;

    const isCustom = (mode === 'カスタム' || mode === '定期カスタム');
    const ownerReward = isCustom ? 200 : 100;
    const participantReward = isCustom ? 100 : 50;

    // 1. 募集主のコイン加算
    if (ownerDiscordId || ownerName) {
      const owner = await findOrCreatePlayer({
        discordId: ownerDiscordId,
        name: ownerName,
        autoCreate: true,
      });

      if (owner) {
        const cur = getPlayerCoins(owner);
        await updatePlayerCoinsAndInventory({
          player: owner,
          newCoins: cur + ownerReward,
        });
      }
    }

    // 2. 参加者のコイン加算
    const namesList: string[] = Array.isArray(joinedNames) ? joinedNames : [];
    const discordIdsList: string[] = Array.isArray(joinedDiscordIds) ? joinedDiscordIds : [];
    const maxLen = Math.max(namesList.length, discordIdsList.length);

    for (let i = 0; i < maxLen; i++) {
      const pName = namesList[i];
      const pDiscord = discordIdsList[i];

      // 募集主と同一人物の場合は二重付与防止
      if (pName && ownerName && pName.toLowerCase() === ownerName.toLowerCase()) continue;
      if (pDiscord && ownerDiscordId && pDiscord === ownerDiscordId) continue;

      const pPlayer = await findOrCreatePlayer({
        discordId: pDiscord,
        name: pName,
        autoCreate: true,
      });

      if (pPlayer) {
        const cur = getPlayerCoins(pPlayer);
        await updatePlayerCoinsAndInventory({
          player: pPlayer,
          newCoins: cur + participantReward,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      ownerReward,
      participantReward,
      message: `🎉 【${mode} 募集成立】募集主に +${ownerReward}コイン、参加者に +${participantReward}コイン が付与されました！`
    });
  } catch (error: any) {
    console.error('Recruit Reward API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
