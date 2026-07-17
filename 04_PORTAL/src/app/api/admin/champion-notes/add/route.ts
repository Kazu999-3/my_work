import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

// ============================================================
// champion_notes への追加（辞典構造化#29 段階2: dual-write用）
//
// ライブラリ→辞典マージ時、従来のmatchup_sentinelへの書き込みに加えて、
// 構造化された champion_notes にも記事を1行追加するためのサーバーAPI。
// ブラウザ(anon)はRLSで champion_notes に書けないため、ここ(サービスロール)を通す。
//
// 同じ記事の再マージで重複しないよう、source_article_id か (champion,title,source) が
// 一致する既存ノートは消してから入れ直す（冪等）。
// ============================================================

export async function POST(req: Request) {
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: 401 });

  try {
    const body = await req.json();
    const champions: string[] = Array.isArray(body.champions) ? body.champions : (body.champion ? [body.champion] : []);
    const title: string = body.title || '(無題)';
    const content: string = body.body || body.content || '';
    const source: string = body.source || 'article';
    const sourceArticleId: number | null = body.source_article_id ?? null;
    const enemy: string | null = body.enemy ?? null;
    const patch: string | null = body.patch ?? null;

    if (champions.length === 0 || !content.trim()) {
      return NextResponse.json({ error: 'champion と body は必須です。' }, { status: 400 });
    }

    let written = 0;
    for (const champion of champions) {
      // 冪等化: 同じ記事(source_article_id)または同一(champion,title,source)の既存ノートを削除
      if (sourceArticleId != null) {
        await supabase.from('champion_notes').delete().eq('champion', champion).eq('source_article_id', sourceArticleId);
      } else {
        await supabase.from('champion_notes').delete().eq('champion', champion).eq('title', title).eq('source', source);
      }
      const { error } = await supabase.from('champion_notes').insert({
        champion, enemy, source_article_id: sourceArticleId, title, body: content, source, patch,
      });
      if (error) throw new Error(`champion_notes insert失敗(${champion}): ${error.message}`);
      written++;
    }

    return NextResponse.json({ success: true, written });
  } catch (err: any) {
    console.error('[champion-notes/add] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
