// ============================================================
// 共通fetchラッパー (課題#39 フロント共通レイヤー)
//
// ・credentials:'include' を自動付与（管理者Cookieセッション）
// ・タイムアウト（既定20秒。AbortControllerで中断）
// ・401（認証切れ）を検知したら /login?next=現在URL へ自動リダイレクト
//   → これまで各ページで「401でエラー表示のまま固まる」体験だったのを解消する
//
// 既存の生fetchを段階的にこれへ置き換えていく。非破壊（新規追加）。
// ============================================================

export interface ApiFetchInit extends RequestInit {
  timeout?: number;
  /** 401時に自動リダイレクトしたくない場合はfalse */
  redirectOn401?: boolean;
}

export async function apiFetch(input: string, init: ApiFetchInit = {}): Promise<Response> {
  const { timeout = 20000, redirectOn401 = true, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(input, {
      credentials: 'include',
      signal: controller.signal,
      ...rest,
    });
    if (res.status === 401 && redirectOn401 && typeof window !== 'undefined') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
      throw new Error('認証セッションが切れました。ログインページへ移動します。');
    }
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** JSONを返すAPI向け。!ok なら error文言でthrowする。 */
export async function apiJson<T = any>(input: string, init: ApiFetchInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `APIエラー (${res.status})`);
  }
  return data as T;
}
