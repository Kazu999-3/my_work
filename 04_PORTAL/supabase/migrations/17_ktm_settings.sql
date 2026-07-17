-- ============================================================
-- 汎用設定テーブル (課題#30: 共通レイヤー一元化 / 設定のDB化)
--
-- これまでバランサーの「特定2名を同チームにしない」ルールが balancer.ts に
-- 「こんぺい/tamias」と直書きされており、対象を変えるにはコード修正が必要だった。
-- key/value(JSONB) の汎用設定テーブルに移し、コード変更なしで運用調整できるようにする。
-- ============================================================

CREATE TABLE IF NOT EXISTS ktm_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ktm_settings ENABLE ROW LEVEL SECURITY;
-- 読み取りは全員可（バランサーが参照）。書き込みはサーバー側(サービスロール)から。
CREATE POLICY "ktm_settings select" ON ktm_settings FOR SELECT USING (true);

-- 既存のハードコードと同じ内容をシード（挙動を維持）。禁止ペアは [名前1, 名前2] の配列の配列。
INSERT INTO ktm_settings (key, value)
VALUES ('balancer_forbidden_pairs', '[["こんぺい","tamias"]]'::jsonb)
ON CONFLICT (key) DO NOTHING;
