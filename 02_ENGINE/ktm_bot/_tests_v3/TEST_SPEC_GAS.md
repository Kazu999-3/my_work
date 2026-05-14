# 📝 KTM GAS API (Code.gs) 入出力仕様書 (Phase 0)

Code.gsの肥大化した `doPost` および `doGet` 分岐をモジュール分離する際のインターフェース仕様です。
リライト時は、ルーター（doPostメイン処理）から各ハンドラへペイロードを渡す構造にします。

## 1. doPost エンドポイント (JSON Payload)

| `type` (アクション) | 必須リクエストペイロード | 返却オブジェクト (MimeType: JSON) | 副作用対象シート |
|:---|:---|:---|:---|
| `VC_SYNC` | `{ "names": ["A", "B"...] }` | `"SUCCESS: Sync done"` (Text) | `対戦入力` |
| `AUTO_BALANCE` | `{ "names": [...], "fixed": [...] }`| `{ status: "SUCCESS", result: {...}, spectators: [...] }` | `対戦入力` |
| `RECORD_RESULT` | `{ "winner": "BLUE/RED", "kdaMap": {}, "spectators": [] }` | `"SUCCESS: Result recorded"` (Text) | `一括入力`, `対戦入力`, `プレイヤー一覧` |
| `GET_STATS` | `{ "discordId": "123..." }` | `{ status: "SUCCESS", player: "...", stats: {...}, ranks: {...}, mmrs: {...}, pity: X }` | - (Read Only) |
| `UPDATE_LANE` | `{ "discordId", "main", "sub", "ng1", "ng2", "weight", "allowHigher" }` | `{ status: "SUCCESS" }` | `プレイヤー一覧` |
| `MIGRATE_V4` | - | `{ status: "SUCCESS" }` | `プレイヤー一覧` (ヘッダー修正) |
| `GET_SYSTEM_SUMMARY`| - | `{ status: "SUCCESS", timestamp: "...", stats: {...} }` | - |
| `FIX_LAST_MATCH` | `{ "winner": "BLUE/RED" }` | `{ status: "SUCCESS" }` | `一括入力`, `プレイヤー一覧` |
| `ADJUST_MMR` | `{ "targetName", "role", "amount" }` | `{ status: "SUCCESS" }` | `プレイヤー一覧` |
| `INITIALIZE_MMR` | `{ "isOverwriteAll": boolean }`| `{ status: "SUCCESS", message: "..." }` | `プレイヤー一覧` |

## 2. doGet エンドポイント

| 処理概要 | クエリパラメータ / JSON Payload | 返却オブジェクト |
|:---|:---|:---|
| `SYNC_MEMBERS` | `(data via JSON parsing)` | `{ status: "SUCCESS", added: X }` |
| Webhook連携 | `msg` (Query Param) | `"OK"` (Text) Discordの`ANTIGRAVITY_WEBHOOK_URL`へPOST |

## 3. リライトにあたっての前提ルール

- シートの名前定義（`SHEET_NAMES`）などハードコードされたマジックナンバーは、Phase 2にて「定数管理モジュール (`config.ts` 等)」に分離すること。
- 各リクエストに対する内部関数（例: `coreBalanceTeams`）は密結合している状態を解きほぐし、純粋関数としてのテストカバレッジを確保すること。
