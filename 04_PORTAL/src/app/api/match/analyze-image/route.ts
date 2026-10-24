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
これはLeague of Legends (LoL) のカスタムゲーム対戦結果（対戦後ロビーリザルト画面、またはインゲーム観戦TABスコアボード画面）のスクリーンショットです。
以下の【画像タイプの自動判別】を行い、該当する画面形式に応じたルールで情報を抽出し、**厳密なJSON形式のみ**で出力してください。JSONの周りに markdown の \`\`\`json などの修飾は一切付けず、生のプレーンテキストのJSONデータだけを返してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【ステップ1：画像タイプの自動判別】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
画像が以下のどちらの画面であるかを判別してください：

● 形式A: 【対戦後ロビーリザルト画面（詳細統計）】
  - 画面全体に縦10行のテーブル（表）が並んでいる。
  - 上5行が勝利チーム、下5行が敗北チームに分かれている。
  - 撮影者（本人）の行がチームの1行目にハイライト表示されている場合がある。

● 形式B: 【インゲーム観戦TABスコアボード / 観戦画面】
  - ゲーム中または試合終了直後のインゲーム画面・観戦画面。
  - 画面上部中央に試合時間（例「28:14」）とキルスコア（青スコア vs 赤スコア）が表示されている。
  - テーブルが「左側5名（BLUEチーム）」と「右側5名（REDチーム）」に左右分割（または上下分割）されている。
  - 画面中央やネクサス付近に「VICTORY / DEFEAT」やネクサス破壊エフェクトが出ている場合がある。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【ステップ2：勝敗（winningTeam）と試合時間の判定ルール】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. "winningTeam":
   - 形式A（ロビーリザルト）の場合:
     - 上5行が勝利チームです。上5行の背景色やヘッダーの色調を注視してください。
     - 赤色・ピンク色・オレンジ系 (RED) ➔ "winningTeam": "RED"
     - 青色・水色系 (BLUE) ➔ "winningTeam": "BLUE"
   - 形式B（インゲームTAB・観戦画面）の場合:
     - 画面中央やネクサス付近に「VICTORY / DEFEAT」が表示されている場合、その勝敗から判定。
     - どちらかのネクサスが爆発している場合、破壊された側と反対のチームが勝利。
     - 試合終了演出がない場合、上部のチームキル数・タワー数・ゴールド差で圧倒的に勝利している側、あるいはスコアボードの勝利表記から "BLUE" または "RED" を判定。

2. "gameDurationSec":
   - 画面に表示されている試合時間（例「28:14」なら 1694）を秒の整数で抽出してください。
   - インゲーム画面では画面上部中央や右上に必ず「MM:SS」形式で時間が出ています。見当たらない場合は null（推測で埋めないこと）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【ステップ3：プレイヤー10名とロール（TOP/JG/MID/ADC/SUP）の特定】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
画像から全10名（BLUE 5名、RED 5名）を正確に読み取ります。

● 形式A（ロビーリザルト）の場合のロール特定:
  - LoLのリザルト画面は通常、上から [TOP, JG, MID, ADC, SUP] の順です。
  - ただし、撮影者の行だけが最上段（1行目）に来ます。
  - 撮影者の召喚師呪文（スマイト所持ならJG）、靴アイテム（ソーサラーシューズならMID、バーサーカーブーツ等ならADC）、稲妻アイコン（TOP）、サポートアイテム（SUP）から撮影者のロールを特定し、残りの4行に欠けているロールを上から順に割り当ててください。

● 形式B（インゲームTAB・観戦画面）の場合のロール特定:
  - 通常、各チーム上から順番に [TOP, JG, MID, ADC, SUP] の定位置に並んでいます。
  - スマイト（手のアイコン）を持っているプレイヤーは "JG" です。
  - サポートアイテム（世界の絵図など）を持っているプレイヤーは "SUP" です。
  - これらを照合して各プレイヤーのロール（TOP, JG, MID, ADC, SUP）を特定してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【ステップ4：チャンピオンの判定基準】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
各プレイヤーの顔アイコン画像（丸型や四角型のイラスト）からどのチャンピオンであるかを特定します。
画像認識の確度を最大化するため、まず各プレイヤーの顔アイコンの特徴を以下の観点から言葉で詳細に分析し、その思考過程を "champion_analysis_notes" フィールドに出力してください：
- **顔・髪の特徴**: 髪の色（赤、白、金、黒など）、髪型、ヘルメットや帽子の有無、性別や表情。
- **背景と色調**: アイコンの背景や全体のメインカラー（青い氷、緑の毒、赤い炎、紫の闇など）。
- **種族・外見**: 人間、小人（ヨードル）、機械・ロボット、動物、モンスター、影など。
（記述例: "背景が暗い緑色、ドクロのような顔のモンスター ➔ Karthus" または "白い長髪の女性で、背景は冷たい青 ➔ Ashe"）

この詳細な分析を踏まえ、以下の「認識候補チャンピオン一覧」のマスターリストから最も合致するものを1つ選び、"champion_name" に格納してください。リストにない適当な名前や架空の名前は絶対に返さないでください。

【認識候補チャンピオン一覧（必ずこの中から一致させてください）】
${championsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【重要：出力配列の順序ルール】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"players" 配列には、必ず以下の順序で10名を出力してください：
- **最初の5名（index 0〜4）**: 「勝利(VICTORY)チーム」の5名（ロール順: TOP, JG, MID, ADC, SUP）
- **後半の5名（index 5〜9）**: 「敗北(DEFEAT)チーム」の5名（ロール順: TOP, JG, MID, ADC, SUP）
※形式B（インゲームTAB画面で左が青、右が赤）であっても、勝利チームがREDの場合はREDの5名を先頭5名に、BLUEの5名を後半5名に並べ替えて出力してください。
※各プレイヤーの "team" には、本来のチーム色 ("BLUE" または "RED") を必ず設定してください。

抽出するデータ項目：
1. "sourceType": "LOBBY_RESULT" または "INGAME_TAB_SPECTATOR"
2. "winningTeam": "BLUE" または "RED"（上記の色判定ルールに従うこと。「勝利側だから青」は誤り）
3. "gameDurationSec": 秒数整数 または null
4. "players": 10人の配列。
   - "name": 画像から読み取れるサモナー名（画像にあるそのままのテキスト）
   - "team": "BLUE" または "RED"
   - "role": 上記の決定法則から特定した "TOP", "JG", "MID", "ADC", "SUP" のいずれか。
   - "kills": キル数（数値）
   - "deaths": デス数（数値）
   - "assists": アシスト数（数値）
   - "champion_analysis_notes": 上記観点による顔アイコンの分析と思考プロセス
   - "champion_name": マスターリストに書かれている正確な「英語名ID（例: Aatrox, Ahri, LeeSin）」

期待するJSON出力フォーマット：
{
  "sourceType": "LOBBY_RESULT",
  "winningTeam": "BLUE",
  "gameDurationSec": 1694,
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
