# 報告1（F-2）：「編集・統合履歴」モーダルの両案の影響範囲

作成日: 2026-11-22  
対象: `05_PILOT`  
根拠指示文: `05_PILOT/docs/specs/22-missing-reports-instruction.md`（SPEC 19 / 指示文21 の未決事項 F-2）  
※ 本報告は調査・比較の提出のみであり、コードの復活・削除はいずれも未実施（ユーザー判断待ち）。

---

## 1. 現状の整理

`05_PILOT/src/app/page.tsx` には履歴モーダルの開閉ステート `isRevisionModalOpen` と `<RevisionHistoryModal>` が実装されており、`ChampionHeroBanner` へも `setIsRevisionModalOpen` が渡されています。  
しかし、`setIsRevisionModalOpen(true)` を実際に呼び出すUI要素を持つ `ToolPaletteModal`（`05_PILOT/src/app/_champions/ToolPaletteModal.tsx`）がどのファイルからも `import` / 描画されておらず、`ChampionHeroBanner` 側も受け取った `setIsRevisionModalOpen` を未使用のため、画面から履歴モーダルを開く導線が丸ごと行き止まりになっています。

---

## 2. 履歴データの実在確認

- **保存先テーブル**: Supabase `knowledge_revisions` テーブル
- **書き込み処理（稼働中）**:
  - `05_PILOT/src/lib/championFactsMerge.ts`（L222）: チャンピオン知見（強み・弱み等）のマージ更新時に履歴を insert
  - `05_PILOT/src/lib/knowledgeIntegrate.ts`（L43）: 記事承認・統合時に履歴を insert
  - `05_PILOT/src/lib/matchupMemo.ts`（L18）: 対面メモ更新時に履歴を insert
  - `05_PILOT/src/app/api/admin/dict-maintenance/route.ts`（L98, L170）: 管理エディタでの保存時にも履歴を insert
- **読み取りAPI**: `05_PILOT/src/app/api/admin/revisions/route.ts`（`GET /api/admin/revisions?champion=...`）が存在し、`knowledge_revisions` から `target_key`（英語ID・日本語名・`champ_<id>_global` 等）で最大100件を取得して返します。
- **結論**: 履歴データと取得APIは**実在し、現在も継続して記録が蓄積されています**（本セッションでは本番DBへの直接クエリは行っていないため実レコード件数は未計測ですが、上記4箇所の自動・手動更新経路から保存される構造です）。したがって、案 (a) で導線を復活させた場合、対象チャンピオンの更新履歴が存在する限りそのまま表示されます。

---

## 3. 案 (a)：ToolPaletteModal を配線して機能を復活させる

### 関係ファイル一覧
| ファイル | 役割 |
|---|---|
| `05_PILOT/src/app/page.tsx` | `isRevisionModalOpen`（L81）と `<RevisionHistoryModal>`（L287-L292）を保持 |
| `05_PILOT/src/app/_champions/ToolPaletteModal.tsx` | 各種管理ツールと `setIsRevisionModalOpen(true)`（L114）のボタンを保持（現在どこからも未参照） |
| `05_PILOT/src/app/_champions/ChampionHeroBanner.tsx` | `setIsRevisionModalOpen` を props で受取済み（L20、現在未使用） |
| `05_PILOT/src/app/_champions/RevisionHistoryModal.tsx` | `/api/admin/revisions` を呼び出してフィールド別履歴を表示するモーダル本体 |
| `05_PILOT/src/app/api/admin/revisions/route.ts` | `knowledge_revisions` テーブルから履歴を返す GET API |

### 作業量の見込み
- **変更ファイル数**: 2ファイル程度（`page.tsx` に `isToolModalOpen` state と `<ToolPaletteModal>` 描画を追加し、`ChampionHeroBanner.tsx` またはヘッダーから開くボタンを1つ配置する。または `ChampionHeroBanner.tsx` に直接「編集・統合履歴」ボタンを1つ追加する場合は `ChampionHeroBanner.tsx` の1ファイルのみ）。
- **規模**: **小**（数行〜20行程度）。

### リスク・副作用
- `ToolPaletteModal` ごと復活させた場合、パレット内に含まれる他機能（レーン設定モーダル、アイテム辞書モーダル、戦術取込モーダル等）への導線も同時に表に出るため、一般ユーザーにも管理者向けツールボタンが見える場合はアクセス制御／表示条件の確認が必要になります（履歴モーダル単体のボタンを `ChampionHeroBanner` へ置く場合は履歴閲覧のみに限定可能）。
- `/api/admin/revisions` は `GET` の閲覧専用APIであるため、表示復活によるデータ破壊リスクはありません。

---

## 4. 案 (b)：死にコード・未使用 props を削除する

### 関係ファイル一覧
| ファイル | 削除・整理対象 |
|---|---|
| `05_PILOT/src/app/_champions/ToolPaletteModal.tsx` | 他から一切参照されていないためファイルごと削除候補 |
| `05_PILOT/src/app/_champions/RevisionHistoryModal.tsx` | 到達経路を消す場合はファイルごと削除候補 |
| `05_PILOT/src/app/page.tsx` | `isRevisionModalOpen` state（L81）、`ChampionHeroBanner` への prop（L187）、`<RevisionHistoryModal>`（L287-L292）を削除 |
| `05_PILOT/src/app/_champions/ChampionHeroBanner.tsx` | 未使用 prop `setIsRevisionModalOpen`（L11, L20）を削除 |
| `05_PILOT/src/app/api/admin/revisions/route.ts` | 画面を消す場合は未使用APIとなるため削除候補（任意） |

### 作業量の見込み
- **変更ファイル数**: 4〜5ファイル（2ファイル修正＋2〜3ファイル削除）。
- **規模**: **小〜中**（コード整理とビルド・型エラー確認）。

### リスク・副作用
- `knowledge_revisions` への書き込み自体は `championFactsMerge.ts` 等に残るためバックグラウンド記録は壊れませんが、**チャンピオン詳細ページ上から「いつどの知見が教本に統合されたか」を確認する手段が失われます**。
- `ToolPaletteModal.tsx` 内の他のクイック導線も同時に消えます（ただし現在も未接続のため、現状から利用できなくなる機能はありません）。

---

## 5. `/admin/dict-maintenance` の「改定履歴」タブとの関係

| 比較項目 | `RevisionHistoryModal`（辞典トップ側） | `/admin/dict-maintenance`「改定履歴」タブ |
|---|---|---|
| **参照テーブル** | `knowledge_revisions`（`/api/admin/revisions`） | `knowledge_revisions`（`/api/admin/dict-maintenance` L39-41、直近10件） |
| **対象データの範囲** | `target_key` に英語ID・日本語名・`champ_<id>_global` 等をすべて含み、**各項目（強み/弱み/ビルド/マスター教本等）の更新履歴を最大100件・項目フィルタ付きで閲覧可能** | 主に管理エディタ用の **直近10件** を表示し、過去バージョンへの **ロールバック（復元）** 機能を持つ |
| **役割の違い** | 閲覧専用の監査・統合履歴ビュー | 管理者が誤上書き時に復元するためのエディタ付属履歴 |

- **重複と代替可否**: 参照している DB テーブル自体は同じ `knowledge_revisions` ですが、`/admin/dict-maintenance` 側は直近10件＋ロールバック用であり、**記事統合による項目別の詳細な履歴（最大100件・項目フィルタ付き）をチャンピオン詳細画面上でそのまま確認する用途を完全には代替していません**。
- **判断材料のまとめ**: 「詳細画面からも項目別の統合履歴をすぐ見返したい」場合は案 (a)（または履歴ボタンのみ配置）、「履歴確認・復元は管理画面 `/admin/dict-maintenance` だけで十分で、詳細画面はシンプルに保ちたい」場合は案 (b) が適しています。
