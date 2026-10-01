import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    const author = (body.author || 'WebPortal').trim();

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'タイトルとメモ本文を入力してください。' },
        { status: 400 }
      );
    }

    const repoRoot = path.resolve(process.cwd(), '..');
    const inboxDir = path.join(repoRoot, '01_INTEL', '00_INBOX');

    if (!fs.existsSync(/*turbopackIgnore: true*/ inboxDir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ inboxDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeTitle = title.replace(/[\\/*?:"<>| \s]/g, '_').slice(0, 40);
    const filename = `${timeStr}_${safeTitle}.md`;
    const targetPath = path.join(inboxDir, filename);

    const fileContent = `# ${title}\n\n**投函者**: ${author}\n**投函日時**: ${now.toLocaleString('ja-JP')}\n\n---\n\n${content}\n`;

    fs.writeFileSync(/*turbopackIgnore: true*/ targetPath, fileContent, 'utf-8');

    return NextResponse.json({
      success: true,
      filename,
      message: '📥 帝国インボックスへ正常に投函されました。常駐デーモンが自動で構造化・原本退避・索引登録を実行します。'
    });
  } catch (err: any) {
    console.error('[/api/inbox/post] error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'インボックスへの投函に失敗しました。' },
      { status: 500 }
    );
  }
}
