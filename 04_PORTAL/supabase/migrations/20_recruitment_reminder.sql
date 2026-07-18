-- 募集の開始時刻リマインド（D1）用カラム。
-- start_at: 募集作成時に「開始予定時刻」テキストを解釈して入れる（解釈不能ならNULL＝リマインドしない）。
-- reminded: リマインド送信済みフラグ（二重送信防止）。
ALTER TABLE recruitments ADD COLUMN IF NOT EXISTS start_at timestamptz;
ALTER TABLE recruitments ADD COLUMN IF NOT EXISTS reminded boolean NOT NULL DEFAULT false;

-- リマインド走査（status/reminded/start_at 絞り込み）を高速化
CREATE INDEX IF NOT EXISTS idx_recruitments_reminder ON recruitments (status, reminded, start_at);
