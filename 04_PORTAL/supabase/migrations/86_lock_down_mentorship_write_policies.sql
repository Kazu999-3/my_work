-- 師弟機能・評判テーブルの「誰でも書き込める」RLSポリシーを外す（2026-10-04）
--
-- 次の5表には roles=public / cmd=ALL / USING(true) WITH CHECK(true) のポリシーがあり、
-- ブラウザに配布している公開(anon)キーだけで、APIを通さずに誰でも行の追加・変更・削除ができた。
-- 書き込みはすべて 04_PORTAL の API ルート（lib/supabaseAdmin = サービスロール、RLSを通らない）から行っており、
-- ブラウザから直接書き込む経路は無い（2026-10-04 grep で確認）。04本番がサービスロールで動いていることは、
-- 書き込みポリシーの無い coin_transactions へ04から書き込めていることで確認済み。
-- 読み取りポリシー（Allow public read …）はポータルで公開している情報のため残す。
DROP POLICY IF EXISTS "Allow all insert/update for mentorship_matches" ON public.mentorship_matches;
DROP POLICY IF EXISTS "Allow all insert/update for mentorship_profiles" ON public.mentorship_profiles;
DROP POLICY IF EXISTS "Allow all insert for mentorship_reviews" ON public.mentorship_reviews;
DROP POLICY IF EXISTS "Allow authenticated insert for mentorship_profile_comments" ON public.mentorship_profile_comments;
DROP POLICY IF EXISTS "Allow all insert for player_reputations" ON public.player_reputations;
