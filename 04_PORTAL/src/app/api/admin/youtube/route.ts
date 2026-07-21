import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// サーバーサイド用クライアント（サービスキーを使用）

function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 1. キュー一覧の取得
export async function GET(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
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

    // 解析完了した動画から生成された記事を紐づける。
    // 記事がどの形で動画を参照しているかは生成経路によってまちまちなので、
    // URL の形に依存せず「11桁の動画IDが本文・URL・タイトルのどこかに出てくるか」で突き合わせる。
    const rows = data || [];

    try {
      const { data: articles } = await supabase
        .from('personal_knowledge')
        .select('id, title, source_url, content, raw_content, tags')
        .limit(3000);

      const queueIds = new Set(rows.map((r: any) => String(r.id)));

      // 1動画から複数記事が作られることもあるため配列で保持する
      const byVideoId = new Map<string, any[]>();
      const attach = (videoId: string, a: any) => {
        if (!queueIds.has(videoId)) return;
        const list = byVideoId.get(videoId) || [];
        if (list.some((x) => String(x.id) === String(a.id))) return; // 同じ記事の重複登録を防ぐ
        list.push({
          id: a.id,
          title: a.title,
          archived: Array.isArray(a.tags) && a.tags.includes('__DELETED__'),
        });
        byVideoId.set(videoId, list);
      };

      for (const a of articles || []) {
        const src = String(a.source_url || '');
        // source_url に動画IDが含まれていれば最優先で紐づける（URLの形は問わない）
        const srcHits = src.match(/[A-Za-z0-9_-]{11}/g) || [];
        let hit = false;
        for (const id of srcHits) {
          if (queueIds.has(id)) { attach(id, a); hit = true; }
        }
        if (hit) continue;

        // source_url が無い/別形式の記事のために、本文・タイトルからも動画IDを拾う
        const body = `${a.title || ''}\n${String(a.content || '').slice(0, 2000)}\n${String(a.raw_content || '').slice(0, 2000)}`;
        const bodyHits = body.match(/[A-Za-z0-9_-]{11}/g) || [];
        for (const id of bodyHits) {
          if (queueIds.has(id)) attach(id, a);
        }
      }

      for (const row of rows as any[]) {
        row.articles = byVideoId.get(String(row.id)) || [];
      }
    } catch (linkErr) {
      // 紐づけに失敗してもキュー一覧自体は表示できるようにする
      console.warn('[YouTube API] 記事の紐づけに失敗:', linkErr);
    }

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('❌ [YouTube API] GET Error:', err);
    return NextResponse.json({ error: 'キューの読み込みに失敗しました。' }, { status: 500 });
  }
}

// 2. 新規動画の追加
// 2. 新規動画の追加 または タスク起動
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 手動タスク起動の処理
    if (body.trigger_task) {
      const { trigger_task } = body;
      
      const taskData = {
        task_type: trigger_task,
        payload: {},
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('edge_tasks')
        .insert(taskData)
        .select();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `タスク「${trigger_task}」の実行要求を送信しました。`,
        task: data ? data[0] : null
      });
    }

    const { url } = body;

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
