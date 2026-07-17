import { NextResponse, NextRequest } from 'next/server';
import { verifyAdminSession } from '../../../../lib/adminAuth';

const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:8001';
const ANTIGRAVITY_API_KEY = process.env.ANTIGRAVITY_API_KEY || 'default_dev_key_2026';

// 共通ヘッダー
const headers = {
  'X-Antigravity-Key': ANTIGRAVITY_API_KEY,
  'Content-Type': 'application/json',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const taskType = searchParams.get('task_type');
  
  let targetUrl = `${CORE_API_URL}/api/ab-test/variations`;
  if (taskType) {
    targetUrl += `?task_type=${taskType}`;
  }

  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ success: false, error: errorText }, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;
    
    let targetUrl = `${CORE_API_URL}/api/ab-test/variations`;
    if (action === 'evolve') {
      targetUrl = `${CORE_API_URL}/api/ab-test/evolve`;
    }
    
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ success: false, error: errorText }, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing variation ID' }, { status: 400 });
    }
    
    const body = await req.json();
    const targetUrl = `${CORE_API_URL}/api/ab-test/variations/${id}`;
    
    const res = await fetch(targetUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ success: false, error: errorText }, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
