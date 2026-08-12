import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { critiqueChampionEntry } from '../../../../../lib/dictReview';

// Builder-Critic方式の辞典品質チェック(オンデマンド専用、自動一括更新には組み込まない)。
// DictionaryTab.tsxの「品質チェック」ボタンから、管理者が個別に呼び出す想定。
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { champion } = await req.json();
    if (!champion) {
      return NextResponse.json({ error: 'champion が必要です' }, { status: 400 });
    }

    const result = await critiqueChampionEntry(supabase, champion);
    if (!result) {
      return NextResponse.json({ error: '品質チェックを実行できませんでした（データ不足、または比較対象が見つかりません）。' }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('❌ [Quality Check API] POST Error:', err);
    return NextResponse.json({ error: err.message || '品質チェックに失敗しました。' }, { status: 500 });
  }
}
