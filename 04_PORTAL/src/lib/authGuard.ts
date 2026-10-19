import { cookies } from 'next/headers';
import { supabaseAdmin as supabase } from './supabaseAdmin';
import { decodeUserSession, isAdminDiscordId, USER_SESSION_COOKIE } from './userSession';

export interface AuthSession {
  discordId: string;
  username: string;
  displayName: string;
  avatar?: string;
  coins?: number;
  rank?: string;
  isAdmin: boolean;
}

/**
 * リクエストのセッションCookieからログイン中ユーザーを取得・検証する
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const parsed = decodeUserSession(cookieStore.get(USER_SESSION_COOKIE)?.value);
    if (!parsed) return null;

    return {
      ...parsed,
      isAdmin: isAdminDiscordId(parsed.discordId),
    };
  } catch (err) {
    console.warn('[authGuard] Failed to parse session:', err);
    return null;
  }
}

/**
 * 管理者専用エンドポイント向けの検証。ログイン必須かつ isAdmin であることを要求する。
 */
export async function requireAdmin(): Promise<{ ok: boolean; session: AuthSession | null; error?: string }> {
  const session = await getAuthSession();
  if (!session) {
    return { ok: false, session: null, error: 'Discordログインが必要です。' };
  }
  if (!session.isAdmin) {
    return { ok: false, session, error: 'この操作は管理者のみ実行できます。' };
  }
  return { ok: true, session };
}

/**
 * 指定されたプレイヤー（名前またはDiscord ID）がログイン中の本人、または管理者であるか検証
 *
 * ⚠️ 2026-09-22 セキュリティ修正:
 * 以前の実装は「セッションが無ければリクエストボディの識別子で擬似セッションを作る」
 * 「どの条件にも一致しなくても最後に ok:true を返す」という2つの抜け道があり、
 * **一度も ok:false を返さない＝認証として機能していない**状態だった。
 * その結果 /api/bet・/api/bet/tip・/api/bet/shop・/api/bet/handicap は
 * 他人のdiscordIdを指定するだけで他人のコインを操作できた。
 * 呼び出し側は必ず戻り値の session を正本として使い、ボディの識別子を信用しないこと。
 */
export async function verifyUserOrAdmin(
  targetIdentifier: string | { discordId?: string | null; playerName?: string | null }
): Promise<{ ok: boolean; session: AuthSession | null; error?: string }> {
  const session = await getAuthSession();

  const reqDiscordId = typeof targetIdentifier === 'object' ? targetIdentifier.discordId : targetIdentifier;
  const reqPlayerName = typeof targetIdentifier === 'object' ? targetIdentifier.playerName : targetIdentifier;

  // ログイン必須（擬似セッションの発行は廃止）
  if (!session) {
    return { ok: false, session: null, error: 'Discordログインが必要です。' };
  }

  // 管理者なら無条件で許可
  if (session.isAdmin) {
    return { ok: true, session };
  }

  // 2026-10-19: 照合は「ログイン中の本人」との完全一致だけにする。以前は
  //   - 名前を部分一致（どちらかがもう一方を含む）で照合しており、Discord の表示名を短い文字（例: "1"）にすると
  //     他人の Discord ID や名前に「含まれる」ため通り、誰のコインでも操作できた
  //   - Discord ID と名前の両方が来た時、どちらか一方が合えば通しており、「他人の Discord ID ＋ 自分の名前」で通った
  const lower = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const isObject = typeof targetIdentifier === 'object';

  // Discord ID が指定されたら、本人の ID と完全一致すること
  if (isObject && reqDiscordId && reqDiscordId !== session.discordId) {
    return { ok: false, session, error: '他のプレイヤーになりすました操作は実行できません。' };
  }
  if (isObject && reqDiscordId === session.discordId) {
    return { ok: true, session };
  }

  // 文字列1つ（Discord ID か名前のどちらか）または名前だけの指定
  const target = lower(isObject ? reqPlayerName : targetIdentifier);
  if (!target) {
    return { ok: false, session, error: '他のプレイヤーになりすました操作は実行できません。' };
  }
  if (target === lower(session.discordId)) {
    return { ok: true, session };
  }

  // 名前は「本人の Discord ID に紐づいた名簿の名前・IGN」と完全一致すること
  if (supabase && session.discordId) {
    const { data: player } = await supabase
      .from('ktm_players')
      .select('name, ign')
      .eq('discord_id', session.discordId)
      .limit(1)
      .maybeSingle();
    if (player) {
      if ([player.name, player.ign].filter(Boolean).some((n) => lower(n) === target)) {
        return { ok: true, session };
      }
    } else if ([session.displayName, session.username].filter(Boolean).some((n) => lower(n) === target)) {
      // まだ名簿に居ない人（カジノを初めて使う時に自動で登録される）は、Discord の名前と完全一致すること。
      // 同じ名前の他人が居ても、findOrCreatePlayer が別の Discord ID の人を返さない
      return { ok: true, session };
    }
  }

  // どの照合にも一致しなかった＝他人の識別子を指定している。拒否する。
  return {
    ok: false,
    session,
    error: '他のプレイヤーになりすました操作は実行できません。',
  };
}
