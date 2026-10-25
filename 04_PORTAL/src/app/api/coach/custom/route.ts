import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '../../../../lib/authGuard';
import { generateCustomCoachReport, getSavedCoachReport, saveCoachReportToStorage } from '../../../../lib/customCoach';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

/**
 * 専属AIコーチカルテの取得 (GET)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const playerName = searchParams.get('playerName');

    if (!playerName) {
      return NextResponse.json({ ok: false, error: 'playerName は必須です' }, { status: 400 });
    }

    const session = await getAuthSession();
    const isAdmin = Boolean(session?.isAdmin);

    // プレイヤーのDiscord IDを取得して本人確認
    let isOwner = false;
    if (session) {
      if (session.displayName === playerName || session.username === playerName) {
        isOwner = true;
      } else if (supabase) {
        const { data: p } = await supabase
          .from('ktm_players')
          .select('discord_id')
          .eq('name', playerName)
          .maybeSingle();
        if (p?.discord_id === session.discordId) {
          isOwner = true;
        }
      }
    }

    const report = await getSavedCoachReport(playerName);

    if (!report) {
      return NextResponse.json({
        ok: true,
        report: null,
        isOwner,
        isAdmin,
      });
    }

    // 他人が見た場合はプライベート保護（弱点や分析は隠し、称号バッジと強みのみ公開）
    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        ok: true,
        isPrivate: true,
        isOwner: false,
        isAdmin: false,
        report: {
          playerName: report.playerName,
          coachBadge: report.coachBadge,
          overallRating: report.overallRating,
          analyzedMatchesCount: report.analyzedMatchesCount,
          keyStats: {
            mostPlayedChamp: report.keyStats.mostPlayedChamp,
            mainRole: report.keyStats.mainRole,
            winRate: report.keyStats.winRate,
          },
          strengths: report.strengths,
          createdAt: report.createdAt,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      report,
      isOwner,
      isAdmin,
    });
  } catch (err: any) {
    console.error('[api/coach/custom GET] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * 専属AIコーチカルテの手動オンデマンド生成 (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.discordId) {
      return NextResponse.json({ ok: false, error: '診断を実行するにはログインが必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const playerName = body.playerName;

    if (!playerName) {
      return NextResponse.json({ ok: false, error: 'playerName は必須です' }, { status: 400 });
    }

    const isAdmin = Boolean(session.isAdmin);

    // 本人または管理者のみ診断実行可能
    let isOwner = false;
    if (session.displayName === playerName || session.username === playerName) {
      isOwner = true;
    } else if (supabase) {
      const { data: p } = await supabase
        .from('ktm_players')
        .select('discord_id')
        .eq('name', playerName)
        .maybeSingle();
      if (p?.discord_id === session.discordId) {
        isOwner = true;
      }
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        ok: false,
        error: 'ご自身の専属AIコーチカルテのみ診断・更新が可能です。',
      }, { status: 403 });
    }

    // 診断を実行
    const report = await generateCustomCoachReport(playerName);

    // 結果を保存
    await saveCoachReportToStorage(playerName, report);

    return NextResponse.json({
      ok: true,
      report,
      isOwner: true,
      isAdmin,
    });
  } catch (err: any) {
    console.error('[api/coach/custom POST] Error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'カルテ診断に失敗しました' }, { status: 500 });
  }
}
