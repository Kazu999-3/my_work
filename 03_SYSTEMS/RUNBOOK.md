# 📖 Sovereign OS 制式運用・起動マニュアル (RUNBOOK)

> **Coupen原則**: 自分で作った仕組みは3ヶ月使わないと確実に忘れる。
> 置き場所・起動する言い方・出てくるもの・困ったときの見る場所を、1枚のシートに凝縮して残す。

---

## 🚀 1. 主要システムの起動ワンライナー

### ① Sovereign HUD (デスクトップ・オーバーレイ)
- **ブラウザから1タップ起動**: ポータル `/coach` 画面の「🚀 HUD起動」ボタンを押す（`sovereign://launch`）
- **プロトコル再登録（動かない時）**:
  ```powershell
  d:\my_work\03_SYSTEMS\register_sovereign_protocol.bat
  ```
- **手動直接起動**:
  ```powershell
  py d:\my_work\03_SYSTEMS\v2_CORE\_LOL\overlay\matchup_card_widget.py
  ```

### ② バックエンド・エッジワーカー群 (API / キュー監視)
- **ワンクリック一括起動**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File d:\my_work\03_SYSTEMS\start_all.ps1
  ```
- **ポータルからの起動**: 管理ダッシュボード（`/admin/dashboard`）の「🚀 ワーカー起動」ボタン

### ③ ポータル Web アプリケーション (Next.js)
- **ローカル開発サーバー起動**:
  ```powershell
  cd d:\my_work\04_PORTAL
  npm run dev
  # ブラウザで http://localhost:3000 を開く
  ```

---

## 🛠️ 2. 運用・保守・修復CLIチートシート

### ① チャンピオン辞典 ＆ DataDragon同期ヘルスチェック (`sync_dict_health.py`)
| 目的 | コマンド |
| :--- | :--- |
| **辞書全体の健全性・件数確認** | `py d:\my_work\scripts\sync_dict_health.py --status` |
| **公式DataDragon用語への一括正規化** | `py d:\my_work\scripts\sync_dict_health.py --normalize` |
| **不正タグ・表記ゆれの完全自動修復** | `py d:\my_work\scripts\sync_dict_health.py --fix-tags --apply` |
| **滞留した古いpendingキューのリセット** | `py d:\my_work\scripts\sync_dict_health.py --reset-pending` |

### ② YouTube解析キュー監視 ＆ エラー復旧 (`clean_youtube_queue.py`)
| 目的 | コマンド |
| :--- | :--- |
| **動画解析キューの状況確認** | `py d:\my_work\scripts\clean_youtube_queue.py --status` |
| **エラー動画の一括再試行リセット** | `py d:\my_work\scripts\clean_youtube_queue.py --retry-failed --apply` |
| **回復不能な壊れた動画のクローズ** | `py d:\my_work\scripts\clean_youtube_queue.py --clean-errors` |

### ③ Gemini APIモデル健全性・実クォータ実測
| 目的 | コマンド |
| :--- | :--- |
| **利用可能モデルと残クォータ実測** | `py d:\my_work\.claude\skills\gemini-model-health-check\scripts\check_gemini_models.py` |

---

## 🧪 3. 動作テスト ＆ 品質監査ワンライナー

### ① バランサー ＆ KTMコア単体テスト（36件）
```powershell
cd d:\my_work\04_PORTAL
npm test
# 約20秒で 36 pass / 0 fail を確認
```

### ② TypeScript型チェック
```powershell
cd d:\my_work\04_PORTAL
npx tsc --noEmit
# エラー0件を確認
```

---

## 🚨 4. 困ったときのトラブルシュート（見るべき場所）

| 症状 | 真因・確認場所 | 対処手順 |
| :--- | :--- | :--- |
| **ワーカーが二重起動エラーになる** | 前回のプロセスまたはソケットロックが残留 | タスクマネージャーで `python.exe` を確認、または `start_all.ps1` を再実行（排他制御対応済み） |
| **AIが429 / 404 エラーを連発する** | 架空モデル指定またはクォータ枯渇 | `check_gemini_models.py` で実測し、`gemini-3.1-flash-lite` / `gemini-3.5-flash-lite` が指定されているか確認 |
| **ポータルで選手がアンランクに見える** | 最高ランクのディビジョン不一致バグ | ティア名単体（例: `GOLD`）で統一。Riot再同期ボタンを押す |
| **YouTube動画解析が止まっている** | `youtube_queue` に `failed` が滞留 | `clean_youtube_queue.py --retry-failed --apply` を実行 |
