import { supabase } from './supabaseClient';

// ============================
// Gemini共通クライアント
// 全ルート（coach/analyze, admin/live-match, admin/knowledge/add,
// player/junglepedia/advice, match/analyze-image）はこれ経由でGeminiを呼ぶこと。
// リトライ・バックオフ・任意キャッシュをここに一本化する。
// ============================

export interface GeminiCallOptions {
  model?: string; // デフォルト: gemini-2.0-flash-lite
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  apiKeyEnv?: string; // デフォルト: GEMINI_API_KEY
  responseMimeType?: string;
  cacheKey?: string; // 指定時はDBキャッシュを利用
  cacheTtlMs?: number; // デフォルト24時間
}

// 'gemini-2.0-flash-lite'はこのAPIキーで上限0(常に429)だったため、最も余裕のある
// 'gemini-3.1-flash-lite'（15 RPM / 500 RPD）に変更。model未指定の呼び出し元はここに従う。
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

async function readCache(cacheKey: string, ttlMs: number): Promise<string | null> {
  if (!supabase) return null;
  try {
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    const { data } = await supabase
      .from('gemini_response_cache')
      .select('response, created_at')
      .eq('cache_key', cacheKey)
      .gt('created_at', cutoff)
      .maybeSingle();
    return data?.response ?? null;
  } catch (e) {
    console.warn('[geminiClient] cache read failed', e);
    return null;
  }
}

async function writeCache(cacheKey: string, response: string) {
  if (!supabase) return;
  try {
    await supabase
      .from('gemini_response_cache')
      .upsert({ cache_key: cacheKey, response, created_at: new Date().toISOString() });
  } catch (e) {
    console.warn('[geminiClient] cache write failed', e);
  }
}

/**
 * Gemini generateContent を呼び出す共通関数。
 * - 429時は指数バックオフでリトライ（Retry-Afterヘッダがあれば優先）
 * - cacheKey指定時は同一プロンプトの再生成を抑止（デフォルト24h）
 */
export async function callGeminiWithRetry(
  prompt: string,
  options: GeminiCallOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxOutputTokens = 1024,
    maxRetries = 4,
    apiKeyEnv = 'GEMINI_API_KEY',
    responseMimeType,
    cacheKey,
    cacheTtlMs = DEFAULT_TTL_MS,
  } = options;

  if (cacheKey) {
    const cached = await readCache(cacheKey, cacheTtlMs);
    if (cached) return cached;
  }

  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    return `※ ${apiKeyEnv}未設定のためAI生成をスキップしました。`;
  }

  const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens };
  if (responseMimeType) generationConfig.response_mime_type = responseMimeType;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig,
          }),
        }
      );
    } catch (networkErr) {
      lastError = networkErr;
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`Gemini API: ネットワークエラーでリトライ上限に到達しました: ${networkErr}`);
    }

    if (res.status === 429) {
      lastError = new Error('Gemini API: Too Many Requests');
      if (attempt < maxRetries) {
        const retryAfterHeader = Number(res.headers.get('retry-after'));
        const waitMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : backoffMs(attempt);
        console.log(`[geminiClient] 429 Rate Limited - ${waitMs}ms 後にリトライ (${attempt + 1}/${maxRetries})`);
        await sleep(waitMs);
        continue;
      }
      throw new Error('Gemini API: レート制限により全リトライが失敗しました。しばらく待ってから再度お試しください。');
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`Gemini API Error: ${res.status} ${res.statusText} ${bodyText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '生成失敗';

    if (cacheKey) await writeCache(cacheKey, text);
    return text;
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini API: 不明なエラー');
}

function backoffMs(attempt: number): number {
  // 2s, 4s, 8s, 16s ... 上限30s
  return Math.min(2000 * 2 ** attempt, 30000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
