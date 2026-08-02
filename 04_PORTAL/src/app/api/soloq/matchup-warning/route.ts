import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { champion = '', enemyChampion = '' } = body;

    if (!champion || !enemyChampion) {
      return NextResponse.json({ warning: null });
    }

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
