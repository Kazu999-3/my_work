import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatGeminiError } from '../geminiClient';

describe('formatGeminiError Unit Tests', () => {
  it('429エラーから「Please retry in 2h48m17.77s」の残り時間を日本語化できること', () => {
    const rawError = JSON.stringify({
      error: {
        code: 429,
        message: 'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3-flash, description: Generate content requests per day limit exceeded on Free Tier. Please retry in 2h48m17.774039237s.',
        status: 'RESOURCE_EXHAUSTED',
      }
    });

    const formatted = formatGeminiError(429, rawError);
    assert.ok(formatted.includes('⏳ Gemini APIの1日上限（無料枠: 20回）に達しました'));
    assert.ok(formatted.includes('【約2時間48分】'));
    assert.ok(formatted.includes('直接統合'));
  });

  it('429エラーで秒数のみの場合（45秒）も正しく抽出できること', () => {
    const rawError = 'Please retry in 45.12s.';
    const formatted = formatGeminiError(429, rawError);
    assert.ok(formatted.includes('【約45秒】'));
  });

  it('429エラーでRetryInfoの秒数(10097s)から時分を逆算できること', () => {
    const rawError = JSON.stringify({
      error: {
        code: 429,
        message: 'Resource exhausted',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '10097s',
          }
        ]
      }
    });

    const formatted = formatGeminiError(429, rawError);
    // 10097秒 = 2時間48分17秒
    assert.ok(formatted.includes('【約2時間48分】'));
  });

  it('503エラーで混雑メッセージを返すこと', () => {
    const formatted = formatGeminiError(503, 'Service Unavailable');
    assert.ok(formatted.includes('一時的に混雑しています（503）'));
  });
});
