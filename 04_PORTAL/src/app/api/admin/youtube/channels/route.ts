import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabaseClient';

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('youtube_channels')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(data || []);

  } catch (err: any) {
    console.error('❌ [Channels API] GET Error:', err);
    return NextResponse.json({ error: `チャンネルリストの取得に失敗しました: ${err.message}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'チャンネルURLが指定されていません。' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    // エッジタスク（resolve_youtube_channel）を起票してローカルエッジワーカーにチャンネルの解決と登録を任せる
    const taskData = {
      task_type: 'resolve_youtube_channel',
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
      message: 'チャンネルの登録解決要求を送信しました。ローカルワーカーがバックグラウンドで解析と登録を行います。',
      task: data ? data[0] : null
    });

  } catch (err: any) {
    console.error('❌ [Channels API] POST Error:', err);
    return NextResponse.json({ error: `チャンネルの登録に失敗しました: ${err.message}` }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, active } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'チャンネルIDが指定されていません。' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    const { error } = await supabase
      .from('youtube_channels')
      .update({ active })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: '監視設定を更新しました。' });

  } catch (err: any) {
    console.error('❌ [Channels API] PATCH Error:', err);
    return NextResponse.json({ error: `設定の更新に失敗しました: ${err.message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'チャンネルIDが指定されていません。' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase接続が有効ではありません。' }, { status: 500 });
    }

    const { error } = await supabase
      .from('youtube_channels')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'チャンネル監視を解除しました。' });

  } catch (err: any) {
    console.error('❌ [Channels API] DELETE Error:', err);
    return NextResponse.json({ error: `チャンネルの解除に失敗しました: ${err.message}` }, { status: 500 });
  }
}
