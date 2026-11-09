import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "../../../../lib/adminAuth";
import {
  SundayFestivalTheme,
  DEFAULT_SUNDAY_THEMES,
  getSundayFestivalTheme,
  saveSundayFestivalTheme
} from "../../../../lib/sundayFestivalTheme";

// GET: 現在の今週のお題を取得（誰でも閲覧可能）
export async function GET() {
  try {
    const currentTheme = await getSundayFestivalTheme();
    return NextResponse.json({
      ok: true,
      theme: currentTheme,
      presets: DEFAULT_SUNDAY_THEMES,
    });
  } catch (error: any) {
    console.error("[festival/theme GET] error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: 今週のお題を更新（管理者のみ）
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json(
        { ok: false, error: "管理者権限が必要です。" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, title, description } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { ok: false, error: "お題のタイトルは必須です。" },
        { status: 400 }
      );
    }

    const updatedTheme: SundayFestivalTheme = {
      id: id || `custom_${Date.now()}`,
      title: title.trim(),
      description: (description && typeof description === 'string') ? description.trim() : "",
      updated_at: new Date().toISOString(),
      updated_by: "admin",
    };

    const saved = await saveSundayFestivalTheme(updatedTheme);
    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "お題の保存に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      theme: updatedTheme,
    });
  } catch (error: any) {
    console.error("[festival/theme POST] error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
