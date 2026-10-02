import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// /shorts/・/live/ も含む。旧ポータルでは /shorts/ が漏れていてShorts動画が登録できなかった(2026-08-05)
function extractVideoId(url: string): string | null {
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/i);
  return m && m[2].length === 11 ? m[2] : null;
}

// キューを処理するワーカー(youtube_worker.py / youtube_absorber.py)はYouTube専用。
// Xの投稿を積んでも誰も処理せず pending のまま残り続けるため、受け付けずに案内する。
function isXUrl(url: string): boolean {
  return /(?:^|\/\/|\.)(x\.com|twitter\.com)\//i.test(url);
}

// 1. キュー一覧取得
export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    const { data, error } = await supabase
      .from('youtube_queue')
      .select('*')
      .order('date_added', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ success: true, items: data || [] });
  } catch (e: any) {
    console.error('Queue取得エラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

// 2. キュー追加 (YouTube / X 両対応)
export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();
    const { url, title, priority = 'medium' } = body;

    if (!url) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 });
    }

    if (isXUrl(url)) {
      return NextResponse.json({
        error: 'Xの投稿は動画解析キューでは処理できません。ライブラリの「ナレッジ取り込み」からURLとして取り込んでください。',
      }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: '有効なYouTubeのURLではありません' }, { status: 400 });
    }

    // 既に存在するか確認（manually_closed も「対応不可と判断済み」の記録なので再登録しない）
    const { data: existing } = await supabase
      .from('youtube_queue')
      .select('id, status, title')
      .eq('id', videoId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: `既にキューに登録されています (ステータス: ${existing.status})`,
        item: existing
      });
    }

    // タイトル・チャンネル名は oEmbed で取得する（APIキー不要）。
    // 取れなければ共有元から渡されたタイトルを使う。
    let resolvedTitle = String(title || '').trim() || `YouTube Video (${videoId})`;
    let channelName = 'Unknown';
    try {
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
        { cache: 'no-store' },
      );
      if (oembed.ok) {
        const o = await oembed.json();
        if (o.title) resolvedTitle = o.title;
        if (o.author_name) channelName = o.author_name;
      }
    } catch (err) {
      console.warn('[youtube/queue] oEmbed取得に失敗:', err);
    }

    // date_added は bigint(UNIX秒)。ISO文字列を入れると insert 自体が型エラーで失敗する
    // (2026-10-02、05_PILOTからの追加が1件も成功していなかった原因)
    const { data: inserted, error: insertErr } = await supabase
      .from('youtube_queue')
      .insert({
        id: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: resolvedTitle,
        channel_name: channelName,
        status: 'pending',
        priority,
        retry_count: 0,
        date_added: Math.floor(Date.now() / 1000),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, message: `「${resolvedTitle}」を解析キューに追加しました。`, item: inserted });
  } catch (e: any) {
    console.error('YouTube Queue追加エラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

// 3. キューからクローズ
// 行を物理削除すると重複チェック(id一致)が効かなくなり、チャンネル/プレイリスト監視が
// 同じ動画を再検出した時にまた pending で積まれてしまう。旧ポータルと同じく
// status を manually_closed にして「対応不可と判断済み」の記録を残す。
export async function DELETE(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'idが必要です' }, { status: 400 });
    }

    const { error } = await supabase
      .from('youtube_queue')
      .update({ status: 'manually_closed' })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'キューからクローズしました。' });
  } catch (e: any) {
    console.error('YouTube Queueクローズエラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

// 4. キューステータス更新 (再試行/ステータス変更)
export async function PATCH(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();
    const { id, status, resetRetries } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id と status が必要です' }, { status: 400 });
    }

    const updates: any = { status };
    if (resetRetries) updates.retry_count = 0;

    const { data, error } = await supabase
      .from('youtube_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (e: any) {
    console.error('YouTube Queue更新エラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}
