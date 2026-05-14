---
description: OLE Pro Beta の動画解析エンジン (yt-dlp + Gemini API) をバッチ起動し、対象のYouTube動画群の勝率に直結する情報を自動レポート化する手順。
---

# 🎥 OLE 一括解析 ワークフロー (/ole-analyze-batch)

KireiLOL等のハイレートなチャレンジャー・プロプレイヤーの動画から、「マクロ・ミクロのカンペ」を自動で抽出するバッチを走らせます。

## 📋 実行ステップ

### Step 1: 環境の事前チェック
1. ルートディレクトリ (`d:\my_work`) に `.env` が存在し、`GEMINI_API_KEY` が正しく設定されているかを確認します。
2. Pythonの仮想環境 (`.venv`) と必要なパッケージ (`yt-dlp`, `google-generativeai`, `python-dotenv`) が揃っているか監査します。

### Step 2: 解析エンジンの起動
1. `d:\my_work\scratch\batch_ole_analyzer.py` をバックグラウンドで（`WaitMsBeforeAsync`などを用いて）起動します。
2. アナライザは設定された動画（24本等）順番にダウンロードし、Gemini 1.5 Pro へ音声を投げて OLE Report を生成し続けます。

### Step 3: 状況トラッキングの開始
- 実行の `CommandId` を王に報告し、「現在裏側で動画を解析中です。結果は `03_FACTORY/note_drafts/ole_reports/` に順次出力されます」と伝達します。
