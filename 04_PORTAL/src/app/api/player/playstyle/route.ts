import { NextResponse } from 'next/server';
import { getAuthSession } from '../../../../lib/authGuard';
import { discordFetch } from '../../../../lib/discordFetch';
import { getRoleSyncConfig, PlaystyleRoleKey } from '../../../../lib/discordRoleSync';

export const dynamic = 'force-dynamic';

const GUILD_ID = process.env.DISCORD_GUILD_ID || '1485636149379858567';

const FALLBACK_PLAYSTYLE_ROLES: Record<PlaystyleRoleKey, string> = {
  soloq: '1556976001509101631',
  flex: '1556976003241345025',
  aram: '1557006449329311906',
  casual: '1557006450847518730',
  learner: '1556976007234330634',
};

async function getPlaystyleRoleMap(): Promise<Record<PlaystyleRoleKey, string>> {
  const config = await getRoleSyncConfig();
  return {
    soloq: config.playstyle_roles?.soloq || FALLBACK_PLAYSTYLE_ROLES.soloq,
    flex: config.playstyle_roles?.flex || FALLBACK_PLAYSTYLE_ROLES.flex,
    aram: config.playstyle_roles?.aram || FALLBACK_PLAYSTYLE_ROLES.aram,
    casual: config.playstyle_roles?.casual || FALLBACK_PLAYSTYLE_ROLES.casual,
    learner: config.playstyle_roles?.learner || FALLBACK_PLAYSTYLE_ROLES.learner,
  };
}

/**
 * GET: ログイン中のユーザーのプレイスタイルロール所持状況を取得
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: 'ログインが必要です。' }, { status: 401 });
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'DISCORD_BOT_TOKENが未設定です。' }, { status: 500 });
    }

    const memberRes = await discordFetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.discordId}`,
      { headers: { Authorization: `Bot ${token}` } }
    );

    // サーバーにいない（退出済み・未参加）のは異常ではないので 404 にしない。
    // 以前は 404 を返し、画面の API エラー通知（ApiErrorWatcher）に毎回エラーとして届いていた（2026-10-18）
    if (memberRes.status === 404) {
      return NextResponse.json({
        ok: true,
        notInServer: true,
        playstyles: { soloq: false, flex: false, aram: false, casual: false, learner: false },
      });
    }
    if (!memberRes.ok) {
      return NextResponse.json({ ok: false, error: 'Discordサーバーのメンバー情報の取得に失敗しました。' }, { status: 502 });
    }

    const memberData: { roles: string[] } = await memberRes.json();
    const currentRoles = new Set(memberData.roles || []);
    const roleMap = await getPlaystyleRoleMap();

    const statuses: Record<PlaystyleRoleKey, boolean> = {
      soloq: currentRoles.has(roleMap.soloq),
      flex: currentRoles.has(roleMap.flex),
      aram: currentRoles.has(roleMap.aram),
      casual: currentRoles.has(roleMap.casual),
      learner: currentRoles.has(roleMap.learner),
    };

    return NextResponse.json({ ok: true, playstyles: statuses });
  } catch (err: any) {
    console.error('[playstyle GET] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: プレイスタイルロールをトグル（付与 / 剥奪）
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: 'ログインが必要です。' }, { status: 401 });
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'DISCORD_BOT_TOKENが未設定です。' }, { status: 500 });
    }

    const body = await req.json();
    const roleKey = body.roleKey as PlaystyleRoleKey;
    if (!roleKey || !['soloq', 'flex', 'aram', 'casual', 'learner'].includes(roleKey)) {
      return NextResponse.json({ ok: false, error: '不正なロールキーです。' }, { status: 400 });
    }

    const roleMap = await getPlaystyleRoleMap();
    const targetRoleId = roleMap[roleKey];
    if (!targetRoleId) {
      return NextResponse.json({ ok: false, error: '対象ロールIDが見つかりません。' }, { status: 500 });
    }

    // 現在のメンバー状態を確認
    const memberRes = await discordFetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.discordId}`,
      { headers: { Authorization: `Bot ${token}` } }
    );

    if (!memberRes.ok) {
      return NextResponse.json({ ok: false, error: 'Discordサーバーのメンバー情報の取得に失敗しました。' }, { status: 404 });
    }

    const memberData: { roles: string[] } = await memberRes.json();
    const currentRoles = new Set(memberData.roles || []);
    const isCurrentlyActive = currentRoles.has(targetRoleId);

    let newStatus = false;
    if (isCurrentlyActive) {
      // 剥奪
      const removeRes = await discordFetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.discordId}/roles/${targetRoleId}`,
        { method: 'DELETE', headers: { Authorization: `Bot ${token}` } }
      );
      if (!removeRes.ok && removeRes.status !== 204) {
        throw new Error(`ロール解除失敗: ${removeRes.status}`);
      }
      newStatus = false;
    } else {
      // 付与
      const addRes = await discordFetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${session.discordId}/roles/${targetRoleId}`,
        { method: 'PUT', headers: { Authorization: `Bot ${token}` } }
      );
      if (!addRes.ok && addRes.status !== 204) {
        throw new Error(`ロール付与失敗: ${addRes.status}`);
      }
      newStatus = true;
    }

    return NextResponse.json({
      ok: true,
      roleKey,
      active: newStatus,
      message: newStatus ? 'ロールを付与しました。' : 'ロールを解除しました。',
    });
  } catch (err: any) {
    console.error('[playstyle POST] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
