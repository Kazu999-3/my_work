import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { verifyBotSecret } from '../../../../lib/botAuth';
import {
  getRoleSyncConfig,
  saveRoleSyncConfig,
  setupDiscordRoles,
  syncPlayersDiscordRoles,
  ROLE_DEFINITIONS,
  PLAYSTYLE_ROLE_DEFINITIONS,
  BEGINNER_LOUNGE_ROLE_DEFINITION,
} from '../../../../lib/discordRoleSync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/** 認証チェック（管理者セッションまたはBotシークレット） */
async function authenticate(req: Request) {
  const botAuth = verifyBotSecret(req);
  if (botAuth.ok) return { ok: true };

  const adminAuth = await verifyAdminSession(req);
  if (adminAuth.ok) return { ok: true };

  return { ok: false, error: botAuth.error || adminAuth.error || 'Unauthorized' };
}

/**
 * GET: 現在のDiscordロール設定・定義の取得
 */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const config = await getRoleSyncConfig();
  return NextResponse.json({
    config,
    definitions: ROLE_DEFINITIONS,
    playstyleDefinitions: PLAYSTYLE_ROLE_DEFINITIONS,
    beginnerLoungeDefinition: BEGINNER_LOUNGE_ROLE_DEFINITION,
  });
}

/**
 * POST: ロール自動セットアップ / 一括同期 / 設定保存
 */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // 1. ロール自動セットアップ（Discord上に5ロールを作成してID保存）
    if (action === 'setup') {
      const result = await setupDiscordRoles();
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: result.message,
        roles: result.roles,
        playstyle_roles: result.playstyle_roles,
        beginner_lounge_role: result.beginner_lounge_role,
      });
    }

    // 2. 全員一括同期
    if (action === 'sync_all') {
      const summary = await syncPlayersDiscordRoles();
      return NextResponse.json({ success: true, summary });
    }

    // 3. 特定プレイヤー同期
    if (action === 'sync_players') {
      const { playerIds, discordIds } = body;
      const summary = await syncPlayersDiscordRoles({ playerIds, discordIds });
      return NextResponse.json({ success: true, summary });
    }

    // 4. 設定の直接保存
    if (action === 'save_config') {
      const { config } = body;
      if (!config || !config.roles) {
        return NextResponse.json({ error: '不正な設定ペイロードです。' }, { status: 400 });
      }
      const ok = await saveRoleSyncConfig(config);
      if (!ok) {
        return NextResponse.json({ error: '設定の保存に失敗しました。' }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: '設定を保存しました。' });
    }

    return NextResponse.json({ error: `未知のアクション: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[api/discord/role-sync] エラー:', error);
    return NextResponse.json({ error: error.message || '処理中にエラーが発生しました。' }, { status: 500 });
  }
}
