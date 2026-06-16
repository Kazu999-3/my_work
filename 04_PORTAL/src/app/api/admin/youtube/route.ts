import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { createClient } from '@supabase/supabase-js';

// サーバーサイド用クライアント（サービスキーを使用）
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey
);

function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 1. キュー一覧の取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get('sort') || 'date_added';

    let query = supabase.from('youtube_queue').select('*');

    if (sort === 'published_at') {
      query = query.order('published_at', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('date_added', { ascending: false, nullsFirst: false });
    }
    
    // タイブレーカーとして id 順は維持
    query = query.order('id', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('❌ [YouTube API] GET Error:', err);
    return NextResponse.json({ error: 'キューの読み込みに失敗しました。' }, { status: 500 });
  }
}

// 2. 新規動画の追加
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URLを指定してください。' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: '無効なYouTube URLです。' }, { status: 400 });
    }

    // 重複チェック
    const { data: existing, error: checkError } = await supabase
      .from('youtube_queue')
      .select('id')
      .eq('id', videoId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      return NextResponse.json({ error: 'この動画はすでにキューに登録されています。' }, { status: 400 });
    }

    // yt-dlp によるタイトル・チャンネル名・投稿日取得の試行 (ローカル用)
    let title = 'YouTube Video';
    let channelName = 'Unknown';
    let publishedAt: string | null = null;
    const ytDlpPath = path.join(process.cwd(), '../.venv/Scripts/yt-dlp.exe');

    if (fs.existsSync(ytDlpPath)) {
      try {
        const getInfoCmd = `"${ytDlpPath}" --print "%(title)s" --print "%(uploader)s" --print "%(upload_date)s" "${url}"`;
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(getInfoCmd, { timeout: 10000 }, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout.trim());
          });
        });
        if (stdout) {
          const lines = stdout.split('\n');
          if (lines[0]) title = lines[0].trim();
          if (lines[1]) channelName = lines[1].trim();
          if (lines[2]) {
            const rawDate = lines[2].trim(); // YYYYMMDD
            if (rawDate.length === 8 && /^\d+$/.test(rawDate)) {
              publishedAt = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ [YouTube API] yt-dlp によるタイトル・チャンネル名・投稿日取得に失敗しました。フォールバックします:', err);
      }
    }

    const newItem = {
      id: videoId,
      title: title,
      channel_name: channelName,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      status: 'pending',
      retry_count: 0,
      date_added: Math.floor(Date.now() / 1000),
      published_at: publishedAt
    };

    const { data: inserted, error: insertError } = await supabase
      .from('youtube_queue')
      .insert([newItem])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: `動画「${title}」をキューに追加しました。`,
      item: inserted
    });

  } catch (err: any) {
    console.error('❌ [YouTube API] POST Error:', err);
    return NextResponse.json({ error: err.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}

// 3. 動画ステータス・優先度の更新（再試行、保留、優先度変更等）
export async function PUT(req: NextRequest) {
  try {
    const { id, status, priority } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'IDを指定してください。' }, { status: 400 });
    }

    const updates: any = {};
    if (status !== undefined) {
      updates.status = status;
      if (status === 'pending') {
        updates.retry_count = 0;
      }
    }
    if (priority !== undefined) {
      updates.priority = priority;
    }

    const { data, error } = await supabase
      .from('youtube_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '動画を更新しました。',
      item: data
    });

  } catch (err: any) {
    console.error('❌ [YouTube API] PUT Error:', err);
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
  }
}

// 4. 動画の削除
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'IDを指定してください。' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('youtube_queue')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: '指定された動画が見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '動画をキューから削除しました。'
    });

  } catch (err: any) {
    console.error('❌ [YouTube API] DELETE Error:', err);
    return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
  }
}

// 5. エラー動画の一括再試行
export async function PATCH(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action !== 'retry_all_errors') {
      return NextResponse.json({ error: '無効なアクションです。' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('youtube_queue')
      .update({ status: 'pending', retry_count: 0 })
      .in('status', ['error_generation', 'error_no_transcript', 'failed'])
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${data?.length || 0} 件のエラー動画を再試行キューにリセットしました。`,
      count: data?.length || 0
    });

  } catch (err: any) {
    console.error('❌ [YouTube API] PATCH Error:', err);
    return NextResponse.json({ error: '一括再試行に失敗しました。' }, { status: 500 });
  }
}
