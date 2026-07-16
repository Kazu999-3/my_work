-- 募集(パーティー募集)の作成者・状態をDBで正規に管理するテーブル。
-- これまではDiscord埋め込みのthumbnail URLに`?metadata=<JSON>`として状態を埋め込み、
-- 都度パースしてowner判定していたため、埋め込みが壊れると権限チェックごと失われていた。
create table if not exists recruitments (
  id                 uuid primary key default gen_random_uuid(),
  discord_message_id text unique,
  discord_channel_id text,
  owner_discord_id   text not null,
  mode               text,
  max_count          int,
  status             text not null default 'open', -- open | closed | deleted
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_recruitments_owner on recruitments (owner_discord_id);
create index if not exists idx_recruitments_message on recruitments (discord_message_id);
