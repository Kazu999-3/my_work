-- atomic insight(AIによる知見分解)の分割結果を、辞典生成/レーンガイド統合に
-- 使う前に人間が確認できるようにするレビューステータス列。
-- 2026-08-15、「チャンピオンごとの分割も全て最終的に人間が確認するようにしたい」
-- というユーザー要望への対応。既存行・is_atomic=falseの通常記事は'approved'を
-- デフォルトとし、挙動を変えない(記事登録時点で既に人間=投稿者が内容を決めている
-- ため)。is_atomic=trueの分割知見だけ、アプリ側の挿入時に明示的に'pending'を
-- 指定する。

alter table personal_knowledge
  add column if not exists review_status text not null default 'approved';

alter table personal_knowledge
  add constraint personal_knowledge_review_status_check
  check (review_status in ('pending', 'approved'));

create index if not exists idx_personal_knowledge_review_status
  on personal_knowledge (review_status)
  where review_status = 'pending';
