-- 「ログイン済み(authenticated)なら許可」のRLSポリシーを外す（2026-10-04）
--
-- このプロジェクトは Supabase Auth を使っていない（auth.users は0人。ログインは Discord / 合言葉の独自方式）。
-- 一方 Supabase Auth は既定で誰でも公開(anon)キーから新規登録でき、登録すれば authenticated ロールになる。
-- そのため以下のポリシーは「正当な利用者はいないのに、自分で登録した第三者だけが使える」入口になっていた。
--   - personal_knowledge … 攻略ライブラリ記事の追加・変更・削除
--   - agent_prompts      … 動画解析等が読むAIへの指示文の書き換え（以降の解析結果を乗っ取れる）
--   - youtube_channels   … 監視チャンネルの追加・削除
--   - coin_transactions  … 全メンバーのコイン履歴の閲覧
--   - intelligence_core / intelligence_vectors / article_ideas / api_usage_logs … 書き換え
-- アプリの書き込みはすべてサービスロール（RLSを通らない）経由で、Edge Function もサービスキーを使っている。
-- Supabase Auth でログインするコードも存在しない（2026-10-04 確認）。
DROP POLICY IF EXISTS "Allow delete" ON public.agent_prompts;
DROP POLICY IF EXISTS "Allow insert" ON public.agent_prompts;
DROP POLICY IF EXISTS "Allow update" ON public.agent_prompts;
DROP POLICY IF EXISTS "Allow insert" ON public.api_usage_logs;
DROP POLICY IF EXISTS "Allow update" ON public.api_usage_logs;
DROP POLICY IF EXISTS "Allow delete for admin" ON public.article_ideas;
DROP POLICY IF EXISTS "Allow insert for admin" ON public.article_ideas;
DROP POLICY IF EXISTS "Allow update for admin" ON public.article_ideas;
DROP POLICY IF EXISTS "coin_tx_no_anon_access" ON public.coin_transactions;
DROP POLICY IF EXISTS "Allow insert/update" ON public.intelligence_core;
DROP POLICY IF EXISTS "Allow full access" ON public.intelligence_vectors;
DROP POLICY IF EXISTS "Allow delete for admin" ON public.personal_knowledge;
DROP POLICY IF EXISTS "Allow insert for admin" ON public.personal_knowledge;
DROP POLICY IF EXISTS "Allow update for admin" ON public.personal_knowledge;
DROP POLICY IF EXISTS "Allow delete" ON public.youtube_channels;
DROP POLICY IF EXISTS "Allow insert" ON public.youtube_channels;
DROP POLICY IF EXISTS "Allow update" ON public.youtube_channels;
