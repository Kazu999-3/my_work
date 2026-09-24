# 🗺️ Sovereign OS バックグラウンド自動化マップ (AUTOMATION_MAP)

本ファイルは、Sovereign OS でバックグラウンド稼働している全スクリプト・デーモン・Cron ジョブの「実行契機・対象・環境変数・停止手順」を一覧化した可視化マップです。
「知らないところで勝手に動画がキューに積まれる」「止まっているのに気づかない」というブラックボックス化を恒久的に防ぎます。

---

## 📊 自動化ジョブ一覧

| ジョブ名 | 実行環境 | トリガー / 頻度 | 主な役割 | 入力 / 対象 | 一時停止 / 制御方法 |
|---|---|---|---|---|---|
| **YouTube 新着巡回**<br>(`cloud_youtube_monitor.py`) | GitHub Actions<br>(`youtube-monitor.yml`) | 毎時 (0分) | 登録チャンネルの最新動画をAtom RSSで高速巡回し、新着を `youtube_queue` へ起票 | 登録チャンネル (7件)<br>※ShortsはワンポイントTipsとして許可 | Actions ワークフロー無効化<br>または `youtube_channels` テーブル無効化 |
| **YouTube 自動発掘**<br>(`prospector.py`) | GitHub Actions<br>(`prospector.yml`) | 1日3回<br>(03:00, 11:00, 19:00 JST) | 更新が古いチャンピオンをキーにYouTube全体を検索し、良質解説動画を発掘 | YouTube全体検索<br>※尺8〜40分、解説必須語ありのみ | Actions ワークフロー無効化<br>または `ENABLE_PROSPECTOR=0` |
| **動画解析ワーカー**<br>(`youtube_worker.py`) | GitHub Actions<br>(`youtube-worker.yml`) | キュー起票契機<br>＋定期実行 | 字幕/Whisper文字起こし/映像直接解析 ➔ Geminiで攻略バイブル・1分Tips生成 | `youtube_queue`<br>(status: `pending`) | Actions ワークフロー無効化<br>またはキュー全件 closed 化 |
| **Riot パッチ番犬**<br>(`check_patch_update.py`) | GitHub Actions | 1日2回 | DataDragon最新バージョン巡回、ステータス変更チャンピオン抽出 (Dirty Flag) | DataDragon 公式 API<br>(`versions.json`) | Actions ワークフロー無効化 |
| **KTM Bot 定期募集**<br>(`scheduled.js`) | Cloudflare Workers<br>(`ktm-os-worker`) | 毎週水曜 12:00 JST | 週末定期カスタム（土曜カード・日曜カード）の2枚を独立投稿 | Discord 対象チャンネル<br>`recruitments` テーブル | `wrangler.toml` の `crons` 編集<br>または環境変数フラグ |
| **KTM Bot リマインド ＆ 判定**<br>(`scheduled.js`) | Cloudflare Workers<br>(`ktm-os-worker`) | 金曜18:00 / 土曜12:00 / 日曜12:00<br>＋各日20:00判定 | 残り枠のお知らせ投稿、過去リマインド自浄、20:00開催判定返信 | 直近の募集カード<br>`recruitments` テーブル | 上記 Worker Cron に連動 |
| **試合終了監視デーモン**<br>(`auto_match_recorder.py`) | ローカル常駐<br>(PC起動時) | 常駐ポーリング<br>(10秒間隔) | LoLクライアント起動中の試合終了を検知し、戦術バイブルへ試合結果を同期 | Riot Live Client API<br>(`127.0.0.1:2999`) | プロセス終了 (`Ctrl+C` またはタスクマネージャー) |

---

## 🛠️ 各パイプラインの安全設計・制御フラグ

### 1. YouTube 解析パイプライン
- **登録チャンネル限定 vs 全体発掘の分離**:
  - `cloud_youtube_monitor.py`（登録チャンネル巡回）: 信頼できる解説者のみ。ShortsはTipsとして許可。
  - `prospector.py`（全体発掘）: 必須キーワード（解説・ガイド等）および尺8〜40分の多重フィルターでMontageやミームを完全遮断。
- **レート制限 (429) の安全弁**:
  - レート制限検知時は `retry_count` を消費せず `pending` のまま据え置き、その回の実行を即時打ち切る。
- **映像直接解析フォールバック**:
  - 実況音声・字幕のない動画（LoL Dobby等）は、Gemini に YouTube URL を直接渡す映像解析（`gemini_analyze_video`）で自動救済。低解像度メディア指定でトークン消費を抑制。

### 2. Discord Bot 募集パイプライン
- **土日カード完全分離**: 土曜カード・日曜カードが独立したメッセージおよびDBレコードとして管理される。
- **通知の自浄（自己削除）**: 新しいリマインド投稿時に古い「残り枠お知らせ」メッセージを自動DELETEし、チャンネルの散らかりを防止。
- **サイレント消灯**: 投稿から6時間以上経過した突発募集は、通知なしでタイトルを `[受付終了]` へ更新しボタンを完全撤去。

---

## 🔍 トラブルシューティング ＆ 緊急停止

1. **予期しない動画が大量にキューへ積まれた場合**:
   - `scripts/clean_youtube_queue.py --dry-run` で状況確認。
   - `python scripts/clean_youtube_queue.py --close-unwanted` で不要動画を一括クローズ。
2. **GitHub Actions の実行を止めたい場合**:
   - GitHub リポジトリ ➔ `Actions` タブ ➔ 対象のワークフロー ➔ `...` ➔ `Disable workflow`。
3. **ローカル常駐プロセスの確認**:
   - PowerShell: `Get-Process python*` で起動中スクリプトを確認し、不要な場合は `Stop-Process`。
