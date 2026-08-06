import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

async function getCurrentPatch(): Promise<string> {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    return (versions[0] || '16.15.1').split('.').slice(0, 2).join('.');
  } catch {
    return '16.15';
  }
}

export async function GET(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const currentPatch = await getCurrentPatch();

    const { data: facts, error } = await supabase
      .from('champion_facts')
      .select('champion, patch, confidence, last_verified_at, last_verified_by, auto_updated_at, source_summary, updated_at, strengths')
      .eq('archived', false)
      .order('champion', { ascending: true });

    if (error) throw error;

    let verifiedCount = 0;
    let aiGeneratedCount = 0;
    let staleCount = 0;

    const list = (facts || []).map((f: any) => {
      const p = (f.patch || '').split('.').slice(0, 2).join('.');
      const isLatestPatch = p === currentPatch;
      const conf = f.confidence || 'ai_generated';
      const hasContent = !!f.strengths;

      let status: 'verified' | 'ai_generated' | 'stale';
      let priorityScore = 0; // 優先確認スコア

      if (!hasContent || !isLatestPatch || conf === 'stale') {
        status = 'stale'; // 🔴 要対応
        staleCount++;
        priorityScore = !hasContent ? 100 : !isLatestPatch ? 80 : 70;
      } else if (conf === 'verified') {
        status = 'verified'; // 🟢 確認済み
        verifiedCount++;
        priorityScore = 10;
      } else {
        status = 'ai_generated'; // 🟡 AI生成（確認未完了）
        aiGeneratedCount++;
        priorityScore = 50;
      }

      return {
        champion: f.champion,
        patch: f.patch || '未設定',
        confidence: conf,
        status,
        lastVerifiedAt: f.last_verified_at,
        lastVerifiedBy: f.last_verified_by,
        autoUpdatedAt: f.auto_updated_at,
        sourceSummary: f.source_summary,
        updatedAt: f.updated_at,
        hasContent,
        priorityScore,
      };
    });

    // 優先確認トップ10 (要対応・AI未確認の重要度の高いチャンピオン)
    const priorityChampions = [...list]
      .filter((c) => c.status !== 'verified')
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 10);

    return NextResponse.json({
      currentPatch,
      totalCount: list.length,
      summary: {
        verified: verifiedCount,
        aiGenerated: aiGeneratedCount,
        stale: staleCount,
      },
      priorityChampions,
      champions: list,
    });
  } catch (err: any) {
    console.error('[dict-health] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
