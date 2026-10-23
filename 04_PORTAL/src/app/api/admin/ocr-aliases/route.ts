import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * OCR誤読エイリアス辞書のクラウド同期API
 * GET: 現在の辞書を取得
 * POST: 辞書をマージ更新
 */
export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  try {
    const { data } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', 'ocr_player_aliases')
      .maybeSingle();

    const aliases = (data?.value && typeof data.value === 'object' && !Array.isArray(data.value))
      ? data.value
      : {};

    return NextResponse.json({ ok: true, aliases });
  } catch (err: any) {
    console.error('[ocr-aliases/GET] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const newAliases: Record<string, string> = body?.aliases || {};
    if (body?.raw && body?.target) {
      const clean = String(body.raw).toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
      if (clean) newAliases[clean] = String(body.target);
    }

    if (Object.keys(newAliases).length === 0) {
      return NextResponse.json({ ok: true, message: '更新対象なし' });
    }

    const { data: existing } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', 'ocr_player_aliases')
      .maybeSingle();

    const prev = (existing?.value && typeof existing.value === 'object' && !Array.isArray(existing.value))
      ? existing.value
      : {};

    const merged = { ...prev, ...newAliases };

    await supabase
      .from('ktm_settings')
      .upsert({ key: 'ocr_player_aliases', value: merged }, { onConflict: 'key' });

    return NextResponse.json({ ok: true, aliases: merged });
  } catch (err: any) {
    console.error('[ocr-aliases/POST] error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
