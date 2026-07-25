import { NextResponse } from 'next/server';
import { callGeminiWithRetry } from '../../../../../lib/geminiClient';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { content, title } = await req.json();
    if (!content) {
      return NextResponse.json({ error: '本文が指定されていません。' }, { status: 400 });
    }

    const prompt = `あなたはLoL最上位プレイヤーの専属アナリストです。
以下の記事「${title || '無題の攻略記事'}」の本文を読み、忙しいプレイヤーのために【30秒で理解できる最重要ポイント3点】を弾丸箇条書きで要約してください。

【要約ルール】
- 3つのポイントを絵文字付きで簡潔に（1行20〜40字程度）。
- 専門用語を分かりやすく解説し、即実戦で使える判断基準を強調する。
- 全て日本語で出力してください。

【本文】
${content.slice(0, 3000)}`;

    const summaryText = await callGeminiWithRetry(prompt);
    return NextResponse.json({ success: true, summary: summaryText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI要約に失敗しました。' }, { status: 500 });
  }
}
