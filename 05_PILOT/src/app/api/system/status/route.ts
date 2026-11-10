import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const WORKER_HEARTBEAT_ID = '00000000-0000-0000-0000-000000000005';
const HUD_HEARTBEAT_ID = '00000000-0000-0000-0000-000000000006';

const WORKER_STALE_SEC = 120; // 2分
const HUD_STALE_SEC = 60;     // 1分

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({
        success: true,
        hud: { active: false, lastSeenSec: null, status: 'オフライン' },
        worker: { active: false, lastSeenSec: null, status: 'オフライン' },
      });
    }

    const { data: beats, error } = await supabase
      .from('edge_tasks')
      .select('id, updated_at, payload')
      .in('id', [WORKER_HEARTBEAT_ID, HUD_HEARTBEAT_ID]);

    if (error) {
      console.warn('system status取得エラー:', error);
    }

    const now = Date.now();

    // 動画解析ワーカー
    const workerRow = (beats || []).find((b: any) => b.id === WORKER_HEARTBEAT_ID);
    const workerLast = workerRow?.updated_at ? new Date(workerRow.updated_at).getTime() : null;
    const workerDiff = workerLast ? Math.floor((now - workerLast) / 1000) : null;
    const workerActive = workerDiff !== null && workerDiff <= WORKER_STALE_SEC;

    // HUDオーバーレイ
    const hudRow = (beats || []).find((b: any) => b.id === HUD_HEARTBEAT_ID);
    const hudLast = hudRow?.updated_at ? new Date(hudRow.updated_at).getTime() : null;
    const hudDiff = hudLast ? Math.floor((now - hudLast) / 1000) : null;
    const hudActive = hudDiff !== null && hudDiff <= HUD_STALE_SEC;

    return NextResponse.json({
      success: true,
      hud: {
        active: hudActive,
        lastSeenSec: hudDiff,
        lastSeenIso: workerRow?.updated_at || null,
        status: hudActive ? '稼働中' : '未起動',
      },
      worker: {
        active: workerActive,
        lastSeenSec: workerDiff,
        lastSeenIso: workerRow?.updated_at || null,
        status: workerActive ? '稼働中' : '停止中',
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      hud: { active: false, lastSeenSec: null, status: 'エラー' },
      worker: { active: false, lastSeenSec: null, status: 'エラー' },
    }, { status: 500 });
  }
}
