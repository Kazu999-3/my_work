import { NextResponse, NextRequest } from 'next/server';

const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:8001';
const ANTIGRAVITY_API_KEY = process.env.ANTIGRAVITY_API_KEY || 'default_dev_key_2026';

const headers = {
  'X-Antigravity-Key': ANTIGRAVITY_API_KEY,
  'Content-Type': 'application/json',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { champion, role } = body;
    
    if (!champion) {
      return NextResponse.json({ success: false, error: 'Missing champion name' }, { status: 400 });
    }
    
    const targetUrl = `${CORE_API_URL}/api/champions/trend`;
    
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ champion, role: role || 'Jungle' }),
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
