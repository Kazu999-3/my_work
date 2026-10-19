-- personal_knowledge・article_ideas を公開キー（ブラウザに入っている anon キー）で消せないようにする（2026-10-19）
--
-- この2つはマイグレーション外（ダッシュボード）で作られたテーブルで、RLS の設定がコードから確認できない。
-- 公開キーに DELETE 権限が付いており、公開キーで中身を読めることから、RLS が無効なら誰でも全件削除できる状態。
-- personal_knowledge はナレッジ本体（2026-10-19 時点で 1,361 件）。
-- 書き込んでいるのは 04/05 の API・ボット・GitHub Actions・ローカルの常駐処理で、どれもサーバー用のキー（RLS を通らない）を使う。
-- 読み取りは今まで通り残し、書き込み・削除だけ止める。どちらの状態から適用しても同じ結果になるように書く。

ALTER TABLE IF EXISTS public.personal_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.article_ideas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.personal_knowledge') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'personal_knowledge' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "personal_knowledge public read" ON public.personal_knowledge FOR SELECT USING (true);
  END IF;
  IF to_regclass('public.article_ideas') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'article_ideas' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "article_ideas public read" ON public.article_ideas FOR SELECT USING (true);
  END IF;

  IF to_regclass('public.personal_knowledge') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.personal_knowledge FROM anon, authenticated;
  END IF;
  IF to_regclass('public.article_ideas') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.article_ideas FROM anon, authenticated;
  END IF;
END $$;
