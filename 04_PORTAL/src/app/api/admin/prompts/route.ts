import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// agent_prompts は anon/authenticated からの直接アクセスを閉じたため
// (04_PORTAL/supabase/migrations/39_lock_down_agent_prompts_rls.sql)、
// /admin/prompts の一覧取得・保存は service role 経由のこのAPIから行う。
// 認証はproxy.tsの/api/admin/* Cookieゲートで既にカバーされているが(致命的な穴では
// ない)、他の53ファイルと同じ明示的なverifyAdminSessionも追加し、将来proxy.tsの
// ゲート範囲が変わっても単体で安全であるようにする(2026-08-05発覚)。
export async function GET(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('agent_prompts')
    .select('*')
    .order('prompt_id', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ prompts: data || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await req.json();
  const { prompt_id, ...updates } = body;
  if (!prompt_id) {
    return NextResponse.json({ error: 'prompt_id は必須です。' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('agent_prompts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('prompt_id', prompt_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
