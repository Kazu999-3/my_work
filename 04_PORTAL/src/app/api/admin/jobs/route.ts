import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '../../../../lib/adminAuth';

// サーバーサイド用クライアント（サービスキーを使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// Vercel本番環境の検知
// Vercel上ではローカルのPythonスクリプトを実行できないため、
// IS_VERCEL=true の場合はジョブ起動を拒否し案内を返す
// ============================================================
// Windows環境、または明示的なローカル強制フラグがある場合はVercel環境ではないと判定する
const IS_VERCEL = (process.platform === 'win32' || process.env.PORTAL_FORCE_LOCAL === 'true')
  ? false
  : !!process.env.VERCEL;

// ワークスペースのルートを特定する（ポータルの1つ上のディレクトリ）
// ローカル開発: d:/my_work/04_PORTAL/../ → d:/my_work/
// 環境変数 MY_WORK_DIR が設定されていればそちらを優先する
const WORKSPACE_DIR = process.env.MY_WORK_DIR
  ? process.env.MY_WORK_DIR
  : path.resolve(process.cwd(), '../');

const PYTHON_PATH = path.join(WORKSPACE_DIR, '.venv/Scripts/python.exe');

interface JobConfig {
  script: string;
  lock: string;
  log: string;
  name: string;
}

// ============================================================
// ジョブ定義：全て WORKSPACE_DIR からの相対パスで記述
// ============================================================
const JOBS: Record<string, JobConfig> = {
  youtube_absorber: {
    script: '03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.py',
    lock:   '03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.lock',
    log:    '00_LOGS/youtube_absorber_run.log',
    name:   'YouTube動画解析'
  },
  dict_synthesizer: {
    script: '03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.py',
    lock:   '03_SYSTEMS/v2_CORE/_LOL/dict_synthesizer.lock',
    log:    '00_LOGS/dict_synthesizer_run.log',
    name:   '総合辞典マージ'
  },
  research_scout: {
    script: '03_SYSTEMS/v2_CORE/_MONETIZE/research_scout.py',
    lock:   '03_SYSTEMS/v2_CORE/_MONETIZE/research_scout.lock',
    log:    '00_LOGS/research_scout_run.log',
    name:   'トレンド自動リサーチ'
  },
  idea_generator: {
    script: '03_SYSTEMS/v2_CORE/_MONETIZE/idea_generator.py',
    lock:   '03_SYSTEMS/v2_CORE/_MONETIZE/idea_generator.lock',
    log:    '00_LOGS/idea_generator_run.log',
    name:   '記事ネタ自動提案'
  },
  evolution: {
    script: '03_SYSTEMS/v2_CORE/_MONETIZE/evolution.py',
    lock:   '03_SYSTEMS/v2_CORE/_MONETIZE/evolution.lock',
    log:    '00_LOGS/evolution_run.log',
    name:   'AI自己進化プロンプト更新'
  },
  monetization_batch: {
    script: '03_SYSTEMS/v2_CORE/monetization_batch.py',
    lock:   '03_SYSTEMS/v2_CORE/monetization_batch.lock',
    log:    '00_LOGS/monetization_batch_run.log',
    name:   'アフィリエイト一気通貫バッチ'
  },
  champion_db_bulk_update: {
    script: '03_SYSTEMS/v2_CORE/_LOL/champ_db_bulk_updater.py',
    lock:   '03_SYSTEMS/v2_CORE/_LOL/champ_db_bulk_updater.lock',
    log:    '00_LOGS/champion_db_bulk_update_run.log',
    name:   'チャンピオン辞典一括更新'
  }
};

// ============================================================
// GET: 全ジョブのステータス＆ログ取得
// ============================================================
export async function GET(req: NextRequest) {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
  // Vercel環境では常にIDLE状態を返す（ログは取得不可）
  if (IS_VERCEL) {
    const result: Record<string, { name: string; isRunning: boolean; vercelMode: boolean }> = {};
    for (const [key, config] of Object.entries(JOBS)) {
      result[key] = { name: config.name, isRunning: false, vercelMode: true };
    }
    return NextResponse.json(result);
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetJob = searchParams.get('job');

    if (targetJob) {
      const config = JOBS[targetJob];
      if (!config) {
        return NextResponse.json({ error: '無効なジョブ名です。' }, { status: 400 });
      }

      const lockPath = path.join(WORKSPACE_DIR, config.lock);
      const logPath  = path.join(WORKSPACE_DIR, config.log);
      const isRunning = fs.existsSync(lockPath);

      let logs = '';
      if (fs.existsSync(logPath)) {
        const fileContent = fs.readFileSync(logPath, 'utf-8');
        logs = fileContent.split('\n').slice(-100).join('\n');
      } else {
        logs = '実行履歴はありません。';
      }

      return NextResponse.json({ job: targetJob, name: config.name, isRunning, logs });
    }

    // クエリ指定がない場合は全ジョブの簡易ステータスを返す
    const result: Record<string, { name: string; isRunning: boolean }> = {};
    for (const [key, config] of Object.entries(JOBS)) {
      const lockPath = path.join(WORKSPACE_DIR, config.lock);
      result[key] = { name: config.name, isRunning: fs.existsSync(lockPath) };
    }
    return NextResponse.json(result);

  } catch (err: any) {
    console.error('❌ [Jobs API] GET Error:', err);
    return NextResponse.json({ error: 'ステータスの取得に失敗しました。' }, { status: 500 });
  }
}

// ============================================================
// POST: 指定ジョブの実行
// ============================================================
export async function POST(req: NextRequest) {
  // ===== 管理者セッション確認 =====
  // GET側には認証があるのにジョブを実際に起動するPOST側に無かったため追加。
  // 未認証のままだと誰でもバッチジョブ（Python実行/エッジタスク起票）を起動できてしまう。
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
  try {
    const { job, args = [] } = await req.json();

    if (!job || !JOBS[job]) {
      return NextResponse.json({ error: '無効または未指定のジョブ名です。' }, { status: 400 });
    }

    // Vercel本番環境ではPythonスクリプトを実行できないため、エッジタスクとして登録
    if (IS_VERCEL) {
      try {
        const { enqueueEdgeTask } = await import('../../../../lib/edgeTask');
        const task = await enqueueEdgeTask(job, { args });
        return NextResponse.json({
          success: true,
          message: `ローカルエッジワーカーへジョブ「${JOBS[job].name}」の実行要求を送信しました。`,
          task
        });
      } catch (error: any) {
        console.error('❌ [Jobs API] failed to insert edge task:', error);
        return NextResponse.json({ error: `ローカルエッジワーカーへのタスク起票に失敗しました。詳細: ${error.message}` }, { status: 500 });
      }
    }

    const config     = JOBS[job];
    const scriptPath = path.join(WORKSPACE_DIR, config.script);
    const lockPath   = path.join(WORKSPACE_DIR, config.lock);
    const logPath    = path.join(WORKSPACE_DIR, config.log);

    // デバッグ用：パスを確認
    console.log(`[Jobs API] WORKSPACE_DIR: ${WORKSPACE_DIR}`);
    console.log(`[Jobs API] scriptPath: ${scriptPath}`);
    console.log(`[Jobs API] exists: ${fs.existsSync(scriptPath)}`);

    // スクリプトの存在チェック
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        {
          error: `スクリプトファイルが存在しません: ${config.script}`,
          debug: { WORKSPACE_DIR, scriptPath },
        },
        { status: 404 }
      );
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

    const runArgs  = [scriptPath, ...args];
    // PYTHONPATHは必ず絶対パスで設定する
    const env      = { ...process.env, PYTHONPATH: path.join(WORKSPACE_DIR, '03_SYSTEMS') };
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
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
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
