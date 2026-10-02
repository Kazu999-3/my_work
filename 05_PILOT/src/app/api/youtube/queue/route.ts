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

export const QUEUE_STATUSES = [
  'pending', 'processing', 'completed', 'on_hold',
  'error_generation', 'error_no_transcript', 'failed', 'manually_closed',
] as const;
const ERROR_STATUSES = ['error_generation', 'error_no_transcript', 'failed'];
const PRIORITIES = ['high', 'medium', 'low'];

// 1. キュー一覧取得
// 一覧はサーバー側で絞り込み・ページ送りする（全1,300件超を毎回送らない）。
// 件数(counts)は絞り込みと無関係に全件から数える。以前は先頭100件だけで集計しており不正確だった。
export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    const status = searchParams.get('status') || '';
    const channel = searchParams.get('channel') || '';
    const sort = searchParams.get('sort') === 'published_at' ? 'published_at' : 'date_added';
    // PostgREST の or() 構文を壊す文字は除去する
    const q = (searchParams.get('q') || '').replace(/[,()*%\\]/g, ' ').trim();
    const withMeta = searchParams.get('meta') === '1';

    let query = supabase.from('youtube_queue').select('*', { count: 'exact' });
    if (status === 'errors') query = query.in('status', ERROR_STATUSES);
    else if (status && status !== 'all') query = query.eq('status', status);
    if (channel) query = query.eq('channel_name', channel);
    if (q) query = query.or(`title.ilike.%${q}%,channel_name.ilike.%${q}%,id.ilike.%${q}%`);
    query = query
      .order(sort, { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    let counts: Record<string, number> | undefined;
    let channels: string[] | undefined;
    if (withMeta) {
      const results = await Promise.all(
        QUEUE_STATUSES.map((st) =>
          supabase!.from('youtube_queue').select('id', { count: 'exact', head: true }).eq('status', st),
        ),
      );
      counts = {};
      QUEUE_STATUSES.forEach((st, i) => { counts![st] = results[i].count || 0; });

      // Supabase は1回1,000行までなので分割して取得する
      const names = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data: rows, error: chErr } = await supabase
          .from('youtube_queue').select('channel_name').order('id').range(from, from + 999);
        if (chErr) throw chErr;
        (rows || []).forEach((r: any) => r.channel_name && names.add(r.channel_name));
        if (!rows || rows.length < 1000) break;
      }
      channels = Array.from(names).sort((x, y) => x.localeCompare(y, 'ja'));
    }

    return NextResponse.json({ success: true, items: data || [], total: count ?? 0, counts, channels });
  } catch (e: any) {
    console.error('Queue取得エラー:', e);
    return NextResponse.json({ error: e.message || '内部エラー' }, { status: 500 });
  }
}

const BULK_MAX = 200;

async function fetchOEmbed(videoId: string): Promise<{ title: string | null; channel: string | null }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { cache: 'no-store' },
    );
    if (!res.ok) return { title: null, channel: null };
    const o = await res.json();
    return { title: o.title || null, channel: o.author_name || null };
  } catch {
    return { title: null, channel: null };
  }
}

async function addMany(rawIds: unknown[], priority: string, source: string) {
  const ids = Array.from(new Set(rawIds.map(String).filter((v) => /^[A-Za-z0-9_-]{11}$/.test(v)))).slice(0, BULK_MAX);
  if (ids.length === 0) {
    return NextResponse.json({ error: '有効な動画IDがありません' }, { status: 400 });
  }

  // 既に登録済み（解析済み・クローズ済みを含む）の動画は飛ばす
  const { data: existing, error: exErr } = await supabase!.from('youtube_queue').select('id').in('id', ids);
  if (exErr) throw exErr;
  const known = new Set((existing || []).map((r: any) => r.id));
  const fresh = ids.filter((id) => !known.has(id));

  // oEmbed は1本ずつなので8件ずつ並行で取る
  const rows: any[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < fresh.length; i += 8) {
    const chunk = fresh.slice(i, i + 8);
    const metas = await Promise.all(chunk.map(fetchOEmbed));
    chunk.forEach((id, j) => rows.push({
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: metas[j].title || `YouTube Video (${id})`,
      channel_name: metas[j].channel || (source ? `[PL] ${source}` : 'Unknown'),
      status: 'pending',
      priority,
      retry_count: 0,
      date_added: now,
    }));
  }

  if (rows.length > 0) {
    // 同時に別経路（監視など）が同じ動画を入れていても失敗しないよう、重複は無視する
    const { error } = await supabase!.from('youtube_queue').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }

  return NextResponse.json({
    success: true,
    added: rows.length,
    skipped: ids.length - rows.length,
    message: `${rows.length}本を解析キューに追加しました${ids.length - rows.length ? `（登録済み${ids.length - rows.length}本は飛ばしました）` : ''}。`,
  });
}

// 2. キュー追加 (YouTubeのみ)
export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();

    // プレイリストのまとめて登録（ブックマークレットがページ上の動画IDを集めて渡す）
    if (Array.isArray(body.videoIds)) {
      return await addMany(body.videoIds, PRIORITIES.includes(body.priority) ? body.priority : 'medium', String(body.source || ''));
    }

    const { url, title } = body;
    const priority = PRIORITIES.includes(body.priority) ? body.priority : 'medium';

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

// 4. キューの更新
//   { id, status, resetRetries }       … 単体のステータス変更（再試行・保留・保留解除）
//   { action: 'retry_all_errors' }     … エラー系をまとめて pending に戻す
//   { action: 'set_priority', id, priority }
//   { action: 'close', ids: [...] }    … まとめて manually_closed にする
export async function PATCH(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'retry_all_errors') {
      const { data, error } = await supabase
        .from('youtube_queue')
        .update({ status: 'pending', retry_count: 0 })
        .in('status', ERROR_STATUSES)
        .select('id');
      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length || 0, message: `${data?.length || 0}件のエラー動画を解析待ちに戻しました。` });
    }

    if (action === 'set_priority') {
      if (!body.id || !PRIORITIES.includes(body.priority)) {
        return NextResponse.json({ error: 'id と priority(high/medium/low) が必要です' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('youtube_queue').update({ priority: body.priority }).eq('id', body.id).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, item: data });
    }

    if (action === 'close') {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 500) : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: '対象の動画が指定されていません' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('youtube_queue').update({ status: 'manually_closed' }).in('id', ids).select('id');
      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length || 0, message: `${data?.length || 0}件をクローズしました。` });
    }

    const { id, status, resetRetries } = body;
    if (!id || !QUEUE_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'id と有効な status が必要です' }, { status: 400 });
    }

    const updates: any = { status };
    if (resetRetries || status === 'pending') updates.retry_count = 0;

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
