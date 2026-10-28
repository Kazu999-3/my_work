import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// 定期実行を待たずにタスクを1件起票する（2026-10-20、旧ポータル 04 の戦術取り込み画面にあった
// 「辞典の合成を起動」ボタンの移植。04 側の画面は 05 に機能がそろったため削除した）。
// 起票できる種類は限定し、同じ種類が待機中・実行中なら積まない（連打で何重にも入らないように）。
const TRIGGERABLE_TASK_TYPES: Record<string, string> = {
  dict_synthesizer: '辞典の合成',
  youtube_channel_monitor: 'YouTube新着巡回',
  reddit_scout: 'Redditスカウト',
};

export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const taskType = String(body.task_type || '');
    const label = TRIGGERABLE_TASK_TYPES[taskType];
    if (!label) return NextResponse.json({ error: '起動できない種類です' }, { status: 400 });

    const { data: active, error: activeErr } = await supabase
      .from('edge_tasks').select('id').eq('task_type', taskType).in('status', ['pending', 'running']).limit(1);
    if (activeErr) throw activeErr;
    if (active && active.length > 0) {
      return NextResponse.json({ success: true, alreadyQueued: true, message: `${label}は待機中または実行中です` });
    }

    const { error } = await supabase.from('edge_tasks').insert({ task_type: taskType, payload: {}, status: 'pending' });
    if (error) throw error;

    // GitHub Actions の定期実行は間隔が延びることがあるため、トークンがあれば即時起動する（無ければ次の定期実行で処理される）
    const ghToken = process.env.GH_ACTIONS_TOKEN;
    let dispatched = false;
    if (ghToken) {
      const res = await fetch('https://api.github.com/repos/Kazu999-3/my_work/actions/workflows/edge-cloud-worker.yml/dispatches', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'master' }),
      }).catch(() => null);
      dispatched = !!res?.ok;
    }

    return NextResponse.json({
      success: true,
      dispatched,
      message: dispatched ? `${label}を起動しました` : `${label}を予約しました（次の定期実行で処理されます）`,
    });
  } catch (e: any) {
    console.error('[admin/tasks/trigger] Error:', e);
    return NextResponse.json({ error: e.message || '起動に失敗しました' }, { status: 500 });
  }
}
