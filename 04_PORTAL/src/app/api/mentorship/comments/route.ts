import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ ok: false, error: 'profileId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mentorship_profile_comments')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true })
      .limit(30);

    if (error) {
      // テーブルが未作成等の場合は空配列で安全に応答
      return NextResponse.json({ ok: true, comments: [] });
    }

    return NextResponse.json({ ok: true, comments: data || [] });
  } catch (error: any) {
    console.error('[mentorship/comments GET] Error:', error);
    return NextResponse.json({ ok: true, comments: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: 'コメント投稿にはDiscordログインが必要です。' }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, comment } = body;

    if (!profileId || !comment || !comment.trim()) {
      return NextResponse.json({ ok: false, error: 'プロフィールIDとコメント内容は必須です。' }, { status: 400 });
    }

    const authorName = session.displayName || session.username || 'メンバー';

    const { data, error } = await supabase
      .from('mentorship_profile_comments')
      .insert({
        profile_id: profileId,
        author_discord_id: session.discordId,
        author_name: authorName,
        comment: comment.trim(),
      })
      .select()
      .single();

    if (error) {
      console.warn('[mentorship/comments POST] Insert error:', error);
      return NextResponse.json({ ok: false, error: 'コメントの保存に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comment: data, message: '💬 ワンポイントアドバイスを投稿しました！' });
  } catch (error: any) {
    console.error('[mentorship/comments POST] Error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Error' }, { status: 500 });
  }
}
