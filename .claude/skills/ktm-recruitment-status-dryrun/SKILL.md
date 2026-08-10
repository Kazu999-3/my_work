---
name: ktm-recruitment-status-dryrun
description: KTM Botの「定期カスタム募集(シルバー以下/ゴルプラ2部門)」の埋め込み色・状態文言ロジック(03_SYSTEMS/ktm_bot/src/utils/recruitmentStatus.js)を、Discordに実投稿せず全参加人数パターンで検証するスキル。募集カードの色分岐(募集中/混合カスタム可能/開催確定)や残数バナーのロジックを変更する時、components.js/scheduled.jsの募集人数まわりを触る時に必ず使うこと。実際にDiscordへ投稿してから間違いに気づくと、参加者に誤った状態(満員なのに募集中のまま等)を見せてしまう。
---

# KTM Recruitment Status Dry-Run

## 背景

KTM Botの定期カスタム募集カードは、シルバー以下/ゴルプラの2部門合計で「募集中(琥珀色)→混合カスタム可能(黄色)→開催確定(緑)」の3状態を持つ。このロジックは元々`components.js`(ボタン押下時)と`scheduled.js`(定期同期アナウンス)の2箇所に別々に実装されており、2026-08-10に「募集中」状態の色コードが2箇所で食い違っていた(片方は琥珀色0xc89b3c、もう片方は赤0xe74c3c)ことが発覚した。

これを`03_SYSTEMS/ktm_bot/src/utils/recruitmentStatus.js`の`computeRecruitmentStatus()`/`buildStatusBanner()`という共通の純粋関数に一本化した。今後この閾値ロジック(定員・境界条件)を変更する際は、両方の呼び出し元を手で書き換えるのではなく、この共通関数だけを直す。

## 使い方

```bash
cd 03_SYSTEMS/ktm_bot
node scripts/dry_run_recruitment_status.mjs
# または
npm run dryrun:recruitment
```

Discord APIを一切呼ばず、以下の代表的な参加人数パターン(境界値・異常値含む)を`computeRecruitmentStatus()`に通し、色・`isConfirmed`/`isMixedReady`フラグ・バナー文言を一覧表示する。あわせて「confirmedとmixedReadyが同時にtrueにならない」等の不変条件も自己検証し、違反があれば非ゼロ終了する。

## いつ使うか

- `recruitmentStatus.js`の閾値(定員10名等)やcapacity引数を変更した時
- `components.js`/`scheduled.js`で募集カードの色・文言まわりを触った時
- 「満員なのに募集中のまま」「混合カスタムの黄色にならない」等の不具合報告を受けて原因を切り分けたい時

出力の`color`列が想定と違う、または不変条件違反が出た場合は、実際にDiscordへ投稿する前に`recruitmentStatus.js`を修正すること。

## 既知の落とし穴 (Known Pitfalls)

- **(2026-08-10)** このスクリプトは`computeRecruitmentStatus()`の計算結果のみを検証する。Discord埋め込み(`targetEmbed`)への反映漏れや、`relatedMsgs`への同期漏れ(募集カードとアナウンスメッセージの色がズレる等)まではカバーしない——それらは実機テスト(テスト用チャンネルでのボタン押下)で別途確認すること。
