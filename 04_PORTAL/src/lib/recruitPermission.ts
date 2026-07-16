/**
 * 募集(recruitments)の編集・削除権限チェック共通ロジック（Portal側）。
 * ktm_bot/src/utils/recruitPermission.js と同じ判定基準（募集主 or 管理者）を使うこと。
 */
export interface Recruitment {
  id: string;
  discord_message_id: string | null;
  owner_discord_id: string;
  status: string;
}

export function getAdminDiscordIds(): string[] {
  const idsStr = process.env.NEXT_PUBLIC_ADMIN_DISCORD_IDS || '';
  return idsStr.split(',').map((id) => id.trim()).filter(Boolean);
}

export function canEditRecruitment(
  currentUserDiscordId: string | null | undefined,
  recruitment: Pick<Recruitment, 'owner_discord_id'>,
  adminIds: string[] = getAdminDiscordIds()
): boolean {
  if (!currentUserDiscordId) return false;
  return (
    currentUserDiscordId === recruitment.owner_discord_id ||
    adminIds.includes(currentUserDiscordId)
  );
}
