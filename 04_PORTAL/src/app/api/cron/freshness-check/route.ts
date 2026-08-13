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
  // CRON_SECRET未設定時fail-openパターンの修正(2026-08-05発覚、api/cron/route.tsと同じ修正)。
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = (req.headers.get('user-agent') || '').includes('vercel-cron');
  const bearerOk = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!bearerOk && !isVercelCron) {
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
        url: '/admin/dict-health',
        data: { staleCount: stale.length },
      });
    }

    // dict_fact_check_queueは検出(スキャン)も消化も完全に手動で、他のどのcronからも
    // 監視されていなかった(2026-08-13の監査#13で発覚)。誰もタブを開かなければ積み上がりに
    // 気づけないため、pending件数がしきい値を超えたら鮮度アラートとは別に通知する。
    const PENDING_ALERT_THRESHOLD = 15;
    const { count: pendingFactCheckCount } = await supabase
      .from('dict_fact_check_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if ((pendingFactCheckCount || 0) >= PENDING_ALERT_THRESHOLD) {
      await createAdminNotification({
        type: 'dict_review',
        title: `📋 辞典ファクトチェックキューが${pendingFactCheckCount}件滞留中`,
        body: `dict_fact_check_queueの未対応件数がしきい値(${PENDING_ALERT_THRESHOLD}件)を超えました。「辞典＆ナレッジ統合ヘルスダッシュボード」のファクトチェックタブで確認してください。`,
        url: '/admin/dict-health',
        data: { pendingFactCheckCount },
      });
    }

    return NextResponse.json({
      success: true,
      checked: sources.length,
      stale: stale.length,
      pendingFactCheckCount: pendingFactCheckCount || 0,
    });
  } catch (err: any) {
    console.error('[freshness-check] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
