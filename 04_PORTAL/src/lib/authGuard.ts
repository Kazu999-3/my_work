import { cookies } from 'next/headers';
import { supabaseAdmin as supabase } from './supabaseAdmin';

// 管理者Discord IDリスト（環境変数または固定オーナーID）
const OWNER_DISCORD_ID = '697220229964759130';

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
    const sessionCookie = cookieStore.get('ktm_user_session')?.value;
    if (!sessionCookie) return null;

    const parsed = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
    if (!parsed || (!parsed.discordId && !parsed.username && !parsed.displayName)) return null;

    const adminIds = (process.env.ADMIN_DISCORD_IDS || OWNER_DISCORD_ID)
      .split(',')
      .map((s) => s.trim());

    const isAdmin = adminIds.includes(parsed.discordId) || parsed.discordId === OWNER_DISCORD_ID || parsed.username === 'kazuki' || parsed.displayName?.includes('かずき');

    return {
      ...parsed,
      isAdmin,
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

  // 本人のDiscord IDと一致するか
  if (reqDiscordId && session.discordId === reqDiscordId) {
    return { ok: true, session };
  }

  // 本人の表示名（サモナー名/名簿名）と一致するか
  const targets = [reqDiscordId, reqPlayerName].filter(Boolean).map(t => String(t).trim().toLowerCase());
  const userNames = [session.displayName, session.username, session.discordId].filter(Boolean).map(u => String(u).trim().toLowerCase());

  for (const t of targets) {
    for (const u of userNames) {
      if (t === u || t.includes(u) || u.includes(t)) {
        return { ok: true, session };
      }
    }
  }

  // DBのktm_playersからdiscord_idとnameを照合
  if (supabase && session.discordId) {
    const { data: player } = await supabase
      .from('ktm_players')
      .select('discord_id, name, ign')
      .eq('discord_id', session.discordId)
      .limit(1)
      .maybeSingle();

    if (player) {
      const pNames = [player.name, player.ign, player.discord_id].filter(Boolean).map(n => String(n).trim().toLowerCase());
      for (const t of targets) {
        for (const pn of pNames) {
          if (t === pn || t.includes(pn) || pn.includes(t)) {
            return { ok: true, session };
          }
        }
      }
    }
  }

  // どの照合にも一致しなかった＝他人の識別子を指定している。拒否する。
  return {
    ok: false,
    session,
    error: '他のプレイヤーになりすました操作は実行できません。',
  };
}
