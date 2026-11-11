// Gemini API 呼び出しヘルパー（上から順に試す自動フォールバック）
//
// 2026-10-29 実測:
// - gemini-3.5-flash / gemini-3.5-flash-lite / gemini-3.6-flash が 200 OK で高速かつ安定稼働中。
// - gemini-3-flash-preview は現在一時的な429枯渇中。
// - gemini-3.1-flash-lite は Google 側で 503 UNAVAILABLE。
// - gemini-2.5-flash は無料枠の1日20回制限(429)で即死するため候補から除外。
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-pro-latest',
];

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  timeoutMs?: number;
  enableSearch?: boolean; // Google Search Grounding (Web検索連動)
}

export function formatGeminiError(status: number, errText: string): string {
  if (status === 429) {
    // 1. "Please retry in 2h48m17.77s" などの正規表現抽出
    const retryMatch = errText.match(/Please retry in\s+((?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?)/i);
    let waitTimeStr = '';

    if (retryMatch) {
      const hours = retryMatch[2] ? `${retryMatch[2]}時間` : '';
      const mins = retryMatch[3] ? `${retryMatch[3]}分` : '';
      const secs = retryMatch[4] ? `${Math.round(parseFloat(retryMatch[4]))}秒` : '';
      waitTimeStr = `${hours}${mins}${hours ? '' : secs}` || 'しばらくの間';
    } else {
      // details 内の retryDelay (例: "10097s")
      const delayMatch = errText.match(/"retryDelay":\s*"(\d+)(?:\.\d+)?s"/);
      if (delayMatch) {
        const totalSecs = parseInt(delayMatch[1], 10);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        waitTimeStr = h > 0 ? `${h}時間${m}分` : `${m}分`;
      }
    }

    const isFreeTierLimit = /limit:\s*20|Free Tier|per day limit/i.test(errText);

    if (waitTimeStr) {
      return `⏳ Gemini APIの${isFreeTierLimit ? '1日上限（無料枠: 20回）' : '利用制限'}に達しました。あと【約${waitTimeStr}】後に再開できます。（※お急ぎの場合は「直接統合」で承認するか、時間をおいてお試しください）`;
    }
    return `⏳ Gemini APIの利用上限（429）に達しました。しばらく時間をおいてから再試行するか、「直接統合」で承認してください。`;
  }

  if (status === 503) {
    return '⚠️ Gemini APIのサーバーが一時的に混雑しています（503）。少し待ってから再試行してください。';
  }

  return `Gemini API エラー (${status}): ${errText.slice(0, 180)}`;
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

      // Google Search Grounding の有効化
      if (options.enableSearch) {
        body.tools = [{ googleSearch: {} }];
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? 60000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Gemini ${model}] エラー status: ${res.status}`, errText);
        lastError = new Error(formatGeminiError(res.status, errText));
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

export interface GeminiDetailedResponse {
  text: string;
  searchChunks: Array<{ uri: string; title: string }>;
  webSearchQueries: string[];
}

export async function callGeminiDetailed(prompt: string, options: GeminiOptions = {}): Promise<GeminiDetailedResponse> {
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

      if (options.enableSearch) {
        body.tools = [{ googleSearch: {} }];
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? 60000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Gemini ${model}] エラー status: ${res.status}`, errText);
        lastError = new Error(formatGeminiError(res.status, errText));
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const text = (candidate?.content?.parts || [])
        .filter((p: any) => typeof p?.text === 'string' && !p.thought)
        .map((p: any) => p.text)
        .join('');

      const searchChunks: Array<{ uri: string; title: string }> = [];
      const rawChunks = candidate?.groundingMetadata?.groundingChunks || [];
      for (const chunk of rawChunks) {
        if (chunk?.web?.uri) {
          searchChunks.push({
            uri: String(chunk.web.uri),
            title: String(chunk.web.title || ''),
          });
        }
      }

      const webSearchQueries: string[] = candidate?.groundingMetadata?.webSearchQueries || [];

      if (text) {
        return { text, searchChunks, webSearchQueries };
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

