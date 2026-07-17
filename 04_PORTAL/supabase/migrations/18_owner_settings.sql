-- ============================================================
-- オーナー設定のシード (課題#47: ソロQ自動分析DM)
--
-- 自動分析DMの送信先(オーナーのDiscordユーザーID)を ktm_settings に登録する。
-- 既定値は ktm_bot の ADMIN_ID（＝オーナー）。違う場合はこの値を更新すればよい。
-- soloq_last_analyzed_match はエンドポイントが自動更新するので初期は空。
-- ============================================================

INSERT INTO ktm_settings (key, value)
VALUES ('owner_discord_id', '"697220229964759130"'::jsonb)
ON CONFLICT (key) DO NOTHING;
