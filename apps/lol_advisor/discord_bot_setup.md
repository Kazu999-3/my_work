# Discord Bot トークン取得ガイド 🤖

LoL AI アドバイザー（アンちゃん）を Discord で動かすために必要な「トークン」の取得手順です。

## ステップ 1: Discord Developer Portal にアクセス
1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセスして、自分の Discord アカウントでログインします。

## ステップ 2: アプリケーションの作成
1. 右上の **"New Application"** ボタンをクリックします。
2. 名前（例：`Antigravity-LoL-Advisor`）を入力し、規約にチェックを入れて **"Create"** を押します。

## ステップ 3: Bot の設定
1. 左メニューの **"Bot"** をクリックします。
2. **"Reset Token"** (または初回は "Copy Token") をクリックします。
3. 表示された長い文字列（トークン）を **コピーして大切に保管** してください。
    - **【警告】** トークンはパスワードと同じです。他人に教えたり、GitHub などに公開しないでください。

## ステップ 4: 必要な権限（Privileged Gateway Intents）の設定
同じ "Bot" 画面の下の方にある **"Privileged Gateway Intents"** セクションで、以下の 3 つを **ON** にしてください。これがないと、Bot がメッセージを読んだり送ったりできません。
- [x] **Presence Intent**
- [x] **Server Members Intent**
- [x] **Message Content Intent** (← これが特に重要です)

最後に一番下の **"Save Changes"** をクリックします。

## ステップ 5: Bot を自分のサーバーに招待する
1. 左メニューの **"OAuth2"** -> **"URL Generator"** をクリックします。
2. **"Scopes"** で `bot` と `applications.commands` にチェックを入れます。
3. 下に現れる **"Bot Permissions"** で `Administrator`（管理者）または必要な権限にチェックを入れます。
4. 一番下に表示された **"Generated URL"** をブラウザで開き、自分のサーバーを選択して招待します。

---
トークンが取得できたら、アンちゃんに教えてください！
`.env` ファイルに設定して、Bot のプログラムを作成します。
