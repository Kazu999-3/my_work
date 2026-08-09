-- 複数タブや素早い二重送信で同一試合(match_id)の振り返りが重複挿入される
-- レースコンディションを、DB側のユニーク制約で根本的に防ぐ。
-- match_idが無い(手動入力等でNULLの)レコード同士は重複扱いしないよう部分インデックスにする。
CREATE UNIQUE INDEX IF NOT EXISTS soloq_reflections_match_id_unique
  ON soloq_reflections (match_id)
  WHERE match_id IS NOT NULL;
