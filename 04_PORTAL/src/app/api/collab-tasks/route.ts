import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// サーバーサイド用クライアント（サービスキーを使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// タスク一覧取得
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('collab_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// タスク追加
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, owner, priority } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'タスク名は必須です' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('collab_tasks')
      .insert([{ title, description: description || '', owner: owner || 'both', priority: priority || 'medium', status: 'todo' }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
