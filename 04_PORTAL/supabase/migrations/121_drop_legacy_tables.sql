-- 2026-10-23: 未稼働・死に機能の完全撤去
-- A: 教えて先輩のコメント機能（mentorship_profile_comments: 0件）
-- A: 教えて先輩のレビュー・星評価機能（mentorship_reviews: 0件）
-- B: 2026年6月初期プロトタイプのタスクボード（collab_tasks: 初期ダミー10件のみ、コード参照0件）

DROP TABLE IF EXISTS public.mentorship_profile_comments CASCADE;
DROP TABLE IF EXISTS public.mentorship_reviews CASCADE;
DROP TABLE IF EXISTS public.collab_tasks CASCADE;
