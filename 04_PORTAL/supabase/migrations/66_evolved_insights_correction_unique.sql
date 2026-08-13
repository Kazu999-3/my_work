-- sync_corrections_to_insights(ai_helper.py)は「まだevolved_insightsに埋め込まれていない
-- dict_known_correctionsを埋め込む」というcheck-then-insertパターンで、
-- evolved_insights.source_correction_idにユニーク制約が無かった。ローカルデーモンと
-- GitHub Actions cloud workerの2系統がほぼ同時に別チャンピオンのtrend更新を成功させると
-- 同じ未同期の訂正を両方が拾って重複insertしうる(2026-08-13、ナレッジ/ファクトチェック系
-- 監査#14で発覚)。
--
-- アプリ側(sync_corrections_to_insights)は既にinsertのHTTPステータスが200/201以外の場合は
-- 例外を投げず単にsynced件数へカウントしないだけの実装になっているため、この制約追加だけで
-- Python側の変更なしに重複を防止できる。
-- NULLは複数許容(UNIQUE制約はNULL同士を重複とみなさない)なので、source_correction_idが
-- 無い将来的な用途(手動追加のinsight等)を妨げない。
ALTER TABLE evolved_insights
  ADD CONSTRAINT evolved_insights_source_correction_id_unique UNIQUE (source_correction_id);
