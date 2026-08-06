import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { action, champion, champions } = body;

    // A. 一括タスク起票: bulk_enqueue_stale
    if (action === 'bulk_enqueue_stale' && Array.isArray(champions) && champions.length > 0) {
      let enqueued = 0;
      for (const champ of champions) {
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
            payload: { champion: champ, role: 'GLOBAL' },
            status: 'pending',
            created_at: new Date().toISOString(),
          });
          if (!taskErr) enqueued++;
        }
      }
      return NextResponse.json({ success: true, message: `${enqueued} 体のチャンピオンを更新キューに追加しました` });
    }

    if (!champion) {
      return NextResponse.json({ error: 'champion パラメータが必要です' }, { status: 400 });
    }

    // B. 人間確認済みに変更: verify
    if (action === 'verify') {
      const { error } = await supabase
        .from('champion_facts')
        .update({
          confidence: 'verified',
          last_verified_at: new Date().toISOString(),
          last_verified_by: 'admin',
          updated_at: new Date().toISOString(),
        })
        .ilike('champion', champion);

      if (error) throw error;
      return NextResponse.json({ success: true, message: `${champion} を確認済みに設定しました` });
    }

    // C. AI生成に戻す: unverify
    if (action === 'unverify') {
      const { error } = await supabase
        .from('champion_facts')
        .update({
          confidence: 'ai_generated',
          updated_at: new Date().toISOString(),
        })
        .ilike('champion', champion);

      if (error) throw error;
      return NextResponse.json({ success: true, message: `${champion} をAI生成ステータスに戻しました` });
    }

    // D. 個別更新タスク起票: enqueue_update
    if (action === 'enqueue_update') {
      const { data: existingTask } = await supabase
        .from('edge_tasks')
        .select('id')
        .eq('task_type', 'champion_trend')
        .eq('status', 'pending')
        .filter('payload->champion', 'eq', champion)
        .maybeSingle();

      if (existingTask) {
        return NextResponse.json({ success: true, message: `${champion} は既に更新キューに存在します` });
      }

      const { error: taskErr } = await supabase.from('edge_tasks').insert({
        task_type: 'champion_trend',
        payload: { champion, role: 'GLOBAL' },
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (taskErr) throw taskErr;
      return NextResponse.json({ success: true, message: `${champion} の更新タスクをキューに追加しました` });
    }

    return NextResponse.json({ error: '無効な action です' }, { status: 400 });
  } catch (err: any) {
    console.error('[dict-health/verify] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
