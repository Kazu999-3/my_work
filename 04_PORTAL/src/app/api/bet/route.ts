import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// ユーザーの所持コイン・ランキング・ベット履歴取得
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const discordId = searchParams.get('discordId');
    const name = searchParams.get('name');

    // 1. 所持コインランキング TOP 10
    const { data: topPlayers } = await supabase
      .from('ktm_players')
      .select('name, discord_id, rank, coins')
      .order('coins', { ascending: false })
      .limit(10);

    const ranking = (topPlayers || []).map((p: any) => ({
      name: p.name,
      discordId: p.discord_id,
      rank: p.rank,
      coins: p.coins ?? 1000,
    }));

    // 2. 指定ユーザーの残高と履歴
    let userCoins = 1000;
    let userBets: any[] = [];

    if (discordId || name) {
      let query = supabase.from('ktm_players').select('coins, name, discord_id');
      if (discordId) {
        query = query.eq('discord_id', discordId);
      } else if (name) {
        query = query.eq('name', name);
      }
      const { data: userData } = await query.single();
      if (userData) {
        userCoins = userData.coins ?? 1000;
      }
    }

    return NextResponse.json({
      success: true,
      userCoins,
      ranking,
      userBets,
    });
  } catch (error: any) {
    console.error('Bet API GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ベット受付
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { discordId, playerName, team, amount, matchId } = body;

    if (!team || !amount || amount <= 0) {
      return NextResponse.json({ error: 'チームと有効な賭け金（1コイン以上）を指定してください。' }, { status: 400 });
    }

    if (!['BLUE', 'RED'].includes(team.toUpperCase())) {
      return NextResponse.json({ error: 'ベット対象は BLUE または RED です。' }, { status: 400 });
    }

    // プレイヤーの所持コイン確認
    let query = supabase.from('ktm_players').select('name, discord_id, coins');
    if (discordId) {
      query = query.eq('discord_id', discordId);
    } else if (playerName) {
      query = query.eq('name', playerName);
    } else {
      return NextResponse.json({ error: 'プレイヤー情報が不足しています。' }, { status: 400 });
    }

    // 他者のコインを勝手に賭けないよう本人・管理者検証
    const { verifyUserOrAdmin } = await import('../../../lib/authGuard');
    const authCheck = await verifyUserOrAdmin(discordId || playerName);
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    const { data: player, error: pError } = await query.single();
    if (pError || !player) {
      return NextResponse.json({ error: 'プレイヤーが見つかりません。名簿登録を行ってください。' }, { status: 404 });
    }

    const currentCoins = player.coins ?? 1000;
    const betAmount = Math.min(amount, currentCoins);
    if (betAmount <= 0 || currentCoins < betAmount) {
      return NextResponse.json({ error: `所持コインが足りません（現在: ${currentCoins}コイン）。` }, { status: 400 });
    }

    // コインを控除
    const newCoins = currentCoins - betAmount;
    await supabase
      .from('ktm_players')
      .update({ coins: newCoins })
      .eq('name', player.name);

    return NextResponse.json({
      success: true,
      playerName: player.name,
      team: team.toUpperCase(),
      amount: betAmount,
      remainingCoins: newCoins,
      message: `${player.name} さんが 【${team.toUpperCase()} チーム】に ${betAmount}コイン をベットしました！（残り: ${newCoins}コイン）`,
    });
  } catch (error: any) {
    console.error('Bet API POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
