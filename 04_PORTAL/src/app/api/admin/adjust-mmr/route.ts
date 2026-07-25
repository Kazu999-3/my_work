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

    // 更新するカラムを決定（単一レーン変更時は総合MMRを再計算、全体変更時は5レーンへ差分同期）
    const targetRole = role.toUpperCase();
    const updateData: any = {};

    if (['TOP', 'JG', 'MID', 'ADC', 'SUP'].includes(targetRole)) {
      if (targetRole === 'TOP') updateData.mmr_top = newMmr;
      if (targetRole === 'JG') updateData.mmr_jg = newMmr;
      if (targetRole === 'MID') updateData.mmr_mid = newMmr;
      if (targetRole === 'ADC') updateData.mmr_adc = newMmr;
      if (targetRole === 'SUP') updateData.mmr_sup = newMmr;

      const top = updateData.mmr_top ?? player.mmr_top ?? 1200;
      const jg = updateData.mmr_jg ?? player.mmr_jg ?? 1200;
      const mid = updateData.mmr_mid ?? player.mmr_mid ?? 1200;
      const adc = updateData.mmr_adc ?? player.mmr_adc ?? 1200;
      const sup = updateData.mmr_sup ?? player.mmr_sup ?? 1200;
      updateData.mmr = Math.round((top + jg + mid + adc + sup) / 5);
    } else {
      const diff = newMmr - (player.mmr || 1200);
      updateData.mmr = newMmr;
      updateData.mmr_top = Math.max(100, (player.mmr_top || 1200) + diff);
      updateData.mmr_jg = Math.max(100, (player.mmr_jg || 1200) + diff);
      updateData.mmr_mid = Math.max(100, (player.mmr_mid || 1200) + diff);
      updateData.mmr_adc = Math.max(100, (player.mmr_adc || 1200) + diff);
      updateData.mmr_sup = Math.max(100, (player.mmr_sup || 1200) + diff);
    }

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
