import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
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

    // 2. 下書き原稿の読み込み。
    // 以前は 02_FACTORY/note_drafts をファイルシステム経由で読んでいたが、
    // このディレクトリは.gitignore対象でVercel本番のデプロイには一切含まれず、
    // 本番では常にファイルが見つからず空になる作りだった。
    // エージェントスキル(sovereign-factory等)がnote記事を書く際に、
    // note_articlesテーブルへも記録するようにして、そちらから読む。
    const { data: draftRows, error: draftErr } = await supabase
      .from('note_articles')
      .select('id, title, champion, patch, content_free, content_paid, promo_text, status, source_skill, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (draftErr) console.warn('[analytics] note_articles取得に失敗:', draftErr.message);
    const drafts = draftRows || [];

    return NextResponse.json({ reports, drafts });
  } catch (error: any) {
    console.error('Error fetching analytics reports and drafts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
