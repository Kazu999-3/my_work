import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const WORKSPACE_DIR = path.resolve(process.cwd(), '../');
const LOG_FILE_PATH = path.join(WORKSPACE_DIR, '00_LOGS/monetization_batch_run.log');
const LOCK_FILE_PATH = path.join(WORKSPACE_DIR, '03_SYSTEMS/v2_CORE/monetization_batch.lock');
const PYTHON_PATH = path.join(WORKSPACE_DIR, '.venv/Scripts/python.exe');
const SCRIPT_PATH = path.join(WORKSPACE_DIR, '03_SYSTEMS/v2_CORE/monetization_batch.py');

// 1. バッチの実行状態とログの取得
export async function GET() {
  try {
    const isRunning = fs.existsSync(LOCK_FILE_PATH);
    
    let logs = '';
    if (fs.existsSync(LOG_FILE_PATH)) {
      // ログファイルの最後の約100行を取得して返す（効率化のため）
      const fileContent = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
      const lines = fileContent.split('\n');
      logs = lines.slice(-200).join('\n');
    } else {
      logs = 'バッチの実行履歴はありません。';
    }

    return NextResponse.json({
      isRunning,
      logs
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Generate API] GET Error:', err);
    return NextResponse.json({ error: 'ステータスの取得に失敗しました。' }, { status: 500 });
  }
}

// 2. バッチの起動
export async function POST(req: NextRequest) {
  try {
    const { dryRun } = await req.json();

    // 二重起動防止
    if (fs.existsSync(LOCK_FILE_PATH)) {
      return NextResponse.json({ error: 'バッチはすでに実行中です。' }, { status: 400 });
    }

    // ロックファイルの作成
    fs.mkdirSync(path.dirname(LOCK_FILE_PATH), { recursive: true });
    fs.writeFileSync(LOCK_FILE_PATH, String(process.pid), 'utf-8');

    // ログファイルの初期化
    fs.mkdirSync(path.dirname(LOG_FILE_PATH), { recursive: true });
    fs.writeFileSync(LOG_FILE_PATH, `[${new Date().toLocaleString()}] monetization_batch.py を起動します...\n`, 'utf-8');

    const args = [SCRIPT_PATH];
    if (dryRun) {
      args.push('--dry-run');
      fs.appendFileSync(LOG_FILE_PATH, '⚠️ ドライランモードで起動中...\n');
    }

    // 非同期でPythonスクリプトを実行
    // PYTHONPATH を 03_SYSTEMS に設定する必要がある（importエラー防止のため）
    const env = { ...process.env, PYTHONPATH: path.join(WORKSPACE_DIR, '03_SYSTEMS') };
    
    const child = spawn(PYTHON_PATH, args, {
      cwd: WORKSPACE_DIR,
      env,
      detached: true,
      stdio: 'ignore' // 親プロセスと完全に切り離すために標準入出力を無視に設定し、内部でリダイレクトするか、あるいはstdoutを拾う
    });

    // detached で起動した場合 stdio: 'ignore' で親が終了しても子が動き続けるようにします。
    // そのため、Python側で独自のログ出力とロックファイル制御をしてもらうのが一番安全ですが、
    // ここではNode.js側でログファイルを追記で開いて直接子の出力をリダイレクトします。
    // spawn に stdio: ['ignore', out, err] を指定すると、Node.jsがログファイルにリダイレクトしてくれます。
    const logStream = fs.createWriteStream(LOG_FILE_PATH, { flags: 'a' });
    
    const redirectChild = spawn(PYTHON_PATH, args, {
      cwd: WORKSPACE_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    redirectChild.stdout.pipe(logStream);
    redirectChild.stderr.pipe(logStream);

    redirectChild.on('close', (code) => {
      // 終了時にロックファイルを削除
      try {
        if (fs.existsSync(LOCK_FILE_PATH)) {
          fs.unlinkSync(LOCK_FILE_PATH);
        }
        const finishMsg = `\n[${new Date().toLocaleString()}] バッチ処理が終了しました (終了コード: ${code})\n`;
        fs.appendFileSync(LOG_FILE_PATH, finishMsg, 'utf-8');
      } catch (err) {
        console.error('❌ ロックファイルの削除に失敗しました:', err);
      }
    });

    // バックグラウンドで非同期実行するため、クライアントには即レスポンスを返す
    return NextResponse.json({
      success: true,
      message: dryRun ? 'アフィリエイトバッチをドライランで起動しました。' : 'アフィリエイトバッチを起動しました。'
    });

  } catch (err: any) {
    console.error('❌ [Affiliate Generate API] POST Error:', err);
    // エラー時はロックファイルをクリーンアップ
    try {
      if (fs.existsSync(LOCK_FILE_PATH)) {
        fs.unlinkSync(LOCK_FILE_PATH);
      }
    } catch (e) {}
    return NextResponse.json({ error: `バッチの起動に失敗しました: ${err.message}` }, { status: 500 });
  }
}
