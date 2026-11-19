// Ollama ローカルLLM ハイブリッド呼び出しアダプター
// ローカルで Ollama (Qwen2.5 7B) が起動していれば最優先でローカル処理し（Geminiトークン完全0・高速レスポンス）、
// 未起動またはエラー時は自動で既存の Gemini API (geminiClient.ts) へ安全にフォールバックします。

import { callGemini, GeminiOptions } from './geminiClient';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const ENABLE_LOCAL_LLM = process.env.ENABLE_LOCAL_LLM !== '0' && process.env.ENABLE_LOCAL_LLM !== 'false';

let lastHealthCheckTime = 0;
let lastHealthCheckResult = false;
const HEALTH_CACHE_MS = 5000; // 5秒間は死活判定をキャッシュしてオーバーヘッドを抑制

/**
 * Ollama サーバーの死活確認（1秒タイムアウト・5秒キャッシュ）
 */
export async function isOllamaAvailable(): Promise<boolean> {
  if (!ENABLE_LOCAL_LLM) return false;

  const now = Date.now();
  if (now - lastHealthCheckTime < HEALTH_CACHE_MS) {
    return lastHealthCheckResult;
  }

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(1000),
    });
    lastHealthCheckResult = res.ok;
    lastHealthCheckTime = now;
    return lastHealthCheckResult;
  } catch (_e) {
    lastHealthCheckResult = false;
    lastHealthCheckTime = now;
    return false;
  }
}

/**
 * Ollama の OpenAI 互換エンドポイント (/v1/chat/completions) を直接呼び出し
 */
export async function callOllama(prompt: string, options: GeminiOptions = {}): Promise<string> {
  const url = `${OLLAMA_BASE_URL}/v1/chat/completions`;
  const isJson = options.responseMimeType === 'application/json' || options.responseMimeType?.includes('json');

  // 長文プロンプトでの指示埋没（Lost in the Middle）を防ぐサンドイッチガード
  let userPrompt = prompt;
  if (isJson && !prompt.includes('【最重要: 出力指示】')) {
    userPrompt += '\n\n------------------------\n【最重要: 出力指示】\n上記の指示に従い、直ちに { から始まる純粋なJSONオブジェクトのみを出力してください。前置きや解説テキストは一切出力しないでください。';
  }

  const payload: any = {
    model: OLLAMA_MODEL,
    messages: [
      {
        role: 'system',
        content: isJson
          ? 'You are a specialized game analyst. Output only pure, valid JSON with no conversational commentary or markdown codeblocks.'
          : 'You are a specialized game analyst. Output the response in natural, accurate Japanese.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: options.temperature ?? 0.2,
  };

  if (isJson) {
    payload.response_format = { type: 'json_object' };
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP Error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  if (!content) {
    throw new Error('Ollama からの応答が空でした。');
  }

  // Markdownの ```json ... ``` をトリム
  let clean = content.trim();
  if (clean.startsWith('```')) {
    const lines = clean.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) lines.pop();
    clean = lines.join('\n').trim();
  }

  return clean;
}

/**
 * ハイブリッドLLM呼び出し:
 * 1. ローカル Ollama が稼働していれば最優先で実行（Gemini消費0）
 * 2. 未起動またはエラー時は既存の Gemini API へ安全にフォールバック
 */
export async function callHybridLlm(prompt: string, options: GeminiOptions = {}): Promise<string> {
  const isLocalReady = await isOllamaAvailable();

  if (isLocalReady) {
    try {
      console.log(`[Hybrid LLM] 🏠 ローカル Ollama (${OLLAMA_MODEL}) で優先実行中（Geminiトークン消費0）...`);
      const localResult = await callOllama(prompt, options);
      return localResult;
    } catch (err: any) {
      console.warn(`[Hybrid LLM] ⚠️ ローカル Ollama 呼び出し失敗 (${err.message})。Gemini API へ自動フォールバックします。`);
    }
  }

  // Gemini API へフォールバック
  return callGemini(prompt, options);
}
