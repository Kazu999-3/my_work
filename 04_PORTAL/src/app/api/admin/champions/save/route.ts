import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { recordMatchupSentinelRevision } from '../../../../../lib/matchupSentinelRevisions';

// フェーズ1 SSOT化: 辞典の手動保存先を champion_facts に変更。
// 移行期間中は matchup_sentinel GLOBAL行への二重書きも維持する。

export async function POST(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase環境変数が設定されていません。' }, { status: 500 });
    }
    const body = await req.json();
    const { matchup_id, champion, enemy, strategy, raw_data } = body;

    if (!matchup_id || !champion || !enemy) {
      return NextResponse.json({ error: '必須パラメータが不足しています。' }, { status: 400 });
    }

    // 履歴記録用に更新前の状態を取得しておく
    const { data: beforeRow } = await supabase
      .from('matchup_sentinel')
      .select('title, strategy, raw_data')
      .eq('matchup_id', matchup_id)
      .maybeSingle();

    // =============================================
    // A. champion_facts (SSOT) への書き込み
    // =============================================
    const rd = raw_data || {};
    const jg = rd.jg_style || {};
    const factsUpsert: Record<string, any> = {
      champion,
      strengths: rd.strengths || null,
      weaknesses: rd.weaknesses || null,
      power_spikes: rd.powerSpikes || null,
      build_runes: rd.buildRunes || null,
      full_clear_time: rd.fullClearTime || null,
      strategy: strategy || null,
      counter_champions: rd.counterChampions || null,
      must_ban_champions: rd.mustBanChampions || null,
      pick_recommendation: rd.pickRecommendation || null,
      note_draft: rd.note_draft || null,
      jg_type: jg.type || null,
      jg_description: jg.description || null,
      jg_blind_pickable: typeof jg.blind_pickable === 'number' ? jg.blind_pickable : null,
      jg_counter_pickable: typeof jg.counter_pickable === 'number' ? jg.counter_pickable : null,
      full_clear_time_sec: typeof jg.full_clear_time_sec === 'number' ? jg.full_clear_time_sec : null,
      first_core_timing_sec: typeof jg.first_core_timing_sec === 'number' ? jg.first_core_timing_sec : null,
      second_core_timing_sec: typeof jg.second_core_timing_sec === 'number' ? jg.second_core_timing_sec : null,
      patch: rd.patch_meta?.patch || null,
      source: 'manual',
      custom_fields: rd.customFields || {},
      patch_meta: rd.patch_meta || null,
      pro_builds: rd.pro_builds || [],
      // 手動保存 = 人間が確認した内容なので verified
      confidence: 'verified',
      last_verified_at: new Date().toISOString(),
      last_verified_by: 'admin',
      source_summary: '管理者による手動保存',
      updated_at: new Date().toISOString(),
    };

    const { error: factsError } = await supabase
      .from('champion_facts')
      .upsert(factsUpsert, { onConflict: 'champion' });

    if (factsError) {
      console.error('❌ [Champion Save API] champion_facts upsert error:', factsError);
      // champion_facts への書き込みが失敗してもmatchup_sentinelへの書き込みは試みる（移行期間中の安全措置）
    }

    // =============================================
    // B. matchup_sentinel への二重書き（移行期間中のみ維持）
    // =============================================
    // 容量削減対策①：note_draftをSupabase Storageへ退避させる
    let updatedRawData = { ...(rd) };
    if (updatedRawData.note_draft) {
      try {
        const draftContent = updatedRawData.note_draft;
        const fileName = `${champion}_draft.txt`;
        
        const { error: uploadError } = await supabase
          .storage
          .from('drafts')
          .upload(fileName, draftContent, {
            contentType: 'text/plain; charset=utf-8',
            upsert: true
          });

        if (uploadError) {
          console.error('❌ [Champion Save API] Storage Upload Error:', uploadError);
        } else {
          const { data: urlData } = supabase
            .storage
            .from('drafts')
            .getPublicUrl(fileName);
            
          updatedRawData.note_draft_url = urlData?.publicUrl || `/storage/v1/object/public/drafts/${fileName}`;
          delete updatedRawData.note_draft;
        }
      } catch (uploadErr) {
        console.error('❌ [Champion Save API] Storage Process Exception:', uploadErr);
      }
    }

    const data = {
      matchup_id,
      champion,
      enemy,
      strategy: strategy || '',
      raw_data: updatedRawData,
      created_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('matchup_sentinel')
      .upsert(data, { onConflict: 'matchup_id' })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    // 履歴記録（note_draftはStorage退避前の実文で差分を残す）
    await recordMatchupSentinelRevision(
      matchup_id,
      beforeRow,
      { strategy: data.strategy, raw_data: { ...(raw_data || {}) } }
    );

    return NextResponse.json({
      success: true,
      message: 'チャンピオン辞典を安全に更新しました。',
      data: result
    });

  } catch (err: any) {
    console.error('❌ [Champion Save API] POST Error:', err);
    return NextResponse.json({ error: 'チャンピオン辞典の保存に失敗しました: ' + err.message }, { status: 500 });
  }
}
