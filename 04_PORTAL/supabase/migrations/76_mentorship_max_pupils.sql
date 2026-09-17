-- Migration 76: Add max_pupils to mentorship_profiles
-- 師匠が複数人の弟子（最大1〜3人）を同時に受け入れられるように拡張

ALTER TABLE mentorship_profiles 
ADD COLUMN IF NOT EXISTS max_pupils INT DEFAULT 3;

COMMENT ON COLUMN mentorship_profiles.max_pupils IS '師匠が同時に受け入れ可能な弟子の最大人数（デフォルト: 3）';
