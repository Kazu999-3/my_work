import { NextResponse } from 'next/server';
import { syncMentorshipDashboard, ensureMentorshipChannel } from '../../../../lib/discordMentorship';
import { getAuthSession } from '../../../../lib/authGuard';
import { verifyBotSecret } from '../../../../lib/botAuth';

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    const hasBotSecret = request.headers.has('x-bot-secret') && verifyBotSecret(request).ok;

    if (!session && !hasBotSecret) {
      return NextResponse.json(
        { ok: false, error: 'ログインまたはBot認証が必要です。' },
        { status: 401 }
      );
    }

    // 管理者・ログインユーザーまたはBotが手動更新をトリガー可能
    const channelId = await ensureMentorshipChannel();
    const success = await syncMentorshipDashboard();

    return NextResponse.json({
      ok: success,
      channelId,
      message: success ? 'Discordダッシュボードの同期が完了しました。' : '同期に失敗しました。',
    });
  } catch (err: any) {
    console.error('[mentorship/sync-discord] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
