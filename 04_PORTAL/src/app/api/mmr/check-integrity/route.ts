import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { computeRepresentativeMmr, replayMmrHistory } from '../../../../lib/mmr';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// MMR整合性チェック: 全試合を再生した「本来の値」と、DB に保存されている今の値を比べる。
// 2026-10-16: 再生はリビルドと同じ replayMmrHistory を使う。以前はこのファイルに計算を別に書いており、
// リビルドに全レーン波及・早期投了の緩和・エキシビション除外を入れた後もそれが反映されず、
// リビルド直後でも全員「ズレあり」と表示されて「Rebuildを実行」ボタンが出続けていた。
export async function GET(request: Request) {
  try {
    // ===== 管理者セッション確認 =====
    // 全プレイヤーの内部MMR格差データを返す管理者専用の診断APIのため保護する。
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    // =================================

    const { data: allPlayers, error: pError } = await supabase
      .from('ktm_players')
      .select('id, name, mmr, mmr_top, mmr_jg, mmr_mid, mmr_adc, mmr_sup');
    if (pError) throw pError;
    const currentById = new Map((allPlayers || []).map((p: any) => [p.id, p]));

    const { playersMap } = await replayMmrHistory(supabase);

    const discrepancies = [];
    for (const e of Array.from(playersMap.values()) as any[]) {
      const cur: any = currentById.get(e.id);
      if (!cur) continue;
      // 代表MMRはリビルド/ライブと同じ「試合数重み付け」で期待値を出す(N1整合)。
      const expectedTotal = computeRepresentativeMmr(
        { TOP: e.mmr_top, JG: e.mmr_jg, MID: e.mmr_mid, ADC: e.mmr_adc, SUP: e.mmr_sup },
        { TOP: e.laneGames.TOP, JG: e.laneGames.JG, MID: e.laneGames.MID, ADC: e.laneGames.ADC, SUP: e.laneGames.SUP }
      );
      const current = {
        TOP: cur.mmr_top || 1200, JG: cur.mmr_jg || 1200, MID: cur.mmr_mid || 1200,
        ADC: cur.mmr_adc || 1200, SUP: cur.mmr_sup || 1200, TOTAL: cur.mmr || 1200,
      };
      const expected = {
        TOP: e.mmr_top, JG: e.mmr_jg, MID: e.mmr_mid, ADC: e.mmr_adc, SUP: e.mmr_sup, TOTAL: expectedTotal,
      };
      const diff = {
        TOP: expected.TOP - current.TOP, JG: expected.JG - current.JG, MID: expected.MID - current.MID,
        ADC: expected.ADC - current.ADC, SUP: expected.SUP - current.SUP, TOTAL: expected.TOTAL - current.TOTAL,
      };
      if (Object.values(diff).some((d) => Math.abs(d) > 2)) {
        discrepancies.push({ name: e.name, current, expected, diff });
      }
    }

    return NextResponse.json({
      success: true,
      hasDiscrepancy: discrepancies.length > 0,
      discrepancyCount: discrepancies.length,
      discrepancies,
    });
  } catch (error: any) {
    console.error('Integrity Check Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
