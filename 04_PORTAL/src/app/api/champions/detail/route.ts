import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// champions/tabs/DictionaryTab.tsx の詳細モーダル用。
// フェーズ1 SSOT化 + 複数レーン対応: champion_factsを正本として読み取る。
// ロール(role)が指定されている場合は該当ロールの知見を返し、
// プレイ可能なレーン一覧(availableRoles)も同時に返却する。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const champId = searchParams.get('champion');
    const requestedRole = searchParams.get('role');
    if (!champId) return NextResponse.json({ error: 'champion が必要です' }, { status: 400 });

    // 1. そのチャンピオンのプレイ可能ロール一覧を取得
    const { data: laneRoleRows } = await supabase
      .from('champion_lane_roles')
      .select('role, rank')
      .ilike('champion', champId)
      .order('rank', { ascending: true });

    const availableRoles: string[] = (laneRoleRows || [])
      .map((r: any) => (r.role === 'ADC' ? 'BOT' : r.role))
      .filter((r: string, i: number, arr: string[]) => arr.indexOf(r) === i);

    // ロールが明示されていない場合は最有力ロール、それも無ければ 'GLOBAL'
    const targetRole = requestedRole || (availableRoles.length > 0 ? availableRoles[0] : 'GLOBAL');

    // 2. 指定ロール、またはフォールバック用のクエリを実行
    const [factsRoleRes, factsFallbackRes, matchupsRes, spikeRes, interrogationRes, jungleTimingRes] = await Promise.all([
      // --- 指定ロールの champion_facts ---
      requestedRole
        ? supabase.from('champion_facts').select('*').ilike('champion', champId).ilike('role', requestedRole).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // --- フォールバック（champion一致のみ、最新順） ---
      supabase.from('champion_facts').select('*').ilike('champion', champId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      // --- 対面メモ: matchup_sentinel（GLOBAL以外） ---
      supabase.from('matchup_sentinel').select('id, matchup_id, champion, enemy, title, strategy, raw_data').ilike('champion', champId).neq('enemy', 'GLOBAL'),
      // --- パワースパイク ---
      supabase.from('champion_power_spikes').select('early_game_score, mid_game_score, late_game_score, peak_window, summary').ilike('champion', champId).maybeSingle(),
      // --- 反省ログ ---
      supabase.from('matchup_sentinel').select('strategy, raw_data, created_at').eq('enemy', 'PROCESS_INTERROGATION'),
      // --- Riot実測ジャングルタイミング ---
      supabase.from('champion_jungle_timing_agg').select('sample_count, avg_first_core_sec, avg_second_core_sec, tier, external_fastest_clear_sec, external_sample_size, external_source').ilike('champion', champId).maybeSingle(),
    ]);

    const fact = factsRoleRes?.data || factsFallbackRes.data;
    const matchupsList = matchupsRes.data && matchupsRes.data.length > 0 ? matchupsRes.data : [];
    const jt = jungleTimingRes.data;
    const realJungleTiming = jt ? {
      sampleCount: jt.sample_count,
      avgFirstCoreSec: jt.avg_first_core_sec,
      avgSecondCoreSec: jt.avg_second_core_sec,
      tier: jt.tier,
      externalFastestClearSec: jt.external_fastest_clear_sec,
      externalSampleSize: jt.external_sample_size,
      externalSource: jt.external_source,
    } : null;

    let dataFields: any = {
      strengths: '',
      weaknesses: '',
      powerSpikes: '',
      buildRunes: '',
      fullClearTime: '',
      counterChampions: '',
      mustBanChampions: '',
      pickRecommendation: '',
      strategy: '',
      note_draft: '',
      customFields: {},
      patch_meta: null,
      pro_builds: [],
      research_sources: [],
      jg_style: null,
      role: targetRole,
    };

    if (fact) {
      dataFields = {
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
        research_sources: fact.research_sources || [],
        jg_style: fact.jg_type ? {
          type: fact.jg_type,
          description: fact.jg_description || '',
          blind_pickable: fact.jg_blind_pickable,
          counter_pickable: fact.jg_counter_pickable,
          full_clear_time_sec: fact.full_clear_time_sec ?? null,
          first_core_timing_sec: fact.first_core_timing_sec ?? null,
          second_core_timing_sec: fact.second_core_timing_sec ?? null,
        } : null,
        role: fact.role || targetRole,
      };
    }

    const pastInterrogations = (interrogationRes.data || []).filter((r: any) => {
      const target = r.raw_data?.target_enemy || '';
      return target.toLowerCase() === champId.toLowerCase();
    });

    return NextResponse.json({
      success: true,
      champion: champId,
      currentRole: targetRole,
      availableRoles: availableRoles.length > 0 ? availableRoles : ['GLOBAL'],
      dataFields,
      powerSpikes: spikeRes.data || null,
      matchupsList,
      pastInterrogations,
      realJungleTiming,
    });
  } catch (err: any) {
    console.error('[api/champions/detail] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
