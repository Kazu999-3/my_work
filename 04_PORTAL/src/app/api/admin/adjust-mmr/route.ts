import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export async function POST(req: Request) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const { targetName, role, amount } = await req.json();
    if (!targetName || !role || amount === undefined) {
      return NextResponse.json({ status: "ERROR", message: "Missing parameters." }, { status: 400 });
    }

    // S-02: 入力バリデーション（ロール列挙・MMRの現実的な範囲）で名簿破損を防ぐ
    if (!['TOP', 'JG', 'MID', 'ADC', 'SUP'].includes(String(role).toUpperCase())) {
      return NextResponse.json({ status: "ERROR", message: "role は TOP/JG/MID/ADC/SUP のいずれかで指定してください。" }, { status: 400 });
    }
    const newMmr = parseInt(amount, 10);
    if (!Number.isNaN(newMmr) && (newMmr < 100 || newMmr > 4000)) {
      return NextResponse.json({ status: "ERROR", message: "MMRは100〜4000の範囲で指定してください。" }, { status: 400 });
    }
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
