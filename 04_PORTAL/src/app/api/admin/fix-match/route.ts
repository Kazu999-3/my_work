import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { winner } = await req.json();
    if (winner !== "BLUE" && winner !== "RED") {
      return NextResponse.json({ status: "ERROR", message: "Invalid winner format. Must be BLUE or RED." }, { status: 400 });
    }

    // 譛譁ｰ縺ｮ隧ｦ蜷医ｒ1莉ｶ蜿門ｾ・    const { data: latestMatch, error: matchError } = await supabase
      .from('ktm_matches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (matchError || !latestMatch) {
      return NextResponse.json({ status: "ERROR", message: "No match found to fix." }, { status: 404 });
    }

    // 蜍晏茜繝√・繝繧呈峩譁ｰ
    const { error: updateError } = await supabase
      .from('ktm_matches')
      .update({ winning_team: winner })
      .eq('id', latestMatch.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // 窶ｻMMR縺ｮ蜀崎ｨ育ｮ励′蠢・ｦ√↑蝣ｴ蜷医・縲√％縺薙〒蛻･騾泌・逅・ｒ蜻ｼ縺ｳ蜃ｺ縺吝ｿ・ｦ√′縺ゅｋ縺・    // 迴ｾ蝨ｨ縺ｮMVP縺ｧ縺ｯ縲悟享謨苓ｨ倬鹸縺ｮ菫ｮ豁｣縲阪・縺ｿ縺ｨ縺吶ｋ縲・
    return NextResponse.json({ status: "SUCCESS", message: `Match updated to ${winner} win.` });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
