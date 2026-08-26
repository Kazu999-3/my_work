import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

const TODO_FILE_PATH = path.resolve(process.cwd(), '../02_FACTORY/TODO.md');

// TODO項目をパースする型
export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  section: string;
  rawLine: string;
}

// GET: TODO.md からタスク一覧を取得
export async function GET(req: NextRequest) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    if (!fs.existsSync(TODO_FILE_PATH)) {
      return NextResponse.json({ todos: [], message: 'TODO.md が見つかりません' });
    }

    const content = fs.readFileSync(TODO_FILE_PATH, 'utf-8');
    const lines = content.split('\n');

    const todos: TodoItem[] = [];
    let currentSection = '全般タスク';

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        currentSection = trimmed.replace(/^##\s+/, '').trim();
      } else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
        const completed = trimmed.startsWith('- [x] ');
        const text = trimmed.replace(/^- \[[ x]\]\s+/, '').trim();
        todos.push({
          id: `todo_${index}`,
          text,
          completed,
          section: currentSection,
          rawLine: line,
        });
      }
    });

    return NextResponse.json({ todos, lastModified: fs.statSync(TODO_FILE_PATH).mtime });
  } catch (err: any) {
    console.error('[TODO API] GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: タスクの完了トグル、または新規タスク追加
export async function POST(req: NextRequest) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { action, rawLine, newText, completed } = await req.json();

    if (!fs.existsSync(TODO_FILE_PATH)) {
      return NextResponse.json({ error: 'TODO.md が見つかりません' }, { status: 404 });
    }

    let content = fs.readFileSync(TODO_FILE_PATH, 'utf-8');

    if (action === 'toggle') {
      if (!rawLine) return NextResponse.json({ error: 'rawLine が必要です' }, { status: 400 });
      const targetOld = rawLine;
      const isCurrentlyCompleted = rawLine.includes('- [x] ');
      const targetNew = isCurrentlyCompleted
        ? rawLine.replace('- [x] ', '- [ ] ')
        : rawLine.replace('- [ ] ', '- [x] ');

      if (content.includes(targetOld)) {
        content = content.replace(targetOld, targetNew);
        fs.writeFileSync(TODO_FILE_PATH, content, 'utf-8');
        return NextResponse.json({ success: true, newRawLine: targetNew });
      } else {
        return NextResponse.json({ error: '対象のタスク行が見つかりませんでした' }, { status: 404 });
      }
    } else if (action === 'add') {
      if (!newText) return NextResponse.json({ error: 'newText が必要です' }, { status: 400 });
      const newTodoLine = `- [ ] **${newText}** (ポータルから追加: ${new Date().toLocaleDateString('ja-JP')})`;
      
      // 未対応セクションを探して先頭に追加、無ければ末尾に追加
      if (content.includes('## 🔧 未対応') || content.includes('## 📅 次回の注力タスク')) {
        const match = content.match(/## (🔧 未対応|📅 次回の注力タスク)[^\n]*\n/);
        if (match && match.index !== undefined) {
          const insertPos = match.index + match[0].length;
          content = content.slice(0, insertPos) + `${newTodoLine}\n` + content.slice(insertPos);
        } else {
          content += `\n${newTodoLine}\n`;
        }
      } else {
        content += `\n${newTodoLine}\n`;
      }

      fs.writeFileSync(TODO_FILE_PATH, content, 'utf-8');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '無効な action です' }, { status: 400 });
  } catch (err: any) {
    console.error('[TODO API] POST Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
