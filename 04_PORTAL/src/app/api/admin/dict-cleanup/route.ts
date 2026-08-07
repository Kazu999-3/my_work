import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    let deletedFacts = 0;
    let deletedSentinel = 0;
    let deletedKnowledge = 0;
    let deletedQueue = 0;

    // 1. champion_facts の空データ・アーカイブ済みゴミ削除
    const { data: emptyFacts } = await supabase
      .from('champion_facts')
      .select('champion')
      .or('strengths.is.null,strengths.eq.');
    
    if (emptyFacts && emptyFacts.length > 0) {
      const champNames = emptyFacts.map((f: any) => f.champion);
      const { count } = await supabase
        .from('champion_facts')
        .delete({ count: 'exact' })
        .in('champion', champNames);
      deletedFacts = count || 0;
    }

    // 2. matchup_sentinel の空 strategy レコード削除
    const { count: countSentinel } = await supabase
      .from('matchup_sentinel')
      .delete({ count: 'exact' })
      .or('strategy.is.null,strategy.eq.');
    deletedSentinel = countSentinel || 0;

    // 3. personal_knowledge の空 content レコード削除
    const { count: countKb } = await supabase
      .from('personal_knowledge')
      .delete({ count: 'exact' })
      .or('content.is.null,content.eq.');
    deletedKnowledge = countKb || 0;

    // 4. dict_fact_check_queue の dismissed (却下済み) レコードのクリーンアップ
    const { count: countQueue } = await supabase
      .from('dict_fact_check_queue')
      .delete({ count: 'exact' })
      .eq('status', 'dismissed');
    deletedQueue = countQueue || 0;

    const totalCleaned = deletedFacts + deletedSentinel + deletedKnowledge + deletedQueue;

    return NextResponse.json({
      success: true,
      message: `✅ データベースのクリーンアップが完了しました（計${totalCleaned}件のゴミデータを削除・整理）`,
      details: {
        deletedFacts,
        deletedSentinel,
        deletedKnowledge,
        deletedQueue,
      },
    });
  } catch (err: any) {
    console.error('[dict-cleanup] POST error:', err);
    return NextResponse.json({ error: err.message || 'クリーンアップ処理中にエラーが発生しました。' }, { status: 500 });
  }
}
