import { supabase } from '@/lib/supabaseClient';

// 合言葉の総当たり対策（2026-10-19）。04 の管理者ログインと同じく、同じ IP からの失敗は15分に10回まで。
// 失敗は edge_tasks に login_failure（payload.app = '05'）として残す。
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function clientIp(headers: Headers): string {
  const xffChain = (headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return headers.get('x-real-ip') || xffChain[xffChain.length - 1] || 'unknown';
}

/** 失敗が上限に達していれば true */
export async function isLoginBlocked(ip: string): Promise<boolean> {
  if (!supabase) return false;
  const { count } = await supabase
    .from('edge_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('task_type', 'login_failure')
    .contains('payload', { ip, app: '05' })
    .gt('created_at', new Date(Date.now() - WINDOW_MS).toISOString());
  return (count || 0) >= MAX_ATTEMPTS;
}

export async function recordLoginFailure(ip: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('edge_tasks').insert({ task_type: 'login_failure', status: 'completed', payload: { ip, app: '05' } });
}
