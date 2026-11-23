# 出所不明ボタン4系統の調査報告書

- **作成日**: 2026-11-23
- **対象**: `03_SYSTEMS/ktm_bot`（指示文31 項目6）
- **調査対象ボタン**:
  1. `bet_team:`（チーム勝敗ベット）
  2. `opgg_scout`（OP.GG スカウティング）
  3. `approve_knowledge:`（YouTubeナレッジワンクリック承認）
  4. `quick_substitute_*`（代替クイック募集）

---

## 1. 調査結果サマリー

| ボタン系統 | ボタン生成元（どこで作られているか） | Bot側ハンドラ | 押下時の処理成否 | 現状ステータス・所見 |
| :--- | :--- | :--- | :--- | :--- |
| **`bet_team:`** | **Portal API** (`04_PORTAL/src/app/api/discord/route.ts:295,301`) | `src/handlers/bet.js` (`handleBetButton`) | ✅ **正常に最後まで通る** (モーダル展開 ➔ 送信 ➔ `/api/bet` 記録) | **現役稼働中**。バランサーからチーム編成をDiscordへ告知する際に「🟦 BLUE にベット」「🟥 RED にベット」として付与される。 |
| **`opgg_scout`** | **生成箇所なし** (コードベース全体に生成処理が存在しない) | `src/handlers/buttons/adminQuickActions.js:145` | ⚠️ **ボタン自体が存在しないため押下不能**。コード単体としては `extractPlayersFromEmbed` でEmbedからチーム別プレイヤーを抽出し、OP.GG multi-search URL を組む実装が存在する。 | **孤立ハンドラ（未配線）**。チーム分けEmbedに「🕵️ OP.GGで両軍を偵察」ボタンを付ける構想の残骸、または手動テスト用の実装。 |
| **`approve_knowledge:`** | **生成箇所なし** (コードベース全体に生成処理が存在しない) | `src/handlers/buttons/portalBasics.js:65` | ⚠️ **ボタン自体が存在しないため押下不能**。コード単体としては管理者判定 ➔ `personal_knowledge` を `review_status: 'verified'` にPATCH ➔ ボタンを「承認済み」に差し替える実装が完成している。 | **孤立ハンドラ（未配線）**。YouTube解析完了時に管理者チャンネルへ飛ばす通知メッセージに付ける予定だったが、通知側のメッセージ生成が未実装のまま残ったもの。 |
| **`quick_substitute_*`** | **過去の生成元が廃止済み** (2026-10-03に `eventNotify.js` から撤去) | `src/handlers/buttons/notifySubstitute.js:50` | ⚠️ **ボタン自体が存在しないため押下不能**。コード単体は参加者リストをメッセージ本文に追記・解除し、ボタンラベルの人数を更新する処理。 | **廃止済み残骸**。20:00中止判定時に以前は「🎮 ノーマル行く人！」「🔥 ARAMやる人！」ボタンを出していたが、2026-10-03に「⚔️ 通常募集を立てる（`portal_recruit`）」へ統一されたため、ハンドラ側だけが取り残された。 |

---

## 2. 各ボタンの詳細調査

### ① `bet_team:` (チーム勝敗ベット)
- **生成元**: `04_PORTAL/src/app/api/discord/route.ts` (lines 286-312)
  バランサーからDiscordの対戦チャンネルへ編成 Embed を投稿する際、以下のようにコンポーネントが動的生成されています：
  ```ts
  payload.components = [
    {
      type: 1,
      components: [
        { type: 2, label: "🟦 BLUE にベット", style: 1, custom_id: "bet_team:BLUE" },
        { type: 2, label: "🟥 RED にベット", style: 4, custom_id: "bet_team:RED" },
        { type: 2, label: "🎲 Webカジノ / 番付", style: 5, url: `${portalBaseUrl}/casino` }
      ]
    }
  ];
  ```
- **処理フロー**:
  1. ユーザーがボタンを押下すると、`src/index.js:161` から `src/handlers/bet.js` の `handleBetButton` が呼ばれる。
  2. モーダル `bet_modal:BLUE` または `bet_modal:RED`（賭け金入力）が返る。
  3. モーダル送信時、`handleBetModalSubmit` が Portal の `/api/bet` を呼び出してコイン残高チェックとベット登録を実行する。
- **結論**:
  出所不明ではなく、**PortalとBotが連携して稼働している正常な現役機能**です。撤去・修正は不要です。

---

### ② `opgg_scout` (OP.GGスカウティング)
- **生成元**: **存在しない**。
  過去コミット `d7a537f4`（2026-10-07のリファクタリング）以前から `handlers/components.js` に存在していたが、ボタンそのものを生成する処理はリポジトリ内に見当たりません。
- **実装内容**:
  `interaction.message.embeds[0]` から `Team A` / `Team B` のプレイヤー名を `extractPlayersFromEmbed` で取り出し、Supabase の `ktm_players` から IGN（Riot ID）を引いて `https://www.op.gg/multisearch/jp?summoners=...` のURLを組み立てて返信する処理。
- **結論**:
  チーム分け結果メッセージに付ける想定で作られたが、生成側の配線が行われていない「未配線のスタブ機能」です。現状は実害がありませんが、使う予定がなければ将来的な棚卸しでハンドラ削除、または対戦発表Embedへのボタン追加のどちらかを判断する必要があります。

---

### ③ `approve_knowledge:` (ナレッジワンクリック承認)
- **生成元**: **存在しない**。
  `03_SYSTEMS/ktm_bot/src/handlers/buttons/portalBasics.js:65` にハンドラが実装されています。
- **実装内容**:
  `customId` の第2引数（`articleId`）を元に、Supabase `personal_knowledge` テーブルの該当レコードの `review_status` を `'verified'` に更新し、ボタン表示を「✅ 承認済み (by 管理者名)」に更新する。
- **結論**:
  YouTube解析スクリプト等からDiscord管理者用チャンネルに新着ナレッジ通知を投げ、そこからワンクリック承認させるワークフロー用として用意されたものですが、通知生成側が存在していません。Pilot側（`05_PILOT`）のレビュー画面で承認が行われているため、Bot側のこのハンドラは現在眠っている状態です。

---

### ④ `quick_substitute_*` (`quick_substitute_normal` / `quick_substitute_aram`)
- **生成元**: **廃止済み**（`03_SYSTEMS/ktm_bot/src/handlers/jobs/eventNotify.js:433` のコメント参照）。
  ```js
  // 2026-10-03: 以前は「21:00まで参加枠を開放しています／別モードで遊ぶことも可能です」という
  // 状況案内とノーマル・ARAMのクイック募集ボタンだったが、開催するのかしないのかが曖昧だった。
  // ユーザー指示により「中止」と明言し、遊びたい人向けに通常募集を立てるボタンだけを付ける。
  ```
- **結論**:
  2026-10-03に中止通知の仕様変更が行われた際、ボタンの生成側（`eventNotify.js`）は `portal_recruit` に差し替えられたものの、ハンドラ側（`notifySubstitute.js:50`）が削除されずに残存していた「旧仕様の残骸」です。
  今後押されることはないため、安全に撤去可能です。

---

## 3. 推奨アクション
1. `bet_team:`: そのまま維持（現役機能）。
2. `opgg_scout`: 必要性が低ければハンドラを削除、あるいはチーム発表Embedにボタンを追加。
3. `approve_knowledge:`: Discord上でのナレッジ承認フローを使わないならハンドラを削除。
4. `quick_substitute_*`: 生成側が既に存在しないため、ハンドラを安全に削除可能。
