-- フルクリア時間の実測値をjunglepedia.lol(高エロソロキュー・50万試合超の集計)から
-- 取得するために追加。既存のavg_full_clear_sec(Riot Timeline APIの自前集計、
-- 累積カウンタを60秒間隔で誤判定する構造的な指標選定ミスがあり2026-08-15に表示を
-- 撤去済み)とは出典もサンプル規模も全く異なるため、混同を避けて別カラムに分ける。
-- avg_first_core_sec/avg_second_core_sec(実際のITEM_PURCHASEDイベントベースで
-- 正確)は引き続きRiot集計を使う。

alter table champion_jungle_timing_agg
  add column if not exists external_avg_clear_sec integer,
  add column if not exists external_sample_size integer,
  add column if not exists external_source text,
  add column if not exists external_updated_at timestamptz;

-- sample_countはNOT NULL・デフォルト無しのため、Riot集計側の行がまだ存在しない
-- チャンピオンをこちらの出典だけでINSERTしようとすると制約違反になる。
-- 0(=Riot集計側のサンプルはまだ無い、の意味として正確)をデフォルトにする。
alter table champion_jungle_timing_agg
  alter column sample_count set default 0;
