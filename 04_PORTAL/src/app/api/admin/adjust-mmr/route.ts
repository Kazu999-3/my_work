import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { targetName, role, amount } = await req.json();
    if (!targetName || !role || amount === undefined) {
      return NextResponse.json({ status: "ERROR", message: "Missing parameters." }, { status: 400 });
    }

    const newMmr = parseInt(amount, 10);
    if (isNaN(newMmr)) {
      return NextResponse.json({ status: "ERROR", message: "amount must be a valid number." }, { status: 400 });
    }

    // プレイヤーを取得
    const { data: player, error: playerError } = await supabase
      .from('ktm_players')
      .select('*')
      .eq('name', targetName)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ status: "ERROR", message: "Player not found." }, { status: 404 });
    }

    // 更新するカラムを決定
    const targetRole = role.toUpperCase();
    const updateData: any = {};
    if (targetRole === 'TOP') updateData.mmr_top = newMmr;
    else if (targetRole === 'JG') updateData.mmr_jg = newMmr;
    else if (targetRole === 'MID') updateData.mmr_mid = newMmr;
    else if (targetRole === 'ADC') updateData.mmr_adc = newMmr;
    else if (targetRole === 'SUP') updateData.mmr_sup = newMmr;
    else updateData.mmr = newMmr; // 全体 または 不明な場合

    const { error: updateError } = await supabase
      .from('ktm_players')
      .update(updateData)
      .eq('id', player.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ status: "SUCCESS", message: `Updated ${targetName}'s ${role} MMR to ${newMmr}.` });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
