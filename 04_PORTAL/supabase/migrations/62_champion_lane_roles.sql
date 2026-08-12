-- 辞典のレーン絞り込みがDDragonタグの粗い推測しかなく「全く当てにならない」との指摘(2026-08-12)。
-- leagueofgraphs/dpm.lolはCloudflare系のbot対策で取得不可(403)だったため、
-- 代替としてop.gg(https://www.op.gg/champions?position={role})から実データを取得し、
-- その結果をこのテーブルに保存する。1チャンピオンが複数レーンで運用される場合があるため、
-- (champion, role)の複合ユニークで多対多を許容する。
CREATE TABLE IF NOT EXISTS champion_lane_roles (
  id BIGSERIAL PRIMARY KEY,
  champion TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('TOP', 'JG', 'MID', 'ADC', 'SUP')),
  rank INT,
  source TEXT NOT NULL DEFAULT 'opgg',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (champion, role)
);

CREATE INDEX IF NOT EXISTS idx_champion_lane_roles_champion ON champion_lane_roles (champion);

ALTER TABLE champion_lane_roles ENABLE ROW LEVEL SECURITY;

-- 表示用の読み取り専用データのため、閲覧は誰でも可能。書き込みはservice roleのみ
-- (04_PORTAL/CLAUDE.mdのsupabase-table-securityチェックリストに準拠)。
CREATE POLICY "champion_lane_roles_public_read" ON champion_lane_roles
  FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE ON champion_lane_roles FROM anon, authenticated;
