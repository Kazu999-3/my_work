-- reference_items の「公開キー/自己登録ユーザーが書き込める」不要なポリシーを外す（健康診断 2026-11-22）
--
-- migration 86 / 87 と同様、アプリ・サーバーからの書き込みはすべてサービスロール（supabaseAdmin）経由のため、
-- anon / authenticated ロール向けの insert/update/delete ポリシーは不要であり、
-- 外部から直接テーブルを改ざんされるセキュリティホールになるため削除する。
DROP POLICY IF EXISTS "Allow delete for admin" ON public.reference_items;
DROP POLICY IF EXISTS "Allow insert for admin" ON public.reference_items;
DROP POLICY IF EXISTS "Allow update for admin" ON public.reference_items;
