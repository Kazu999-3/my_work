import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode, ownerDiscordId, ownerName, joinedDiscordIds, joinedNames } = body;

    const isCustom = (mode === 'カスタム' || mode === '定期カスタム');
    const ownerReward = isCustom ? 200 : 100;
    const participantReward = isCustom ? 100 : 50;

    // 募集主のコイン加算
    if (ownerDiscordId || ownerName) {
      let q = supabase.from('ktm_players').select('name, coins');
      if (ownerDiscordId) q = q.eq('discord_id', ownerDiscordId);
      else if (ownerName) q = q.eq('name', ownerName);
      const { data: owner } = await q.single();
      if (owner) {
        const cur = owner.coins ?? 1000;
        await supabase.from('ktm_players').update({ coins: cur + ownerReward }).eq('name', owner.name);
      }
    }

    // 参加者のコイン加算
    if (joinedNames && Array.isArray(joinedNames) && joinedNames.length > 0) {
      const { data: participants } = await supabase
        .from('ktm_players')
        .select('name, coins')
        .in('name', joinedNames);

      for (const p of (participants || [])) {
        if (p.name !== ownerName) {
          const cur = p.coins ?? 1000;
          await supabase.from('ktm_players').update({ coins: cur + participantReward }).eq('name', p.name);
        }
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
