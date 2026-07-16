import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { playerName, sliders, tags, objectives } = body;

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json({ error: "Gemini APIキーが未設定です。環境変数 GEMINI_API_KEY を設定してください。" }, { status: 400 });
    }

    const prompt = `
あなたはLeague of Legendsの超一流ジャングルアナリスト兼AI鬼コーチです。
プレイヤー「${playerName}」のジャングラーとしての統計データに基づいて、勝率を上げるための分析とアドバイスを行います。

【プレイヤーのジャングル統計】
- Habitual (ルート固定) vs Dynamic (変幻自在): ${sliders.habitualDynamic}%
- Top-side Start (上開始) vs Bot-side Start (下開始): ${sliders.topBot}%
- Red-side Start (赤バフ) vs Blue-side Start (青バフ): ${sliders.redBlue}%
- Objective-focused (中立優先) vs Trade-heavy (戦闘・介入優先): ${sliders.objectiveTrade}%
- Passive (堅実) vs Aggressive (戦闘狂): ${sliders.passiveAggressive}%
- Clear Speed (Lv4到達スピードの優秀度): ${sliders.clearSpeed}%

上記データを多角的にプロファイリングし、以下の2つの視点から絶対に実践すべき具体的な【戦術指示3箇条】をJSON形式で生成してください。
※「〜しなさい」「〜は厳禁だ」といった、説得力と愛のあるプロコーチらしい口調で記述しなさい。

1. selfImprovement (本人向け・勝率UPアドバイス3箇条)
   - 本人がさらに上のランクを目指すために、プレイスタイルの偏り（例: クリア速度が遅い、オブジェクトに寄りすぎ/寄らなさすぎ、ルートが読まれやすい等）を論理的に指摘し、改善すべき行動を具体的に指示してください。
2. counterTactics (敵視点・対このプレイヤーのカウンター対策3箇条)
   - もし敵ジャングラーとしてこのプレイヤーと対戦する場合、彼の弱点やクリア傾向をどう逆手にとって崩すべきか（例: ルート固定を読んでインベイドする、アグレッシブさに合わせてカウンターガンクを構える等）を指示してください。

JSONの出力フォーマットは必ず以下の通りにしてください。解説やマークダウンの \`\`\`json などの装飾は一切含めず、純粋な生のJSONオブジェクトだけを出力してください：
{
  "selfImprovement": [
    { "title": "1. ...", "detail": "..." },
    { "title": "2. ...", "detail": "..." },
    { "title": "3. ...", "detail": "..." }
  ],
  "counterTactics": [
    { "title": "1. ...", "detail": "..." },
    { "title": "2. ...", "detail": "..." },
    { "title": "3. ...", "detail": "..." }
  ]
}
`;

    // 'gemini-2.5-flash'は日次上限を超過していたため、最も余裕のある'gemini-3.1-flash-lite'に変更
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return NextResponse.json(JSON.parse(text.trim()));
      }
      return NextResponse.json({ error: 'Geminiの返却フォーマットが正しくありません。' }, { status: 502 });
    }

    return NextResponse.json({ error: `Gemini APIエラー: ステータスコード ${res.status}` }, { status: 502 });

  } catch (error: any) {
    console.error('Junglepedia Advice API Error:', error);
    return NextResponse.json({ error: error.message || 'アドバイスの生成に失敗しました。' }, { status: 500 });
  }
}
