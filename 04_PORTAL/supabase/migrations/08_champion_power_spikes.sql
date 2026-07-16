-- チャンピオン辞典: 「時間帯別の強さ（パワースパイク）」を構造化して持つ専用テーブル。
-- 従来 matchup_sentinel.raw_data.powerSpikes は自由記述の1文字列のみで、
-- 一覧表示・ソート・比較に使えなかったため新設する。
create table if not exists champion_power_spikes (
  champion          text primary key,       -- DataDragonのchampion id（例: "Lillia"）
  early_game_score  smallint not null check (early_game_score between 1 and 5),  -- 1-9分
  mid_game_score    smallint not null check (mid_game_score between 1 and 5),    -- 10-20分
  late_game_score   smallint not null check (late_game_score between 1 and 5),   -- 20分以降
  peak_window       text,                   -- 例: "レベル6-11、2ndアイテム完成後"
  summary           text,                   -- 例: "序盤は弱いが中盤のドラゴンファイトで最強クラス"
  source            text not null default 'gemini', -- gemini | manual
  patch             text,
  updated_at        timestamptz not null default now()
);

create index if not exists idx_champion_power_spikes_patch
  on champion_power_spikes (patch);
