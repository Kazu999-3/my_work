import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { resolveChampionListString, getNoChampionMarker } from '../../../../../lib/dictFactCheck';

// personal_knowledge の汎用更新（保存/アーカイブ/復元 共通）。
// ブラウザ(anon)から直接updateしていた箇所をservice role経由に統一するためのルート。
// 更新可能フィールドをallowlistし、想定外のカラムが書き換わらないようにする。
export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = ['title', 'champion', 'tags', 'content', 'raw_content', 'created_at'] as const;

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { id, updateData } = await req.json();
    if (id === undefined || id === null || id === '' || !updateData || typeof updateData !== 'object') {
      return NextResponse.json({ error: 'id と updateData が必要です' }, { status: 400 });
    }

    const payload: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updateData) payload[key] = updateData[key];
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: '更新可能なフィールドがありません' }, { status: 400 });
    }

    // champion列は正規化なしの自由文字列を直接書き込めてしまっていた
    // （LibraryTabContent.tsxの保存フローでは通常/merge-articleが先に呼ばれ正規化されるが、
    // 「有効なチャンピオンが無かった」場合や他の呼び出し元では、未正規化の生値がこの
    // 汎用更新ルートまで落ちてくることがあった）。このルート自身でも実在チャンピオンへ
    // 正規化し、解決できないものは黙って除外する（全滅した場合は「対象外」慣習値にする）。
    if ('champion' in payload) {
      const raw = payload.champion;
      if (raw === null || raw === undefined || raw === '') {
        payload.champion = null;
      } else if (String(raw).trim().toLowerCase() === getNoChampionMarker('personal_knowledge').toLowerCase()) {
        payload.champion = getNoChampionMarker('personal_knowledge');
      } else {
        const resolved = await resolveChampionListString(String(raw));
        payload.champion = resolved.length > 0 ? resolved.join(', ') : getNoChampionMarker('personal_knowledge');
      }
    }

    const { error } = await supabase.from('personal_knowledge').update(payload).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
