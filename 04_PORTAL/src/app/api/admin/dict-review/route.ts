import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';

// ============================================================
// 辞典の鮮度レビュー (課題#50 フェーズC)
//
// GET: 未レビュー(または古い)champion_facts をN件取り、現パッチでも有効かをLLMが判定して
//      「更新候補リスト」を返す（書き込みはしない）。管理者が中身を見て判断する。
// POST: 管理者の承認を反映する。{champion, action:'keep'|'archive'}
//        keep=現パッチで有効確認（reviewed_at/review_patch更新）、archive=アーカイブ(削除しない)。
// ============================================================

export const dynamic = 'force-dynamic';

async function getCurrentPatch(): Promise<string> {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    return (versions[0] || '').split('.').slice(0, 2).join('.'); // "15.13"
  } catch {
    return '';
  }
}

export async function GET(req: Request) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });

  try {
    const limit = Math.min(10, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 5));
    const currentPatch = await getCurrentPatch();

    // 未レビュー優先 → 更新が古い順
    const { data: facts } = await supabase
      .from('champion_facts')
      .select('champion, patch, strengths, weaknesses, power_spikes, build_runes, strategy, reviewed_at, review_patch')
      .eq('archived', false)
      .order('reviewed_at', { ascending: true, nullsFirst: true })
      .order('updated_at', { ascending: true })
      .limit(limit);

    const candidates = await Promise.all((facts || []).map(async (f: any) => {
      const prompt = `あなたはLoLのメタ分析コーチです。以下はチャンピオン「${f.champion}」の辞典データ（作成パッチ: ${f.patch || '不明'}）です。現在のパッチ ${currentPatch || '最新'} でもこの内容が概ね有効か判定してください。

強み: ${f.strengths || 'なし'}
弱み: ${f.weaknesses || 'なし'}
パワースパイク: ${f.power_spikes || 'なし'}
ビルド/ルーン: ${f.build_runes || 'なし'}

必ず以下のJSONのみ出力（前置き・コードブロック禁止）:
{"verdict":"keep|update|archive","reason":"<30字以内の理由>","note":"<updateの場合の要修正点。40字以内。不要なら空>"}
- keep: 現パッチでも概ね有効
- update: 一部古く、更新した方が良い
- archive: 大幅に古い/現メタと乖離、アーカイブ推奨`;
      let verdict = 'keep', reason = '', note = '';
      try {
        const raw = await callGeminiWithRetry(prompt, { model: 'gemini-3.1-flash-lite', temperature: 0.2, maxOutputTokens: 256, maxRetries: 2, cacheKey: `dictreview:${f.champion}:${f.patch}:${currentPatch}` });
        let cleaned = (raw || '').trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
        const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
        if (s >= 0 && e > s) { const p = JSON.parse(cleaned.slice(s, e + 1)); verdict = p.verdict || 'keep'; reason = p.reason || ''; note = p.note || ''; }
      } catch { reason = 'LLM判定に失敗'; }
      return { champion: f.champion, patch: f.patch, verdict, reason, note, reviewed_at: f.reviewed_at, review_patch: f.review_patch };
    }));

    return NextResponse.json({ currentPatch, count: candidates.length, candidates });
  } catch (err: any) {
    console.error('[dict-review] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });

  try {
    const { champion, action } = await req.json();
    if (!champion || !['keep', 'archive'].includes(action)) {
      return NextResponse.json({ error: 'champion と action(keep|archive) が必要です。' }, { status: 400 });
    }
    const currentPatch = await getCurrentPatch();
    const update = action === 'archive'
      ? { archived: true }
      : { reviewed_at: new Date().toISOString(), review_patch: currentPatch };
    const { error } = await supabase.from('champion_facts').update(update).eq('champion', champion);
    if (error) throw error;
    return NextResponse.json({ success: true, champion, action });
  } catch (err: any) {
    console.error('[dict-review] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
