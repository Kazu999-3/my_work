import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { checkKnowledgeFreshness } from '../../../../lib/knowledgeFreshness';
import { createAdminNotification } from '../../../../lib/notify';

// ============================================================
// ナレッジ関連テーブルの鮮度監視・日次自動アラート (2026-08-03 追加)
//
// /admin/knowledge の鮮度モニター(FreshnessPanel)はプル型(見に行かないと
// 気づかない)だった。「dead man's switch」の考え方(想定される合図が
// 来なかったこと自体をアラートする)を適用し、毎日チェックして停滞が
// あれば管理者通知でプッシュ型アラートに変える。
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sources = await checkKnowledgeFreshness(supabase);
    const stale = sources.filter((s) => s.isStale);

    if (stale.length > 0) {
      await createAdminNotification({
        type: 'dict_review',
        title: `🚨 データ鮮度アラート: ${stale.length}件が停滞中`,
        body: stale.map((s) => {
          const ageLabel = s.ageHours === null ? 'データなし' : s.ageHours < 24 ? `${Math.round(s.ageHours)}時間前` : `${Math.round(s.ageHours / 24)}日前`;
          return `・${s.label}: 最終更新 ${ageLabel}（想定 ${s.expectedIntervalHours}時間以内）`;
        }).join('\n'),
        url: '/admin/knowledge?tab=maintenance',
        data: { staleCount: stale.length },
      });
    }

    return NextResponse.json({ success: true, checked: sources.length, stale: stale.length });
  } catch (err: any) {
    console.error('[freshness-check] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
