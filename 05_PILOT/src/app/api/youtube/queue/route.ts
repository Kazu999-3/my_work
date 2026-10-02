import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

function extractMediaId(url: string): { type: 'youtube' | 'x'; id: string; normalizedUrl: string; defaultTitle: string; channelName: string } | null {
  // 1. YouTube判定 (通常URL, 短縮URL, shorts, live, embed等)
  const ytMatch = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/i);
  if (ytMatch && ytMatch[2].length === 11) {
    const vid = ytMatch[2];
    return {
      type: 'youtube',
      id: vid,
      normalizedUrl: `https://www.youtube.com/watch?v=${vid}`,
      defaultTitle: `YouTube Video (${vid})`,
      channelName: 'YouTube'
    };
  }

  // 2. X (旧Twitter) 判定 (x.com または twitter.com)
  const xMatch = url.match(/(?:x\.com|twitter\.com)\/(?:#!\/)?(\w+)\/status\/(\d+)/i);
  if (xMatch) {
    const username = xMatch[1];
    const tweetId = xMatch[2];
    return {
      type: 'x',
      id: `x_${tweetId}`,
      normalizedUrl: `https://x.com/${username}/status/${tweetId}`,
      defaultTitle: `X Post (@${username})`,
      channelName: `@${username}`
    };
  }

  return null;
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

    const media = extractMediaId(url);
    if (!media) {
      return NextResponse.json({ error: '有効なYouTubeまたはX(Twitter)のURLではありません' }, { status: 400 });
    }

    // 既に存在するか確認
    const { data: existing } = await supabase
      .from('youtube_queue')
      .select('id, status, title')
      .eq('id', media.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: `既にキューに登録されています (ステータス: ${existing.status})`,
        item: existing
      });
    }

    // 新規登録
    const { data: inserted, error: insertErr } = await supabase
      .from('youtube_queue')
      .insert({
        id: media.id,
        url: media.normalizedUrl,
        title: title || media.defaultTitle,
        channel_name: media.channelName,
        status: 'pending',
        priority,
        retry_count: 0,
        date_added: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, item: inserted });
  } catch (e: any) {
    console.error('YouTube Queue追加エラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

// 3. キュー削除
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
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('YouTube Queue削除エラー:', e);
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
