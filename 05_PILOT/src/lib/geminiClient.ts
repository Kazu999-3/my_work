// Gemini API 呼び出しヘルパー（上から順に試す自動フォールバック）
//
// 2026-10-04 gemini-model-health-check で実測: gemini-3.1-flash-lite / gemini-3.5-flash-lite / gemini-2.5-flash は動作OK。
// それまでの一覧 ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'] は後ろ2つが 404（廃止済み）で、
// 冒頭コメントの「3.5/3.1 Flash-Lite 自動フォールバック」とも食い違っていた（実質 2.5-flash 1本だけ）。
// 枠に余裕のある 3.1-flash-lite を先頭にする。モデルを変える時は必ず実測スクリプトで確認すること（.claude/rules/llm-health.md）。
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

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

