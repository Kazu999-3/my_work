# データベース異常行の発生元調査報告書 (SPEC04-anomaly-records.md)

本ドキュメントは、`05_PILOT/docs/specs/04-numbers-and-labels-followup-SPEC.md`（SPEC 04）に基づき、Supabaseの `champion_facts` および `matchup_sentinel` テーブル内に検出された3件の異常行（`template`、`Lee Sin` / `LeeSin`、`ヴァイ` / `Vi`）について、発生経緯・投入スクリプト・発生原因を特定・整理した調査報告である。
※SPECの指示に基づき、本フェーズでは**DB行の削除・統合は行わず、事実の特定と報告のみ**を行う。

---

## 1. 検出された異常行の一覧

| 異常行の識別子 (champion) | 該当テーブル | 本来の正本ID (173体) | 状態 |
| :--- | :--- | :--- | :--- |
| `template` | `champion_facts`, `matchup_sentinel` | なし（不要行） | 空データ／テンプレート |
| `Lee Sin` | `champion_facts`, `matchup_sentinel` | `LeeSin` | スペース混入による重複行 |
| `ヴァイ` | `champion_facts`, `matchup_sentinel` | `Vi` | 日本語カタカナ混入による重複行 |

---

## 2. 各異常行の発生元の詳細調査

### ① `template` 行の発生元
- **発生原因**: 戦術バイブルMarkdown群の初期一括DBインポート処理におけるファイルパース誤認識。
- **投入スクリプト**: 初期にローカルの戦術Markdown（`01_INTEL/_TACTICS/*.md`）を一括走査して Supabase へシード投入したスクリプト（`generate_tactics_bible.py` や初期同期処理）。
- **経緯**:
  - `01_INTEL/_TACTICS/template_tactics_bible.md` というバイブル執筆ひな型ファイルが存在していた。
  - スクリプトが正規表現 `([a-zA-Z0-9_]+)_tactics_bible\.md` でファイル名をパースした際、`template` をチャンピオンの英語IDとして抽出。
  - そのまま `champion = 'template'` として `champion_facts` および `matchup_sentinel` に INSERT された。

### ② `Lee Sin` / `LeeSin` の重複発生元
- **発生原因**: 外部データソース（YouTube・OP.GG・Lolalytics・Reddit等）からの抽出時におけるスペース正規化の漏れ。
- **投入スクリプト**: `scripts/extract_video_tactics.py` および `scripts/article_pipeline.py`。
- **経緯**:
  - Riot Games 公式 DataDragon ではキーがスペースなしの `LeeSin` であるのに対し、外部サイトや動画タイトルでは一般的に `Lee Sin`（空白入り）と表記される。
  - 初期の動画抽出・知見保存スクリプトにおいて、空白を除去する正規化 `replace(" ", "")` が一部の処理経路で抜けていたため、`champion = 'Lee Sin'` として新規行が INSERT された。
  - 一方で DataDragon 直接同期や一部スクリプトからは `LeeSin` が INSERT され、DB上に2行が併存することになった。
  - 後に `scripts/sync_dict_health.py`（Line 311: `"lee sin": "LeeSin"`）や `extract_video_tactics.py`（Line 43）で正規化ルールが追加されたが、既存のDB行の統合・削除は手つかずのまま残っていた。

### ③ `ヴァイ` / `Vi` の重複発生元
- **発生原因**: 日本語動画タイトル・記事要約からのチャンピオン名自動判定における英語ID変換の漏れ。
- **投入スクリプト**: 初期の記事承認・要約抽出スクリプト（`article_pipeline.py` 初期版）。
- **経緯**:
  - 短いチャンピオン名（Vi、Sett、Lulu等）は一般的なカタカナ単語（リセット、ルール等）との誤爆を防ぐため判定ロジックが複雑化していた。
  - 日本語タイトル「ヴァイ解説」から日本語名 `ヴァイ` を抽出した際、`champAliases` による英語ID `Vi` への変換を通さずに、日本語名のまま `champion` カラムへ書き込んだレコードが発生した。
  - DataDragon 側には英名 `Vi` で登録されていたため、`Vi` と `ヴァイ` の2行が共存する状態となった。

---

## 3. なぜ総数のズレ（173 / 175 / 176）を引き起こしたか
- 正本実数は `champions_summary.json` の **173体**。
- しかし、DBの `champion_facts` や `matchup_sentinel` テーブルに対して `COUNT(*)` を実行すると：
  - 正本173体 ＋ `template`（+1） ＋ `Lee Sin`（+1） ＝ **175行**（または `ヴァイ` 含む **176行**）
- これにより、DBの全行数をそのまま画面に出していたダッシュボード（176）や旧健全性監査（175）で数字の食い違いが発生していた。
- SPEC 01 および SPEC 04 により、API・画面側で `champions_summary.json` の正本173体を基準としてフィルタリング・集計を行う改修が完了したため、現在は画面上の表示ズレは完全に解消されている。

---

## 4. 今後の処置方針の選択肢（未決事項）

| 選択肢 | 内容 | メリット | リスク・懸念点 |
| :--- | :--- | :--- | :--- |
| **案A: DB行を安全に削除・統合する** | 1. `template` 行を DELETE<br>2. `Lee Sin` の蓄積データを `LeeSin` へマージ後に削除<br>3. `ヴァイ` の蓄積データを `Vi` へマージ後に削除 | DBが完全に正本173行と一致し、将来のスクリプトでの潜在的バグが根絶される | 外部キー制約や依存テーブル（`personal_knowledge` 等）の事前調査と慎重なマイグレーション作業が必要 |
| **案B: DB行は残し、アプリ層の正本フィルターを継続運用する** | DBの行は一切変更せず、現行の `champions_summary.json` 突合による除外・正規化をそのまま維持する | DB破壊リスクがゼロ。既存の動作に影響を与えない | DB直接参照スクリプト（SQL等）で再度175/176行とカウントされる可能性がある |
