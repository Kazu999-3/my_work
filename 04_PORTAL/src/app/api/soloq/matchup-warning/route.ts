import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { normalizeChampionName } from '../../../../lib/championNames';

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return NextResponse.json({ warning: null });
    }

    const body = await request.json().catch(() => ({}));
    const { champion: championInput = '', enemyChampion: enemyChampionInput = '' } = body;

    if (!championInput || !enemyChampionInput) {
      return NextResponse.json({ warning: null });
    }

    // 自由記述の入力欄からの値は大文字小文字・アポストロフィがDB表記と食い違うことがあり、
    // 完全一致検索では無警告のまま何も見つからなくなる(coach/analyzeのmatchupモードと同じ正規化)。
    const champion = normalizeChampionName(championInput);
    const enemyChampion = normalizeChampionName(enemyChampionInput);

    if (!supabaseAdmin) {
      return NextResponse.json({ warning: null });
    }

    // 1. Check matchup_sentinel
    const matchupId = `${champion}_vs_${enemyChampion}`;
    const { data: sentinelData } = await supabaseAdmin
      .from('matchup_sentinel')
      .select('strategy, title, updated_at')
      .eq('matchup_id', matchupId)
      .maybeSingle();

    // 2. Check soloq_reflections
    const { data: reflectionsData } = await supabaseAdmin
      .from('soloq_reflections')
      .select('matchup_memo, reflection_note, win, kda, created_at')
      .eq('champion', champion)
      .eq('enemy_champion', enemyChampion)
      .not('matchup_memo', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);

    let memoText = '';
    if (sentinelData?.strategy) {
      memoText = sentinelData.strategy;
    } else if (reflectionsData && reflectionsData.length > 0) {
      memoText = reflectionsData.map((r: any) => r.matchup_memo).filter(Boolean).join('\n---\n');
    }

    if (!memoText) {
      return NextResponse.json({ warning: null });
    }

    return NextResponse.json({
      warning: {
        champion,
        enemyChampion,
        memo: memoText,
        recentReflectionsCount: reflectionsData ? reflectionsData.length : 0,
        lastUpdatedAt: sentinelData?.updated_at || (reflectionsData?.[0]?.created_at || null),
      },
    });
  } catch (err: any) {
    console.error('Error fetching matchup warning:', err);
    return NextResponse.json({ warning: null });
  }
}
