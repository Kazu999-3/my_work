import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// champions/tabs/DictionaryTab.tsx の詳細モーダル用。
// フェーズ1 SSOT化: champion_factsを正本として読み取る。
// matchup_sentinel GLOBAL行にフォールバック（移行期間の安全装置）。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const champId = searchParams.get('champion');
    if (!champId) return NextResponse.json({ error: 'champion が必要です' }, { status: 400 });

    const [factsRes, matchupsRes, spikeRes, interrogationRes] = await Promise.all([
      // --- 正本: champion_facts (SSOT) ---
      supabase.from('champion_facts').select('*').ilike('champion', champId).maybeSingle(),
      // --- 対面メモ: matchup_sentinel（GLOBAL以外） ---
      supabase.from('matchup_sentinel').select('id, matchup_id, champion, enemy, title, strategy, raw_data').ilike('champion', champId).neq('enemy', 'GLOBAL'),
      // --- パワースパイク ---
      supabase.from('champion_power_spikes').select('early_game_score, mid_game_score, late_game_score, peak_window, summary').ilike('champion', champId).maybeSingle(),
      // --- 反省ログ ---
      supabase.from('matchup_sentinel').select('strategy, raw_data, created_at').eq('enemy', 'PROCESS_INTERROGATION'),
    ]);

    const fact = factsRes.data;
    const matchupsList = matchupsRes.data && matchupsRes.data.length > 0 ? matchupsRes.data : [];

    // champion_facts にデータがある場合は正本から構成
    if (fact) {
      const dataFields = {
        strengths: fact.strengths || '',
        weaknesses: fact.weaknesses || '',
        powerSpikes: fact.power_spikes || '',
        buildRunes: fact.build_runes || '',
        fullClearTime: fact.full_clear_time || '',
        counterChampions: fact.counter_champions || '',
        mustBanChampions: fact.must_ban_champions || '',
        pickRecommendation: fact.pick_recommendation || '',
        strategy: fact.strategy || '',
        note_draft: fact.note_draft || '',
        customFields: fact.custom_fields || {},
        patch_meta: fact.patch_meta || null,
        pro_builds: fact.pro_builds || [],
        jg_style: fact.jg_type ? {
          type: fact.jg_type,
          description: fact.jg_description || '',
          blind_pickable: fact.jg_blind_pickable,
          counter_pickable: fact.jg_counter_pickable,
          full_clear_time_sec: fact.full_clear_time_sec ?? null,
          first_core_timing_sec: fact.first_core_timing_sec ?? null,
          second_core_timing_sec: fact.second_core_timing_sec ?? null,
        } : null,
      };

      const pastInterrogations = (interrogationRes.data || []).filter((r: any) => {
        const target = r.raw_data?.target_enemy || '';
        return target.toLowerCase() === champId.toLowerCase();
      });

      return NextResponse.json({
        matchupsList,
        dataFields,
        dictCreatedAt: fact.updated_at || null,
        powerSpikeScores: spikeRes.data || null,
        pastInterrogations,
        // SSOT メタ情報（UIがconfidence/last_verified_at等を表示するために返す）
        ssotMeta: {
          confidence: fact.confidence || 'ai_generated',
          lastVerifiedAt: fact.last_verified_at || null,
          lastVerifiedBy: fact.last_verified_by || null,
          autoUpdatedAt: fact.auto_updated_at || null,
          sourceSummary: fact.source_summary || null,
          patch: fact.patch || null,
        },
      });
    }

    // --- フォールバック: champion_facts にデータが無い場合のみ matchup_sentinel GLOBAL行 ---
    const { data: noteData, error: noteError } = await supabase
      .from('matchup_sentinel')
      .select('strategy, raw_data, created_at')
      .eq('champion', champId)
      .eq('enemy', 'GLOBAL')
      .maybeSingle();

    if (noteError) {
      console.warn(`[champions/detail] ${champId}のGLOBAL行取得でエラー（重複行の可能性）:`, noteError);
    }

    const rd = noteData?.raw_data || {};

    let loadedNoteDraft = rd.note_draft || '';
    if (rd.note_draft_url) {
      try {
        const res = await fetch(rd.note_draft_url);
        if (res.ok) loadedNoteDraft = await res.text();
      } catch (fetchErr) {
        console.error('note_draft_urlの取得に失敗:', rd.note_draft_url, fetchErr);
      }
    }

    const dataFields = {
      strengths: rd.strengths || '', weaknesses: rd.weaknesses || '',
      powerSpikes: rd.powerSpikes || '', buildRunes: rd.buildRunes || '',
      fullClearTime: rd.fullClearTime || '', counterChampions: rd.counterChampions || '',
      mustBanChampions: rd.mustBanChampions || '', pickRecommendation: rd.pickRecommendation || '',
      strategy: noteData?.strategy || '', note_draft: loadedNoteDraft,
      customFields: rd.customFields || {},
      patch_meta: rd.patch_meta || null,
      pro_builds: rd.pro_builds || [],
      jg_style: rd.jg_style || null,
    };

    const pastInterrogations = (interrogationRes.data || []).filter((r: any) => {
      const target = r.raw_data?.target_enemy || '';
      return target.toLowerCase() === champId.toLowerCase();
    });

    return NextResponse.json({
      matchupsList,
      dataFields,
      dictCreatedAt: noteData?.created_at || null,
      powerSpikeScores: spikeRes.data || null,
      pastInterrogations,
      ssotMeta: null, // フォールバック中はメタ情報なし
    });
  } catch (err: any) {
    console.error('[champions/detail] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
