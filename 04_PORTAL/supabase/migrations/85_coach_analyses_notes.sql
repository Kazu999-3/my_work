-- 試合後ディープ分析の「試合メモ」を保存する列（2026-10-04）
--
-- 旧ポータルの /api/lol/match-memo は coach_analyses.notes を読み書きする作りだったが、
-- この列が存在しなかった。読み込みは常にエラー→空メモ、保存は失敗→予備処理で
-- AI分析結果の focus 欄を「【メモ】…」で上書きする、という状態で、機能として一度も動いていない
-- （上書きされた行は0件）。05(KTM Pilot)へ移植するにあたり列を追加する。
ALTER TABLE coach_analyses ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE coach_analyses ADD COLUMN IF NOT EXISTS notes_updated_at timestamptz;
