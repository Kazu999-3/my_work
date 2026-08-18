-- ============================================================
-- champion_facts 複数レーン（ロール別）対応マイグレーション (#65)
--
-- 背景: 複数レーンでプレイされるチャンピオン（例: ヤスオ MID/TOP/BOT、グラガス TOP/JG/MID/SUP）
-- について、レーンごとにビルド・ルーン・立ち回り・パワースパイクを完全分離して
-- 管理・表示できるようにする。
--
-- 変更内容:
-- 1. champion_facts に role カラムを追加 (デフォルト 'GLOBAL' または最有力ロール)
-- 2. 既存レコードの role を最有力ロール（champion_lane_roles の rank 1）で初期化
-- ============================================================

-- 1. role カラム追加
ALTER TABLE champion_facts
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'GLOBAL';

-- 2. 既存の champion_facts レコードに対し、champion_lane_roles の rank=1 のロールをセット
DO $$
BEGIN
  -- champion_lane_roles が存在する場合、最有力ロールを champion_facts に反映
  UPDATE champion_facts cf
  SET role = sub.role
  FROM (
    SELECT DISTINCT ON (champion) champion, role
    FROM champion_lane_roles
    ORDER BY champion, rank ASC
  ) sub
  WHERE cf.champion = sub.champion AND (cf.role = 'GLOBAL' OR cf.role IS NULL);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'champion_lane_roles update skipped: %', SQLERRM;
END $$;

-- 3. インデックス作成 (champion, role)
CREATE INDEX IF NOT EXISTS idx_champion_facts_champ_role ON champion_facts(champion, role);
