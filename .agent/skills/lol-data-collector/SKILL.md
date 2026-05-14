---
name: lol-data-collector
description: Lolalytics / u.gg / op.gg などから最新パッチのチャンピオン統計データ（勝率・ピック率・ビルド・ルーン）を構造化JSONで自動収集するスキル。
---

# 🎮 LoL Data Collector

## 目的
指定チャンピオン×ロールの最新パッチデータを、複数の統計サイトから自動収集し、構造化された分析用データとして出力する。

## 使用タイミング
- `/lol-tactics-production` ワークフローのStep 1として自動起動
- 軍師エージェント(Strategist)からの呼び出し
- ユーザーが「〇〇の最新データを集めて」と依頼した時

## 入力パラメータ
| パラメータ | 必須 | 説明 | 例 |
|:---|:---|:---|:---|
| `champion` | ✅ | チャンピオン名（英語） | `Nidalee` |
| `role` | ✅ | ロール | `Jungle` |
| `patch` | ❌ | パッチ番号（省略時は最新） | `26.08` |
| `elo` | ❌ | 対象レート帯（デフォルト: Platinum+） | `Master+` |

## 実行手順

### Step 1: Lolalytics からデータ取得
```
search_web で以下を検索:
"site:lolalytics.com {champion} {role} patch {patch}"
```
取得対象:
- 勝率 (Win Rate %)
- ピック率 (Pick Rate %)
- バン率 (Ban Rate %)
- ティア (Tier: S+, S, A, B...)
- サンプル数 (Games)

### Step 2: ビルド・ルーン情報の取得
```
search_web で以下を検索:
"site:u.gg {champion} {role} build"
```
取得対象:
- コアアイテム（勝率順 Top 3）
- ルーンセット（最高勝率 + 最多ピック）
- サモナースペル
- スキルオーダー

### Step 3: 構造化出力
取得データを以下のJSON形式で `01_INTEL/tactics/` に保存:

```json
{
  "champion": "Nidalee",
  "role": "Jungle",
  "patch": "26.08",
  "elo": "Platinum+",
  "collected_at": "2026-04-17T17:00:00+09:00",
  "stats": {
    "win_rate": 51.2,
    "pick_rate": 4.8,
    "ban_rate": 2.1,
    "tier": "A",
    "games": 28450
  },
  "builds": [
    {
      "name": "最高勝率ビルド",
      "items": ["Rod of Ages", "Lich Bane", "Zhonya's Hourglass"],
      "win_rate": 54.3,
      "pick_rate": 12.5
    }
  ],
  "runes": {
    "primary": "First Strike",
    "secondary": "Sorcery",
    "win_rate": 52.8
  },
  "skill_order": "Q > E > W"
}
```

## 出力先
- ファイル: `01_INTEL/tactics/lolalytics_{champion}_{patch}.md`
- 形式: Markdown（人間可読）+ JSON（機械可読）

## 制約
- 1回の実行で最大3サイトまで巡回（API制限回避）
- データが見つからない場合は `[データ不足]` を明記し、手動確認を促す
- 古いパッチデータは参考値として扱い、見出しに `⚠️ 旧パッチ` を付与
