# 指示文：通知・Discordメッセージ内の死リンク修正

作成: 2026-11-20（Muse 調査）
対象: 04_PORTAL / 03_SYSTEMS(ktm_bot) / scripts

## 目的

通知やDiscordメッセージに含まれるリンクのうち、本番で開けない「死リンク」が見つかったので、実在するページへ付け替える。

## 調査結果（2026-11-20 本番実測）

### 確定の死リンク

| # | 飛ばし元 | リンク先（現状） | 実測 | 本来の飛ばし先 |
|---|---|---|---|---|
| 1 | 師弟ペア成立時のDiscordスレッド歓迎メッセージ「戦績コーチング・リプレイ監査」 | `https://my-work-8jbd.vercel.app/coach` | **404** | Pilot のコーチページ `https://ktm-pilot.vercel.app/coach`（実在・200） |
| 2 | KTM Bot の記事承認ボタン「ポータルで確認」 | `https://my-work-8jbd.vercel.app/admin/knowledge` | **削除済みページ**（未ログイン時はログイン画面へ飛ぶため一見正常に見えるが、ログインすると404。削除されたことは `04_PORTAL/src/lib/dictFactCheck.ts` のコメントにも明記） | Pilot の記事承認画面 `https://ktm-pilot.vercel.app/admin/review`（記事承認は 05 へ移行済み） |

### 条件付きで死ぬリンク

| # | 飛ばし元 | 内容 |
|---|---|---|
| 3 | ポータル側の通知ベル（`04_PORTAL/src/components/NotificationBell.tsx`）のクイックアクション | coach_review / soloq 系は `/coach`、dict_review は `/admin/dict-health` へ相対リンクしている。どちらもポータルには無いページ（Pilot のページ）。Pilot 側のベルにはドメイン振り替え処理（resolveNotificationUrl）があるため Pilot から押せば正常だが、ポータルのベルから押すとポータルドメイン上で 404 になる |

### 生存確認済み（変更不要）

`/mypage` `/mentorship` `/casino` `/guide` `/history` `/balancer` `/leaderboard` `/ktm-admin`、Pilot の `/coach`（ログイン必須は正常）

### ついでに見つけた要確認

- `scripts/youtube_worker.py` の通知先デフォルトが旧ドメイン `https://ktm-portal.pages.dev` のまま（現在は Cloudflare Access のログイン画面が返る）。`PORTAL_URL` 環境変数が本番で正しく設定されていれば実害はないが、未設定だと通知が旧環境へ飛ぶ。

## やること

- [ ] #1: `04_PORTAL/src/lib/discordMentorship.ts`（677行付近）の「戦績コーチング・リプレイ監査」のリンク先を `https://ktm-pilot.vercel.app/coach` に変更する。`PORTAL_BASE_URL` と混同しないよう、Pilot 用の定数を分けること
- [ ] #2: `03_SYSTEMS/ktm_bot/src/handlers/buttons/portalBasics.js`（96行付近）の「ポータルで確認」ボタンの URL を `https://ktm-pilot.vercel.app/admin/review` に変更する。ボタン文言も実態に合わせて調整してよい（例:「記事承認画面で確認」）
- [ ] #3: ポータル側 NotificationBell のクイックアクションに、Pilot 側 NotificationBell の `resolveNotificationUrl` と同じ振り替えを入れる（Pilot のパスは Pilot の絶対URLへ、それ以外は従来どおり）。Pilot 側の実装を正として揃えること
- [ ] 要確認: `scripts/youtube_worker.py` の `PORTAL_URL` 環境変数が本番で設定されているか確認する。デフォルト値は現行の `https://my-work-8jbd.vercel.app` に付け替える

## やらないこと

- 通知・メッセージの文面やレイアウトの変更（#2 のボタン文言の微調整を除く）
- リンク先ページ自体の新規作成（/coach をポータルに作るなど）
- 上記以外のファイルの変更

## 完了条件

- Portal は `npm run build` が成功してからプッシュする
- Bot は通常のデプロイ手順で反映する
- 修正後、新規に飛ぶ通知・メッセージのリンクがすべて実在ページへ着地することを報告に含める

## 注意

- 既に投稿済みの Discord メッセージ内のリンクはこの修正では直らない（新規投稿分から有効）。過去分の救済が必要かどうかはユーザーが判断するので、勝手に再投稿などしないこと
- 未決事項を勝手に決めないこと。判断に迷う点は報告に明記して止めること
