---
name: Note & X Auto Publisher (Playwright版)
description: Playwrightを用いてnote.comへの下書き・有料記事の自動投稿および、X.comへの宣伝用連続ツイートスレッドの投稿を行う自動化スキル。
---

# 📝 note & X 自動投稿・プロモーション連携スキル (Note & X Auto Publisher)

このスキルは、Playwrightで構成された自動投稿エンジン `publisher.py` をコマンドラインから動作させ、生成したnote記事（有料・無料・下書き）の投稿および、X（Twitter）での拡散用ツリースレッド投稿を自律的かつシームレスに連携実行するためのエージェント用操作指示です。

## 🛠️ コマンド呼び出しの基本仕様

### 1. note.com への記事投稿（下書き保存 または 直接有料公開）
noteに記事を投稿します。本文はMarkdownファイルを直接指定するか、コマンドの文字列として渡すことができます。

- **下書き（Draft）として保存する（推奨・確認用）**
  ```bash
  .venv\Scripts\python.exe 03_SYSTEMS/v2_CORE/publisher.py note --title "【パッチ14.X】チャレンジャー直伝ジャングル解説" --body-file "02_FACTORY/note_drafts/target_article.md"
  ```
- **直接有料公開する（価格500円）**
  ```bash
  .venv\Scripts\python.exe 03_SYSTEMS/v2_CORE/publisher.py note --title "【パッチ14.X】チャレンジャー直伝ジャングル解説" --body-file "02_FACTORY/note_drafts/target_article.md" --publish --price 500
  ```
- **ログイン確認・初回ログイン実行時（ブラウザ画面を表示）**
  ```bash
  .venv\Scripts\python.exe 03_SYSTEMS/v2_CORE/publisher.py note --title "テスト" --body "テスト本文" --no-headless
  ```

### 2. X.com (Twitter) への連載スレッド（ツリー）投稿
Xへ連投スレッドを投稿します。ツイートはカンマ区切りまたは、JSON配列ファイルから直接ロードできます。

- **JSONファイルからロードしてスレッド投稿（推奨）**
  ```bash
  .venv\Scripts\python.exe 03_SYSTEMS/v2_CORE/publisher.py x --tweets-json "02_FACTORY/note_drafts/tweets.json"
  ```
- **ログイン確認・初回ログイン実行時（ブラウザ画面を表示）**
  ```bash
  .venv\Scripts\python.exe 03_SYSTEMS/v2_CORE/publisher.py x --tweets "テスト投稿1" "テスト投稿2" --no-headless
  ```

---

## 🔒 永続セッション管理とログインの絶対防衛ルール

1. **セッションデータの保存先**:
   - X（Twitter）: `D:/my_work/.agent/playwright_data/x_profile`
   - note.com: `D:/my_work/.agent/playwright_data/note_profile`
   - プロファイルにはCookie、LocalStorage、セッションデータがすべて自動で永続保存されます。

2. **ログイン切れ（401 / リダイレクト）の対処**:
   - 通常は `headless` モード（非表示）で動作しますが、セッション切れを検知するとプロセスは即座に `FAILED` で終了します。
   - `FAILED` になった場合、または初回稼働時は、必ずユーザーにチャット上で「**ヘッドフル（画面表示）モードでの初回ログイン**」を促し、人間による手動認証（2FA、確認コード）を実行してもらってください。
   - **手動ログインを促す際の手順**:
     - `python 03_SYSTEMS/v2_CORE/publisher.py note --title "ログイン用テスト" --body "ログイン" --no-headless` を実行。
     - ブラウザが開いたらユーザーに手動でログイン手続きを完了してもらい、エディタ画面（note）またはホーム画面（X）が表示されるのを確認後、コンソールで待機が解除されるのを待つ。

3. **投稿履歴の確認**:
   - 投稿完了時、コンソールに `SUCCESS:URL` が出力され、Supabase DB の `published_posts` テーブルにも履歴（プラットフォーム名、記事タイトル、URL）が自動的に保存されます。
