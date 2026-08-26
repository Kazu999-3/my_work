import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { enqueueEdgeTask } from '../../../../../lib/edgeTask';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { job } = await req.json();

    switch (job) {
      case 'youtube_absorber': {
        const task = await enqueueEdgeTask('youtube_channel_monitor', { trigger: 'manual_dashboard' });
        return NextResponse.json({ success: true, message: 'YouTube新着動画収集ジョブを投入しました', task });
      }

      case 'dict_fact_check': {
        const task = await enqueueEdgeTask('dict_synthesizer', { trigger: 'manual_dashboard', mode: 'batch_check' });
        return NextResponse.json({ success: true, message: 'チャンピオン辞典ファクトチェックを投入しました', task });
      }

      case 'discord_sync': {
        // 直接Discord同期APIを叩く
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/discord/auto-sync-members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => null);

        const data = res ? await res.json().catch(() => null) : null;
        return NextResponse.json({
          success: true,
          message: data?.message || 'Discordメンバー自動同期を実行しました',
          data,
        });
      }

      case 'patch_update': {
        const task = await enqueueEdgeTask('lol_trend_collect', { trigger: 'manual_dashboard' });
        return NextResponse.json({ success: true, message: '最新パッチ・トレンドデータ同期を投入しました', task });
      }

      default:
        return NextResponse.json({ error: '無効な job 種別です' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('❌ [System Trigger API] Error:', err);
    return NextResponse.json({ error: `ジョブ起動に失敗しました: ${err.message}` }, { status: 500 });
  }
}
