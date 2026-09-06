import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

let overlayProcess: any = null;

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

      const scriptPath = path.resolve(process.cwd(), '..', '03_SYSTEMS', 'v2_CORE', '_LOL', 'overlay', 'run_overlay.py');
      const venvPython = path.resolve(process.cwd(), '..', '.venv', 'Scripts', 'python.exe');

      const args = [scriptPath];
      if (action === 'demo') {
        args.push('--demo');
      }

      overlayProcess = spawn(venvPython, args, {
        cwd: path.resolve(process.cwd(), '..'),
        detached: true,
        stdio: 'ignore'
      });

      overlayProcess.unref();

      overlayProcess.on('exit', () => {
        overlayProcess = null;
      });

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
