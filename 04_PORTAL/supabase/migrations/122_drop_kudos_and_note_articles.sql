-- ==============================================================================
-- 122_drop_kudos_and_note_articles.sql
-- 称賛タグ機能（player_reputations）の完全廃止、および
-- 画面が存在せず放置されていた旧note下書きテーブル（note_articles）の完全削除
-- ==============================================================================

-- 1. 称賛タグテーブル（Kudos）
DROP TABLE IF EXISTS public.player_reputations CASCADE;

-- 2. 旧note記事テーブル
DROP TABLE IF EXISTS public.note_articles CASCADE;
