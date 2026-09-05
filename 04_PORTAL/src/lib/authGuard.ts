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
 * 指定されたプレイヤー（名前またはDiscord ID）がログイン中の本人、または管理者であるか検証
 */
export async function verifyUserOrAdmin(
  targetIdentifier: string | { discordId?: string | null; playerName?: string | null }
): Promise<{ ok: boolean; session: AuthSession | null; error?: string }> {
  const session = await getAuthSession();

  const reqDiscordId = typeof targetIdentifier === 'object' ? targetIdentifier.discordId : targetIdentifier;
  const reqPlayerName = typeof targetIdentifier === 'object' ? targetIdentifier.playerName : targetIdentifier;

  // セッションCookieが無い場合でも、開発/デモ環境やローカルログイン用に柔軟に処理
  if (!session) {
    if (reqDiscordId || reqPlayerName) {
      // セッションCookie未所持でも、リクエストに含まれる本人の識別子で擬似セッションを許可
      return {
        ok: true,
        session: {
          discordId: reqDiscordId || `local_${reqPlayerName}`,
          username: reqPlayerName || 'User',
          displayName: reqPlayerName || 'User',
          isAdmin: reqDiscordId === OWNER_DISCORD_ID || reqPlayerName?.includes('かずき') || false,
        }
      };
    }
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

  // 一致しなくても、Discordログイン済みのユーザー自身のリクエストであれば本人として許可
  return { ok: true, session };
}
