import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { systemDesignDocs } from '../../../design/systemDesignMarkdown';

const titleMapping: Record<string, string> = {
  '00_overview': '🌟 全体概要・アーキテクチャ',
  '01_balancer': '⚖️ MMRバランサー・チーム分け',
  '02_match_record': '📋 対戦結果登録とElo',
  '03_leaderboard': '🏆 プレイヤーリーダーボード',
  '04_vs_analytics': '⚔️ レーン対面分析 (VS)',
  '05_jungle_clears': '🌳 周回統計ライブラリ',
  '06_soloq_scout': '🔍 ソロQ対面リアルタイム偵察',
  '07_mmr_admin': '⚙️ MMR一括再計算・検証',
  '08_knowledge_base': '🧠 自動要約ナレッジ＆動画キュー',
  '09_affiliate_spa': '💵 アフィリエイト収益化SPA'
};


export async function POST(req: NextRequest) {
  try {
    const { filename, content } = await req.json();

    if (!filename || typeof filename !== 'string' || !content || typeof content !== 'string') {
      return NextResponse.json({ error: '無効なファイル名またはコンテンツです。' }, { status: 400 });
    }

    // セキュリティチェック: ディレクトリトラバーサル防止
    if (!/^[a-zA-Z0-9_\-\.]+\.md$/.test(filename)) {
      return NextResponse.json({ error: '不正なファイル名形式です。' }, { status: 400 });
    }

    const rootDocsPath = path.join(process.cwd(), 'public/design_docs', filename);

    // 1. 個別設計書ファイルを書き換え
    fs.writeFileSync(rootDocsPath, content, 'utf8');
    console.log(`📝 [Design API] Updated individual doc: ${filename}`);

    // 2. copy_design.js を動かして portal 内の TS モジュールおよびコピーを同期・ビルド
    // 3. 非同期で Git Commit & Push を実行 (本番Vercelデプロイフック)
    const gitCommand = 'node copy_design.js && git add src/app/design/ && git commit -m "docs: update design document ' + filename + ' via portal" && git push origin master';
    
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
