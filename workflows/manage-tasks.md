---
description: スプレッドシート上のタスク管理（追加・確認・更新）を行う
---

ユーザーからタスクの追加・一覧表示・ステータス更新の指示があった場合、AIアシスタントは `apps/youtube_manager/src/task_manager.py` を使用してスプレッドシート上の「Tasks」シートと連携します。

## 1. タスクを追加する (`/add-task`)
ユーザーが「〇〇をタスクに追加して」や `/add-task [内容]` のように指示した場合：
- 内容から「タスク名」「カテゴリ」「優先度（高/中/低）」「期限（YYYY-MM-DD）」を推測、またはユーザーに確認します。
- 以下のコマンドを実行してタスクを追加します。
  ```bash
  python d:\my_work\apps\youtube_manager\src\task_manager.py add --name "タスク名" --category "カテゴリ" --priority "優先度" --due "期限"
  ```
- 追加完了後、ユーザーに追加されたタスクの内容を報告します。

## 2. タスクを一覧表示する (`/list-tasks`)
ユーザーが「現在のタスクを教えて」や `/list-tasks` と指示した場合：
- 以下のコマンドを実行して、現在のタスク一覧を取得します。
  ```bash
  python d:\my_work\apps\youtube_manager\src\task_manager.py list
  ```
- 特定のステータス（例：未着手のみ）で絞り込む場合は `--status "未着手"` を付与します。
- 取得した結果を見やすいMarkdownリスト形式でユーザーに提示します。

## 3. タスクのステータスを更新する (`/update-task`)
ユーザーが「〇〇のタスクを完了にして」や `/update-task [タスク名] [新しいステータス]` と指示した場合：
- 以下のコマンドを実行してステータスを更新します。
  ```bash
  python d:\my_work\apps\youtube_manager\src\task_manager.py update --name "タスク名の一部" --status "完了"
  ```
- 更新完了後、ユーザーに結果を報告します。
