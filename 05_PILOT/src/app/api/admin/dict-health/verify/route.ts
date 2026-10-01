import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabaseClient';
import { getCalendarPatch } from '../../../../../lib/ddragonClient';

export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 });
  }

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
          if (!taskErr || taskErr.code === '23505') enqueued++;
        }
      }
      return NextResponse.json({ success: true, message: `${enqueued} 体のチャンピオンを更新キューに追加しました` });
    }

    if (!champion) {
      return NextResponse.json({ error: 'champion パラメータが必要です' }, { status: 400 });
    }

    // B. 人間確認済みに変更: verify
    if (action === 'verify') {
      const currentPatch = await getCalendarPatch();

      const { error } = await supabase
        .from('champion_facts')
        .update({
          confidence: 'verified',
          patch: currentPatch,
          last_verified_at: new Date().toISOString(),
          last_verified_by: 'admin',
          updated_at: new Date().toISOString(),
        })
        .ilike('champion', champion);

      if (error) throw error;
      return NextResponse.json({ success: true, message: `${champion} を確認済みに設定しました` });
    }

    // C. AI生成・未確認に戻す: unverify
    if (action === 'unverify') {
      const { error } = await supabase
        .from('champion_facts')
        .update({
          confidence: 'ai_generated',
          last_verified_at: null,
          last_verified_by: null,
          updated_at: new Date().toISOString(),
        })
        .ilike('champion', champion);

      if (error) throw error;
      return NextResponse.json({ success: true, message: `${champion} を未確認（AI生成）に戻しました` });
    }

    // D. 単体AI更新キュー投入: enqueue_update
    if (action === 'enqueue_update') {
      const { data: existingTask } = await supabase
        .from('edge_tasks')
        .select('id')
        .eq('task_type', 'champion_trend')
        .eq('status', 'pending')
        .filter('payload->champion', 'eq', champion)
        .maybeSingle();

      if (existingTask) {
        return NextResponse.json({ success: true, message: `${champion} は既に更新待機中です` });
      }

      const { error: taskErr } = await supabase.from('edge_tasks').insert({
        task_type: 'champion_trend',
        payload: { champion, role: 'GLOBAL' },
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (taskErr && taskErr.code !== '23505') throw taskErr;
      return NextResponse.json({ success: true, message: `${champion} のAI再リサーチキューを起票しました` });
    }

    return NextResponse.json({ error: `未知のアクション: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[dict-health/verify] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
