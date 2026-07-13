import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { performFullMmrRebuild } from '../../../../lib/mmr';

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

    // MMRの再計算を自動実行し、整合性を保つ
    await performFullMmrRebuild(supabase);

    return NextResponse.json({ status: "SUCCESS", message: `Match updated to ${winner} win and MMR rebuilt.` });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}

