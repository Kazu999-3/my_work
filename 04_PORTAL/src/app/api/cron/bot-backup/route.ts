import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { createAdminNotification } from '../../../../lib/notify';

// ============================================================
// Bot の定期実行の保険（2026-10-20 追加、migration 115）
//
// Supabase の pg_cron（時間どおりに動く）が、Bot 本命（Cloudflare の cron）の予定時刻の数分後に
// cron_bot_backup() を呼び、本命の記録（bot_cron_runs）が無い時だけここを呼ぶ。
// ここでもう一度記録を確かめてから、Bot の手動実行（/trigger-scheduled、source=pg_cron）を呼ぶ。
// 以前の保険（GitHub Actions）は開始が3〜4時間遅れて間に合っていなかった。
// ============================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const JOB_WINDOW_MINUTES: Record<string, number> = {
  weekly_recruit: 30,
  event_notify: 30,
  check_2000: 20,
};

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const job = params.get('job') || '';
  const windowMinutes = JOB_WINDOW_MINUTES[job];
  if (!windowMinutes) {
    return NextResponse.json({ error: 'unknown job' }, { status: 400 });
  }

  // 見張り（migration 116 の cron_bot_watch）から: 保険の後も成功の記録が無い → 管理者に知らせる
  if (params.get('alert') === '1') {
    return alertMissingRun(job);
  }

  const workerUrl = process.env.BOT_WORKER_URL;
  const triggerKey = process.env.BOT_TRIGGER_KEY;
  if (!workerUrl || !triggerKey) {
    console.error('[bot-backup] BOT_WORKER_URL / BOT_TRIGGER_KEY が未設定です');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  // pg_cron 側の確認から数秒の間に本命が動き出した場合に、二重に送らないよう確かめ直す
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data: recent, error } = await supabase
    .from('bot_cron_runs')
    .select('id')
    .eq('job', job)
    .in('status', ['running', 'success'])
    .gt('started_at', since)
    .limit(1);
  if (error) {
    console.error('[bot-backup] bot_cron_runs の確認に失敗:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (recent && recent.length > 0) {
    return NextResponse.json({ skipped: true, reason: '本命が動いていました' });
  }

  const url = `${workerUrl.replace(/\/$/, '')}/trigger-scheduled?key=${encodeURIComponent(triggerKey)}&mode=${job}&source=pg_cron`;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(50_000) });
    const text = (await res.text()).slice(0, 300);
    if (!res.ok) {
      console.error(`[bot-backup] Bot の手動実行に失敗 (${job}): ${res.status} ${text}`);
      return NextResponse.json({ error: `bot ${res.status}` }, { status: 502 });
    }
    console.warn(`[bot-backup] 本命が動いていなかったため、保険で ${job} を実行しました`);
    return NextResponse.json({ triggered: true, job });
  } catch (err: any) {
    console.error(`[bot-backup] Bot の呼び出しで例外 (${job}):`, err?.message);
    return NextResponse.json({ error: err?.message }, { status: 502 });
  }
}

const JOB_LABELS: Record<string, string> = {
  weekly_recruit: '水曜の募集カード',
  event_notify: '残り枠のお知らせ',
  check_2000: '20:00の開催判定',
};

const SOURCE_LABELS: Record<string, string> = { cloudflare: '本命', pg_cron: '保険', manual: '手動' };

async function alertMissingRun(job: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('bot_cron_runs')
    .select('source, status, detail, started_at')
    .eq('job', job)
    .gt('started_at', since)
    .order('started_at', { ascending: true });
  if (error) {
    console.error('[bot-backup] 見張り: bot_cron_runs の確認に失敗:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lines = (rows || []).map((r: any) => {
    const time = new Date(r.started_at).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
    const reason = r.detail?.reason || r.detail?.message || '';
    return `・${time} ${SOURCE_LABELS[r.source] || r.source}: ${r.status}${reason ? `（${reason}）` : ''}`;
  });
  const label = JOB_LABELS[job] || job;
  await createAdminNotification({
    type: 'bot_cron',
    level: 'error',
    title: `⚠️ Bot の定期実行「${label}」が完了していません`,
    body: [
      '本命（Cloudflare）と保険（pg_cron）のどちらでも、投稿まで終わった記録がありません。Discord のチャンネルを確認してください。',
      lines.length > 0 ? `直近1時間の記録:\n${lines.join('\n')}` : '直近1時間の記録: なし（本命も保険も動いていません）',
    ].join('\n'),
    data: { job },
  });
  return NextResponse.json({ alerted: true, job, runs: lines.length });
}
