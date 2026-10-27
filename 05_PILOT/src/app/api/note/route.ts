import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'note_drafts.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return NextResponse.json({
        success: true,
        drafts: data.drafts || [],
        total: (data.drafts || []).length,
      });
    }

    return NextResponse.json({
      success: true,
      drafts: [],
      total: 0,
    });
  } catch (err: any) {
    console.error('[api/note] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
