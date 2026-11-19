import { supabase } from '@/lib/supabaseClient';

// 合言葉の総当たり対策（SPEC 02 フェイルクローズ準拠）。
// 同じ IP からの失敗は15分に10回まで。
// 制限の基盤（DB）が利用できない場合は安全のためログイン自体を停止（fail-closed）する。
export const MAX_LOGIN_ATTEMPTS = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15分

/** テスト用: Supabaseクライアントのモック注入 */
let customSupabaseClient: any = null;

export function _setSupabaseForTest(client: any) {
  customSupabaseClient = client;
}

function getSupabase() {
  return customSupabaseClient !== null ? customSupabaseClient : supabase;
}

/**
 * クライアントの送信元IPアドレスを取得する。
 * Vercel環境ではプロキシチェーンの最前列（一番左）が本来の接続元クライアントIPとなる。
 * 末尾を取得すると攻撃者の指定したプロキシヘッダー等で偽装される脆弱性を防ぐ。
 */
export function clientIp(headers: Headers): string {
  // 1. x-forwarded-for の先頭を取得（Vercel推奨）
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const firstIp = xff.split(',')[0]?.trim();
    if (firstIp && firstIp !== 'unknown') return firstIp;
  }

  // 2. Vercel / Cloudflare 等の信頼できる個別ヘッダーフォールバック
  const vercelIp = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (vercelIp) return vercelIp;

  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const cfIp = headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  return 'unknown';
}

export interface RateLimitCheckResult {
  blocked: boolean;
  unavailable?: boolean;
  remainingAttempts?: number;
}

/**
 * ログイン試行がブロックされているか判定する。
 * ⚠️ 重要: DBアクセス不可またはエラー時は fail-closed（blocked: true, unavailable: true）を返す。
 */
export async function isLoginBlocked(ip: string): Promise<RateLimitCheckResult> {
  const sb = getSupabase();
  // 基盤が未初期化ならフェイルクローズ（503対象）
  if (!sb) {
    console.error('[loginRateLimit] ⚠️ Supabaseクライアントが未初期化のためログインをフェイルクローズ停止します');
    return { blocked: true, unavailable: true };
  }

  try {
    const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
    const { count, error } = await sb
      .from('edge_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('task_type', 'login_failure')
      .contains('payload', { ip, app: '05' })
      .gt('created_at', since);

    if (error) {
      console.error('[loginRateLimit] ⚠️ レート制限チェックのDBクエリエラー:', error);
      return { blocked: true, unavailable: true };
    }

    const failureCount = count || 0;
    const blocked = failureCount >= MAX_LOGIN_ATTEMPTS;
    const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - failureCount);

    return { blocked, remainingAttempts };
  } catch (err) {
    console.error('[loginRateLimit] ⚠️ レート制限チェック中の致命的例外:', err);
    return { blocked: true, unavailable: true };
  }
}

/**
 * ログイン失敗を記録する。
 * 記録基盤が利用できない場合もエラーを検知できるよう真偽値を返す。
 */
export async function recordLoginFailure(ip: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, error: 'DATABASE_CLIENT_UNAVAILABLE' };
  }

  try {
    const { error } = await sb.from('edge_tasks').insert({
      task_type: 'login_failure',
      status: 'completed',
      payload: { ip, app: '05', timestamp: Date.now() },
    });

    if (error) {
      console.error('[loginRateLimit] ログイン失敗記録の挿入エラー:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err: any) {
    console.error('[loginRateLimit] ログイン失敗記録中の例外:', err);
    return { ok: false, error: err?.message || 'UNKNOWN_ERROR' };
  }
}
