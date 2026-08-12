import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { reviewChampionFacts, reviewMatchupContradictions, reviewRevisionHotspots } from '../../../../lib/dictReview';
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
  // CRON_SECRET未設定時に `process.env.CRON_SECRET &&` の短絡でチェック自体が丸ごと
  // 無効化(fail-open)される、api/cron/route.tsで既に修正済みのパターンがこのルートには
  // 未適用のまま残っていた(2026-08-05発覚)。同じfail-closed方式に統一する。
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = (req.headers.get('user-agent') || '').includes('vercel-cron');
  const bearerOk = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!bearerOk && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPatch, candidates } = await reviewChampionFacts(supabase, 15);
    const needsAttention = candidates.filter((c) => c.verdict !== 'keep');
    const contradictions = await reviewMatchupContradictions(supabase, 15);
    const revisionHotspots = await reviewRevisionHotspots(supabase, 5);

    if (needsAttention.length > 0 || contradictions.length > 0 || revisionHotspots.length > 0) {
      const updateCount = needsAttention.filter((c) => c.verdict === 'update').length;
      const archiveCount = needsAttention.filter((c) => c.verdict === 'archive').length;
      const bodyParts: string[] = [];
      if (needsAttention.length > 0) {
        bodyParts.push(`要更新 ${updateCount}件 / アーカイブ推奨 ${archiveCount}件（現パッチ ${currentPatch || '不明'}）`);
        bodyParts.push(...needsAttention.slice(0, 5).map((c) => `・${c.champion}: ${c.reason}`));
      }
      if (contradictions.length > 0) {
        bodyParts.push(`⚠️ 辞典内容の矛盾疑い ${contradictions.length}件`);
        bodyParts.push(...contradictions.slice(0, 5).map((c) =>
          `・${c.enemy === 'GLOBAL' ? c.champion : `${c.champion} vs ${c.enemy}`}: ${c.summary}`
        ));
      }
      if (revisionHotspots.length > 0) {
        bodyParts.push(`🔁 修正が集中している項目 ${revisionHotspots.length}件（直近14日、リサーチが不安定な可能性）`);
        bodyParts.push(...revisionHotspots.map((h) =>
          `・${h.targetKey}（${h.targetType}/${h.mostRevisedField}）: ${h.revisionCount}回修正`
        ));
      }
      await createAdminNotification({
        type: 'dict_review',
        title: `🔄 辞典鮮度レビュー: ${needsAttention.length + contradictions.length + revisionHotspots.length}件が要対応`,
        body: bodyParts.join('\n'),
        url: '/admin/knowledge?tab=maintenance',
        data: {
          needsAttention: needsAttention.length + contradictions.length + revisionHotspots.length,
          updateCount, archiveCount, contradictionCount: contradictions.length,
          revisionHotspotCount: revisionHotspots.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      scanned: candidates.length,
      needsAttention: needsAttention.length,
      contradictionsScanned: contradictions.length,
      revisionHotspots: revisionHotspots.length,
      currentPatch,
    });
  } catch (err: any) {
    console.error('[dict-review-check] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
