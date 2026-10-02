import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

// 監視チャンネル(youtube_channels)と監視プレイリスト(youtube_playlists)の管理。
// 旧ポータルでは別々のAPIだったが、テーブル名と解決タスク名以外は同一なので kind で切り替える。
// 新規登録は URL→ID の解決に yt-dlp が要るため、PCのエッジワーカーへタスクを起票して任せる。
const KINDS = {
  channel: { table: 'youtube_channels', task: 'resolve_youtube_channel', label: 'チャンネル' },
  playlist: { table: 'youtube_playlists', task: 'resolve_youtube_playlist', label: 'プレイリスト' },
} as const;
type Kind = keyof typeof KINDS;

function getKind(req: NextRequest): Kind | null {
  const k = new URL(req.url).searchParams.get('kind');
  return k === 'channel' || k === 'playlist' ? k : null;
}

// 共有ボタン由来の ?si=... などの追跡パラメータを落とす。プレイリストは list= だけ残す。
// 2026-10-01 に ?si= 付きのチャンネルURLの解決タスクが2回続けて失敗していた。
function normalizeUrl(raw: string, kind: Kind): string {
  try {
    const u = new URL(raw.trim());
    if (kind === 'playlist') {
      const list = u.searchParams.get('list');
      return list ? `https://www.youtube.com/playlist?list=${list}` : raw.trim();
    }
    return `${u.origin}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return raw.trim();
  }
}

export async function GET(req: NextRequest) {
  try {
    const kind = getKind(req);
    if (!kind) return NextResponse.json({ error: 'kind は channel か playlist を指定してください' }, { status: 400 });
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { table, task } = KINDS[kind];

    const [{ data, error }, { data: tasks }] = await Promise.all([
      supabase.from(table).select('*').order('created_at', { ascending: false }),
      // 登録依頼の処理結果（失敗に気づけるよう直近分を返す）
      supabase
        .from('edge_tasks')
        .select('id, status, payload, error_message, created_at, updated_at')
        .eq('task_type', task)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    if (error) throw error;

    return NextResponse.json({ success: true, items: data || [], recentTasks: tasks || [] });
  } catch (e: any) {
    console.error('[youtube/watch] GET Error:', e);
    return NextResponse.json({ error: e.message || '取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const kind = getKind(req);
    if (!kind) return NextResponse.json({ error: 'kind は channel か playlist を指定してください' }, { status: 400 });
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });
    const { task, label } = KINDS[kind];

    const { url } = await req.json();
    if (!url || !String(url).trim()) {
      return NextResponse.json({ error: `${label}のURLを入力してください` }, { status: 400 });
    }
    const normalized = normalizeUrl(String(url), kind);
    if (!/youtube\.com|youtu\.be/i.test(normalized)) {
      return NextResponse.json({ error: 'YouTubeのURLではありません' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('edge_tasks')
      .insert({ task_type: task, payload: { url: normalized }, status: 'pending' })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${label}の登録を依頼しました。PCのエッジワーカーがURLを解決して登録します（PCが起動していないと進みません）。`,
      task: data,
    });
  } catch (e: any) {
    console.error('[youtube/watch] POST Error:', e);
    return NextResponse.json({ error: e.message || '登録に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const kind = getKind(req);
    if (!kind) return NextResponse.json({ error: 'kind は channel か playlist を指定してください' }, { status: 400 });
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });

    const { id, active } = await req.json();
    if (!id || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'id と active(true/false) が必要です' }, { status: 400 });
    }
    const { error } = await supabase.from(KINDS[kind].table).update({ active }).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: active ? '監視を再開しました' : '監視を停止しました' });
  } catch (e: any) {
    console.error('[youtube/watch] PATCH Error:', e);
    return NextResponse.json({ error: e.message || '更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const kind = getKind(req);
    if (!kind) return NextResponse.json({ error: 'kind は channel か playlist を指定してください' }, { status: 400 });
    if (!supabase) return NextResponse.json({ error: 'Supabaseクライアントが未初期化です' }, { status: 500 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });

    // 監視対象の登録を外すだけで、キューに積まれた動画やライブラリの記事には影響しない
    const { error } = await supabase.from(KINDS[kind].table).delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: `${KINDS[kind].label}の監視登録を解除しました` });
  } catch (e: any) {
    console.error('[youtube/watch] DELETE Error:', e);
    return NextResponse.json({ error: e.message || '解除に失敗しました' }, { status: 500 });
  }
}
