import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { playerId, stats, mmr, name, highestRank, mainChampions } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // AIに渡すためのスタッツテキストを構築
    let statsText = `プレイヤー名: ${name}\n`;
    statsText += `MMR: ${mmr}\n`;
    statsText += `最高ランク: ${highestRank || 'UNRANKED'}\n\n`;

    statsText += `【レーンごとの戦績】\n`;
    let totalGames = 0;
    if (stats) {
      Object.keys(stats).forEach(role => {
        if (stats[role]) {
          statsText += `- ${role}: ${stats[role].totalGames}戦 ${stats[role].totalWins}勝 (勝率 ${stats[role].winRate}%)\n`;
          totalGames += stats[role].totalGames;
          if (stats[role].topChampions && stats[role].topChampions.length > 0) {
            statsText += `  よく使う: ${stats[role].topChampions.map((c: any) => `${c.name}(勝率${c.winRate}%)`).join(', ')}\n`;
          }
        }
      });
    }

    if (totalGames === 0) {
      return NextResponse.json({ comment: 'まだKTMでの試合記録がありません。これからの活躍に期待です！' });
    }

    const prompt = `
あなたはeスポーツチームの敏腕アナリストです。
以下のLeague of LegendsプレイヤーのKTM（カスタム内戦）でのスタッツデータを分析し、
そのプレイヤーが「どのようなプレイスタイルの持ち主か」「チームでどんな役割を果たしているか」を表す、
カッコよくて端的な「AIの一言コメント」を作成してください。

条件:
- 文章は2〜3文程度で、簡潔にまとめること。
- アナリストのような少し硬めだが、プレイヤーを称えるカッコいいトーン（厨二病にならない程度に）。
- 勝率が高い場合はエースとして、低い場合はポテンシャルや特定の強みを拾うこと。
- 「〜である」「〜の持ち主。」といった体言止めや断言口調を使用。
- AI臭さを消すため、自然な日本語にすること。

【プレイヤーデータ】
${statsText}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const comment = response.text?.trim() || 'データから特徴を分析できませんでした。';

    // 生成したコメントを ktm_players の ai_comment カラムに保存（キャッシュ）
    // （※ DBに ai_comment カラムが追加されている前提。なければエラーになるが握りつぶす）
    await supabase
      .from('ktm_players')
      .update({ ai_comment: comment })
      .eq('id', playerId);

    return NextResponse.json({ comment });
  } catch (error: any) {
    console.error('AI Comment Error:', error);
    return NextResponse.json({ error: error.message || 'コメントの生成に失敗しました。' }, { status: 500 });
  }
}
