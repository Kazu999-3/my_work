import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { isOverwriteAll } = await req.json();

    // 更新用のベースデータ（全ロールを初期値に戻す）
    const initialData = {
      mmr: 1200,
      mmr_top: 1200,
      mmr_jg: 1200,
      mmr_mid: 1200,
      mmr_adc: 1200,
      mmr_sup: 1200
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
      // is_active だが MMR がない（nullなど）ユーザーのみ初期化したい場合
      // 現在の実装ではシンプルに全件のうち一部を処理するか、新規だけを処理するかですが、
      // Supabaseのupdateでnull条件を使うのが難しいため、一旦取得してから更新します。
      const { data: players, error: fetchError } = await supabase
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
