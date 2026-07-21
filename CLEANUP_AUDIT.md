# 不要コード・重複調査レポート

調査日: 2026-07-21 ／ 対象: `04_PORTAL`（TSX/TS 152ファイル）, `03_SYSTEMS`（Python 38 + Bot 11）, `.github/workflows`

> **対応状況（2026-07-21 実施済み）**
> A / B-1 / B-2 / B-3 / B-4 はすべて対応完了。詳細は末尾の「対応記録」を参照。
> 未着手は **C（要確認）** のみ。

判定は「参照が1件もないこと」を機械的に確認したうえで、動的import・cron設定・外部からの直接アクセスまで個別に裏取りしている。

---

## A. 安全に削除できるもの

根拠を確認済み。消してもどこからも参照されない。

| 対象 | 行数 | 根拠 |
|---|---:|---|
| `04_PORTAL/src/components/RadarChart.tsx` | 92 | リポジトリ全体で参照ゼロ。同等機能は `ScoutingReport.tsx` が担っている |
| `04_PORTAL/src/lib/recruitPermission.ts` | - | 参照ゼロ。実際に使われているのは Bot 側の `ktm_bot/src/utils/recruitPermission.js` のみ。ファイル冒頭のコメントが「Bot側と同じ基準を使うこと」と述べており、移植したまま使われなかったと見られる |
| `03_SYSTEMS/ktm_bot/src/utils/balancer.js` | 150 | Bot 内から参照ゼロ。チーム分けは Portal の `lib/balancer.ts`（823行）が実装しており、こちらは旧版の残骸 |
| `04_PORTAL/src/app/api/collab-tasks/` (+`[id]`) | - | 呼び出し元ゼロ。対応するUIも存在しない |
| `04_PORTAL/src/app/api/discord/join/` | - | 呼び出し元ゼロ |

---

## B. 重複していて、片方が古い

**放置すると事故につながる**ため、A より優先度が高い。

### B-1. MMRリビルドが2実装ある 🔴

| | `api/mmr/rebuild` | `api/admin/rebuild-mmr` |
|---|---|---|
| 行数 | 26 | 294 |
| 実装 | `lib/mmr.ts` の `performFullMmrRebuild` を呼ぶ | ルート内に独自実装 |
| discord_id での名寄せ | ✅ | ❌ |
| `initial_prefs` の凍結 | ✅ | ❌ |
| `mmr_breakdown` の記録 | ✅ | ❌ |
| 画面からの呼び出し | あり | **なし**（設計メモに記載があるのみ） |

`admin/rebuild-mmr` は、名前ベースの名寄せだった時代の実装がそのまま残っている。もし何かの拍子に叩かれると、**discord_id 対応前の計算結果で全プレイヤーのMMRが上書きされる**。削除を推奨。

### B-2. Supabaseクライアントの生成が21ファイルに散在 🟡

`lib/supabaseAdmin.ts` があるのに、APIルート21本が個別に `createClient()` している。うち16本は下記のまったく同じ定型文。

```ts
process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
```

`supabaseAdmin` にはサービスロールキー未設定時の警告ログが入っているが、**個別生成した16本はその警告を通らない**。キー設定漏れに気付けないまま anon キーで動き、RLS で書き込みが黙って失敗する経路が残っている。

### B-3. Gemini呼び出しがリトライを通らない経路が2本 🟡

`lib/geminiClient.ts` の `callGeminiWithRetry`（429/503リトライ + 日本語強制ガード）を経由せず、直接APIを叩いている。

- `api/admin/knowledge/add/route.ts`
- `api/match/analyze-image/route.ts`

レート制限時にリトライされず即失敗し、日本語ガードも効かない。以前「辞典が英語になる」問題が起きた経路と同じ構造。

### B-4. Discord表示名の解決が3箇所に重複 🟡

`m.nick || m.user.global_name || m.user.username` が `discord/members`（2箇所）と `discord/participants`（1箇所）に散在。以前「管理ダッシュボードとチーム分けで名前が一致しない」不具合が起きたのは、まさにこの식が片方だけ違っていたため。共通関数にすべき。

---

## C. 要確認（消してよいが、意図を知りたい）

| 対象 | 状況 |
|---|---|
| `04_PORTAL/src/app/admin/soloq/page.tsx` | どこからもリンクされていない。設計メモには「管理者専用 `/admin/soloq`」と記載があるので、URL直打ち運用の可能性あり |
| `03_SYSTEMS/v2_CORE/` の7本 | `apply_patch.py` / `archivist.py` / `auditor.py` / `prospector.py` / `resume_publish.py` / `note_analytics_daemon.py` / `x_analyzer.py` はどこからも import されず、CIからも起動されない。note収益化系の旧機能と見られる |
| `03_SYSTEMS/v2_CORE/test_*.py` 7本 | 通常のテストランナーから外れた手動実行スクリプト。動くかは未検証 |
| `absorber.yml` / `monetization.yml` | 定期実行は停止済み（手動のみ）。参照先スクリプトが存在しないため、復活させるなら要修正 |

---

## D. 消してはいけない（誤検知）

自動検出では未使用に見えるが、実際は使われている。

| 対象 | 実際の呼び出し元 |
|---|---|
| `api/cron/soloq-coach` | `vercel.json` の cron 定義（毎日22:00 UTC） |
| `api/push/send` | `api/match/record` が `sendPushToAll` を動的import |
| `lib/edgeTask.ts` | `admin/champions/trend` と `admin/jobs` が動的import |
| `components/Sidebar.tsx` / `PwaRegister.tsx` | `app/layout.tsx`（ダブルクォートのimportで検索から漏れやすい） |

---

## E. その他の気付き

- **マイグレーション番号 24 が重複**（`24_add_participant_mmr.sql` と `24_initial_prefs.sql`）。`_migrations` テーブルはファイル名で管理しているため実害はないが、次に追加する人が混乱する
- **28番が欠番**。「上達の原則」をレーンガイドへ統合した際に削除した跡で、これも実害なし
- **`edge_tasks` を積むAPIが3本ある**が、処理するのはローカルの `edge_worker_daemon.py` のみ。PCを起動しない限りタスクは溜まり続ける

---

## 推奨する着手順

1. **B-1**（古いMMRリビルドの削除）— 事故リスクがあるため最優先
2. **B-3**（Gemini直叩き2本の統一）— 再発済みの不具合と同じ構造
3. **A**（未参照ファイルの削除）— 低リスク
4. **B-2 / B-4**（共通化）— 挙動を変えるため、テストを添えて段階的に

---

## 対応記録（2026-07-21）

### 完了

| 項目 | 内容 |
|---|---|
| **A** | 5対象すべて削除。設計メモの `rebuild-mmr` 記載も現行API (`api/mmr/rebuild`) へ修正 |
| **B-1** | `api/admin/rebuild-mmr`（294行）を削除 |
| **B-2** | 個別 `createClient()` が **21ファイル → 0** に。すべて `lib/supabaseAdmin` 経由となり、サービスロールキー未設定の警告が全経路で効くようになった |
| **B-3** | `knowledge/add` と `match/analyze-image` を `callGeminiWithRetry` 経由へ |
| **B-4** | `lib/discordName.ts` に集約。3箇所の重複を解消 |

### 副次的な改善

- **共通Geminiクライアントに複数APIキーのローテーションを追加**した。従来 `analyze-image` だけが持っていた「カンマ区切りで複数キーを指定し、429なら別キーへ回す」機能を、統一の過程で共通化。**全てのAI機能がこの恩恵を受ける**（環境変数に複数キーを設定していれば、レート制限で全滅しにくくなる）
- 共通クライアントが**画像入力に対応**（`image: { base64, mimeType }`）
- `resolveDisplayName` は**空文字のニックネームを未設定として扱う**。従来の `||` 連鎖は空文字を真値として扱わないため偶然動いていたが、意図として明示しテストで固定した

### 検証

- `tsc --noEmit`: エラー0
- ユニットテスト: **22件通過**（mmr 17 + discordName 5 ※新規）
- `balancer.test.ts` はサンドボックスの実行時間上限を超えるため未実行。今回の変更対象外（`lib/balancer.ts` は未変更）
