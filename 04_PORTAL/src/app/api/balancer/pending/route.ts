import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import crypto from 'crypto';

// メモリ上に一時保存用の Map を定義 (Next.js の同一プロセスで共有)
const pendingMatches = new Map<string, { balanceResult: any; createdAt: number }>();

// 定期的なクリーンアップ (1時間以上古い pending データを自動削除)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [id, value] of pendingMatches.entries()) {
      if (now - value.createdAt > 3 * 60 * 60 * 1000) { // 3時間有効
        pendingMatches.delete(id);
      }
    }
    lastCleanup = now;
  }
}

export async function POST(request: Request) {
  try {
    cleanupExpired();
    const { balanceResult } = await request.json();
    if (!balanceResult) {
      return NextResponse.json({ error: 'チーム分け結果がありません。' }, { status: 400 });
    }

    const pendingId = crypto.randomUUID();
    pendingMatches.set(pendingId, {
      balanceResult,
      createdAt: Date.now()
    });

    // ★ 修正: 待機プレイヤー（spectators）のPityを一括更新 (+10)
    // チーム確定（結果入力ページへの遷移）の瞬間に即時付与することで、次のゲームの選出で優先される
    if (balanceResult.spectators && balanceResult.spectators.length > 0) {
      for (const name of balanceResult.spectators) {
        const { data: pData } = await supabase
          .from('ktm_players')
          .select('pity')
          .eq('name', name)
          .single();
        
        const nextPity = (Number(pData?.pity) || 0) + 10;
        await supabase
          .from('ktm_players')
          .update({ pity: nextPity })
          .eq('name', name);
      }
    }

    return NextResponse.json({ success: true, pendingId });
  } catch (error: any) {
    console.error('Pending Match Save Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    cleanupExpired();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'IDが指定されていません。' }, { status: 400 });
    }

    const match = pendingMatches.get(id);
    if (!match) {
      return NextResponse.json({ error: '指定されたチーム分けデータが見つからないか、期限切れです。' }, { status: 404 });
    }

    return NextResponse.json({ success: true, balanceResult: match.balanceResult });
  } catch (error: any) {
    console.error('Pending Match Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      pendingMatches.delete(id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
