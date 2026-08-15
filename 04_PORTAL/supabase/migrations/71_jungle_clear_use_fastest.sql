-- junglepedia.lolのフルクリア実測値は平均(avgClearMs)ではなく最速(fastestClearMs)を
-- 使ってほしいというユーザー要望(2026-08-15)。列名が"avg"のままだと将来的な誤解の
-- もとになるため、列自体をリネームする(このカラムは直前のmigration 70で追加した
-- ばかりで他に依存箇所が無いため、リネームで問題ない)。

alter table champion_jungle_timing_agg
  rename column external_avg_clear_sec to external_fastest_clear_sec;
