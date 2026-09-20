-- Migration 79: ポロ・クラッシュのcrashPoint平文漏洩を根絶するため、
-- クライアントに署名済みトークン(HMACのみ・暗号化なし)でcrashPointを渡す方式を廃止し、
-- crashPointをサーバー側DBのみで保持する方式(crash_sessions)に置き換える。
-- クライアントには不透明なgame_id(UUID)しか渡らないため、base64デコードしても
-- クラッシュ値が読めなくなる。
--
-- 多重利確防止(migration 78のcrash_used_tokens)もこのテーブルのstatus列に統合するため、
-- crash_used_tokensは廃止する(2026-09-20新設・実運用0件のため実害なし)。

CREATE TABLE IF NOT EXISTS crash_sessions (
  game_id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  bet_amount INT NOT NULL,
  crash_point NUMERIC NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled'))
);

CREATE INDEX IF NOT EXISTS idx_crash_sessions_started_at ON crash_sessions (started_at);

ALTER TABLE crash_sessions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'crash_sessions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON crash_sessions', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON crash_sessions FROM anon, authenticated;

DROP TABLE IF EXISTS crash_used_tokens;
