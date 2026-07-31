import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { reviewChampionFacts } from '../../../../lib/dictReview';
import { createAdminNotification } from '../../../../lib/notify';

// ============================================================
// 辞典の鮮度レビュー・週次自動検知 (課題#50 フェーズC 拡張)
//
// /admin/knowledge の「データ整備＆鮮度レビュー」タブは完全手動で、
// 開いて「レビュー実行」を押さない限り古いデータが放置されたままだった。
// 反映(keep/archive/regenerate)は辞典本体を直接書き換える操作なので
// 引き続き人の承認を必須にするが、「そもそも見に行かない」問題を解消する
// ため、検知だけをこのCronで自動化し、要対応がある時だけ通知する。
// Vercel Cron は Authorization: Bearer CRON_SECRET を付与する。
// vercel.jsonのschedule("0 23 * * 2")はUTC基準。+9時間するとJST水曜8:00に着地する
// （UTC火曜23:00 → JST水曜8:00）。曜日をそのまま"3"(水)にすると木曜8:00 JSTに
// ズレるので注意（2026-08-01に実際にこのズレで発覚・修正した）。
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPatch, candidates } = await reviewChampionFacts(supabase, 15);
    const needsAttention = candidates.filter((c) => c.verdict !== 'keep');

    if (needsAttention.length > 0) {
      const updateCount = needsAttention.filter((c) => c.verdict === 'update').length;
      const archiveCount = needsAttention.filter((c) => c.verdict === 'archive').length;
      await createAdminNotification({
        type: 'dict_review',
        title: `🔄 辞典鮮度レビュー: ${needsAttention.length}件が要対応`,
        body: `要更新 ${updateCount}件 / アーカイブ推奨 ${archiveCount}件（現パッチ ${currentPatch || '不明'}）\n${needsAttention.slice(0, 5).map((c) => `・${c.champion}: ${c.reason}`).join('\n')}`,
        url: '/admin/knowledge?tab=maintenance',
        data: { needsAttention: needsAttention.length, updateCount, archiveCount },
      });
    }

    return NextResponse.json({
      success: true,
      scanned: candidates.length,
      needsAttention: needsAttention.length,
      currentPatch,
    });
  } catch (err: any) {
    console.error('[dict-review-check] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
