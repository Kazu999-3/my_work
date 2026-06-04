import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { isOverwriteAll } = await req.json();

    // 譖ｴ譁ｰ逕ｨ縺ｮ繝吶・繧ｹ繝・・繧ｿ・亥・繝ｭ繝ｼ繝ｫ繧貞・譛溷､縺ｫ謌ｻ縺呻ｼ・    const initialData = {
      mmr: 1200,
      mmr_top: 1200,
      mmr_jg: 1200,
      mmr_mid: 1200,
      mmr_adc: 1200,
      mmr_sup: 1200
    };

    if (isOverwriteAll) {
      // 蜈ｨ蜩｡繧貞ｼｷ蛻ｶ逧・↓荳頑嶌縺・      const { error } = await supabase
        .from('ktm_players')
        .update(initialData)
        .neq('id', 'dummy'); // 繝繝溘・譚｡莉ｶ縺ｧ蜈ｨ莉ｶ譖ｴ譁ｰ・・upabase縺ｮ蜈ｨ莉ｶ譖ｴ譁ｰ蛻ｶ髯仙屓驕ｿ縺ｮ縺溘ａ・・
      if (error) throw new Error(error.message);
      return NextResponse.json({ status: "SUCCESS", message: "All players MMR have been initialized to 1200." });
    } else {
      // is_active 縺縺・MMR 縺後↑縺・ｼ・ull縺ｪ縺ｩ・峨Θ繝ｼ繧ｶ繝ｼ縺ｮ縺ｿ蛻晄悄蛹悶＠縺溘＞蝣ｴ蜷・      // 迴ｾ蝨ｨ縺ｮ螳溯｣・〒縺ｯ繧ｷ繝ｳ繝励Ν縺ｫ蜈ｨ莉ｶ縺ｮ縺・■荳驛ｨ繧貞・逅・☆繧九°縲∵眠隕上□縺代ｒ蜃ｦ逅・☆繧九°縺ｧ縺吶′縲・      // Supabase縺ｮupdate縺ｧnull譚｡莉ｶ繧剃ｽｿ縺・・縺碁屮縺励＞縺溘ａ縲∽ｸ譌ｦ蜿門ｾ励＠縺ｦ縺九ｉ譖ｴ譁ｰ縺励∪縺吶・      const { data: players, error: fetchError } = await supabase
        .from('ktm_players')
        .select('id, mmr, mmr_top');

      if (fetchError) throw new Error(fetchError.message);

      let updatedCount = 0;
      for (const p of players || []) {
        if (p.mmr === null || p.mmr_top === null) {
          await supabase.from('ktm_players').update(initialData).eq('id', p.id);
          updatedCount++;
        }
      }
      return NextResponse.json({ status: "SUCCESS", message: `Initialized MMR for ${updatedCount} players.` });
    }
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
