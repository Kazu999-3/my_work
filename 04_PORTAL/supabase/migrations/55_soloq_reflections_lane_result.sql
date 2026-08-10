-- 試合全体の勝敗(win)とは別に、対面(レーン)単位の勝ち負けを記録できるようにする。
-- 集団戦で拾われた/味方の乱入等でチームは勝っても対面には負けている、あるいはその逆、
-- というケースを区別し、対面別の成績集計(matchup-warning等)ではこちらを使う。
ALTER TABLE soloq_reflections
  ADD COLUMN IF NOT EXISTS lane_result TEXT CHECK (lane_result IN ('win', 'even', 'loss'));
