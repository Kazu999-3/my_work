-- 評判・師弟コースのテーブルを公開キー（ブラウザに入っている anon キー）で読めないようにする（2026-10-19）
--
-- migration 73/74/75 で「誰でも読める」ポリシーを付けたままだった。画面はすべてサーバーの API（管理者キー）経由で
-- 読んでおり、ブラウザから直接読む箇所は無い（04・05 とも確認済み）。公開キーで直接読むと:
--   - player_reputations: 匿名のはずの称賛・相談/報告の送り主（sender_discord_id）と本文が分かる
--   - mentorship_*: 師弟の進捗メモ・チェックインの回答・Discord ID が分かる
-- 書き込みのポリシーは migration 86 で既に外してある。

DROP POLICY IF EXISTS "Allow public read for player_reputations" ON public.player_reputations;
DROP POLICY IF EXISTS "Allow public read for mentorship_reviews" ON public.mentorship_reviews;
DROP POLICY IF EXISTS "Allow public read for mentorship_profiles" ON public.mentorship_profiles;
DROP POLICY IF EXISTS "Allow public read for mentorship_matches" ON public.mentorship_matches;
DROP POLICY IF EXISTS "Allow public read for mentorship_profile_comments" ON public.mentorship_profile_comments;
