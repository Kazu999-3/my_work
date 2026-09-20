-- Migration 78: ポロ・クラッシュの多重利確防止用トークン使用済みテーブル
-- 同一gameToken(署名済みセッション)によるCASHOUTの多重POSTを防ぐため、
-- 利確処理に入る前にトークンのハッシュをこのテーブルへUNIQUE制約付きでINSERTし、
-- 既に使用済み(=INSERT失敗)なら二重利確として拒否する。
-- 全操作は/api/bet/crash route(service_role)経由のみのため、anon/authenticatedは完全遮断。

CREATE TABLE IF NOT EXISTS crash_used_tokens (
  token_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crash_used_tokens_used_at ON crash_used_tokens (used_at);

ALTER TABLE crash_used_tokens ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'crash_used_tokens' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON crash_used_tokens', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON crash_used_tokens FROM anon, authenticated;
