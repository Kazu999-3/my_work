import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// 失敗しているタスクを再起票する（旧ポータル /api/admin/tasks/retry-all の移植）。2026-10-04
// 旧版から変えた点: 同じ (task_type, payload) が既に待機中・実行中なら積まない（連打で同じタスクが何重にも入っていた）。

// scripts/edge_cloud_worker.py（GitHub Actions）が処理するタスク種別。
// youtube_absorb・champion_db_bulk_update は専用の定期ワークフローが担当するため対象外。
const RETRYABLE_TASK_TYPES = new Set([
  'resolve_youtube_channel', 'resolve_youtube_playlist', 'youtube_channel_monitor',
  'reddit_scout', 'lol_trend_collect', 'dict_synthesizer', 'champion_trend',
]);

export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 20) : [];
    if (ids.length === 0) return NextResponse.json({ error: 'ids が空です' }, { status: 400 });

    // 画面から送られた中身は信用せず、DB上で本当に failed のものだけを対象にする
    const { data: failed, error } = await supabase
      .from('edge_tasks').select('id, task_type, payload').in('id', ids).eq('status', 'failed');
    if (error) throw error;

    const { data: active } = await supabase
      .from('edge_tasks').select('task_type, payload').in('status', ['pending', 'running']);
    const activeKeys = new Set((active || []).map((t) => `${t.task_type}|${JSON.stringify(t.payload || {})}`));

    let retried = 0, skipped = 0;
    const errors: string[] = [];
    for (const t of failed || []) {
      const key = `${t.task_type}|${JSON.stringify(t.payload || {})}`;
      if (!RETRYABLE_TASK_TYPES.has(t.task_type) || activeKeys.has(key)) { skipped++; continue; }
      const { error: insErr } = await supabase.from('edge_tasks').insert({ task_type: t.task_type, payload: t.payload || {}, status: 'pending' });
      if (insErr) { errors.push(`${t.task_type}: ${insErr.message}`); continue; }
      activeKeys.add(key);
      retried++;
    }

    // GitHub Actions の定期実行は間隔が延びることがあるため、トークンがあれば即時起動する（無ければ次の定期実行で処理される）
    const ghToken = process.env.GH_ACTIONS_TOKEN;
    let dispatched = false;
    if (ghToken && retried > 0) {
      const res = await fetch('https://api.github.com/repos/Kazu999-3/my_work/actions/workflows/edge-cloud-worker.yml/dispatches', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'master' }),
      }).catch(() => null);
      dispatched = !!res?.ok;
    }

    return NextResponse.json({ success: errors.length === 0, retried, skipped, dispatched, errors });
  } catch (e: any) {
    console.error('[admin/tasks/retry-all] Error:', e);
    return NextResponse.json({ error: e.message || '再実行に失敗しました' }, { status: 500 });
  }
}
