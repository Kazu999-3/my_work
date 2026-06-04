import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { winner } = await req.json();
    if (winner !== "BLUE" && winner !== "RED") {
      return NextResponse.json({ status: "ERROR", message: "Invalid winner format. Must be BLUE or RED." }, { status: 400 });
    }

    // 最新の試合を1件取得
    const { data: latestMatch, error: matchError } = await supabase
      .from('ktm_matches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (matchError || !latestMatch) {
      return NextResponse.json({ status: "ERROR", message: "No match found to fix." }, { status: 404 });
    }

    // 勝利チームを更新
    const { error: updateError } = await supabase
      .from('ktm_matches')
      .update({ winning_team: winner })
      .eq('id', latestMatch.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // ※MMRの再計算が必要な場合は、ここで別途処理を呼び出す必要があるが
    // 現在のMVPでは「勝敗記録の修正」のみとする。

    return NextResponse.json({ status: "SUCCESS", message: `Match updated to ${winner} win.` });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
