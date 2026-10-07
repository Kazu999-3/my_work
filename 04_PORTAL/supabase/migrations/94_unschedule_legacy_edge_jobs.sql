-- 役に立っていなかった古い定期実行2つを止める（2026-10-07、ユーザー判断）
--
-- どちらも 2026-06 に Supabase 側で直接登録されたもので、リポジトリからは参照が無かった。
--   - invoke-pulse-patches（30分おき → Edge Function pulse-patches）: パッチノートのページの読み取りが壊れており、
--     毎回 {"status":"No patch found in HTML"}。パッチ検知は GitHub Actions の Riot Patch Watchdog が担っている
--   - invoke-match-importer（15分おき → Edge Function match-importer）: 特定の1アカウントの JG 対面を取り込む
--     初期の処理で、毎回 {"imported":0}
-- Edge Function 本体とソース（supabase/functions/）も削除した。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-pulse-patches') THEN
    PERFORM cron.unschedule('invoke-pulse-patches');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoke-match-importer') THEN
    PERFORM cron.unschedule('invoke-match-importer');
  END IF;
END;
$$;
