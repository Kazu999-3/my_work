// Discordメンバーの表示名を決めるルール。
//
// 以前、管理ダッシュボードは nick 優先・チーム分けAPIは global_name 優先という
// 食い違いがあり、「同じ人なのに画面によって名前が違う」不具合が起きた。
// 判定を1箇所に集約して、二度と枝分かれしないようにする。
//
// 優先順位: サーバーごとのニックネーム → グローバル表示名 → ユーザー名

export interface DiscordMemberLike {
  nick?: string | null;
  user?: {
    global_name?: string | null;
    username?: string | null;
  } | null;
}

/** ギルドメンバー(GET /guilds/{id}/members のレスポンス)から表示名を得る */
export function resolveDisplayName(
  member: DiscordMemberLike | null | undefined,
  fallback = 'Unknown',
): string {
  if (!member) return fallback;
  const nick = member.nick?.trim();
  if (nick) return nick;
  const globalName = member.user?.global_name?.trim();
  if (globalName) return globalName;
  const username = member.user?.username?.trim();
  if (username) return username;
  return fallback;
}
