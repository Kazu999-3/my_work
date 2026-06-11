import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: '無効なコンテンツです。' }, { status: 400 });
    }

    const rootPath = path.join(process.cwd(), '../SYSTEM_DESIGN.md');
    const localPath = path.join(process.cwd(), 'src/app/design/SYSTEM_DESIGN.md');

    // 1. プロジェクトルートの設計書を書き換え
    fs.writeFileSync(rootPath, content, 'utf8');

    // 2. ポータル内の設計書も書き換え (同期)
    fs.writeFileSync(localPath, content, 'utf8');

    console.log('📝 [Design API] SYSTEM_DESIGN.md has been updated from portal.');

    // 3. 非同期で Git Commit & Push を実行 (デプロイキック)
    // 処理待ちを避けるため、コマンドはノンブロッキングで非同期実行します
    const gitCommand = 'git add ../SYSTEM_DESIGN.md src/app/design/SYSTEM_DESIGN.md && git commit -m "docs: update system design via portal dashboard" && git push origin master';
    
    exec(gitCommand, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [Design API] Git deployment failed: ${error.message}`);
        return;
      }
      console.log(`✅ [Design API] Git deployment successful:\n${stdout}`);
      if (stderr) {
        console.warn(`⚠️ [Design API] Git warnings:\n${stderr}`);
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: '設計書を保存しました。バックグラウンドで自動デプロイを開始しました。' 
    });

  } catch (err: any) {
    console.error('❌ [Design API] Error:', err);
    return NextResponse.json({ error: err.message || '内部エラーが発生しました。' }, { status: 500 });
  }
}
