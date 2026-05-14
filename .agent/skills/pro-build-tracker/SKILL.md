---
name: pro-build-tracker
description: プロプレイヤー（Oner, Canyon, Kanavi等）の最新ビルド・ルーンをop.gg/プロフィール等から追跡し、メタの先端トレンドを抽出するスキル。
---

# 🏆 Pro Build Tracker

## 目的
プロ・ハイエロプレイヤーの最新ビルドを追跡し、「一般統計サイトにはまだ反映されていないメタの先端」を捉える。

## 使用タイミング
- `/lol-tactics-production` ワークフローのStep 2として自動起動
- 軍師エージェント(Strategist)からの呼び出し
- ユーザーが「プロの最新ビルドを調べて」と依頼した時

## 入力パラメータ
| パラメータ | 必須 | 説明 | 例 |
|:---|:---|:---|:---|
| `champion` | ✅ | チャンピオン名（英語） | `Jarvan IV` |
| `role` | ✅ | ロール | `Jungle` |
| `region` | ❌ | 地域（デフォルト: KR） | `KR`, `EUW`, `NA` |

## 追跡対象プレイヤーリスト
最低でも以下のプロ/ハイエロを毎回チェック:

### ジャングル
- **Oner** (T1) - KR
- **Canyon** (Gen.G) - KR
- **Kanavi** (JDG) - CN
- **Inspired** (FLY) - NA

### トップ
- **Zeus** (T1) - KR
- **Kiin** (Gen.G) - KR

### ミッド
- **Faker** (T1) - KR
- **Chovy** (Gen.G) - KR

### ボットレーン
- **Gumayusi** (T1) - KR
- **Ruler** (JDG) - CN

> [!NOTE]
> このリストは最新のロスター変動に応じて定期的に更新すること。

## 実行手順

### Step 1: プロプレイヤーの最新試合を検索
```
search_web:
"{player_name} {champion} op.gg probuilds"
"site:probuildstats.com {champion} {role}"
```

### Step 2: 差分分析
一般統計（lol-data-collectorの結果）と比較して:
- プロだけが使っている **独自ビルド** を特定
- プロだけが優先している **ルーン** を特定
- プロの **スキルオーダーの違い** を検出

### Step 3: 構造化出力
```markdown
## 🏆 プロトレンド速報: {Champion} {Role}

### 注目ビルド
- **{Player名}** が直近5試合で採用:
  - コア: {Item1} → {Item2} → {Item3}
  - 勝率: {X}勝{Y}敗
  - 一般統計との差異: {差分の説明}

### プロ vs 統計の乖離ポイント
| 項目 | 一般統計(Plat+) | プロ採用 |
|:---|:---|:---|
| メインルーン | {一般} | {プロ} |
| コア1st | {一般} | {プロ} |
| スキルオーダー | {一般} | {プロ} |
```

## 出力先
- `01_INTEL/tactics/pro_trend_{champion}_{date}.md`

## 制約
- プロの試合データが2週間以上古い場合は `⚠️ 古いデータ` を付記
- 該当チャンピオンの直近プロ使用がない場合は「プロ未採用」と明記
