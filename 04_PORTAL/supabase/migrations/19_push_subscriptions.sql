-- ============================================================
-- Web Push 購読情報 (課題#52)
--
-- ブラウザのプッシュ購読(endpoint + 鍵)を保存し、サーバーから web-push で通知を送る。
-- 購読の登録/削除はサーバーAPI(サービスロール)経由で行うため、書き込みポリシーは付けない。
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- 読み書きはサーバー(サービスロール)のみ。公開ポリシーは作らない。
