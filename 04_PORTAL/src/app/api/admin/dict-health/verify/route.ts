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
          // 23505 = 一意制約違反。事前のSELECTと実際のINSERTの間に別経路(手動ボタン/
          // auto-refreshなど)が同じチャンピオンを投入していた場合の正常なレース結果なので、
          // 「既に投入済み」として扱いエラーにしない(2026-08-13の監査#9で発覚したTOCTOU対策、
          // migration 64のユニークインデックスとセット)。
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
      // DDragonのメジャー番号はシーズン通し番号(14=2024,15=2025,16=2026...)のため、
      // 辞典側の表記(西暦下2桁基準の26.xx)に揃えるため+10する(2026-08-08発覚)。
      let currentPatch = '26.15';
      try {
        const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await vRes.json();
        const [rawMajor, rawMinor] = (versions[0] || '16.15.1').split('.');
        currentPatch = `${parseInt(rawMajor, 10) + 10}.${rawMinor}`;
      } catch {
        // fallback
      }

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
      return NextResponse.json({ success: true, message: `${champion} を確認済み（🟢 パッチ ${currentPatch}）に設定しました` });
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

      // 23505 = 一意制約違反。事前のSELECTとの間に別経路が投入済みだった場合の正常な
      // レース結果として扱う(2026-08-13の監査#9対策、migration 64とセット)。
      if (taskErr && taskErr.code !== '23505') throw taskErr;
      return NextResponse.json({ success: true, message: `${champion} の更新タスクをキューに追加しました` });
    }

    return NextResponse.json({ error: '無効な action です' }, { status: 400 });
  } catch (err: any) {
    console.error('[dict-health/verify] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
