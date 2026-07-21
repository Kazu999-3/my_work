# 手動実行の結合テスト

CI では実行されない。**本番のSupabase・Gemini・noteに実際に接続する**ため、
自動化するとAPIクォータを消費したり本番データを書き換えたりする恐れがある。

`v2_CORE` 直下に `test_*.py` として置いていたが、pytest等が誤って拾うと
本番へ接続してしまうため、このフォルダへ隔離した。

## 実行方法

リポジトリのルートから、`.env` が読める状態で実行する。

```bash
cd 03_SYSTEMS
PYTHONPATH=. python v2_CORE/manual_tests/test_pulse_sync.py
```

## 各テストの前提

| ファイル | 何を確かめるか | 必要なもの |
|---|---|---|
| `test_api_gateway_fallback.py` | APIゲートウェイのレート制限フォールバック | なし（ローカル完結） |
| `test_db_columns.py` | Supabaseのカラム構成の確認 | SUPABASE_URL / KEY |
| `test_db_players.py` | `ktm_players` の中身の確認 | SUPABASE_URL / KEY |
| `test_evolution_pgvector.py` | 埋め込み生成と類似検索（1536次元） | GEMINI_API_KEY + pgvector |
| `test_note_publish_direct.py` | noteへの投稿 ⚠️**実際に投稿される** | NOTE_EMAIL / NOTE_PASSWORD |
| `test_pulse_sync.py` | Discordメンバー同期 | DISCORD_BOT_TOKEN |
| `test_task_queue_supabase.py` | タスクキューの登録・取得 | SUPABASE_URL / KEY |

`test_note_publish_direct.py` は**本番のnoteに記事が投稿される**ので、
内容を確認せずに実行しないこと。
