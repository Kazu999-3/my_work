# Bot 指示文38：自己紹介ウォッチャーを Bot Worker の Cron へ移行する

## 目的
自己紹介が投稿されてから Bot がオンボーディング処理（Portal `/api/onboarding/process-intro`）を走らせるまでの待ち時間を、現状の「数時間〜無期限」から「最大でも10分程度」に短縮する。

## 現状の問題（2026-11-25 01:07、ユーザー報告＋Muse 調査で確認）
- 2026-11-24 夜、自己紹介が投稿されてから **4時間経っても Bot が一切アクションしなかった**（ユーザー報告）。
- 現在の監視は GitHub Actions の `onboarding-intro-watcher.yml`（cron `*/15 * * * *`）が担っている。GitHub API で実行履歴を確認したところ、**2026-11-24 のスケジュール実行は 09:40 JST と 19:27 JST の2回だけ**だった（15分間隔なら約100回/日の計算）。19:27 以降は1回も実行されておらず、夜の自己紹介は翌日未明まで拾われていない。
- 手動実行（workflow_dispatch）と上記2回のスケジュール実行はいずれも **success** で、処理チェーン自体（Worker `/check-intro-pending` → Portal `/api/onboarding/process-intro`）は正常。**原因は GitHub Actions の高頻度 cron が大量に間引かれていること**であり、コードのバグではない。
- 結論：監視の置き場所を GitHub Actions から、既に定期実行の実績がある Cloudflare Workers Cron Triggers（Bot 本体）へ移す。

## やること
- [ ] `03_SYSTEMS/ktm_bot/wrangler.toml` の `[triggers] crons` に `*/5 * * * *`（5分間隔）を追加する。既存5本の曜日体系（Cloudflare の 1=日曜〜7=土曜）の注意書きに触れないこと。新規分は分・時フィールドのみで曜日を含まない。
- [ ] Bot の scheduled ハンドラ（`src/handlers/scheduled.js`）に、上記 cron 用の分岐を追加する：
  - 既存の `/check-intro-pending`（`src/index.js`）が持つ未処理判定ロジック（自己紹介チャンネルの直近メッセージ取得→未処理件数の算出）を共通関数化し、HTTP エンドポイントと scheduled の両方から使えるようにする。判定基準（対象チャンネル、開始日時、Riot ID 形式、処理済みの定義）は現行から一切変えない。
  - 未処理が1件以上ある場合のみ、Portal の `POST /api/onboarding/process-intro` を呼ぶ。認証は GitHub Actions 版が使っていたのと同じ Portal 側シークレット（Bot から Portal への既存の呼び出しと同じ方式）を使う。未処理0件なら Portal を呼ばずに終了する（現行の「ゼロ・ウェイスト」方針を維持）。
  - 実行記録は既存の `bot_cron_runs` への記録の仕組みに乗せる（job 名は `intro_watch` とする）。失敗時は既存の管理者アラート（notifyAdminError 等）の経路で通知する。
  - `scheduledJobName` にも `intro_watch` の判定を追加する。
- [ ] `.github/workflows/onboarding-intro-watcher.yml` は **schedule トリガーを外し、workflow_dispatch（手動実行）のみ残す**。二重処理を防ぐため。ファイル自体は残してよい（手動の非常用として）。
- [ ] デプロイ後、Bot の CI（bot-syntax）と KTM Bot Deploy が成功することを確認する。
- [ ] ローカルで Bot の構文チェック（既存の dry-run 手順）が通ることを確認してから push する。

## やらないこと
- Portal 側 `/api/onboarding/process-intro` の処理内容の変更。
- 未処理判定の基準（対象チャンネル・開始日時・形式・処理済みの定義）の変更。
- 既存5本の Cron Triggers の変更。
- `/check-intro-pending` エンドポイントの廃止（手動確認用に残す）。

## 完了条件
- Cloudflare 側の Cron で5分間隔にチェックが走り、`bot_cron_runs` に `intro_watch` の実行記録が継続して残ること。
- 自己紹介が投稿されてから、長くても10分程度で `process-intro` が実行される状態になること（次の実投稿、または検証用の投稿で確認）。
- GitHub Actions 側のスケジュール実行が発生しなくなること（workflow_dispatch の手動実行は引き続き可能）。
- 実施結果を DAILY_LOG に記録する際は、ユーザーの指示・合意があったかのような記述をしないこと（この指示文が根拠）。

## 未決事項（エージェントが勝手に決めない）
- なし。間隔（5分）・移行先（Worker Cron）・GitHub 側の扱い（手動のみ残す）は本指示文で確定。
