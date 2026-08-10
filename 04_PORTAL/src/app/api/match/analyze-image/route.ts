import { NextResponse } from 'next/server';
import { callGeminiWithRetry } from '../../../../lib/geminiClient';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, champions } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: '画像データがありません。' }, { status: 400 });
    }

    // 意図的な公開API(balancer/record/page.tsxから友人メンバーが自分で使う運用)。
    // ただし最大3モデルへ順次フォールバックする画像解析はコードベース中で最もコストが
    // 高いGemini呼び出しにもかかわらず、乱用対策が一切無かった(2026-08-05発覚)。
    // discord/sync等と同じedge_tasksベースのクールダウンで連打を防ぐ。
    const COOLDOWN_MS = 30 * 1000;
    const { data: lastRun } = await supabase
      .from('edge_tasks')
      .select('created_at')
      .eq('task_type', 'match_analyze_image_cooldown')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun) {
      const elapsed = Date.now() - new Date(lastRun.created_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        return NextResponse.json({ error: `画像解析は${Math.ceil((COOLDOWN_MS - elapsed) / 1000)}秒後に再試行してください。` }, { status: 429 });
      }
    }
    await supabase.from('edge_tasks').insert({ task_type: 'match_analyze_image_cooldown', status: 'completed', payload: {} });

    // APIキーの検証・複数キーのローテーション・429/5xxのリトライは
    // すべて callGeminiWithRetry 側に集約している。

    const championsText = champions && Array.isArray(champions)
      ? champions.map((c: any) => `${c.name} (${c.id})`).join(', ')
      : 'Aatrox, Ahri, Akali, LeeSin, Ezreal, Threshなど';

    const prompt = `
これはLeague of Legends (LoL) のカスタムゲームの対戦結果（リザルト画面、詳細統計画面）のスクリーンショットです。
この画像から以下の情報を抽出し、**厳密なJSON形式のみ**で出力してください。JSONの周りに markdown の \`\`\`json などの修飾は一切付けず、生のプレーンテキストのJSONデータだけを返してください。

【注意：テーブル構造（行）の認識について】
画像は10行のテーブル（表）構造になっています。必ず1行ずつ左から右にスキャンし、同じ行にある「サモナー名」「チャンピオン顔アイコン」「召喚師呪文（スマイトなど）」「アイテム欄および右隣の靴アイコン」「マーク（稲妻など）」「K/D/A」を同一人物のデータとして強固に紐づけてください。行を跨いでデータが混ざることは絶対に許されません。
【重要：チーム(サイド)の色および勝敗の判定ルール】
- LoLのリザルト画面では、**上の5行が必ず「勝利(VICTORY)チーム」、下の5行が必ず「敗北(DEFEAT)チーム」**です。
- しかし、**勝利チームが BLUE とは限りません。** 勝利チームが RED サイド（赤色）の場合も非常に多く存在します。
- 画像の上5行（勝利チーム）の背景色、左端のバーの色、ヘッダーの色を注視してください：
  - 上5行の色調が**赤色・ピンク色・オレンジ系 (RED)** である場合 ➔ **"winningTeam": "RED"** です！
  - 上5行の色調が**青色・水色系 (BLUE)** である場合 ➔ **"winningTeam": "BLUE"** です！
- 上5行が赤色であるにもかかわらず "BLUE" と出力することは絶対に禁止です。色（青=BLUE, 赤=RED）を厳密に見て "winningTeam" を決定してください。

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
1. "winningTeam": "BLUE" または "RED"（上記の色判定ルールに従うこと。「勝利側だから青」は誤り）
2. "players": 10人の配列。各プレイヤーは以下の項目を持つ。
   - "name": 画像から読み取れるサモナー名（多少の読み間違いや類似した文字を含む可能性があるため、画像にあるそのままのテキスト）
   - "team": "BLUE" または "RED"（そのプレイヤーの行の色調で判定。位置では決めない）
   - "role": 上記の決定法則から特定した "TOP", "JG", "MID", "ADC", "SUP" のいずれか。
   - "kills": キル数（数値）
   - "deaths": デス数（数値）
   - "assists": アシスト数（数値）
   - "damageDealt": 与ダメージ（画像内に与ダメージの数値が存在する場合のみ。存在しないタイプの場合は0またはnull）
   - "minionsKilled": CS（画像内にCSの数値が存在する場合のみ。存在しないタイプの場合は0またはnull）
   - "champion_analysis_notes": 上記観点による顔アイコンの分析と思考プロセス
   - "champion_name": マスターリストに書かれている正確な「英語名ID（例: Aatrox, Ahri, LeeSin）」の文字列を厳密に抽出して出力してください（日本語名は含めないでください）。

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
      "damageDealt": 19915,
      "minionsKilled": 224,
      "champion_analysis_notes": "緑色の光を纏った大剣を持つ女性戦士 ➔ Riven",
      "champion_name": "Riven"
    },
    ...
  ]
}
`;

    // 画像解析はモデルによって可否・クォータが分かれる。
    // 1つ目がダメでも代替の画像対応モデルへ切り替えられるよう、複数モデルを順に試す。
    // （共通クライアント化した際にこのフォールバックが失われ、画像解析が落ちやすくなっていた）
    // gemini-2.0-flash/gemini-1.5-flash-latestはこのアカウントのAI Studioクォータ画面で
    // 無料枠が0/0(gemini-2.0-flash)または廃止済み(1.5系)と判明したため、実クォータのある
    // モデルのみに変更(2026-08-10)。gemini-2.5-flash-liteはさらに実際のAPI呼び出しで
    // 404 NOT_FOUNDと判明したため、実リクエストで動作確認済みのgemini-3.5-flash-liteに
    // 差し替え(同日、gemini-model-health-checkスキルで検出)。
    const visionModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
    let textOutput = '';
    let lastErr: any = null;
    for (const model of visionModels) {
      try {
        textOutput = await callGeminiWithRetry(prompt, {
          model,
          image: { base64: imageBase64, mimeType: mimeType || 'image/png' },
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 4096,
          maxRetries: 1,
        });
        if (textOutput && !textOutput.startsWith('※')) break;
      } catch (e) {
        lastErr = e;
        // 次のモデルへ
      }
    }
    if (!textOutput || textOutput.startsWith('※')) {
      throw lastErr || new Error('Gemini からの解析結果が空です（画像対応モデルで生成できませんでした）。');
    }

    let cleanText = textOutput.trim();
    if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7);
    if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3);
    cleanText = cleanText.trim();

    const parsedData = JSON.parse(cleanText);
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
