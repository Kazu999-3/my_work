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
これはLeague of Legends (LoL) の対戦結果画面（クライアントのリザルト画面「スコアボード」、またはインゲーム観戦TAB画面）のスクリーンショットです。
画像から正確に試合情報と10名のプレイヤー詳細を読み取り、**厳密なJSON形式のみ**で出力してください。Markdownのコードブロック（\`\`\`json等）や解説文は一切含めず、純粋なJSON文字列のみを返してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【画面のレイアウトと読み取り規則】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **試合の勝敗 (winningTeam)**:
   - 画面最上部に「勝利」や青色クリスタルアイコンが表示されている場合、または上側の「チーム 1」（水色/青）が勝利している場合 ➔ "BLUE"
   - 画面最上部に「敗北」や赤色クリスタルアイコンが表示されている場合、または下側の「チーム 2」（赤）が勝利している場合 ➔ "RED"

2. **試合時間 (gameDurationSec)**:
   - 画面上部（タイトル付近）に「32:03」のように試合時間が表示されています。
   - これを秒数（分×60＋秒）に換算した整数（例: 32分3秒なら 1923）として出力してください。

3. **チームと行の並び順**:
   - 上半分 5行: 「チーム 1 (BLUE)」
   - 下半分 5行: 「チーム 2 (RED)」
   - 通常、各チーム上から順番にロール定位置 [TOP, JG, MID, ADC, SUP] の順に並んでいます。
     - 1行目: TOP（ソロレーン、テレポート等）
     - 2行目: JG（スマイト所持、緑/青/赤のペット所持）
     - 3行目: MID（ソロレーン）
     - 4行目: ADC（マークスマン、CS多数）
     - 5行目: SUP（サポートアイテム所持、CSが極端に少ない）

4. **各プレイヤー行の読み取り項目（左から右）**:
   - **チャンピオン顔アイコン**: 丸型イラスト。特徴（顔・髪・種族・色）から正確なチャンピオン英語名を特定。
   - **サモナー名 (name)**: プレイヤーのサモナー名（日本語・英数字。忠実にそのまま読み取ること）。
   - **KDA**: 「12 / 1 / 5」のように表示されている「キル / デス / アシスト」の3つの数字。
   - **CS (cs)**: KDAの右側にあるミニオン/モンスター討伐数（例: 248, 188, 208, 252, 29 等）。
   - **獲得ゴールド (gold)**: コインアイコンの横にあるゴールド数値（カンマを除去した整数、例: 15690, 12356 等）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【チャンピオン判定マスターリスト（必ずこの中から英語IDを選んでください）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${championsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力JSONフォーマット】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "sourceType": "LOBBY_RESULT",
  "winningTeam": "BLUE",
  "gameDurationSec": 1923,
  "players": [
    {
      "name": "サモナー名",
      "team": "BLUE",
      "role": "TOP",
      "kills": 12,
      "deaths": 1,
      "assists": 5,
      "cs": 248,
      "gold": 15690,
      "champion_name": "Urgot",
      "champion": "Urgot"
    },
    ... (チーム1の残り4名: JG, MID, ADC, SUP),
    ... (チーム2の5名: TOP, JG, MID, ADC, SUP)
  ]
}
※ "players" 配列には合計10名分を、チーム1（BLUE 5名: TOP, JG, MID, ADC, SUP）➔ チーム2（RED 5名: TOP, JG, MID, ADC, SUP）の順序で出力してください。
※ "champion_name" と "champion" の両方に同じ正確なチャンピオン英語ID（例: "Urgot", "Sylas", "Xerath", "MissFortune", "Leona", "Renekton", "JarvanIV", "Orianna", "Varus", "Kled" 等）を格納してください。
`;

    // 画像解析はモデルによって可否・クォータが分かれる。
    // 1つ目がダメでも代替の画像対応モデルへ切り替えられるよう、複数モデルを順に試す。
    // （共通クライアント化した際にこのフォールバックが失われ、画像解析が落ちやすくなっていた）
    // gemini-2.0-flash/gemini-1.5-flash-latestはこのアカウントのAI Studioクォータ画面で
    // 無料枠が0/0(gemini-2.0-flash)または廃止済み(1.5系)と判明したため、実クォータのある
    // モデルのみに変更(2026-08-10)。gemini-2.5-flash-liteはさらに実際のAPI呼び出しで
    // 404 NOT_FOUNDと判明したため、実リクエストで動作確認済みのgemini-3.5-flash-liteに
    // 差し替え(同日、gemini-model-health-checkスキルで検出)。
    const visionModels = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
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
