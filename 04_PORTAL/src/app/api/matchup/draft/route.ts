import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../lib/adminAuth';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { getChampionKnowledge } from '../../../../lib/championKnowledge';

// 対面メモのAI下書き。champion/enemy/role から、辞典の蓄積情報も踏まえて
// メモ各項目のたたき台をJSONで返す（対面メモ入力の高速化）。
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const { champion, enemy, role } = await req.json();
    if (!champion || !enemy) {
      return NextResponse.json({ error: '自分と相手のチャンピオンが必要です。' }, { status: 400 });
    }
    const [myK, enemyK] = await Promise.all([
      getChampionKnowledge(supabase, champion, { maxNotes: 4, maxNoteChars: 300 }),
      getChampionKnowledge(supabase, enemy, { maxNotes: 4, maxNoteChars: 300 }),
    ]);

    const prompt = `あなたはLoLの熟練コーチです。${role || ''}レーンで「${champion}」を使い、対面「${enemy}」と戦うときのマッチアップメモのたたき台を作成してください。
${myK.hasData ? `【${champion}の蓄積情報】\n${myK.text}\n` : ''}${enemyK.hasData ? `【${enemy}の蓄積情報】\n${enemyK.text}\n` : ''}
必ず以下のJSONのみ出力（前置き・コードブロック・注釈禁止、すべて日本語・各60字以内）:
{"winCondition":"<この対面の勝ち筋>","earlyGame":"<序盤(Lv1-6)の立ち回り>","powerSpikes":"<相手/自分のパワースパイク・危険な時間帯>","buildRunes":"<推奨ビルド・対抗ルーン>","counterJg":"<ガンク/ロームへの警戒点>"}`;

    const raw = await callGeminiWithRetry(prompt, { model: 'gemini-3.1-flash-lite', temperature: 0.4, maxOutputTokens: 1024, maxRetries: 2 });
    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) throw new Error('AIの出力を解析できませんでした。もう一度お試しください。');
    const draft = JSON.parse(cleaned.slice(s, e + 1));
    return NextResponse.json({ success: true, draft, usedKnowledge: myK.hasData || enemyK.hasData });
  } catch (e: any) {
    console.error('[matchup/draft] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
