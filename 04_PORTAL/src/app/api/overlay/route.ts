import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

let overlayProcess: any = null;

function findPythonAndScript() {
  const possibleRoots = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    'D:/my_work',
    'D:\\my_work'
  ];

  let venvPython: string | null = null;
  let scriptPath: string | null = null;
  let logsDir: string | null = null;

  for (const root of possibleRoots) {
    const py = path.resolve(root, '.venv', 'Scripts', 'python.exe');
    if (!venvPython && fs.existsSync(py)) {
      venvPython = py;
    }
    const sc = path.resolve(root, '03_SYSTEMS', 'v2_CORE', '_LOL', 'overlay', 'run_overlay.py');
    if (!scriptPath && fs.existsSync(sc)) {
      scriptPath = sc;
    }
    const logPath = path.resolve(root, '00_LOGS');
    if (!logsDir && fs.existsSync(logPath)) {
      logsDir = logPath;
    }
  }

  // フォールバック
  if (!venvPython) venvPython = 'D:/my_work/.venv/Scripts/python.exe';
  if (!scriptPath) scriptPath = 'D:/my_work/03_SYSTEMS/v2_CORE/_LOL/overlay/run_overlay.py';
  if (!logsDir) logsDir = 'D:/my_work/00_LOGS';

  return { venvPython, scriptPath, logsDir };
}

export async function GET() {
  const isRunning = overlayProcess !== null && !overlayProcess.killed;
  return NextResponse.json({
    running: isRunning,
    pid: overlayProcess ? overlayProcess.pid : null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    if (action === 'stop') {
      if (overlayProcess && !overlayProcess.killed) {
        overlayProcess.kill('SIGTERM');
        overlayProcess = null;
      }
      return NextResponse.json({ success: true, message: 'オーバーレイを停止しました。' });
    }

    if (action === 'start' || action === 'demo') {
      if (overlayProcess && !overlayProcess.killed) {
        return NextResponse.json({ success: true, message: 'オーバーレイは既に起動中です。', running: true });
      }

      const { venvPython, scriptPath, logsDir } = findPythonAndScript();

      if (!fs.existsSync(venvPython)) {
        return NextResponse.json({ error: `Python実行環境が見つかりません: ${venvPython}` }, { status: 500 });
      }
      if (!fs.existsSync(scriptPath)) {
        return NextResponse.json({ error: `オーバーレイスクリプトが見つかりません: ${scriptPath}` }, { status: 500 });
      }

      const args = [scriptPath];
      if (action === 'demo') {
        args.push('--demo');
      }

      // ログファイルへのリダイレクト
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFile = path.resolve(logsDir, 'overlay.log');
      const outLog = fs.openSync(logFile, 'a');

      const workingDir = path.dirname(path.dirname(path.dirname(scriptPath))); // D:/my_work

      overlayProcess = spawn(venvPython, args, {
        cwd: workingDir,
        detached: true,
        stdio: ['ignore', outLog, outLog]
      });

      overlayProcess.on('error', (err: any) => {
        console.error('オーバーレイプロセス起動エラー:', err);
        overlayProcess = null;
      });

      overlayProcess.on('exit', () => {
        overlayProcess = null;
      });

      overlayProcess.unref();

      return NextResponse.json({
        success: true,
        message: action === 'demo' ? '🎮 オーバーレイ（デモモード）を起動しました！' : '🎮 Sovereign HUD オーバーレイを起動しました！',
        running: true,
        pid: overlayProcess ? overlayProcess.pid : null
      });
    }

    return NextResponse.json({ error: '無効なアクションです。' }, { status: 400 });
  } catch (error: any) {
    console.error('オーバーレイ制御エラー:', error);
    return NextResponse.json({ error: error.message || 'オーバーレイの制御に失敗しました。' }, { status: 500 });
  }
}
