# 🤖 Sovereign OS 常駐デーモン ＆ 自動化スクリプト完全仕様書 (DAEMONS_GUIDE)

本ドキュメントは、ローカルPCおよびバックグラウンドで常駐稼働するデーモン・スクリプト・バッチファイルの公式管理仕様書です。

---

## 🏛️ 3大デーモンの概要 ＆ 状態確認

ルート直下の `status.bat` を実行することで、常時稼働状況・PID・ログサイズ・スタートアップ登録を一括点検できます。

```cmd
d:\my_work\status.bat
```

| デーモン名 | 役割 | 起動コマンド | 停止コマンド | ログファイル |
| :--- | :--- | :--- | :--- | :--- |
| **Sovereign Edge Worker** | YouTube動画キューの監視、字幕取得、Gemini戦術抽出、ライブラリ自動保存、DBタスク実行 | `start_edge_worker.bat`<br>`start_edge_worker.ps1` | `stop_edge_worker.bat`<br>`stop_edge_worker.ps1` | `03_SYSTEMS/logs/edge_worker.log` |
| **KTM Match Watcher** | LoL起動・対戦中（Live Client API）を監視し、試合終了時に自動で戦績取得・反省メモを準備 | `start_match_watcher.bat` | `stop_match_watcher.bat` | `00_LOGS/sovereign_os.log` |
| **Sovereign HUD Overlay** | 試合中に画面端で対面の癖・時間帯目標・HUDデータを常時表示する実戦オーバーレイ | `03_SYSTEMS/start_overlay.bat`<br>（またはWeb版 `/overlay`） | `03_SYSTEMS/stop_overlay.bat` | `00_LOGS/overlay.log` |

---

## 🚀 一括起動 ＆ Windows 自動起動管理

### 1. 全デーモンの一括起動
PC起動後や手動再起動時は、ルート直下の `start_all.bat` を実行します。
Edge Worker と Match Watcher がバックグラウンド（サイレント）で立ち上がります。

```cmd
d:\my_work\start_all.bat
```

### 2. Windows スタートアップ（PC起動時の自動常駐）
PCの起動時に自動でバックグラウンド常駐させるためのスクリプトです。
- **登録**: `powershell -ExecutionPolicy Bypass -File scripts/register_startup.ps1`
- **解除**: `powershell -ExecutionPolicy Bypass -File scripts/unregister_startup.ps1`

ショートカット配置先:
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
- `Sovereign_Edge_Worker.lnk`
- `KTM_Match_Watcher.lnk`
- `Sovereign_HUD_Overlay.lnk`

---

## 🛠️ トラブルシューティング ＆ よくある質問

### Q1. Edge Worker が二重起動していないか心配
`status.bat` で表示される PID が複数ある場合（例: `19388, 19408, 19420`）、これは Python のプロセス監視ラッパーとメインデーモン、およびサブプロセスによる正常な親子関係です。
強制再起動したい場合は、`stop_edge_worker.bat` ➔ `start_edge_worker.bat` を実行してください。

### Q2. ログが肥大化しないか？
`start_edge_worker.ps1` には自動ログローテーション機能が組み込まれており、ログファイルが3MBを超えた場合、起動時に自動的に最新2,000行を残してトリミングされます。
