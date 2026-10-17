-- 希望レーンの「FILL」を「ALL」に統一する（2026-10-17）
--
-- マイページの「おまかせ」が FILL で保存されていた一方、チーム分け（/api/balancer）は ALL だけを
-- 「どこでもOK」として扱っており、FILL の人はどのレーンでも希望外として扱われていた。
-- コード側も FILL → ALL の読み替えを入れたうえで、既存データもそろえる（該当は数人）。

UPDATE public.ktm_players
SET role_preferences = jsonb_set(role_preferences, '{primary}', '"ALL"')
WHERE upper(role_preferences->>'primary') IN ('FILL', 'ANY');

UPDATE public.ktm_players
SET role_preferences = jsonb_set(role_preferences, '{secondary}', '"ALL"')
WHERE upper(role_preferences->>'secondary') IN ('FILL', 'ANY');
