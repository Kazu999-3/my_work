-- Migration 82: ブッシュ・スカウト（Mines型ミニゲーム）のセッションテーブル
--
-- 【なぜサーバー側にしか盤面を置かないか】
-- クライアントへ盤面（地雷の位置）を渡すと、どんな難読化をしてもデベロッパーツールから
-- 読めてしまい、必ず勝てるゲームになる。ポロ・クラッシュで crashPoint を署名付きトークンで
-- 渡して漏洩させた失敗（migration 79）と同じ轍なので、最初からDBのみで保持する。
-- クライアントに渡すのは不透明な game_id (UUID) だけ。
--
-- 【多重利確の防止】
-- 79_crash_sessions.sql と同じく「pending → settled の UPDATE が1行だけ成功する」方式。
-- マスを開ける操作も reveal_count を条件に含めた UPDATE にしてあり、同じマスの連打や
-- 並行リクエストでは2件目以降が0行更新になって弾かれる。

CREATE TABLE IF NOT EXISTS mines_sessions (
  game_id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  bet_amount INT NOT NULL,
  mine_count INT NOT NULL,
  -- 地雷の位置（0〜24）。★クライアントへは絶対に返さない（決着後の盤面公開時のみ）
  mine_positions INT[] NOT NULL,
  -- 開封済みのマス（0〜24）。順序も記録する
  revealed INT[] NOT NULL DEFAULT '{}',
  -- revealed の件数。条件付きUPDATEの楽観ロックに使う
  reveal_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'lost', 'settled')),
  -- 利確時の払い戻し額（ベット額を含む総額）。負け・進行中は NULL
  payout INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  -- 決着の内訳（倍率・開封数・上限到達の有無など）。原因調査のために必ず残す
  settle_note JSONB
);

-- 「進行中のラウンドへ復帰する」ためのプレイヤー別検索
CREATE INDEX IF NOT EXISTS idx_mines_sessions_player_status
  ON mines_sessions (discord_id, status);

-- 1人が同時に持てる進行中ラウンドは1つだけ。開始ボタンの連打で二重にベットが
-- 引かれるのを、アプリ側のチェックだけに頼らずDBでも防ぐ。
-- ※ ON CONFLICT との併用は部分インデックスの条件式まで一致させる必要があり事故りやすいので、
--    アプリ側では ON CONFLICT を使わず「insert が失敗したら既存の進行中ラウンドを返す」方式にしている。
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mines_sessions_one_pending_per_player
  ON mines_sessions (discord_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mines_sessions_started_at
  ON mines_sessions (started_at);

-- 盤面が読まれると成立しないゲームなので、匿名・ログインユーザーからの直接アクセスを塞ぐ
-- （サーバー側の service_role キー経由でのみ読み書きする）
ALTER TABLE mines_sessions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'mines_sessions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON mines_sessions', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON mines_sessions FROM anon, authenticated;

COMMENT ON COLUMN mines_sessions.mine_positions IS
  '地雷の位置(0-24)。クライアントへ返してよいのは status が lost / settled になった後の盤面公開時のみ';
COMMENT ON COLUMN mines_sessions.settle_note IS
  '決着の内訳。revealCount / multiplier / payout / verdict (cashout|hit_mine|max_payout) を記録する';
