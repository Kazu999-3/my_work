-- Gemini API 429対策: 同一プロンプト（matchup分析など）の再生成を抑止するキャッシュテーブル
create table if not exists gemini_response_cache (
  cache_key   text primary key,
  response    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_gemini_response_cache_created_at
  on gemini_response_cache (created_at);

-- 24時間以上経過したキャッシュを定期的に間引くための補助関数（cronから呼び出し可能）
create or replace function purge_expired_gemini_cache() returns void as $$
begin
  delete from gemini_response_cache where created_at < now() - interval '24 hours';
end;
$$ language plpgsql;
