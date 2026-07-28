-- 「試合後」タブの手動ボタンを廃止し、日次Cronが自動生成した最新の振り返りを
-- そのまま表示する方式に変更するにあたり、Geminiが生成したアドバイス本文を
-- 保存していなかったため再現できなかった。coach_analyses に永続化する。
ALTER TABLE coach_analyses ADD COLUMN IF NOT EXISTS advice text;
