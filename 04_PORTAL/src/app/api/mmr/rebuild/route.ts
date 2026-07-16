import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { performFullMmrRebuild } from '../../../../lib/mmr';
import { verifyAdminSession } from '../../../../lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
  // ===== 管理者セッション確認 =====
  // 全プレイヤーのMMRを一括で書き換える破壊的操作のため、他のadmin配下APIと同様に保護する。
  const authResult = await verifyAdminSession(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const result = await performFullMmrRebuild(supabase);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Rebuild Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

