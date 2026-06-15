import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LINKS_FILE_PATH = path.join(process.cwd(), '../02_FACTORY/affiliate_links.json');

// 1. アフィリエイトリンクの取得
export async function GET() {
  try {
    if (!fs.existsSync(LINKS_FILE_PATH)) {
      // 存在しない場合は初期値を作成
      const defaultLinks = {
        "Canva": "https://px.a8.net/svt/ejd?a8mat=YOUR_CANVA_A8_LINK",
        "Notion": "https://notion.grsm.io/YOUR_NOTION_LINK",
        "ChatGPT": "https://openai.com/YOUR_CHATGPT_LINK"
      };
      fs.mkdirSync(path.dirname(LINKS_FILE_PATH), { recursive: true });
      fs.writeFileSync(LINKS_FILE_PATH, JSON.stringify(defaultLinks, null, 2), 'utf-8');
      return NextResponse.json(defaultLinks);
    }

    const fileContent = fs.readFileSync(LINKS_FILE_PATH, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('❌ [Affiliate Links API] GET Error:', err);
    return NextResponse.json({ error: 'アフィリエイトリンクの読み込みに失敗しました。' }, { status: 500 });
  }
}

// 2. アフィリエイトリンクの上書き保存
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: '無効なデータ形式です。' }, { status: 400 });
    }

    // 基本的な形式バリデーション (すべての値が文字列かつURL形式であることを緩やかにチェック)
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string' || (!value.startsWith('http://') && !value.startsWith('https://'))) {
        return NextResponse.json({ error: `ツール「${key}」のURLが無効です。http:// または https:// で始まっている必要があります。` }, { status: 400 });
      }
    }

    fs.mkdirSync(path.dirname(LINKS_FILE_PATH), { recursive: true });
    fs.writeFileSync(LINKS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'アフィリエイトリンクを更新しました。' });
  } catch (err: any) {
    console.error('❌ [Affiliate Links API] POST Error:', err);
    return NextResponse.json({ error: 'アフィリエイトリンクの保存に失敗しました。' }, { status: 500 });
  }
}
