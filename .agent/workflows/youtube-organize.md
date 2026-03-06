---
description: YouTubeプレイリストを自動整理する（不適切動画削除 ＆ ジャンル振り分け）
---

YouTubeプレイリスト（整理前）の内容をスキャンし、不適切動画の削除とジャンル別の振り分けを実行します。

### ⚙️ Dashboard設定ガイド
整理ルールはスプレッドシートの `Dashboard` シートで管理します：
- **整理キーワード (カテゴリ名)**: タイトルに含まれるキーワード（カンマ区切り）で振り分けます。
- **整理チャンネル (カテゴリ名)**: 特定のチャンネル名（カンマ区切り）に一致する動画を振り分けます。
- **要約対象プレイリスト**: 帳票（Inventory）に出力したいプレイリスト名を指定します。

// turbo
1. YouTube整理プログラムを実行する
   `python src/main.py`
   (実行ディレクトリ: `d:\my_work\apps\youtube_manager`)

2. 実行結果を確認する
   - **ActivityLog**: 移動履歴を確認できます。
   - **Inventory**: 要約対象の動画が一覧化されます。要約が必要な動画は「要約実行」列にチェックを入れて再実行してください。
   [Antigravity YouTube 整理ダッシュボード](https://docs.google.com/spreadsheets/d/1WFPrFebduTxrlRAF535Q_T1JRvfTnJ8MW6FRopxH-Os)
