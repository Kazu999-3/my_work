-- highest_rankのディビジョン(I/II/III/IV)は不要とのユーザー判断のため、
-- 既存データもティア名のみ(例: "PLATINUM III" -> "PLATINUM")に統一する。
-- ディビジョンはcalculateInitialMmr()でも元々使われておらず表示上の情報でしかなかった。
--
-- ※このスクリプトは冪等（何度でも再実行可。ディビジョン無しの行には影響しない）。

UPDATE ktm_players
SET highest_rank = split_part(highest_rank, ' ', 1)
WHERE highest_rank LIKE '% %';
