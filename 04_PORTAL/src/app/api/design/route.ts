import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { systemDesignDocs } from '../../design/systemDesignMarkdown';

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

export async function GET() {
  try {
    const docsDir = path.join(process.cwd(), 'public/design_docs');
    
    // Vercelサーバーレス等でディレクトリが見つからない場合は、静的フォールバックデータを返す
    if (!fs.existsSync(docsDir)) {
      console.warn('⚠️ [Design GET API] public/design_docs not found. Using static fallback docs.');
      return NextResponse.json({ docs: systemDesignDocs });
    }

    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).sort();
    
    // ファイルが存在しない場合も静的フォールバックを返す
    if (files.length === 0) {
      console.warn('⚠️ [Design GET API] No markdown files found. Using static fallback docs.');
      return NextResponse.json({ docs: systemDesignDocs });
    }

    const docs: Record<string, { title: string; filename: string; content: string }> = {};

    files.forEach(file => {
      const filePath = path.join(docsDir, file);
      const rawKey = path.basename(file, '.md');
      const cleanKey = rawKey.replace(/^\d+_/g, '');
      const content = fs.readFileSync(filePath, 'utf8');
      const title = titleMapping[rawKey] || cleanKey;

      docs[cleanKey] = {
        title,
        filename: file,
        content
      };
    });

    return NextResponse.json({ docs });
  } catch (err: any) {
    console.error('❌ [Design GET API] fs read failed. Falling back to static docs. Error:', err.message);
    return NextResponse.json({ docs: systemDesignDocs });
  }
}
