// Gemini API 呼び出しヘルパー（Gemini 3.5 Flash-Lite / 3.1 Flash-Lite 自動フォールバック）

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

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
      const text = candidate?.content?.parts?.[0]?.text;
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

