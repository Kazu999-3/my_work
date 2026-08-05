-- ============================================================
-- dict-migrate(構造化バックフィル)のchampion_notes再構築が「対象チャンピオン全員を
-- 先に全削除→100件ずつチャンク投入」という非トランザクション処理で、途中のチャンクが
-- 失敗するとそのチャンピオンのノートが削除されたまま復元されない問題があった。
-- delete+insertを1つのDB関数呼び出し(=1トランザクション)にまとめ、
-- 失敗時は削除も含めて全体がロールバックされるようにする。
-- ============================================================

CREATE OR REPLACE FUNCTION rebuild_champion_notes_batch(p_champions text[], p_notes jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF array_length(p_champions, 1) > 0 THEN
    DELETE FROM champion_notes WHERE champion = ANY(p_champions);
  END IF;

  INSERT INTO champion_notes (champion, enemy, title, body, source, patch)
  SELECT champion, enemy, title, body, source, patch
  FROM jsonb_to_recordset(p_notes) AS x(champion text, enemy text, title text, body text, source text, patch text);
END;
$$;

REVOKE EXECUTE ON FUNCTION rebuild_champion_notes_batch(text[], jsonb) FROM PUBLIC, anon, authenticated;
