import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// アフィリエイトリンクJSONファイルの絶対パス解決
const affiliateFilePath = path.resolve('d:/my_work/02_FACTORY/affiliate_links.json');

export async function GET() {
  try {
    // 1. アフィリエイトリンク設定のロード
    let links = {};
    if (fs.existsSync(affiliateFilePath)) {
      try {
        const fileContent = fs.readFileSync(affiliateFilePath, 'utf-8');
        links = JSON.parse(fileContent);
      } catch (err: any) {
        console.error('Failed to parse affiliate_links.json:', err);
      }
    } else {
      // 初期値として空のJSONファイルを作成
      const defaultLinks = {
        "Canva": "https://px.a8.net/svt/ejd?a8mat=YOUR_CANVA_A8_LINK",
        "Notion": "https://notion.grsm.io/YOUR_NOTION_LINK",
        "ChatGPT": "https://openai.com/YOUR_CHATGPT_LINK"
      };
      fs.mkdirSync(path.dirname(affiliateFilePath), { recursive: true });
      fs.writeFileSync(affiliateFilePath, JSON.stringify(defaultLinks, null, 2), 'utf-8');
      links = defaultLinks;
    }

    // 2. データベース（bible_articles）からITツールアフィリエイト記事をフェッチ
    // keywords 配列に 'ITツール' または 'アフィリエイト' を含むものを取得
    // postgres 配列フィルタは ?select=*&keywords=cs.{ITツール} のような形式で指定可能だが、
    // ここでは安全に全攻略記事を取得して JavaScript 側でフィルタリングする
    const { data: articles, error } = await supabase
      .from('bible_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const filteredArticles = (articles || []).filter(art => {
      const kws = art.keywords || [];
      return kws.includes('ITツール') || kws.includes('アフィリエイト');
    });

    return NextResponse.json({
      success: true,
      links,
      articles: filteredArticles
    });

  } catch (error: any) {
    console.error('Affiliate API GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action パラメータが不足しています。' }, { status: 400 });
    }

    // A. アフィリエイトリンクの保存
    if (action === 'save_links') {
      const { links } = body;
      if (!links || typeof links !== 'object') {
        return NextResponse.json({ error: '無効な links データです。' }, { status: 400 });
      }

      fs.mkdirSync(path.dirname(affiliateFilePath), { recursive: true });
      fs.writeFileSync(affiliateFilePath, JSON.stringify(links, null, 2), 'utf-8');

      return NextResponse.json({
        success: true,
        message: 'アフィリエイトリンクを保存しました。'
      });
    }

    // B. トレンドツール攻略記事の自律生成のトリガー
    if (action === 'trigger_forge') {
      console.log('[API] Triggering Affiliate Auto-Forge process...');

      // Vercel本本環境などのコマンドライン制限対策
      const pythonPath = process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : 'python3';
      const rootDir = 'd:/my_work';

      // 1. tool_scout.py 実行
      const env = { ...process.env, PYTHONPATH: '03_SYSTEMS' };
      try {
        console.log('[API] Running tool_scout.py...');
        const scoutCmd = `${pythonPath} 03_SYSTEMS/v2_CORE/tool_scout.py`;
        await execPromise(scoutCmd, { cwd: rootDir, env });
        
        console.log('[API] Running tool_forge.py...');
        const forgeCmd = `${pythonPath} 03_SYSTEMS/v2_CORE/tool_forge.py`;
        const { stdout, stderr } = await execPromise(forgeCmd, { cwd: rootDir, env });
        
        console.log('[API] Auto-Forge completed. stdout:', stdout);
        if (stderr) console.warn('[API] Auto-Forge stderr:', stderr);

        // 再生成された記事を取得
        const { data: articles, error } = await supabase
          .from('bible_articles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const filteredArticles = (articles || []).filter(art => {
          const kws = art.keywords || [];
          return kws.includes('ITツール') || kws.includes('アフィリエイト');
        });

        return NextResponse.json({
          success: true,
          message: 'トレンド記事の自律生成が完了しました！',
          articles: filteredArticles
        });

      } catch (execErr: any) {
        console.error('[API] Script execution failed:', execErr);
        return NextResponse.json({ 
          error: `スクリプト実行エラー: ${execErr.message}\nローカル環境または.venv環境が正しくセットアップされていない可能性があります。` 
        }, { status: 500 });
      }
    }

    // C. 一気通貫アフィリエイトバッチのトリガー
    if (action === 'trigger_batch') {
      const dryRun = body.dryRun === true;
      console.log(`[API] Triggering Monetization Batch (One-stop Publish) process (dryRun: ${dryRun})...`);

      const pythonPath = process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : 'python3';
      const rootDir = 'd:/my_work';
      const env = { ...process.env, PYTHONPATH: '03_SYSTEMS' };

      try {
        console.log('[API] Running monetization_batch.py...');
        const batchCmd = `${pythonPath} 03_SYSTEMS/v2_CORE/monetization_batch.py${dryRun ? ' --dry-run' : ''}`;
        const { stdout, stderr } = await execPromise(batchCmd, { cwd: rootDir, env });

        console.log('[API] Monetization Batch completed. stdout:', stdout);
        if (stderr) console.warn('[API] Monetization Batch stderr:', stderr);

        // 生成・投稿後に記事リストを再フェッチ
        const { data: articles, error } = await supabase
          .from('bible_articles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const filteredArticles = (articles || []).filter(art => {
          const kws = art.keywords || [];
          return kws.includes('ITツール') || kws.includes('アフィリエイト');
        });

        return NextResponse.json({
          success: true,
          message: dryRun 
            ? '一気通貫アフィリエイトバッチのテスト実行（ドライラン）が完了しました！（実際の投稿はスキップされました）'
            : '一気通貫アフィリエイトバッチの実行が完了しました！（note下書き保存 ＆ Xスレッド投稿完了）',
          articles: filteredArticles,
          stdout
        });

      } catch (execErr: any) {
        console.error('[API] Monetization Batch execution failed:', execErr);
        return NextResponse.json({ 
          error: `バッチ実行エラー: ${execErr.message}\nブラウザ環境やPlaywrightセッションが正しく構成されていない可能性があります。` 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: '未知の action です。' }, { status: 400 });

  } catch (error: any) {
    console.error('Affiliate API POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
