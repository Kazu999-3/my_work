import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { LANES, detectLane, mergeArticleIntoLane, RateLimitedError } from '../../../../lib/laneGuideMerge';

// レーン別ガイドの統合。
// 攻略ライブラリのうち「特定チャンピオンの記事ではないもの」＝レーンのマクロ・立ち回りを
// レーンごとに1本の記事へマージしていく。統合済みの記事はライブラリから片付ける。
// 実際の統合ロジック(detectLane/mergeArticleIntoLane)は、knowledge/add/route.tsの
// atomic insight単位のレーン振り分けからも使えるよう、lib/laneGuideMerge.tsへ
// 切り出し済み(2026-08-15)。route.tsはGET/POST等の決まったexport以外を外から
// 安全にimportできないため、ここでは再exportせずlibを直接参照する。
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CHUNK = 3; // 1リクエストで統合する記事数（AI呼び出しが重いため）

/**
 * 保存済みガイドの取得。
 * 以前は「メンバー閲覧用」としてGET認証不要のつもりだったが、パスが/api/admin/配下の
 * ためproxy.tsのグローバルCookieゲートに巻き込まれ、実際には未ログイン者は問答無用で
 * 401になっていた。呼び出し元(app/lane-guides/page.tsx)もHTTPステータスを見ずに
 * data.guidesを読むため、401時はguides=[]となり「まだガイドが作成されていません」と
 * 誤表示していた(2026-08-05発覚)。実態と意図が食い違っていたため、ここでは
 * 「管理者専用」の設計に寄せて明示的な認証チェックを追加し、ページ側も認証状態に
 * 応じたガードを行うように変更する。
 */
export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const { data, error } = await supabase
      .from('lane_guides')
      .select('lane, title, body, source_count, updated_at');
    if (error) throw error;
    return NextResponse.json({ success: true, guides: data || [], lanes: LANES });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // ===== 管理者セッション or CRON_SECRET(日次自動整備用) =====
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const auth = await verifyAdminSession(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let action = 'merge';
  try {
    const body = await req.clone().json();
    action = body?.action || 'merge';
  } catch { /* ボディ無しは従来どおり統合 */ }

  // 復旧: 保存されないまま片付けられてしまったレーン記事をライブラリへ戻す。
  // チャンピオン記事は champion_notes へ正常に移動している可能性があるため対象外にする。
  if (action === 'restore') {
    try {
      const { data: facts } = await supabase.from('champion_facts').select('champion');
      const realChampions = new Set((facts || []).map((f: any) => String(f.champion).toLowerCase()));
      const { data: archived } = await supabase
        .from('personal_knowledge')
        .select('id, title, champion')
        .contains('tags', ['__DELETED__'])
        .limit(1000);

      const restorable = (archived || []).filter((a: any) => {
        const names = String(a.champion || '').split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean);
        return !names.some((n) => realChampions.has(n));
      });

      if (restorable.length > 0) {
        const { error } = await supabase
          .from('personal_knowledge')
          .update({ tags: [] })
          .in('id', restorable.map((a: any) => a.id));
        if (error) throw error;
      }

      return NextResponse.json({
        success: true,
        restored: restorable.length,
        message: `${restorable.length}件のレーン記事を攻略ライブラリに戻しました。`,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // 記事を1本だけ、指定したレーンのガイドへ送る。
  // 一括統合は自動判定なので、狙ったレーンへ入れたい場合はこちらを使う。
  if (action === 'merge_one') {
    try {
      const { articleId, lane: requestedLane } = await req.clone().json();
      if (!articleId) return NextResponse.json({ error: 'articleIdが必要です' }, { status: 400 });

      const { data: article } = await supabase
        .from('personal_knowledge')
        .select('id, title, content, raw_content, champion')
        .eq('id', articleId)
        .maybeSingle();
      if (!article) return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 });

      // レーン未指定なら自動判定に任せる
      const lane = requestedLane && LANES.some((l) => l.key === requestedLane)
        ? requestedLane
        : detectLane(article);

      const merged = await mergeArticleIntoLane(article, lane);
      return NextResponse.json({
        success: true,
        lane,
        laneLabel: LANES.find((l) => l.key === lane)?.label || lane,
        title: merged.title,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  try {
    // 1) チャンピオン記事ではない＝レーン/マクロ記事を集める
    // review_status='approved'のみが対象。atomic insight分解(2026-08-15〜)は分割その
    // ものを人間が確認するまでpendingで保存されるため、未承認のまま一括統合されて
    // しまわないようここで弾く。
    const { data: articles } = await supabase
      .from('personal_knowledge')
      .select('id, title, content, raw_content, champion, genre')
      .or('tags.is.null,tags.not.cs.{__DELETED__}')
      .eq('review_status', 'approved')
      .limit(500);

    // champion欄が空 or 実在しないチャンピオン名（Jungle/macro等）のものが対象
    const { data: facts } = await supabase.from('champion_facts').select('champion');
    const realChampions = new Set((facts || []).map((f: any) => String(f.champion).toLowerCase()));
    const isChampionArticle = (a: any) => {
      const names = String(a.champion || '').split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean);
      return names.some((n) => realChampions.has(n));
    };

    const targets = (articles || [])
      .filter((a: any) => !isChampionArticle(a))
      .filter((a: any) => (a.raw_content || a.content || '').length >= 200);

    if (targets.length === 0) {
      // なぜ0件なのかが分からないと詰まるので、内訳を返す
      const total = (articles || []).length;
      const champArticles = (articles || []).filter(isChampionArticle).length;
      const tooShort = (articles || []).filter((a: any) => !isChampionArticle(a) && (a.raw_content || a.content || '').length < 200).length;
      return NextResponse.json({
        success: true, merged: 0, remaining: 0, done: true,
        message: `統合対象のレーン記事はありません（ライブラリ内 ${total}件: チャンピオン記事 ${champArticles}件 / 本文200字未満 ${tooShort}件）。`,
        debug: { total, champArticles, tooShort },
      });
    }

    const batch = targets.slice(0, CHUNK);
    const remaining = Math.max(0, targets.length - batch.length);
    const mergedLanes: string[] = [];

    // 2) レーンごとに既存ガイドへ追記マージ
    for (const a of batch) {
      const lane = detectLane(a);
      try {
        await mergeArticleIntoLane(a, lane);
      } catch (err) {
        if (err instanceof RateLimitedError) {
          // ここまでの成果は返し、次回は続きから再開する
          return NextResponse.json({
            success: true,
            merged: mergedLanes.length,
            lanes: mergedLanes,
            remaining: remaining + (batch.length - mergedLanes.length),
            done: false,
            rateLimited: true,
          });
        }
        throw err;
      }
      mergedLanes.push(lane);
    }

    return NextResponse.json({
      success: true,
      merged: mergedLanes.length,
      lanes: mergedLanes,
      remaining,
      done: remaining === 0,
    });
  } catch (e: any) {
    console.error('[lane-guides] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
