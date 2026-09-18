import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getInboxPath() {
  // 開発環境 (04_PORTAL 内実行) またはルート実行に対応
  const primaryPath = path.resolve(process.cwd(), '..', '02_FACTORY', 'FEEDBACK_INBOX.md');
  if (fs.existsSync(primaryPath)) return primaryPath;
  const secondaryPath = path.resolve(process.cwd(), '02_FACTORY', 'FEEDBACK_INBOX.md');
  if (fs.existsSync(secondaryPath)) return secondaryPath;
  return primaryPath;
}

export interface FeedbackItem {
  id: number;
  raw: string;
  completed: boolean;
  date: string;
  source: string;
  content: string;
}

function parseInbox(content: string): { items: FeedbackItem[]; rawContent: string } {
  const lines = content.split('\n');
  const items: FeedbackItem[] = [];
  let idCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
      const completed = line.startsWith('- [x]');
      const cleanLine = line.replace(/^-\s*\[[ x]\]\s*/, '');
      
      // フォーマット: "YYYY-MM-DD (対象ファイル): 内容"
      let date = '';
      let source = '';
      let text = cleanLine;

      const match = cleanLine.match(/^(\d{4}-\d{2}-\d{2})\s*\(([^)]+)\):\s*(.+)$/);
      if (match) {
        date = match[1];
        source = match[2];
        text = match[3];
      } else {
        const dateMatch = cleanLine.match(/^(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
        if (dateMatch) {
          date = dateMatch[1];
          text = dateMatch[2];
        }
      }

      items.push({
        id: ++idCounter,
        raw: line,
        completed,
        date: date || '日付未定',
        source: source || '一般ナレッジ',
        content: text,
      });
    }
  }

  return { items, rawContent: content };
}

// GET: インボックスのアイテム一覧とサマリーを取得
export async function GET() {
  try {
    const inboxPath = getInboxPath();
    if (!fs.existsSync(inboxPath)) {
      return NextResponse.json({ success: false, error: 'FEEDBACK_INBOX.md が見つかりません' }, { status: 404 });
    }

    const content = fs.readFileSync(inboxPath, 'utf-8');
    const { items } = parseInbox(content);
    const pendingCount = items.filter(i => !i.completed).length;
    const completedCount = items.filter(i => i.completed).length;

    return NextResponse.json({
      success: true,
      items,
      stats: {
        total: items.length,
        pending: pendingCount,
        completed: completedCount,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: 新しい指摘の投函
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ success: false, error: '指摘内容を入力してください' }, { status: 400 });
    }

    const inboxPath = getInboxPath();
    if (!fs.existsSync(inboxPath)) {
      return NextResponse.json({ success: false, error: 'FEEDBACK_INBOX.md が見つかりません' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(inboxPath, 'utf-8');
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    const newEntry = `- [ ] ${today} (${source || 'ポータル投函'}): ${content.trim()}`;

    // "## 📥 投函ポスト" の直後に挿入
    let updatedContent = '';
    const anchor = '## 📥 投函ポスト (最新の指摘を上に追加)';
    if (fileContent.includes(anchor)) {
      updatedContent = fileContent.replace(anchor, `${anchor}\n${newEntry}`);
    } else {
      updatedContent = fileContent + `\n${newEntry}\n`;
    }

    fs.writeFileSync(inboxPath, updatedContent, 'utf-8');

    return NextResponse.json({ success: true, message: '指摘を投函しました', entry: newEntry });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: 指摘の完了トグル
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, targetRaw } = body;

    const inboxPath = getInboxPath();
    if (!fs.existsSync(inboxPath)) {
      return NextResponse.json({ success: false, error: 'FEEDBACK_INBOX.md が見つかりません' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(inboxPath, 'utf-8');
    const { items } = parseInbox(fileContent);

    const item = items.find(i => i.id === id || (targetRaw && i.raw === targetRaw));
    if (!item) {
      return NextResponse.json({ success: false, error: '指定された指摘項目が見つかりません' }, { status: 404 });
    }

    const oldRaw = item.raw;
    const newRaw = item.completed 
      ? oldRaw.replace(/^- \[x\]/, '- [ ]') 
      : oldRaw.replace(/^- \[ \]/, '- [x]');

    const updatedContent = fileContent.replace(oldRaw, newRaw);
    fs.writeFileSync(inboxPath, updatedContent, 'utf-8');

    return NextResponse.json({ success: true, message: 'ステータスを更新しました', completed: !item.completed });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
