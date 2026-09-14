import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

export interface MentorshipReviewSummary {
  targetDiscordId: string;
  targetRoleType: 'PUPIL' | 'MENTOR';
  averageRating: number;
  totalReviews: number;
  topTags: { tag: string; count: number }[];
}

/**
 * GET: 師弟の匿名レビュー集計を取得
 * クエリパラメータ:
 *  - targetDiscordId: 対象のDiscord ID（指定時は1ユーザーの集計）
 *  - targetRoleType: 'PUPIL' | 'MENTOR'
 *  - matchId: 指定時は自分がこのマッチで既にレビュー送信済みかを判定
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDiscordId = searchParams.get('targetDiscordId');
    const targetRoleType = searchParams.get('targetRoleType');
    const matchId = searchParams.get('matchId');

    const session = await getAuthSession();
    const myDiscordId = session?.discordId;

    let hasReviewed = false;
    if (matchId && myDiscordId) {
      const { data: myRev } = await supabase
        .from('mentorship_reviews')
        .select('id')
        .eq('match_id', matchId)
        .eq('reviewer_discord_id', myDiscordId)
        .maybeSingle();
      if (myRev) hasReviewed = true;
    }

    // 全体の集計辞書または特定ユーザーの集計
    let query = supabase.from('mentorship_reviews').select('*');
    if (targetDiscordId) {
      query = query.eq('target_discord_id', targetDiscordId);
    }
    if (targetRoleType) {
      query = query.eq('target_role_type', targetRoleType);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.warn('[mentorship/reviews] select error (fallback empty):', error);
      return NextResponse.json({ ok: true, summaries: {}, hasReviewed });
    }

    // discord_id + role_type ごとに集計
    const summaryMap: Record<string, { totalScore: number; count: number; tagCounts: Record<string, number> }> = {};

    (reviews || []).forEach((r: any) => {
      const key = `${r.target_discord_id}_${r.target_role_type}`;
      if (!summaryMap[key]) {
        summaryMap[key] = { totalScore: 0, count: 0, tagCounts: {} };
      }
      summaryMap[key].totalScore += r.rating;
      summaryMap[key].count += 1;

      if (Array.isArray(r.tags)) {
        r.tags.forEach((tag: string) => {
          summaryMap[key].tagCounts[tag] = (summaryMap[key].tagCounts[tag] || 0) + 1;
        });
      }
    });

    const resultSummaries: Record<string, MentorshipReviewSummary> = {};

    Object.entries(summaryMap).forEach(([key, val]) => {
      const [discordId, roleType] = key.split('_');
      const topTags = Object.entries(val.tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      resultSummaries[key] = {
        targetDiscordId: discordId,
        targetRoleType: roleType as 'PUPIL' | 'MENTOR',
        averageRating: Number((val.totalScore / val.count).toFixed(1)),
        totalReviews: val.count,
        topTags,
      };
    });

    return NextResponse.json({
      ok: true,
      summaries: resultSummaries,
      hasReviewed,
    });
  } catch (err: any) {
    console.error('[mentorship/reviews] GET error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: 師弟の匿名レビューを送信（+100コイン付与）
 */
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    const body = await request.json();
    const { matchId, rating, tags = [], feedbackComment = '' } = body;

    const effectiveDiscordId = session?.discordId || body.reviewerDiscordId;
    if (!effectiveDiscordId) {
      return NextResponse.json({ ok: false, error: 'レビューを送信するにはログインが必要です。' }, { status: 401 });
    }

    if (!matchId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ ok: false, error: 'マッチIDおよび星評価(1〜5)は必須です。' }, { status: 400 });
    }

    // 対象マッチの検証
    const { data: match, error: matchErr } = await supabase
      .from('mentorship_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchErr || !match) {
      return NextResponse.json({ ok: false, error: '該当の師弟マッチが見つかりません。' }, { status: 404 });
    }

    // 送信者がマッチの当事者か確認
    const isMentor = match.mentor_discord_id === effectiveDiscordId;
    const isPupil = match.pupil_discord_id === effectiveDiscordId;

    if (!isMentor && !isPupil) {
      return NextResponse.json({ ok: false, error: 'この師弟ペアの当事者のみが評価を送信できます。' }, { status: 403 });
    }

    const targetDiscordId = isMentor ? match.pupil_discord_id : match.mentor_discord_id;
    const targetRoleType = isMentor ? 'PUPIL' : 'MENTOR';

    // 重複送信チェック
    const { data: existing } = await supabase
      .from('mentorship_reviews')
      .select('id')
      .eq('match_id', matchId)
      .eq('reviewer_discord_id', effectiveDiscordId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: false, error: 'このペアへの評価は既に送信済みです。' }, { status: 400 });
    }

    // レビューの保存
    const { error: insertErr } = await supabase
      .from('mentorship_reviews')
      .insert({
        match_id: matchId,
        reviewer_discord_id: effectiveDiscordId,
        target_discord_id: targetDiscordId,
        target_role_type: targetRoleType,
        rating: Math.min(Math.max(Number(rating), 1), 5),
        tags: Array.isArray(tags) ? tags : [],
        feedback_comment: feedbackComment || '',
      });

    if (insertErr) throw insertErr;

    // 送信者にボーナスコイン (+100コイン) 付与
    let rewardCoins = 0;
    try {
      const player = await findOrCreatePlayer({
        discordId: effectiveDiscordId,
        name: session?.displayName || session?.username || 'Player',
      });
      if (player) {
        const currentCoins = getPlayerCoins(player);
        await updatePlayerCoinsAndInventory({
          player,
          newCoins: currentCoins + 100,
        });
        rewardCoins = 100;
      }
    } catch (coinErr) {
      console.warn('[mentorship/reviews] Coin bonus error:', coinErr);
    }

    return NextResponse.json({
      ok: true,
      message: `⭐ 匿名評価を送信しました！（+${rewardCoins}コイン獲得）`,
      rewardCoins,
    });
  } catch (err: any) {
    console.error('[mentorship/reviews] POST error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
