import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// ============================================================
// 一般ユーザー用: ktm_players の非センシティブ列だけを更新するAPI
//
// migration 12 は「参加(is_active)・希望レーン・NGレーン・Pity・備考」を
// 誰でも編集可能にする設計で、RLS(USING true)+カラム単位のGRANTで実現していた。
// ところが migration 38（セキュリティ強化: 全カラム書き込み放題だったUPDATEポリシーの
// 除去）が "ktm_players public update" ポリシーを丸ごと削除し、再作成しなかったため、
// RLSにUPDATEポリシーが1つも無い状態になり、一般ユーザーの保存(balancer/page.tsx)が
// 常にRLS違反で失敗する回帰が発生していた（2026-08-04発見）。
//
// RLSポリシーで復活させる代わりに、直接アクセスのAPI経由化の方針に合わせてこちらを
// 新設する。管理者専用の全列書き込み(/api/admin/players/save)とは別に、
// 誰でも呼べるが書き込める列は migration 12 と同じ非センシティブ列のみに制限する。
// 行の所有者チェックはしない（migration 12 の「誰でも可」という設計をそのまま踏襲）。
// ============================================================
export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = [
  'is_active', 'role_preferences', 'ng_lane_1', 'ng_lane_2',
  'allow_higher', 'pity', 'off_role_pity', 'metadata',
] as const;

function pick(obj: any, keys: readonly string[]) {
  const out: any = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updates: any[] = Array.isArray(body.updates) ? body.updates : [];
    const targets = updates.filter((p) => p.id !== undefined && p.id !== null);
    if (targets.length === 0) {
      return NextResponse.json({ error: 'updates(id付き)が必要です' }, { status: 400 });
    }

    // metadataは他機能のキャッシュ(playstyle_cache等)も同居する汎用JSONB列のため、
    // フルスナップショットで丸ごと上書きすると、クライアント側の古いスナップショットが
    // サーバー側で後から更新された値(sync-soloq等)を消してしまう事故が起きていた
    // (2026-08-05発覚)。metadataが含まれる場合は、現在のDB値の上に浅くマージしてから
    // 書き込む(呼び出し元は編集対象のキーだけを送る運用に変更済み)。
    const results = await Promise.all(
      targets.map(async (p) => {
        const payload = pick(p, ALLOWED_FIELDS);
        if (payload.metadata !== undefined && payload.metadata !== null) {
          const { data: current } = await supabase.from('ktm_players').select('metadata').eq('id', p.id).maybeSingle();
          payload.metadata = { ...(current?.metadata || {}), ...payload.metadata };
        }
        return supabase.from('ktm_players').update(payload).eq('id', p.id);
      })
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);

    return NextResponse.json({ success: true, updated: targets.length });
  } catch (err: any) {
    console.error('[players/save] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
