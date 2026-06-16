import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const WORKSPACE_DIR = path.resolve(process.cwd(), '../');
const PYTHON_PATH = path.join(WORKSPACE_DIR, '.venv/Scripts/python.exe');

interface JobConfig {
  script: string;
  lock: string;
  log: string;
  name: string;
}

const JOBS: Record<string, JobConfig> = {
  youtube_absorber: {
    script: '03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.py',
    lock: '03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.lock',
    log: '00_LOGS/youtube_absorber_run.log',
    name: 'YouTube動画解析'
  },
  dict_synthesizer: {
    script: '03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py',
    lock: '03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.lock',
    log: '00_LOGS/dict_synthesizer_run.log',
    name: '総合辞典マージ'
  },
  research_scout: {
    script: '03_SYSTEMS/v2_CORE/_MONETIZE/research_scout.py',
    lock: '03_SYSTEMS/v2_CORE/_MONETIZE/research_scout.lock',
    log: '00_LOGS/research_scout_run.log',
    name: 'トレンド自動リサーチ'
  },
  evolution: {
    script: '03_SYSTEMS/v2_CORE/_MONETIZE/evolution.py',
    lock: '03_SYSTEMS/v2_CORE/_MONETIZE/evolution.lock',
    log: '00_LOGS/evolution_run.log',
    name: 'AI自己進化プロンプト更新'
  },
  monetization_batch: {
    script: '03_SYSTEMS/v2_CORE/monetization_batch.py',
    lock: '03_SYSTEMS/v2_CORE/monetization_batch.lock',
    log: '00_LOGS/monetization_batch_run.log',
    name: 'アフィリエイト一気通貫バッチ'
  }
};

// 1. 全ジョブの実行ステータス及び直近ログの取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetJob = searchParams.get('job');

    if (targetJob) {
      const config = JOBS[targetJob];
      if (!config) {
        return NextResponse.json({ error: '無効なジョブ名です。' }, { status: 400 });
      }

      const lockPath = path.join(WORKSPACE_DIR, config.lock);
      const logPath = path.join(WORKSPACE_DIR, config.log);
      const isRunning = fs.existsSync(lockPath);

      let logs = '';
      if (fs.existsSync(logPath)) {
        const fileContent = fs.readFileSync(logPath, 'utf-8');
        logs = fileContent.split('\n').slice(-100).join('\n');
      } else {
        logs = '実行履歴はありません。';
      }

      return NextResponse.json({
        job: targetJob,
        name: config.name,
        isRunning,
        logs
      });
    }

    // クエリ指定がない場合は全ジョブの簡易ステータスを返す
    const result: Record<string, { name: string; isRunning: boolean }> = {};
    for (const [key, config] of Object.entries(JOBS)) {
      const lockPath = path.join(WORKSPACE_DIR, config.lock);
      result[key] = {
        name: config.name,
        isRunning: fs.existsSync(lockPath)
      };
    }

    return NextResponse.json(result);

  } catch (err: any) {
    console.error('❌ [Jobs API] GET Error:', err);
    return NextResponse.json({ error: 'ステータスの取得に失敗しました。' }, { status: 500 });
  }
}

// 2. 指定ジョブの実行
export async function POST(req: NextRequest) {
  try {
    const { job, args = [] } = await req.json();

    if (!job || !JOBS[job]) {
      return NextResponse.json({ error: '無効または未指定のジョブ名です。' }, { status: 400 });
    }

    const config = JOBS[job];
    const scriptPath = path.join(WORKSPACE_DIR, config.script);
    const lockPath = path.join(WORKSPACE_DIR, config.lock);
    const logPath = path.join(WORKSPACE_DIR, config.log);

    // スクリプトの存在チェック
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: `スクリプトファイルが存在しません: ${config.script}` }, { status: 404 });
    }

    // 二重起動防止
    if (fs.existsSync(lockPath)) {
      return NextResponse.json({ error: `ジョブ「${config.name}」はすでに実行中です。` }, { status: 400 });
    }

    // ロックファイルとログディレクトリの作成
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, String(process.pid), 'utf-8');

    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, `[${new Date().toLocaleString()}] ジョブ「${config.name}」を手動起動します...\n`, 'utf-8');

    const runArgs = [scriptPath, ...args];
    const env = { ...process.env, PYTHONPATH: path.join(WORKSPACE_DIR, '03_SYSTEMS') };

    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    // 非同期でPythonスクリプトを実行し、標準入出力をログにリダイレクトする
    const child = spawn(PYTHON_PATH, runArgs, {
      cwd: WORKSPACE_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on('close', (code) => {
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
        }
        const finishMsg = `\n[${new Date().toLocaleString()}] ジョブが終了しました (終了コード: ${code})\n`;
        fs.appendFileSync(logPath, finishMsg, 'utf-8');
      } catch (err) {
        console.error(`❌ ジョブ「${config.name}」のロックファイル削除エラー:`, err);
      }
    });

    return NextResponse.json({
      success: true,
      message: `ジョブ「${config.name}」をバックグラウンドで起動しました。`
    });

  } catch (err: any) {
    console.error('❌ [Jobs API] POST Error:', err);
    return NextResponse.json({ error: `ジョブの起動に失敗しました: ${err.message}` }, { status: 500 });
  }
}
