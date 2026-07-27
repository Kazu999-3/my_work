import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../../lib/adminAuth';
import { recordMatchupSentinelRevision } from '../../../../../../lib/matchupSentinelRevisions';

// クライアント側（ブラウザ）から直接 Supabase に matchup_sentinel を upsert している画面
// （LibraryTabContent.tsx / MatchupTab.tsx）向けの履歴記録専用エンドポイント。
// recordMatchupSentinelRevision は service role キーを使うため、サーバー側でしか呼べない。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { matchupId, before, after, sourceTitle, sourceId } = await req.json();
    if (!matchupId || !after) {
      return NextResponse.json({ error: 'matchupId, after が必要です。' }, { status: 400 });
    }

    await recordMatchupSentinelRevision(matchupId, before ?? null, after, sourceTitle, sourceId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[revisions/record-matchup] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
