import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { champion, mission_type } = await req.json();
    
    if (!champion || !mission_type) {
      return NextResponse.json({ status: "ERROR", message: "Missing champion or mission_type" }, { status: 400 });
    }

    console.log(`[FORGE] Received mission: ${champion} (${mission_type})`);

    // MVP: ここではDBにタスクを書き込むか、または他APIに連携する。
    // 今回はSupabaseに専用テーブルがない可能性があるため、成功レスポンスのみを返し、
    // 今後 Sovereign OS がこれをポーリング/Webhook受信する土台とします。

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: `錬成ミッションを受理しました: ${champion}` 
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
