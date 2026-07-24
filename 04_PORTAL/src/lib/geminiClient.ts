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
  /** 画像を添えて解析させる場合に指定する（スコアボードの読み取りなど） */
  image?: { base64: string; mimeType: string };
  /** レスポンス本文の構造化検証関数（検証失敗時はリトライ） */
  validator?: (text: string) => boolean | Promise<boolean>;
}

// Google AI Studioの最新クォータ実績に基づき、最大容量 (500 RPD / 15 RPM) を誇る
// 'gemini-3.5-flash-lite' をデフォルトとし、429制限時は 'gemini-3.1-flash-lite', 'gemini-3.6-flash' へフォールバックします。
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
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

async function trackApiUsage() {
  if (!supabase) return;
  try {
    const ptObj = new Date(Date.now() - 8 * 60 * 60 * 1000);
    const yyyy = ptObj.getUTCFullYear();
    const mm = String(ptObj.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(ptObj.getUTCDate()).padStart(2, '0');
    const todayFormatted = `${yyyy}-${mm}-${dd}`;

    const { data: existing } = await supabase
      .from('api_usage_logs')
      .select('usage_data')
      .eq('date', todayFormatted)
      .maybeSingle();

    const currentData = existing?.usage_data || {};
    const currentCount = Number(currentData.portal_ai_calls || 0);

    const updatedData = {
      ...currentData,
      portal_ai_calls: currentCount + 1,
    };

    await supabase
      .from('api_usage_logs')
      .upsert({ date: todayFormatted, usage_data: updatedData }, { onConflict: 'date' });
  } catch (e) {
    console.warn('[geminiClient] Failed to track API usage:', e);
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
    image,
  } = options;

  if (cacheKey) {
    const cached = await readCache(cacheKey, cacheTtlMs);
    if (cached) return cached;
  }

  // 環境変数はカンマ区切りで複数キーを持てる。
  // 1つが日次上限に当たっても別枠のクォータで続行できるよう、リトライごとに切り替える。
  const apiKeys = String(process.env[apiKeyEnv] || '')
    .split(',').map((k) => k.trim()).filter(Boolean);
  if (apiKeys.length === 0) {
    return `※ ${apiKeyEnv}未設定のためAI生成をスキップしました。`;
  }

  const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens };
  if (responseMimeType) generationConfig.response_mime_type = responseMimeType;

  // 全AI生成で日本語出力を強制する。素材(統計サイト・英語記事)が英語だと、
  // 個別プロンプトで「日本語で」と書いていても英語のまま返ることがあるため、
  // 共通クライアント側で最後に必ず指示を付ける。
  // ※チャンピオン名・アイテム名・ルーン名などの固有名詞は英語のままにする（表記ゆれ防止）。
  const JP_GUARD = `

【出力言語の絶対条件】
- 出力は必ず**日本語**で書くこと。英語の文章をそのまま返してはいけない。
- 素材が英語であっても、必ず日本語に翻訳・要約して出力すること。
- ただし、チャンピオン名・アイテム名・ルーン名・スキル名などの固有名詞は英語表記のまま残すこと。
- JSON形式を指定されている場合、キー名は指定どおり英語、値の文章は日本語にすること。`;
  const finalPrompt = `${prompt}${JP_GUARD}`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 試行ごとにキーとモデルを最適ローテーション（429発生時は次モデルへ回避）
    const apiKey = apiKeys[attempt % apiKeys.length];
    const preferredModel = options.model || DEFAULT_MODEL;
    const fallbackIdx = FALLBACK_MODELS.indexOf(preferredModel);
    const startIdx = fallbackIdx >= 0 ? fallbackIdx : 0;
    const activeModel = attempt === 0 ? preferredModel : FALLBACK_MODELS[(startIdx + attempt) % FALLBACK_MODELS.length];

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: image
                // 画像を添える場合は「画像→指示」の順にする（Geminiはこの順が安定する）
                ? [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: finalPrompt }]
                : [{ text: finalPrompt }],
            }],
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
        // 未試行のキーが残っていれば、待たずに次のキーへ回す（別枠のクォータを使うため）
        const hasUntriedKey = apiKeys.length > 1 && attempt + 1 < apiKeys.length;
        if (hasUntriedKey) {
          console.log(`[geminiClient] 429 Rate Limited - 次のAPIキーで再試行 (${attempt + 2}/${apiKeys.length}本目)`);
          continue;
        }
        const retryAfterHeader = Number(res.headers.get('retry-after'));
        const waitMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : backoffMs(attempt);
        console.log(`[geminiClient] 429 Rate Limited - ${waitMs}ms 後にリトライ (${attempt + 1}/${maxRetries})`);
        await sleep(waitMs);
        continue;
      }
      throw new Error('Gemini API: レート制限により全リトライが失敗しました。しばらく待ってから再度お試しください。');
    }

    // 503(高負荷) / 500 / 502 / 504 はGemini側の一時的な障害。
    // 以前は即失敗していたが、少し待てば回復することが多いのでリトライ対象にする。
    if (res.status === 503 || res.status === 500 || res.status === 502 || res.status === 504) {
      lastError = new Error(`Gemini API: ${res.status} 一時的に利用できません`);
      if (attempt < maxRetries) {
        const waitMs = backoffMs(attempt);
        console.log(`[geminiClient] ${res.status} Unavailable - ${waitMs}ms 後にリトライ (${attempt + 1}/${maxRetries})`);
        await sleep(waitMs);
        continue;
      }
      // 呼び出し側が「待って再開」に分岐できるよう、レート制限と同じ扱いのメッセージにする
      throw new Error('Gemini API: レート制限によりリトライ上限に到達しました（サーバー高負荷）。しばらく待ってから再度お試しください。');
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`Gemini API Error: ${res.status} ${res.statusText} ${bodyText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '生成失敗';

    if (options.validator) {
      try {
        const isValid = await options.validator(text);
        if (!isValid) {
          console.warn(`[geminiClient] レスポンス検証失敗 (${attempt + 1}/${maxRetries})`);
          if (attempt < maxRetries) {
            await sleep(backoffMs(attempt));
            continue;
          }
        }
      } catch (valErr) {
        console.warn(`[geminiClient] バリデーションエラー (${attempt + 1}/${maxRetries}):`, valErr);
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
      }
    }

    if (cacheKey) await writeCache(cacheKey, text);
    return text;
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini API: 不明なエラー');
}

/**
 * JSON構造化レスポンスを型安全にパース・検証するヘルパー関数
 */
export async function callGeminiStructured<T>(
  prompt: string,
  schema: { parse: (parsed: any) => T },
  options: GeminiCallOptions = {}
): Promise<T> {
  const jsonOptions: GeminiCallOptions = {
    ...options,
    responseMimeType: 'application/json',
    validator: async (text: string) => {
      const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      schema.parse(parsed);
      return true;
    },
  };
  const rawText = await callGeminiWithRetry(prompt, jsonOptions);
  const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
  return schema.parse(JSON.parse(cleanJson));
}

function backoffMs(attempt: number): number {
  // 2s, 4s, 8s, 16s ... 上限30s
  return Math.min(2000 * 2 ** attempt, 30000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 批判的ファクトチェックAI（Critic Engine）を噛ませて高精度・高信憑性文章を生成する二段階関数。
 * 1次生成後に「否定的な批判AI」が間違い・AI臭さ・抽象表現を徹底排除して再校正する。
 */
export async function callGeminiWithCritic(
  prompt: string,
  options: GeminiCallOptions = {}
): Promise<string> {
  // 1次生成
  const draft = await callGeminiWithRetry(prompt, options);

  // 2次生成（批判的AIによる厳格な修正）
  const criticPrompt = `
あなたはLoLの極めて批判的なプロアナリスト＆ファクトチェッカーです。
以下のAI生成文を厳しく査読し、根拠のない推測、抽象的で中身のないAI臭い表現、矛盾、英語の直訳口調を徹底的に排除・修正してください。

【生成された草案】
${draft}

【修正命令】
- 不確実な情報や根拠のない言い切りは削除するか、事実に即した具体例に置き換える。
- 「素晴らしいでしょう」「〜を意識しましょう」といった無意味なAIの挨拶やまとめはすべて全カットする。
- 日本語として自然で、プレイヤーが実戦ですぐ使える具体的な戦術メモへブラッシュアップすること。
- 修正後の最終本文のみを出力すること。
`;

  return await callGeminiWithRetry(criticPrompt, { ...options, cacheKey: undefined });
}
