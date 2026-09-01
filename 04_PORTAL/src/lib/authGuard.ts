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
    if (!parsed || !parsed.discordId) return null;

    const adminIds = (process.env.ADMIN_DISCORD_IDS || OWNER_DISCORD_ID)
      .split(',')
      .map((s) => s.trim());

    const isAdmin = adminIds.includes(parsed.discordId) || parsed.discordId === OWNER_DISCORD_ID;

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
 * 指定されたプレイヤー（名前またはDiscord ID）がログイン中の本人、または管理者であるか検証
 */
export async function verifyUserOrAdmin(
  targetIdentifier: string
): Promise<{ ok: boolean; session: AuthSession | null; error?: string }> {
  const session = await getAuthSession();

  if (!session) {
    return { ok: false, session: null, error: 'Discordログインが必要です。' };
  }

  // 管理者なら無条件で許可
  if (session.isAdmin) {
    return { ok: true, session };
  }

  // 本人のDiscord IDと一致するか
  if (session.discordId === targetIdentifier) {
    return { ok: true, session };
  }

  // 本人の表示名（サモナー名/名簿名）と一致するか
  const trimmedTarget = targetIdentifier.trim().toLowerCase();
  const trimmedDisplayName = (session.displayName || '').trim().toLowerCase();
  const trimmedUsername = (session.username || '').trim().toLowerCase();

  if (trimmedTarget === trimmedDisplayName || trimmedTarget === trimmedUsername) {
    return { ok: true, session };
  }

  // DBのktm_playersからdiscord_idとnameを念のため照合
  const { data: player } = await supabase
    .from('ktm_players')
    .select('discord_id, name, ign')
    .eq('discord_id', session.discordId)
    .limit(1)
    .single();

  if (player) {
    if (
      player.name?.toLowerCase() === trimmedTarget ||
      player.ign?.toLowerCase() === trimmedTarget ||
      player.discord_id === targetIdentifier
    ) {
      return { ok: true, session };
    }
  }

  return {
    ok: false,
    session,
    error: `権限エラー: 他者（${targetIdentifier}）のデータを書き換えることはできません。`,
  };
}
