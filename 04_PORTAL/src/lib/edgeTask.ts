import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Supabase の edge_tasks テーブルへタスクを追加し、
 * ローカル API ゲートウェイへ Webhook 通知を送信してエッジワーカーを即座にトリガーします。
 * (ローカルワーカーが未起動、または本番 Vercel から到達不可の場合は、エラーにせず自動で60秒ポーリングにフォールバックします)
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

  const gatewayUrl = 'http://127.0.0.1:8000/api/v1/worker/notify';
  const apiKey = process.env.ANTIGRAVITY_API_KEY || 'default_dev_key_2026';

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

  return data ? data[0] : null;
}
