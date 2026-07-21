import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';


export async function GET(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('youtube_playlists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(data || []);

  } catch (err: any) {
    console.error('❌ [Playlists API] GET Error:', err);
    return NextResponse.json({ error: `プレイリストの取得に失敗しました: ${err.message}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'プレイリストURLが指定されていません。' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    // エッジタスク（resolve_youtube_playlist）を起票してローカルエッジワーカーにプレイリストの解決と登録を任せる
    const taskData = {
      task_type: 'resolve_youtube_playlist',
      payload: { url: url.trim() },
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('edge_tasks')
      .insert(taskData)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'プレイリストの登録解決要求を送信しました。ローカルワーカーがバックグラウンドで解析と登録を行います。',
      task: data ? data[0] : null
    });

  } catch (err: any) {
    console.error('❌ [Playlists API] POST Error:', err);
    return NextResponse.json({ error: `プレイリストの登録に失敗しました: ${err.message}` }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, active } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'プレイリストIDが指定されていません。' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    const { error } = await supabase
      .from('youtube_playlists')
      .update({ active })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: '監視設定を更新しました。' });

  } catch (err: any) {
    console.error('❌ [Playlists API] PATCH Error:', err);
    return NextResponse.json({ error: `設定の更新に失敗しました: ${err.message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'プレイリストIDが指定されていません。' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    const { error } = await supabase
      .from('youtube_playlists')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'プレイリスト監視を解除しました。' });

  } catch (err: any) {
    console.error('❌ [Playlists API] DELETE Error:', err);
    return NextResponse.json({ error: `プレイリストの解除に失敗しました: ${err.message}` }, { status: 500 });
  }
}
