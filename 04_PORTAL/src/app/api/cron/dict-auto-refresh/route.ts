import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

async function getCurrentPatch(): Promise<string> {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    const fullVer = versions[0] || '16.15.1';
    // "16.15.1" からメジャー・マイナーを取得 "16.15"
    return fullVer.split('.').slice(0, 2).join('.');
  } catch {
    return '16.15';
  }
}

export async function GET(req: Request) {
  // CRON_SECRET 認証または管理者セッション
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const currentPatch = await getCurrentPatch();
    console.log(`[dict-auto-refresh] 現在の最新パッチ: ${currentPatch}`);

    // champion_facts の全アクティブ行を取得
    const { data: facts, error } = await supabase
      .from('champion_facts')
      .select('champion, patch, confidence, updated_at')
      .eq('archived', false);

    if (error) throw error;

    let staleCount = 0;
    const staleChampions: string[] = [];

    for (const f of (facts || [])) {
      const p = (f.patch || '').split('.').slice(0, 2).join('.');
      const isPatchOutdated = p && p !== currentPatch;

      if (isPatchOutdated && f.confidence !== 'stale') {
        staleChampions.push(f.champion);
        staleCount++;
      }
    }

    // パッチ遅れのチャンピオンの confidence を 'stale' に一括更新
    if (staleChampions.length > 0) {
      const { error: updateErr } = await supabase
        .from('champion_facts')
        .update({ confidence: 'stale', updated_at: new Date().toISOString() })
        .in('champion', staleChampions);

      if (updateErr) {
        console.error('[dict-auto-refresh] stale一括更新失敗:', updateErr);
      } else {
        console.log(`[dict-auto-refresh] ${staleChampions.length} 体のチャンピオンを 'stale' に更新しました`);
      }
    }

    // 自動更新タスクを積む（1回のcron実行につき最大5件まで。キュー溢れ防止）
    const toEnqueue = staleChampions.slice(0, 5);
    let enqueuedCount = 0;

    for (const champ of toEnqueue) {
      // 既に pending/running のタスクがあるか確認
      const { data: existingTask } = await supabase
        .from('edge_tasks')
        .select('id')
        .eq('task_type', 'champion_trend')
        .eq('status', 'pending')
        .filter('payload->champion', 'eq', champ)
        .maybeSingle();

      if (!existingTask) {
        const { error: taskErr } = await supabase.from('edge_tasks').insert({
          task_type: 'champion_trend',
          payload: { champion: champ, role: 'GLOBAL', patch: currentPatch },
          status: 'pending',
          created_at: new Date().toISOString(),
        });

        if (!taskErr) enqueuedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      currentPatch,
      totalChampions: facts?.length || 0,
      staleMarked: staleCount,
      enqueuedForAutoUpdate: enqueuedCount,
      staleChampionsSample: staleChampions.slice(0, 10),
    });
  } catch (err: any) {
    console.error('[dict-auto-refresh] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
