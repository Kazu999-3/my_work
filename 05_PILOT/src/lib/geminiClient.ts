// Gemini API 呼び出しヘルパー（上から順に試す自動フォールバック）
//
// 2026-10-27 実測: gemini-3-flash-preview が 200 OK で高速かつクォータ潤沢に稼働中。
// 3.5/3.1 flash-lite は Google 側で一時的な高負荷(503/timeout)が発生する場合があり、
// 2.5-flash は無料枠上限(429)になりやすいため、gemini-3-flash-preview を最優先にする。
const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}

export async function callGemini(prompt: string, options: GeminiOptions = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FREE;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません。');
  }

  const models = options.model ? [options.model, ...FALLBACK_MODELS] : FALLBACK_MODELS;
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body: any = {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxOutputTokens ?? 4096,
        }
      };

      if (options.responseMimeType) {
        body.generationConfig.responseMimeType = options.responseMimeType;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Gemini ${model}] エラー status: ${res.status}`, errText);
        lastError = new Error(`Gemini API エラー (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      // 返事は複数の part に分かれて届くことがある。最初の part だけを読むと途中で切れるため、
      // 考え中のメモ（thought）以外をつなげて読む（2026-10-20。04 のソロQ振り返りが途中で切れていた）
      const text = (candidate?.content?.parts || [])
        .filter((p: any) => typeof p?.text === 'string' && !p.thought)
        .map((p: any) => p.text)
        .join('');
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`[Gemini ${model}] 生成が途中で止まりました (finishReason=${candidate.finishReason}, ${text.length}文字)`);
      }
      if (text) {
        return text;
      }
    } catch (e: any) {
      console.warn(`[Gemini ${model}] 呼び出し失敗:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('全Geminiモデルの呼び出しに失敗しました。');
}

export async function callGeminiWithRetry(prompt: string, options: GeminiOptions = {}): Promise<string> {
  return callGemini(prompt, options);
}

