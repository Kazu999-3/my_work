import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// note_articlesの集計(noteStats)が.limit(50)で頭打ちになっており、50件を超えた時点で
// 古い公開記事の実績が合計から静かに欠落していた(2026-08-05発覚)。translate-jp/route.tsの
// fetchAllRowsと同じ、.range()でページングしながら全件取得する構造に置き換える。
async function fetchAllRows(build: () => any, pageSize = 1000): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    all = all.concat(rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

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
    let drafts: any[] = [];
    try {
      drafts = await fetchAllRows(() =>
        supabase
          .from('note_articles')
          .select('id, title, champion, patch, content_free, content_paid, promo_text, status, source_skill, created_at, note_url, published_at, scheduled_at, views, likes, sales_count, sales_amount, metrics_updated_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
      );
    } catch (draftErr: any) {
      console.warn('[analytics] note_articles取得に失敗:', draftErr.message);
    }

    // 3. 実データ集計（手入力の閲覧数/スキ/売上から算出）。
    // 旧レポート(note_analytics_daemon.py出力)は廃止済みのスクレイパーが
    // 6週間前に吐いた1本きりで更新が止まっているため、noteStatsを主指標にする。
    const published = drafts.filter((d: any) => d.status === 'published');
    const sum = (key: string) => published.reduce((s: number, d: any) => s + (Number(d[key]) || 0), 0);
    const noteStats = {
      publishedCount: published.length,
      totalViews: sum('views'),
      totalLikes: sum('likes'),
      totalSalesCount: sum('sales_count'),
      totalSalesAmount: sum('sales_amount'),
      topByViews: [...published]
        .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
        .slice(0, 5)
        .map((d: any) => ({ id: d.id, title: d.title, champion: d.champion, views: d.views, likes: d.likes, note_url: d.note_url })),
    };

    return NextResponse.json({ reports, drafts, noteStats });
  } catch (error: any) {
    console.error('Error fetching analytics reports and drafts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
