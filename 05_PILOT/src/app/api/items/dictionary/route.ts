import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '@/lib/supabaseClient';

const DICT_PATH = path.resolve(process.cwd(), 'src/data/item_dictionary.json');

function loadLocalDict(): Record<string, string> {
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

function saveLocalDict(data: Record<string, string>) {
  try {
    fs.writeFileSync(DICT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Vercel等の読み取り専用環境では無視
  }
}

export async function GET() {
  try {
    // 1. Supabase ktm_settings (pilot_item_dict) から最優先取得
    if (supabase) {
      const { data, error } = await supabase
        .from('ktm_settings')
        .select('value')
        .eq('key', 'pilot_item_dict')
        .maybeSingle();

      if (!error && data && data.value && typeof data.value === 'object') {
        return NextResponse.json({ success: true, dictionary: data.value });
      }
    }
  } catch (err) {
    console.warn('ktm_settings (pilot_item_dict) 取得フォールバック:', err);
  }

  // 2. ローカルファイルフォールバック
  const dict = loadLocalDict();
  return NextResponse.json({ success: true, dictionary: dict });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let current = loadLocalDict();

    // DBから最新を取得してベースにする
    if (supabase) {
      try {
        const { data } = await supabase
          .from('ktm_settings')
          .select('value')
          .eq('key', 'pilot_item_dict')
          .maybeSingle();
        if (data && data.value && typeof data.value === 'object') {
          current = { ...current, ...data.value };
        }
      } catch {}
    }

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

    // DBへ保存
    if (supabase) {
      await supabase
        .from('ktm_settings')
        .upsert(
          { key: 'pilot_item_dict', value: current, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
    }

    saveLocalDict(current);
    return NextResponse.json({ success: true, dictionary: current });
  } catch (err: any) {
    console.error('dictionary POST エラー:', err);
    return NextResponse.json({ error: err.message || '保存に失敗しました' }, { status: 500 });
  }
}
