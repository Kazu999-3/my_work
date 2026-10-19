import { supabaseAdmin as supabase } from './supabaseAdmin';

/**
 * 無認証の公開APIから Discord へ投稿する処理の連投防止（edge_tasks に最後の実行時刻を残す方式）。
 * まだ待つ必要があれば残り秒数を返し、実行してよければ実行時刻を記録して null を返す。
 * 判定自体に失敗した時は、本来の機能を止めないよう null（実行してよい）を返す。
 * 同じ方式: /api/discord・/api/match/analyze-image（2026-10-19 共通化）
 */
export async function takePostCooldown(taskType: string, cooldownMs: number): Promise<number | null> {
  try {
    const { data: last } = await supabase
      .from('edge_tasks')
      .select('created_at')
      .eq('task_type', taskType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.created_at) {
      const elapsed = Date.now() - new Date(last.created_at).getTime();
      if (elapsed < cooldownMs) return Math.ceil((cooldownMs - elapsed) / 1000);
    }
    await supabase.from('edge_tasks').insert({ task_type: taskType, status: 'completed', payload: { at: new Date().toISOString() } });
    return null;
  } catch (e) {
    console.warn(`[postCooldown] ${taskType} の判定に失敗（実行は続行）:`, e);
    return null;
  }
}
