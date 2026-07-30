import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// scripts/edge_cloud_worker.py (GitHub Actions, 本来は5分おきポーリング)が
// 実際に処理してくれるタスク種別。この一覧に無いもの(youtube_absorb・
// champion_db_bulk_update)は専用の定期ワークフローが別途担当しているため、
// ここから即時起動しても意味が無い。
const EDGE_CLOUD_WORKER_TASK_TYPES = new Set([
  'champion_trend', 'resolve_youtube_channel',
  'resolve_youtube_playlist', 'youtube_channel_monitor', 'reddit_scout',
  'lol_trend_collect', 'dict_synthesizer',
]);

/**
 * Supabase の edge_tasks テーブルへタスクを追加し、エッジワーカーを即座にトリガーします。
 *
 * トリガー経路は2つ:
 * 1. ローカル API ゲートウェイへの Webhook通知（ローカル開発時のみ到達可能）
 * 2. GitHub Actions の edge-cloud-worker.yml を workflow_dispatch で直接起動（本番Vercelから）
 *    ― 本来5分おきポーリングのはずが、GitHub Actions側の実行間隔が実際には
 *    1〜2時間程度まで間延びすることがあるため、キュー投入の瞬間に直接起動して
 *    次の定期実行を待たずに処理させる。GH_ACTIONS_TOKEN が未設定の場合は
 *    従来通りポーリング任せにフォールバックする。
 * どちらも失敗してもエラーにはせず、通常のポーリングにフォールバックします。
 */
export async function enqueueEdgeTask(taskType: string, payload: any = {}) {
  const { data, error } = await supabase
    .from('edge_tasks')
    .insert({
      task_type: taskType,
      payload: payload,
      status: 'pending'
    })
    .select();

  if (error) {
    throw error;
  }

  // ANTIGRAVITY_API_KEY未設定時はGateway側がどのみち拒否するため、
  // 既知の共有デフォルト値へフォールバックせずリクエスト自体を送らない。
  const apiKey = process.env.ANTIGRAVITY_API_KEY;
  if (apiKey) {
    const gatewayUrl = 'http://127.0.0.1:8000/api/v1/worker/notify';
    // バックグラウンドで即時トリガー通知を送信（エラーは無視）
    fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Antigravity-Key': apiKey
      }
    }).catch(() => {
      // ローカル環境未起動またはVercel本番からの呼び出し失敗時は自動で60秒の通常ポーリングへ委ねる
    });
  }

  const ghToken = process.env.GH_ACTIONS_TOKEN;
  if (ghToken && EDGE_CLOUD_WORKER_TASK_TYPES.has(taskType)) {
    try {
      await fetch('https://api.github.com/repos/Kazu999-3/my_work/actions/workflows/edge-cloud-worker.yml/dispatches', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'master' }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // 失敗しても従来通りのポーリングに任せる（このタスク自体の登録は既に成功済み）
    }
  }

  return data ? data[0] : null;
}
