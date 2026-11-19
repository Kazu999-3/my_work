import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { supabase } from '../../../../lib/supabaseClient';
import { getCalendarPatch } from '../../../../lib/ddragonClient';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database client not initialized' }, { status: 500 });
  }

  try {
    const [currentPatch, { data: facts, error }] = await Promise.all([
      getCalendarPatch(),
      supabase
        .from('champion_facts')
        .select('champion, patch, confidence, last_verified_at, last_verified_by, auto_updated_at, source_summary, updated_at, strengths')
        .eq('archived', false)
        .order('champion', { ascending: true })
    ]);

    if (error) throw error;

    // 正本マスター（全173体）の読み込み
    const summaryPath = path.resolve(process.cwd(), 'src/data/champions_summary.json');
    let summaryChampions: any[] = [];
    if (fs.existsSync(summaryPath)) {
      try {
        summaryChampions = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      } catch (_) {}
    }
    const summaryMap = new Map<string, any>(summaryChampions.map(c => [String(c.id).toLowerCase(), c]));
    const factMap = new Map<string, any>((facts || []).map((f: any) => [String(f.champion || '').trim().toLowerCase(), f]));

    let verifiedCount = 0;
    let aiGeneratedCount = 0;
    let staleCount = 0;

    // 正本173体を基準に集計
    const list = summaryChampions.map((sc: any) => {
      const f = factMap.get(String(sc.id).toLowerCase()) || {};
      const p = (f.patch || '').split('.').slice(0, 2).join('.');
      const isLatestPatch = p === currentPatch;
      const isOldPatch = Boolean(p && !isLatestPatch);
      const conf = f.confidence || 'ai_generated';
      const hasContent = !!f.strengths;

      let status: 'verified' | 'ai_generated' | 'stale';
      let priorityScore = 0; // 優先確認スコア

      if (conf === 'verified') {
        status = 'verified'; // 🟢 確認済み
        verifiedCount++;
        priorityScore = 10;
      } else if (!hasContent || !isLatestPatch || conf === 'stale') {
        status = 'stale'; // 🔴 要対応（未確認かつ空データまたは古いパッチ）
        staleCount++;
        priorityScore = !hasContent ? 100 : !isLatestPatch ? 80 : 70;
      } else {
        status = 'ai_generated'; // 🟡 AI生成（現行パッチで最新だが人間未確認）
        aiGeneratedCount++;
        priorityScore = 50;
      }

      return {
        champion: sc.id,
        jpName: sc.name || sc.jpName,
        patch: f.patch || '未設定',
        isOldPatch,
        confidence: conf,
        status,
        lastVerifiedAt: f.last_verified_at || null,
        lastVerifiedBy: f.last_verified_by || null,
        autoUpdatedAt: f.auto_updated_at || null,
        sourceSummary: f.source_summary || null,
        updatedAt: f.updated_at || null,
        hasContent,
        priorityScore,
      };
    });

    // DB側に存在するが正本173体に含まれない不審行・重複行を検出（削除はせず報告用として保持）
    const anomalyRows = (facts || []).filter((f: any) => !summaryMap.has(String(f.champion || '').trim().toLowerCase()));

    // 優先確認トップ10 (要対応・AI未確認の重要度の高いチャンピオン)
    const priorityChampions = [...list]
      .filter((c) => c.status !== 'verified')
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 10);

    return NextResponse.json({
      currentPatch,
      totalCount: list.length, // 常に正本実数173体
      dbRawCount: (facts || []).length,
      anomalies: anomalyRows.map((a: any) => ({
        champion: a.champion,
        patch: a.patch,
        hasStrengths: !!a.strengths,
      })),
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
