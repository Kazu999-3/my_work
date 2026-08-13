import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { verifyBotSecretStrict } from '../../../../lib/botAuth';

export async function POST(req: Request) {
  try {
  // ===== 管理者セッション確認 =====
  // KTM Botの管理者パネル(Discord)からもこのエンドポイントを叩くが、Bot側はX-Bot-Secret
  // ヘッダーしか送らずverifyAdminSessionでは通らないため常に401になっていた
  // (2026-08-13の監査#18で発覚)。PORTAL_BOT_SECRETが有効な場合のみBot経由の呼び出しも許可する。
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok && !verifyBotSecretStrict(req).ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const { isOverwriteAll, customValue } = await req.json();

    let targetMMR = 1200;
    if (customValue !== undefined && customValue !== null) {
      const parsed = parseInt(customValue, 10);
      if (isNaN(parsed) || parsed < 100 || parsed > 4000) {
        return NextResponse.json({ status: "ERROR", message: "MMRは100〜4000の範囲内で入力してください。" }, { status: 400 });
      }
      targetMMR = parsed;
    }

    // 更新用のベースデータ（全ロールを初期値に戻す）
    const initialData = {
      mmr: targetMMR,
      mmr_top: targetMMR,
      mmr_jg: targetMMR,
      mmr_mid: targetMMR,
      mmr_adc: targetMMR,
      mmr_sup: targetMMR
    };

    if (isOverwriteAll) {
      // 全員を強制的に上書き
      const { error } = await supabase
        .from('ktm_players')
        .update(initialData)
        .neq('id', 'dummy'); // ダミー条件で全件更新（Supabaseの全件更新制限回避のため）

      if (error) throw new Error(error.message);
      return NextResponse.json({ status: "SUCCESS", message: "All players MMR have been initialized to 1200." });
    } else {
      // MMR が未設定（null）のユーザーのみ初期化する。
      // 以前は全件取得してから1人ずつawaitでupdateしていたため、人数分の往復が発生していた。
      // DB側の絞り込み(.or)＋1回の一括update(.in)に変えて往復を2回に減らす。
      const { data: players, error: fetchError } = await supabase
        .from('ktm_players')
        .select('id')
        .or('mmr.is.null,mmr_top.is.null');

      if (fetchError) throw new Error(fetchError.message);

      const targetIds = (players || []).map((p: { id: any }) => p.id);
      if (targetIds.length > 0) {
        const { error: updateError } = await supabase
          .from('ktm_players')
          .update(initialData)
          .in('id', targetIds);
        if (updateError) throw new Error(updateError.message);
      }
      return NextResponse.json({ status: "SUCCESS", message: `Initialized MMR for ${targetIds.length} players.` });
    }
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
