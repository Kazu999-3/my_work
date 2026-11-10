import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const HUD_HEARTBEAT_ID = '00000000-0000-0000-0000-000000000006';

export async function POST(req: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB未接続' }, { status: 500 });
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {}

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('edge_tasks')
      .upsert({
        id: HUD_HEARTBEAT_ID,
        task_type: 'hud_heartbeat',
        status: 'running',
        payload: {
          client: 'overwolf_hud',
          version: payload.version || '1.0',
          inGame: !!payload.inGame,
          ...payload,
        },
        updated_at: nowIso,
      });

    if (error) throw error;

    return NextResponse.json({ success: true, timestamp: nowIso });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
