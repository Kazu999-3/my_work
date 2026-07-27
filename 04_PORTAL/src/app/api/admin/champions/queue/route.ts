import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

// ワークスペースのルートを特定する
const WORKSPACE_DIR = process.env.MY_WORK_DIR
  ? process.env.MY_WORK_DIR
  : path.resolve(process.cwd(), '../');

const QUEUE_FILE = path.join(WORKSPACE_DIR, '02_FACTORY/_LOL/champion_update_queue.json');
const LOCK_FILE  = path.join(WORKSPACE_DIR, '03_SYSTEMS/v2_CORE/_LOL/champ_db_bulk_updater.lock');

// champ_db_bulk_updater.py が save_queue() のたびに書き込む固定ID行（ハートビートと同じ方式）。
// ローカルの champion_update_queue.json はデーモンが動いているPCにしか存在せず、
// Vercel上のポータルからは絶対に見えないため、Supabase経由の進捗報告を優先して読む。
const BULK_STATUS_ID = '00000000-0000-0000-0000-000000000002';

export async function GET(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================

    // 1. まずSupabase経由の進捗報告を確認する（どこからアクセスしても見える）
    const { data: statusRow } = await supabaseAdmin
      .from('edge_tasks')
      .select('status, payload, updated_at')
      .eq('id', BULK_STATUS_ID)
      .maybeSingle();

    if (statusRow?.payload) {
      const p = statusRow.payload as any;
      // 10分以上更新が無ければ、デーモンが停止している(=読み込み専用の古い状態)とみなす。
      const staleMs = statusRow.updated_at ? Date.now() - new Date(statusRow.updated_at).getTime() : Infinity;
      const isStale = staleMs > 10 * 60 * 1000;

      return NextResponse.json({
        initialized: true,
        patch_version: p.patch_version,
        updated_at: statusRow.updated_at,
        status: isStale && statusRow.status === 'running' ? 'suspended' : statusRow.status,
        total: p.total || 0,
        completed: p.completed || 0,
        running: p.running || 0,
        failed: p.failed || 0,
        pending: p.pending || 0,
        current_champ: p.current_champ || null,
      });
    }

    // 2. フォールバック: ローカル実行時（Supabaseにまだ一度も報告されていない場合）
    if (!fs.existsSync(QUEUE_FILE)) {
      return NextResponse.json({
        initialized: false,
        total: 0,
        completed: 0,
        running: 0,
        failed: 0,
        pending: 0,
        status: 'idle',
        queue: {}
      });
    }

    const fileContent = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const queueData = JSON.parse(fileContent);

    const queue = queueData.queue || {};
    const total = Object.keys(queue).length;

    let completed = 0;
    let running = 0;
    let failed = 0;
    let pending = 0;
    const runningChamps: string[] = [];

    for (const [champId, info] of Object.entries(queue) as [string, any][]) {
      const s = info.status;
      if (s === 'completed') completed++;
      else if (s === 'running') {
        running++;
        runningChamps.push(info.name);
      }
      else if (s === 'failed') failed++;
      else pending++;
    }

    return NextResponse.json({
      initialized: true,
      patch_version: queueData.patch_version,
      updated_at: queueData.updated_at,
      status: queueData.status || 'idle',
      total,
      completed,
      running,
      failed,
      pending,
      current_champ: runningChamps.length > 0 ? runningChamps[0] : null,
      queue
    });

  } catch (err: any) {
    console.error('❌ [Queue API] GET Error:', err);
    return NextResponse.json({ error: 'キュー情報の取得に失敗しました。' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const { action } = await req.json();

    if (action === 'reset') {
      // 1. キューファイルの削除
      if (fs.existsSync(QUEUE_FILE)) {
        fs.unlinkSync(QUEUE_FILE);
      }
      // 2. ロックファイルの削除（実行中のロックも強制クリア）
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
      }

      console.log('✅ [Queue API] Queue and lock successfully reset.');
      return NextResponse.json({ success: true, message: '一括更新キューと実行ロックをリセットしました。' });
    }

    return NextResponse.json({ error: '無効なアクションです。' }, { status: 400 });

  } catch (err: any) {
    console.error('❌ [Queue API] POST Error:', err);
    return NextResponse.json({ error: `キューの操作に失敗しました: ${err.message}` }, { status: 500 });
  }
}
