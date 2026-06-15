import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const WORKSPACE_DIR = path.resolve(process.cwd(), '../');
const KNOWLEDGE_FILE_PATH = path.join(WORKSPACE_DIR, '02_FACTORY/affiliate_knowledge.md');

// 1. 副業ナレッジ（Markdown）の取得
export async function GET() {
  try {
    if (!fs.existsSync(KNOWLEDGE_FILE_PATH)) {
      // 存在しない場合は初期テンプレートを作成
      const defaultKnowledge = `# 副業（アフィリエイト）運営ナレッジ\n\nここにアフィリエイトのノウハウや記事構成ルールを記述します。`;
      fs.mkdirSync(path.dirname(KNOWLEDGE_FILE_PATH), { recursive: true });
      fs.writeFileSync(KNOWLEDGE_FILE_PATH, defaultKnowledge, 'utf-8');
      return NextResponse.json({ content: defaultKnowledge });
    }

    const content = fs.readFileSync(KNOWLEDGE_FILE_PATH, 'utf-8');
    return NextResponse.json({ content });
  } catch (err: any) {
    console.error('❌ [Affiliate Knowledge API] GET Error:', err);
    return NextResponse.json({ error: '副業ナレッジの読み込みに失敗しました。' }, { status: 500 });
  }
}

// 2. 副業ナレッジ（Markdown）の上書き保存
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (content === undefined || typeof content !== 'string') {
      return NextResponse.json({ error: '無効なデータ形式です。本文（文字列）を指定してください。' }, { status: 400 });
    }

    fs.mkdirSync(path.dirname(KNOWLEDGE_FILE_PATH), { recursive: true });
    fs.writeFileSync(KNOWLEDGE_FILE_PATH, content, 'utf-8');

    return NextResponse.json({ success: true, message: '副業ナレッジを保存しました。' });
  } catch (err: any) {
    console.error('❌ [Affiliate Knowledge API] POST Error:', err);
    return NextResponse.json({ error: '副業ナレッジの保存に失敗しました。' }, { status: 500 });
  }
}
