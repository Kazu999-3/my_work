import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const WORKSPACE_DIR = path.resolve(process.cwd(), '../');
const PYTHON_PATH = path.join(WORKSPACE_DIR, '.venv/Scripts/python.exe');
const SCRIPT_PATH = path.join(WORKSPACE_DIR, '03_SYSTEMS/v2_CORE/_MONETIZE/knowledge_processor.py');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey
);

export async function POST(req: NextRequest) {
  try {
    const { url, text } = await req.json();

    if (!url && !text) {
      return NextResponse.json({ error: 'URLまたはメモテキストを入力してください。' }, { status: 400 });
    }

    const args = [SCRIPT_PATH];
    if (url) {
      args.push('--url', url);
    } else if (text) {
      args.push('--text', text);
    }

    const env = { ...process.env, PYTHONPATH: path.join(WORKSPACE_DIR, '03_SYSTEMS') };

    const resultJson = await new Promise<string>((resolve, reject) => {
      const child = spawn(PYTHON_PATH, args, { cwd: WORKSPACE_DIR, env });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python process exited with code ${code}. Stderr: ${stderr}`));
        }
      });
    });

    const parsedResult = JSON.parse(resultJson.trim());
    if (parsedResult.error) {
      return NextResponse.json({ error: parsedResult.error }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('personal_knowledge')
      .insert([{
        title: parsedResult.title,
        content: parsedResult.summary,
        raw_content: parsedResult.raw_content,
        source_url: parsedResult.source_url,
        genre: parsedResult.genre,
        tags: parsedResult.tags
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `ナレッジ「${parsedResult.title}」を分類・登録しました。`,
      data
    });

  } catch (err: any) {
    console.error('❌ [Knowledge Add API] POST Error:', err);
    return NextResponse.json({ error: err.message || 'ナレッジの処理に失敗しました。' }, { status: 500 });
  }
}
