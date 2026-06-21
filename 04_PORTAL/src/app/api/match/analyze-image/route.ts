import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, champions } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: '画像データがありません。' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY が設定されていません。Vercel等の環境変数を確認してください。' }, { status: 500 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const championsText = champions && Array.isArray(champions)
      ? champions.map((c: any) => `${c.name} (${c.id})`).join(', ')
      : 'Aatrox, Ahri, Akali, LeeSin, Ezreal, Threshなど';

    const prompt = `
これはLeague of Legends (LoL) のカスタムゲームの対戦結果（リザルト画面、詳細統計画面）のスクリーンショットです。
この画像から以下の情報を抽出し、**厳密なJSON形式のみ**で出力してください。JSONの周りに markdown の \`\`\`json などの修飾は一切付けず、生のプレーンテキストのJSONデータだけを返してください。

【注意：テーブル構造（行）の認識について】
画像は10行のテーブル（表）構造になっています。必ず1行ずつ左から右にスキャンし、同じ行にある「サモナー名」「チャンピオン顔アイコン」「召喚師呪文（スマイトなど）」「アイテム欄および右隣の靴アイコン」「マーク（稲妻など）」「K/D/A」を同一人物のデータとして強固に紐づけてください。行を跨いでデータが混ざることは絶対に許されません。
上から5行が「BLUEチーム（左端の数字やマークに青が使われている）」、その下の5行が「REDチーム（赤が使われている）」です。

【重要：各チーム内におけるロール（並び順）の決定法則】
LoLの対戦結果画面の仕様上、各チーム（5行）は本来、上から順番に [TOP, JG, MID, ADC, SUP] の順で綺麗に並んでいます。
ただし、**このスクリーンショットを撮影した「本人（撮影者）」の行だけが、チームリストの一番上（1行目）に優先的に表示されます**。
撮影者の行は、背景が少し明るい、名前が太字になっているなどの強調表示がされています。

以下のステップに従って、論理的に全員のロールを特定してください：
1. チームの1行目のプレイヤー（撮影者）のロールを特定します。
   - 撮影者が「DまたはFキーのスロットに水色とオレンジの手の形のアイコン（スマイト）」を持っているなら、撮影者のロールは "JG" です。
   - 撮影者の行の左端（名前の左など）に「黄色の雷（稲妻）のマーク」があるなら、撮影者のロールは "TOP" です。
   - 6マスのアイテムスロットの右隣にある7番目のスロットに「全体が鮮やかな紫色の靴のアイコン（ソーサラーシューズ）」があるなら、撮影者のロールは "MID" です。
   - 同様に右隣のスロットに「金属製や茶色のリアルなブーツのグラフィック」があるなら、撮影者のロールは "ADC" です。
   - クエスト報酬ゲージや金色のマーク（世界の絵図の進行状況）があるなら、撮影者のロールは "SUP" です。
2. 撮影者のロールが決まれば、残りの4行（上から順に2行目、3行目、4行目、5行目）には、本来の順序 [TOP, JG, MID, ADC, SUP] から撮影者のロールを除外した順番で、上から順番にそのまま割り当ててください。
   - 例：撮影者のロールが "JG" だった場合、残りの4行は上から順に "TOP", "MID", "ADC", "SUP" になります。したがって、そのチームの5人の並び順は [JG, TOP, MID, ADC, SUP] です。
   - 例：撮影者のロールが "MID" だった場合、残りの4行は上から順に "TOP", "JG", "ADC", "SUP" になります。したがって、そのチームの5人の並び順は [MID, TOP, JG, ADC, SUP] です。
   - 例：撮影者のロールが "TOP" だった場合、残りの4行は上から順に "JG", "MID", "ADC", "SUP" になります。したがって、そのチームの5人の並び順は [TOP, JG, MID, ADC, SUP] です。

【チャンピオンの判定基準】
画像内にはチャンピオンの名前（文字）は書かれていません。
各プレイヤーの「チャンピオン顔アイコン画像（丸型や四角型の顔イラスト）」からどのチャンピオンであるかを特定します。
画像認識の確度を最大化するため、まず各プレイヤーの顔アイコンの特徴を以下の観点から言葉で詳細に分析し、その思考過程を "champion_analysis_notes" フィールドに出力してください：
- **顔・髪の特徴**: 髪の色（赤、白、金、黒など）、髪型、ヘルメットや帽子の有無、性別や表情。
- **背景と色調**: アイコンの背景や全体のメインカラー（青い氷、緑の毒、赤い炎、紫の闇など）。
- **種族・外見**: 人間、小人（ヨードル）、機械・ロボット、動物、モンスター、影など。
（記述例: "背景が暗い緑色、ドクロのような顔のモンスター ➔ Karthus" または "白い長髪の女性で、背景は冷たい青 ➔ Ashe"）

この詳細な分析を踏まえ、以下の「認識候補チャンピオン一覧」のマスターリストから最も合致するものを1つ選び、"champion_name" に格納してください。リストにない適当な名前や架空の名前は絶対に返さないでください。

【認識候補チャンピオン一覧（必ずこの中から一致させてください）】
${championsText}

抽出するデータ：
1. "winningTeam": "BLUE" または "RED"
2. "players": 10人の配列。各プレイヤーは以下の項目を持つ。
   - "name": 画像から読み取れるサモナー名（多少の読み間違いや類似した文字を含む可能性があるため、画像にあるそのままのテキスト）
   - "team": "BLUE" または "RED"
   - "role": 上記の決定法則から特定した "TOP", "JG", "MID", "ADC", "SUP" のいずれか。
   - "kills": キル数（数値）
   - "deaths": デス数（数値）
   - "assists": アシスト数（数値）
   - "champion_analysis_notes": 上記観点による顔アイコンの分析と思考プロセス
   - "champion_name": 思考を踏まえて特定した、マスターリスト内の正確なチャンピオン名または英語名ID

期待するJSON出力フォーマット：
{
  "winningTeam": "BLUE",
  "players": [
    {
      "name": "サモナー名",
      "team": "BLUE",
      "role": "TOP",
      "kills": 3,
      "deaths": 2,
      "assists": 8,
      "champion_analysis_notes": "緑色の光を纏った大剣を持つ女性戦士 ➔ Riven",
      "champion_name": "Riven"
    },
    ...
  ]
}
`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/png',
                data: imageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    let response;
    const attempts = 3;
    let delay = 1500; // 1.5秒

    for (let i = 0; i < attempts; i++) {
      try {
        console.log(`Sending image to Gemini API (Attempt ${i + 1}/${attempts})...`);
        response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Gemini API Attempt ${i + 1} failed: ${response.status} - ${errorText}`);
          
          if (response.status === 503 || response.status === 429 || response.status >= 500) {
            if (i < attempts - 1) {
              console.log(`Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // 指数バックオフ
              continue;
            }
          }
          throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }
        break; // 成功
      } catch (fetchErr: any) {
        if (i < attempts - 1) {
          console.log(`Fetch error on attempt ${i + 1}, retrying in ${delay}ms...: ${fetchErr.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw fetchErr;
      }
    }

    if (!response) {
      throw new Error("Gemini API からのレスポンスが取得できませんでした。");
    }

    const result = await response.json();
    const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw new Error("Gemini からの解析結果が空です。");
    }

    const parsedData = JSON.parse(textOutput.trim());
    return NextResponse.json({ status: "SUCCESS", data: parsedData });

  } catch (err: any) {
    console.error("Gemini Analyze Error:", err);
    
    // エラーメッセージの親切化
    let userMessage = err.message || '画像の解析中にエラーが発生しました。';
    if (userMessage.includes('503')) {
      userMessage = 'Gemini APIのサーバーが現在一時的に非常に混雑しています（503）。恐れ入りますが、数秒置いてからもう一度画像を貼り付け直していただくか、手動で入力してください。';
    } else if (userMessage.includes('429')) {
      userMessage = 'Gemini APIの無料枠制限（クォータ制限）に達しました（429）。しばらく時間を置いてからもう一度貼り付けていただくか、手動で入力してください。';
    }
    
    return NextResponse.json({ status: "ERROR", error: userMessage }, { status: 500 });
  }
}
