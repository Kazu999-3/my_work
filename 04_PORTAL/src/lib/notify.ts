import { supabaseAdmin as supabase } from './supabaseAdmin';
import { sendPushToScope } from '../app/api/push/send/route';

/**
 * 管理者向けポータル通知の共通作成関数。
 *
 * admin_notifications テーブルへの保存（通知履歴・ベルアイコン用）と、
 * "admin" scopeを購読しているブラウザへのプッシュ通知送信を1回でまとめて行う。
 * コーチの日次Cronからも、Python側の自動化(herald経由)からも、この関数(または
 * それを叩く /api/push/notify-admin)を通すことで、通知の対象を増やすたびに
 * 履歴・プッシュの両方が自動的に揃う。
 */
export interface AdminNotificationInput {
  type: string;
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  data?: Record<string, any>;
}

export async function createAdminNotification(input: AdminNotificationInput) {
  const { data: row, error } = await supabase
    .from('admin_notifications')
    .insert({
      type: input.type,
      title: input.title,
      body: input.body || null,
      url: input.url || null,
      data: input.data || null,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('[notify] admin_notifications への保存に失敗:', error);
  }

  try {
    await sendPushToScope('admin', {
      title: input.title,
      body: input.body || '',
      url: input.url || '/coach',
      icon: input.icon,
    });
  } catch (e) {
    console.warn('[notify] Push通知送信に失敗（履歴には記録済み）:', e);
  }

  return row;
}
