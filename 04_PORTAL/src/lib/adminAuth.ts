/**
 * 管理者API認証ヘルパー（互換エイリアス）
 *
 * 旧: Supabase Discord OAuth + NEXT_PUBLIC_ADMIN_DISCORD_IDS allowlist を検証していたが、
 * Discordセッション依存を排除しパスワード認証（adminSession.ts）に統一した。
 * 20以上ある /api/admin/** ルートの import 文（'../../../../lib/adminAuth'）を
 * 変更せずに済むよう、実体は adminSession.ts に委譲するだけのエイリアスとして残す。
 */
export { verifyAdminSession } from './adminSession';
