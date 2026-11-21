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
1. **画像上の勝敗 (imageWinner)**:
   - 画面最上部に「勝利」や青色クリスタルアイコンが表示されている場合、または上側の「チーム 1」（水色/青）が勝利している場合 ➔ "TEAM1"
   - 画面最上部に「敗北」や赤色クリスタルアイコンが表示されている場合、または下側の「チーム 2」（赤）が勝利している場合 ➔ "TEAM2"
   - 互換性のため、"winningTeam" にも "TEAM1" なら "BLUE"、"TEAM2" なら "RED" を初期値として設定してください。

2. **試合時間 (gameDurationSec)**:
   - 画面上部に「32:03」のように試合時間が表示されています。秒数（分×60＋秒、例: 32分3秒なら 1923）の整数で出力してください。

3. **チームの区分**:
   - 上半分 5行: 「チーム 1」（画像上の rawTeam: 1）
   - 下半分 5行: 「チーム 2」（画像上の rawTeam: 2）

4. **★重要：プレイヤーのロール判定（定位置は固定ではありません）**:
   - 行の順番は [TOP, JG, MID, ADC, SUP] で固定されておらず、プレイヤーの並び順がバラバラな場合があります！
   - 各プレイヤーのロール（role）は、行順ではなく以下の実態から個別に見極めて "TOP", "JG", "MID", "ADC", "SUP" のいずれかを判定してください：
     - **JG**: 召喚師呪文に「スマイト」を持っている、またはジャングルペットアイテム所持
     - **SUP**: アイテムに「サポートアイテム（世界の絵図、ソラリ、シュレリア、ワードストーン等）」を所持、またはCSが20〜30台と極端に少ない
     - **ADC**: チャンピオンがマークスマン（Varus, MissFortune, Kai'Sa, Jinx, Caitlyn, Ezreal, Jhin, Ashe等）
     - **MID**: チャンピオンがメイジ/アサシン（Xerath, Orianna, Ahri, Sylas, Zed, Syndra, Viktor等）
     - **TOP**: チャンピオンがファイター/タンク（Urgot, Renekton, Darius, Kled, Aatrox, Ornn, Gnar, Jax等）

5. **各行の抽出項目**:
   - **サモナー名 (name)**: 画像に表示されているサモナー名（日本語・英数字を忠実にそのまま読み取る）
   - **KDA**: 「キル / デス / アシスト」の数値（例: 12 / 1 / 5 ➔ kills: 12, deaths: 1, assists: 5）
   - **CS (cs)**: KDAの右側にあるミニオン/モンスター数（例: 248, 188, 208, 252, 29 等の数値）
   - **獲得ゴールド (gold)**: コインアイコン横のゴールド数値（カンマ除去した数値、例: 15690）
   - **チャンピオン (champion_name, champion)**: マスターリストから合致する英語ID（例: "Urgot", "Sylas", "Xerath", "MissFortune", "Leona", "Renekton", "JarvanIV", "Orianna", "Varus", "Kled" 等）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【チャンピオン判定マスターリスト（必ずこの中から英語IDを選んでください）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${championsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力JSONフォーマット】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "sourceType": "LOBBY_RESULT",
  "imageWinner": "TEAM1",
  "winningTeam": "BLUE",
  "gameDurationSec": 1923,
  "players": [
    {
      "name": "グランメゾンTOP",
      "rawTeam": 1,
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
    ... (チーム1の残り4名),
    ... (チーム2の5名: rawTeam: 2)
  ]
}
※ "players" 配列には合計10名分を、チーム1の5名 ➔ チーム2の5名の順序で出力してください。
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
