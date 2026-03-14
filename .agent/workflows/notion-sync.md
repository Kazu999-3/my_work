---
description: Notionのメモ帳をローカルのmemoフォルダに同期する
---

# Notionメモ同期ワークフロー

Notionに保存したメモ（URL要約含む）を、ローカル環境の「memo」フォルダにMarkdownファイルとして出力します。

## 実行方法

### 1. バッチファイルで実行 (推奨)
ルートディレクトリにある `SYNC_MEMO.bat` をダブルクリックしてください。

### 2. 手動でコマンド実行
```powershell
python d:\my_work\apps\hybrid_bot\src\notion_to_local.py
```

## 出力内容
- **保存先**: `d:\my_work\knowledge\memo/`
- **形式**: `YYYYMMDD_タイトル.md`
- **内容**: メモのタイトル、元URL、AIによる要約

## ヒント
- iPhoneのショートカットなどでNotionにメモを飛ばした後、このワークフローを実行することでPC側で即座にその内容をテキストとして利用できるようになります。
