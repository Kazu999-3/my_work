import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const rootDir = process.cwd(); // Next.jsルート (d:/my_work/04_PORTAL)
    
    // 1. 分析レポートの読み込み
    const analyticsDir = path.join(rootDir, '..', '02_FACTORY', 'assets', 'analytics');
    let reports: any[] = [];
    if (fs.existsSync(analyticsDir)) {
      const files = fs.readdirSync(analyticsDir)
        .filter(file => file.startsWith('note_report_') && file.endsWith('.md'))
        .sort()
        .reverse(); // 最新順
        
      reports = files.map(file => {
        const filePath = path.join(analyticsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const date = file.replace('note_report_', '').replace('.md', '');
        return {
          date,
          fileName: file,
          content
        };
      });
    }
    
    // 2. 下書き原稿の読み込み
    const draftsDir = path.join(rootDir, '..', '02_FACTORY', 'note_drafts');
    let drafts: any[] = [];
    if (fs.existsSync(draftsDir)) {
      const files = fs.readdirSync(draftsDir)
        .filter(file => file.endsWith('.md'))
        .sort()
        .reverse();
        
      drafts = files.map(file => {
        const filePath = path.join(draftsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const name = file.replace('.md', '');
        return {
          name,
          fileName: file,
          content
        };
      });
    }
    
    return NextResponse.json({ reports, drafts });
  } catch (error: any) {
    console.error('Error fetching analytics reports and drafts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
