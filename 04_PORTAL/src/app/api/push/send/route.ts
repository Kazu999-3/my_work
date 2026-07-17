import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// 全購読者へWeb Push通知を送る (課題#52)。管理者 or CRON_SECRET から呼び出す。
// 他のサーバー処理(募集開始通知など)からも sendPushToAll() を再利用できる。
export const dynamic = 'force-dynamic';

function configureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@ktm.local';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export async function sendPushToAll(payload: { title: string; body?: string; url?: string }): Promise<{ sent: number; removed: number }> {
  if (!configureVapid()) throw new Error('VAPID鍵(NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)が未設定です。');
  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  let sent = 0, removed = 0;
  const body = JSON.stringify(payload);
  await Promise.all((subs || []).map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      sent++;
    } catch (e: any) {
      // 410/404 は購読切れ → 削除
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        removed++;
      }
    }
  }));
  return { sent, removed };
}

export async function POST(req: Request) {
  // 管理者セッション or CRON_SECRET
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  try {
    const { title, body, url } = await req.json().catch(() => ({}));
    const result = await sendPushToAll({ title: title || 'KTM ポータル', body: body || '', url: url || '/' });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[push/send] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
