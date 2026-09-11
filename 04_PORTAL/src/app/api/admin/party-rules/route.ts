import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { 
  PartyChaosRule, 
  DEFAULT_PARTY_RULES, 
  getPartyRules, 
  savePartyRules 
} from "@/lib/partyRules";

// GET: ルール一覧取得（誰でも取得可能）
export async function GET() {
  try {
    const rules = await getPartyRules();
    return NextResponse.json({ ok: true, rules });
  } catch (error: any) {
    console.error("[party-rules GET] error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// POST: ルール追加（管理者のみ）
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
    const { title, desc, tag } = body;

    if (!title || !desc) {
      return NextResponse.json(
        { ok: false, error: "タイトルと説明は必須です。" },
        { status: 400 }
      );
    }

    const currentRules = await getPartyRules();
    
    // 一意なIDを生成
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRule: PartyChaosRule = {
      id,
      title: title.trim(),
      desc: desc.trim(),
      tag: (tag && tag.trim()) || "カスタム縛り",
      isCustom: true,
      created_at: new Date().toISOString(),
    };

    const updatedRules = [newRule, ...currentRules];
    const saved = await savePartyRules(updatedRules);

    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "ルールの保存に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, rule: newRule, rules: updatedRules });
  } catch (error: any) {
    console.error("[party-rules POST] error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// DELETE: ルール削除（管理者のみ）
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json(
        { ok: false, error: "管理者権限が必要です。" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get("id");

    if (!ruleId) {
      return NextResponse.json(
        { ok: false, error: "削除対象のルールIDが指定されていません。" },
        { status: 400 }
      );
    }

    const currentRules = await getPartyRules();
    const updatedRules = currentRules.filter((r) => r.id !== ruleId);

    if (updatedRules.length === currentRules.length) {
      return NextResponse.json(
        { ok: false, error: "指定されたルールが見つかりませんでした。" },
        { status: 404 }
      );
    }

    const saved = await savePartyRules(updatedRules);
    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "ルールの更新に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, rules: updatedRules });
  } catch (error: any) {
    console.error("[party-rules DELETE] error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// PUT: ルールをデフォルトにリセット（管理者のみ）
export async function PUT(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json(
        { ok: false, error: "管理者権限が必要です。" },
        { status: 403 }
      );
    }

    const saved = await savePartyRules(DEFAULT_PARTY_RULES);
    if (!saved) {
      return NextResponse.json(
        { ok: false, error: "リセットに失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, rules: DEFAULT_PARTY_RULES });
  } catch (error: any) {
    console.error("[party-rules PUT] error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
