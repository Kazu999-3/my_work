import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "../../../../lib/adminAuth";
import { supabaseAdmin as supabase } from "../../../../lib/supabaseAdmin";

const SETTING_KEY = "onboarding_mentors";

// GET: 指定メンター名一覧の取得（認証不要で誰でも参照可能、バランサー等でも利用）
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("ktm_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (error) throw error;

    const mentors: string[] = Array.isArray(data?.value) ? data.value : [];
    return NextResponse.json({ ok: true, mentors });
  } catch (err: any) {
    console.error("[mentors GET] error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST: 指定メンター名一覧の更新（管理者専用）
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: "管理者権限が必要です。" }, { status: 403 });
    }

    const body = await req.json();
    const mentors = Array.isArray(body?.mentors)
      ? body.mentors.map((m: any) => String(m).trim()).filter(Boolean)
      : [];

    const { error } = await supabase
      .from("ktm_settings")
      .upsert(
        {
          key: SETTING_KEY,
          value: mentors,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true, mentors });
  } catch (err: any) {
    console.error("[mentors POST] error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
