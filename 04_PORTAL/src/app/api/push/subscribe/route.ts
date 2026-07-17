import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// ブラウザのプッシュ購読を保存/削除する (課題#52)。誰でも自分のブラウザを購読できる。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { subscription, userAgent } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: '購読情報が不正です。' }, { status: 400 });
    }
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent || null,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[push/subscribe] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { endpoint } = await req.json();
    if (endpoint) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
