import { NextResponse } from 'next/server';
import { processPendingIntros, parseIntroMessage, INTRO_CHANNEL_ID } from '../../../../lib/onboardingProcessor';
import { verifyBotSecret } from '../../../../lib/botAuth';
import { discordFetch } from '../../../../lib/discordFetch';

/**
 * GET: 自己紹介チャンネルの最新メッセージと解析結果のプレビュー (ドライラン)
 */
export async function GET(req: Request) {
  try {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'DISCORD_BOT_TOKEN is not set' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const res = await discordFetch(
      `https://discord.com/api/v10/channels/${INTRO_CHANNEL_ID}/messages?limit=${limit}`,
      { headers: { Authorization: `Bot ${token}` } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Discord API returned ${res.status}` }, { status: res.status });
    }

    const messages = await res.json();
    if (!Array.isArray(messages)) {
      return NextResponse.json({ messages: [] });
    }

    const preview = messages.map((m: any) => {
      const hasCheckReaction = Array.isArray(m.reactions) &&
        m.reactions.some((r: any) => r.emoji?.name === '✅');
      const parsed = parseIntroMessage(m.content);

      return {
        id: m.id,
        author: m.author?.username,
        authorId: m.author?.id,
        timestamp: m.timestamp,
        hasCheckReaction,
        parsed,
        willProcess: !m.author?.bot && !hasCheckReaction && !!parsed,
      };
    });

    return NextResponse.json({
      total: preview.length,
      pending: preview.filter((p: any) => p.willProcess).length,
      preview,
    });
  } catch (err: any) {
    console.error('[process-intro GET error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST: 自己紹介未処理メッセージを検知し、名簿登録・ロール付与・個別チャンネル開通を実行
 */
export async function POST(req: Request) {
  try {
    // 外部からの安全なキックのためBot共有シークレット確認（未設定時は通過）
    const authResult = verifyBotSecret(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    let options = {};
    try {
      const body = await req.json();
      options = body || {};
    } catch {
      // bodyなしの場合はデフォルトオプションで実行
    }

    const result = await processPendingIntros(options);
    return NextResponse.json({
      status: 'SUCCESS',
      ...result,
    });
  } catch (err: any) {
    console.error('[process-intro POST error]:', err);
    return NextResponse.json({ status: 'ERROR', message: err.message }, { status: 500 });
  }
}
