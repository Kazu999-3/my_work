import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// champions/tabs/DictionaryTab.tsx の詳細モーダル（対面メモ一覧・辞典本文・パワースパイク・
// 過去の反省点）用に4つのmatchup_sentinel/champion_power_spikesクエリを1つにまとめた
// 読み取り専用API。
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const champId = searchParams.get('champion');
    if (!champId) return NextResponse.json({ error: 'champion が必要です' }, { status: 400 });

    const [matchupsRes, noteRes, spikeRes, interrogationRes] = await Promise.all([
      supabase.from('matchup_sentinel').select('id, matchup_id, champion, enemy, title, strategy, raw_data').ilike('champion', champId).neq('enemy', 'GLOBAL'),
      supabase.from('matchup_sentinel').select('strategy, raw_data, created_at').eq('champion', champId).eq('enemy', 'GLOBAL').single(),
      supabase.from('champion_power_spikes').select('early_game_score, mid_game_score, late_game_score, peak_window, summary').eq('champion', champId).maybeSingle(),
      supabase.from('matchup_sentinel').select('strategy, raw_data, created_at').eq('enemy', 'PROCESS_INTERROGATION'),
    ]);

    const matchupsList = matchupsRes.data && matchupsRes.data.length > 0 ? matchupsRes.data : [];

    const noteData = noteRes.data;
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
    });
  } catch (err: any) {
    console.error('[champions/detail] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
