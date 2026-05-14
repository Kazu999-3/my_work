---
description: KTMボットのWorker.jsやCode.gs(GAS)を修正した後、安全に本番環境へのテストおよびデプロイを行う一貫ワークフロー。
---

# 🚀 KTM 統合デプロイ・ワークフロー (/ktm-deploy)

KTMシステム（Cloudflare Workers + Google Apps Script）に変更を加えた際、このプロトコルを実行することで、安全かつ迅速に両環境へのデプロイを行います。

## 📋 実行ステップ

### Step 1: 依存関係と構文の自己検証
1. `ktm-architect` スキルをロードし、今回変更した `Worker.js` や `gas/src/` のコード間で、APIインタフェースのズレがないか（JSONのやり取りなど）を監査します。
2. 問題があれば、ここで修正提案をユーザーに行い [y/n] の承認を得ます。

### Step 2: GAS (Google Apps Script) 側のデプロイ
1. カレントディレクトリを `02_ENGINE/ktm_bot/gas` に移動します。
2. `clasp push` を実行し、クラウド上のGASプロジェクトに最新のモジュール群を同期させます。
3. （必要であれば `clasp deploy` を行い、Webアプリのバージョンを更新します）。

### Step 3: Cloudflare Workers 側のデプロイ
1. カレントディレクトリを `02_ENGINE/ktm_bot/` に移動します。
2. `npx wrangler deploy` または指定されたコマンドを実行し、Workerを最新化します。

### Step 4: 完了報告
- デプロイの完了と、新しいWebアプリURL（変更があった場合）を `walkthrough.md` にて王に報告します。
