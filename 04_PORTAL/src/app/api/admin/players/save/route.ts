import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// ============================================================
// 管理者専用: ktm_players のフル書き込みAPI (課題: RLS/書き込み権限設計)
//
// ktm_players は RLS + カラム単位のGRANTで、anon(ブラウザ直叩き)からは
// 「参加(is_active)・希望レーン(role_preferences)・NGレーン・Pity・備考」など
// 非センシティブな列だけ更新できるように制限する（migration 12）。
// 名前・IGN・discord_id・MMR各種・weight・highest_rank の更新、および
// 新規プレイヤーの追加/削除は、このサーバーAPI（サービスロールキー＝RLSバイパス）
// を管理者セッション認証の上で通す。
// ============================================================


// 管理者だけが書き換えられるフルカラム集合（このAPIはサービスロールなので全列書ける）
const FULL_COLUMNS = [
  'discord_id', 'name', 'ign', 'mmr', 'role_preferences', 'is_active',
  'ng_lane_1', 'ng_lane_2', 'highest_rank',
  'mmr_top', 'mmr_jg', 'mmr_mid', 'mmr_adc', 'mmr_sup',
  'weight', 'allow_higher', 'pity', 'off_role_pity', 'metadata',
  'initial_prefs', // 初期MMR計算の凍結レーン（管理者が手修正できるように）
];

function pick(obj: any, keys: string[]) {
  const out: any = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function POST(req: Request) {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
  try {
    const body = await req.json();
    const updates: any[] = Array.isArray(body.updates) ? body.updates : [];
    const inserts: any[] = Array.isArray(body.inserts) ? body.inserts : [];
    const deletes: (number | string)[] = Array.isArray(body.deletes) ? body.deletes : [];

    // 以前はupdate/insert/deleteをそれぞれ独立したPromise.all/個別クエリで実行しており、
    // 一部だけ失敗してもロールバックされず、どの行が失敗したかも分からなかった。
    // save_ktm_players_batch(RPC)で1つのDBトランザクションにまとめ、
    // 途中で失敗したら全体が自動的にロールバックされるようにする(migration 48)。
    const { error } = await supabase.rpc('save_ktm_players_batch', {
      p_updates: updates.filter((p) => p.id != null).map((p) => ({ ...pick(p, FULL_COLUMNS), id: p.id })),
      p_inserts: inserts.map((p) => pick(p, FULL_COLUMNS)),
      p_deletes: deletes.map((d) => Number(d)),
    });
    if (error) throw new Error(`保存エラー: ${error.message}`);

    return NextResponse.json({ success: true, updated: updates.length, inserted: inserts.length, deleted: deletes.length });
  } catch (err: any) {
    console.error('[admin/players/save] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
