import { NextResponse } from 'next/server';
import { cleanupDepartedMemberChannels } from '../../../../lib/onboardingProcessor';
import { verifyBotSecret } from '../../../../lib/botAuth';

/**
 * POST: サーバーを抜けたメンバーの個別案内チャンネルを削除する（クラウドワーカーが定期的に呼ぶ）。
 * body に { "dryRun": true } を渡すと、削除せず対象の一覧だけ返す。
 */
export async function POST(req: Request) {
  // チャンネルを消す経路なので、verifyBotSecret の「未設定なら通す」は使わずシークレットを必須にする
  if (!(process.env.PORTAL_BOT_SECRET || '').trim()) {
    return NextResponse.json({ error: 'PORTAL_BOT_SECRET is not set' }, { status: 503 });
  }
  const authResult = verifyBotSecret(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch {
    // bodyなしは実行
  }

  try {
    const result = await cleanupDepartedMemberChannels({ dryRun });
    return NextResponse.json({ status: 'SUCCESS', dryRun, ...result });
  } catch (err: any) {
    console.error('[cleanup-channels POST error]:', err);
    return NextResponse.json({ status: 'ERROR', message: err.message }, { status: 500 });
  }
}
