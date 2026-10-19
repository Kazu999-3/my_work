-- 辞典バックアップ用一時テーブル3つの削除（2026-10-19、ユーザー承認）
-- 10/07 の辞典テーブル整理・リファクタリング時に巻き戻し用として作成されたバックアップ（計約2.7MB）。
-- 新仕様での本番稼働が安定しているため削除し、ストレージとバックアップ容量を削減する。

DROP TABLE IF EXISTS public.champion_facts_backup_20261007 CASCADE;
DROP TABLE IF EXISTS public.champion_facts_backup_20261007b CASCADE;
DROP TABLE IF EXISTS public.champion_fact_claims_backup_20261007b CASCADE;
