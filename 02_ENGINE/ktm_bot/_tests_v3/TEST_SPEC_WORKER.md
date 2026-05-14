# 📝 KTM Worker (Discord) インタラクション仕様書 (Phase 0)

リライト（モジュール分割）後の結合テストにおける「入出力リファレンス」です。
全てのパスで、分割後も引数と戻り値（Response）が本ドキュメントと一致すること。

## 1. Slash Commands (`type: 2`)

| コマンド名 | 期待されるオプション (引数) | リライト後の期待される出力 (レスポンス型) | 副作用 / 外部通信 |
|:---|:---|:---|:---|
| `/recruit` | `mode`, `time`, `max`, `memo`, `player1-5` | `type: 4` (Embed + Button Components) | - |
| `/ktm_portal` | なし (Admin Only) | `type: 4` (Portal Embed + Select Menu) | Admin権限チェック失敗時はエラーメッセージ |
| `/balance` | なし | `type: 4` (Balance Embed + Win/Red Buttons) | ①Discord VC情報取得 <br>②GAS `AUTO_BALANCE` (非同期Webhook送信) |
| `/stats` | なし | `type: 5` (Deferred: 処理中) | ①GAS `GET_STATS` <br>②Stats Channel に Embed 送信 <br> ③元のインタラクションを PATCH |
| `/lane` | `main`, `sub`, `ng1`, `ng2`, `weight` など | (引数なし時) `type: 9` (Modal) <br> (引数あり時) `type: 5` | (引数あり時) GAS `UPDATE_LANE` |
| `/anchan` | `query` | `type: 5` | ルーター経由 Local API `/chat` へのPOST |

## 2. Component Interactions (`type: 3`)

### 2.1 募集パネル操作
| `custom_id` プレフィクス | 処理内容 | 期待される出力 |
|:---|:---|:---|
| `upgrade_to_10:` | モードをカスタムに変更・10人定員化 | `type: 7` (Message Update) |
| `join_any:`, `join_role:` | JoinedリストとRole変数の更新 | `type: 7` (Message Update) |
| `spectate:` | spectating リストへ移動 | `type: 7` |
| `leave:` | 両リストから削除 | `type: 7` |
| `close:` | Embedを赤色「募集終了」に変更 | `type: 7` + 放送ボタン追加 |
| `broadcast_start:` | 放送用モーダル呼び出し | `type: 9` (Modal `broadcast_modal`) |
| `balance_from_recruit:` | VC依存ではなく募集パネル内の参加者でチーム分け | `type: 7` + GAS `AUTO_BALANCE` |
| `proxy_add_init:` | ユーザーセレクトメニュー表示 | `type: 4` (USER_SELECT) |
| `proxy_add_submit:`| 指定ユーザーを代理追加し、元のメッセージを更新 | `type: 7` (Ephemeral Success) + PATCH元メッセージ |

### 2.2 システム・リザルト操作
| `custom_id` プレフィクス | 処理内容 | 期待される出力 / 副作用 |
|:---|:---|:---|
| `portal_menu` | 各種操作へのハブ機能 | 値によって Modal(`type:9`)、Command系へのフォールバック。 |
| `exec_init_mmr:` | MMR初期化の起動 | 取扱注意: GAS `INITIALIZE_MMR` 呼び出し |
| `forge_show:` | 記事・SNS案の取得 (Local API) | 取得後、Webhookでチャンク分割送信 |
| `win_blue:`, `win_red:` | 勝敗報告 | GAS `RECORD_RESULT` 送信後、自動で `executeBalance` へループ |
| `rebalance` | 現行メンバーで手動再計算 | GAS `AUTO_BALANCE` |

## 3. Modal Submits (`type: 5`)

| `custom_id` | 入力フィールド | 副作用 / 外部通信 |
|:---|:---|:---|
| `portal_recruit_modal` | `mode`, `time`, `max`, `memo` | RECRUIT_CHANNEL へ POST |
| `portal_lane_modal` | `main`, `sub`, `ng1`, `ng2`, `weight` | GAS `UPDATE_LANE` へ POST |
| `admin_fix_match_modal`| `winner` | GAS `FIX_LAST_MATCH` へ POST |
| `admin_adjust_mmr_modal`| `target`, `role`, `amount` | GAS `ADJUST_MMR` へ POST |
| `broadcast_modal:` | `msg` (メッセージ内容) | メッセージ内に書かれたID（メンション）宛にリプライ |
