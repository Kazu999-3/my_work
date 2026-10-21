import { NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { spawn } from 'child_process';

// 管理画面からPCローカルのリプレイ取り込みスクリプトを安全にキックするAPI
export const dynamic = 'force-dynamic';

export type ImportStatus = {
  running: boolean;
  matchId: string | null;
  phase: 'idle' | 'starting' | 'capturing' | 'tracking' | 'uploading' | 'completed' | 'failed';
  message: string;
  startedAt: number | null;
  logs: string[];
};

const globalState = globalThis as unknown as {
  _replayImportState?: ImportStatus;
};

if (!globalState._replayImportState) {
  globalState._replayImportState = {
    running: false,
    matchId: null,
    phase: 'idle',
    message: '',
    startedAt: null,
    logs: [],
  };
}

export async function GET(request: Request) {
  const auth = await verifyAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  return NextResponse.json(globalState._replayImportState);
}

export async function POST(request: Request) {
  const auth = await verifyAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });

  const state = globalState._replayImportState!;
  if (state.running) {
    return NextResponse.json({ error: '現在別の試合を取り込み中です', status: state }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const matchId = (body.matchId || '').trim();
  const minutes = Number(body.minutes) || 0;

  if (!/^[A-Z0-9]+_\d+$/.test(matchId)) {
    return NextResponse.json({ error: '試合IDの形式が正しくありません（例: JP1_608213185）' }, { status: 400 });
  }

  state.running = true;
  state.matchId = matchId;
  state.phase = 'starting';
  state.message = 'リプレイ取り込みの準備中...';
  state.startedAt = Date.now();
  state.logs = [`[${new Date().toLocaleTimeString('ja-JP')}] 試合 ${matchId} の取り込みを開始します`];

  const pythonExe = 'd:/my_work/.venv/Scripts/python.exe';
  const scriptPath = 'd:/my_work/scripts/replay_paths.py';
  const args = [scriptPath, matchId, '--upload'];
  if (minutes > 0) {
    args.push('--minutes', String(minutes));
  }

  const child = spawn(pythonExe, args, {
    cwd: 'd:/my_work',
    env: process.env,
    shell: false,
  });

  const appendLog = (chunk: Buffer) => {
    const text = chunk.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      state.logs.push(line);
      if (state.logs.length > 60) state.logs.shift();

      if (line.includes('撮影用設定に切り替え')) {
        state.phase = 'starting';
        state.message = 'ゲーム画面設定を一時切り替え中...';
      } else if (line.includes('リプレイを開く') || line.includes('撮影: 0〜')) {
        state.phase = 'capturing';
        state.message = 'リプレイを再生・ミニマップ撮影中（※ゲームを手前にしてください）...';
      } else if (line.includes('追跡にかかった時間') || line.includes('Tracker') || line.includes('精度')) {
        state.phase = 'tracking';
        state.message = '移動経路の解析・追跡中...';
      } else if (line.includes('アップロード')) {
        state.phase = 'uploading';
        state.message = 'Supabaseへアップロード中...';
      }
    }
  };

  child.stdout.on('data', appendLog);
  child.stderr.on('data', appendLog);

  child.on('close', (code) => {
    state.running = false;
    if (code === 0) {
      state.phase = 'completed';
      state.message = '取り込みが正常に完了しました！';
      state.logs.push(`[${new Date().toLocaleTimeString('ja-JP')}] 正常完了`);
    } else {
      state.phase = 'failed';
      // 直近のエラーメッセージ行を探して表示
      const lastErrorLine = [...state.logs].reverse().find((l) =>
        l.includes('失敗') || l.includes('エラー') || l.includes('SystemExit') || l.includes('Error') || l.includes('一致しません') || l.includes('開けません')
      );
      const cleanReason = lastErrorLine ? lastErrorLine.replace(/^.*SystemExit:\s*/, '').trim() : '';
      state.message = cleanReason
        ? `エラー: ${cleanReason}`
        : `取り込み中にエラーが発生しました（終了コード ${code}）`;
      state.logs.push(`[${new Date().toLocaleTimeString('ja-JP')}] 終了コード ${code} で失敗`);
    }
  });

  child.on('error', (err) => {
    state.running = false;
    state.phase = 'failed';
    state.message = `プロセス起動エラー: ${err.message}`;
    state.logs.push(`[${new Date().toLocaleTimeString('ja-JP')}] エラー: ${err.message}`);
  });

  return NextResponse.json({ success: true, message: '取り込みを開始しました', status: state });
}
