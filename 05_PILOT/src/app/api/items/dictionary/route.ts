import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const DICT_PATH = path.resolve(process.cwd(), 'src/data/item_dictionary.json');

function loadDict(): Record<string, string> {
  try {
    if (fs.existsSync(DICT_PATH)) {
      const raw = fs.readFileSync(DICT_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('item_dictionary.json 読み込み失敗:', err);
  }
  return {};
}

function saveDict(data: Record<string, string>) {
  try {
    fs.writeFileSync(DICT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('item_dictionary.json 保存失敗:', err);
  }
}

export async function GET() {
  const dict = loadDict();
  return NextResponse.json({ success: true, dictionary: dict });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = loadDict();

    if (body.deleteKey) {
      // 削除
      delete current[body.deleteKey];
    } else if (body.bulk && typeof body.bulk === 'object') {
      // 一括更新
      for (const [k, v] of Object.entries(body.bulk)) {
        if (typeof k === 'string' && typeof v === 'string' && k.trim() && v.trim()) {
          current[k.trim()] = v.trim();
        }
      }
    } else if (body.key && body.value) {
      // 単一登録
      current[body.key.trim()] = body.value.trim();
    } else {
      return NextResponse.json({ error: '無効なリクエストパラメータです' }, { status: 400 });
    }

    saveDict(current);
    return NextResponse.json({ success: true, dictionary: current });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '保存に失敗しました' }, { status: 500 });
  }
}
