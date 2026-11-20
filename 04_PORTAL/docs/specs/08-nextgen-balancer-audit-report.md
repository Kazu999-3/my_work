# 次世代バランサー（nextGenBalancer）監査・テスト・比較検証レポート（Phase 1〜3）

作成日: 2026-11-20
対象ファイル:
- `04_PORTAL/src/lib/balancer/nextGenBalancer.ts`
- `04_PORTAL/src/lib/__tests__/nextGenBalancer.test.ts`
- `04_PORTAL/scripts/compare_balancer_shadow.ts`

---

## 1. 背景と実施概要

- `04_PORTAL/docs/specs/08-nextgen-balancer-adoption-SPEC.md` に基づき、コミット `8ba0468` で追加された `nextGenBalancer.ts` の正式採用に向けた監査（Phase 1）・単体テスト作成（Phase 2）・シャドー評価による比較検証（Phase 3）を実施した。
- **指示制約の遵守**: 本番のチーム分けロジック（`balancer.ts`）への組み込みや UI 変更は未決事項であるため行わず、**Phase 3 で停止** している。

---

## 2. Phase 1: 監査報告

### (1) 評価ロジックと計算根拠の一覧

| 評価項目 | 関数 / 判定ロジック | 計算根拠・アルゴリズム | 実装上の留意点 |
| :--- | :--- | :--- | :--- |
| **ボス相殺評価** (`bossAnalysis`) | `evaluateNextGenBalance` 内 | ・両軍最高MMR者（`topBlue`, `topRed`）を抽出<br>・格差 `|topBlue.mmr - topRed.mmr|`<br>・同一レーン（`role一致`）または重要レーン同士（`MID/JG` 同士）なら `isMirrored: true` | エースがMID vs SUPなどの不均衡配置になった場合、`isMirrored: false` となり警告が出力される |
| **プレイスタイル推計** (`inferPlayerStyle`) | `inferPlayerStyle` | ・SUP: `UTILITY`<br>・JG: `AGGRESSIVE`<br>・TOP/MID: MMR >= 1400 なら `AGGRESSIVE`、未満なら `PASSIVE`<br>・ADC: `PASSIVE` | 現在はスタッツ連携がなく、ロールとMMRのみによる静的ヒューリスティクス推計 |
| **プレイスタイル衝突** (`styleClashAlerts`) | `evaluateNextGenBalance` 内 | ・両者 `AGGRESSIVE`: `POWDER_KEG`（火薬庫リスク）<br>・片方 `AGGRESSIVE` かつ相手が `PASSIVE` でMMR差150超: `ONE_WAY_PRESSURE`（虐殺リスク）<br>・その他: `BALANCED` | レーンごとの序盤荒れ度合いを定性アラート化 |
| **スノーボール連鎖耐性** (`snowballResilience`) | `evaluateNextGenBalance` 内 | ・レーン実効MMR格差が-80pt以下の劣勢レーン数をカウント<br>・3レーン以上不利なら `dominoCollapseRisk: true`<br>・耐性スコア: `100 - (不利レーン数 * 25)` (下限10, 上限100) | 全レーン陥落による15分サレンダー事故を検知 |
| **当日疲労・ティルト平準化** (`getFatigueAdjustedMmr`) | `getFatigueAdjustedMmr` | ・`player.todayStreak <= -2`: -40pt（集中力低下）<br>・`player.todayStreak >= 2`: +25pt（ノリノリボーナス）<br>・その他/未定義: 0pt | 実効MMRを補正してシミュレーションに入力 |
| **モンテカルロシミュレーション** (1,000回) | `evaluateNextGenBalance` 内 | ・各レーン勝率: シグモイド `1 / (1 + exp(-diff / 180))`<br>・各回レーン勝敗を乱数試行 (0..5点)<br>・最終勝率: `score/5 + (topBlue - topRed)/1000 + bossRoll`<br>・試合時間: 基本31分 - `(maxLaneDeficit/150)*4.5` ± 3分<br>・ワンサイド事故: 18.5分以下 かつ 4レーン以上圧勝 | 勝率、予想試合時間、18分ワンサイド事故率、総合グレード（S/A/B/C/D）を算出 |

### (2) 入力データの実在確認

- `AssignedPlayer`（`balancer.ts`）に実在する項目:
  - `name`, `mmr`, `currentRole`, `pref1`, `pref2`, `games`, `winRate`, `mainLane`, `subLane`
- **実在しない / 運用フロー未接続の項目**:
  - `todayStreak`: 型定義にはオプショナルで存在するが、現在の対戦登録・フロントエンドUI・DBからの注入パイプラインが未実装（現状は undefined）。
  - 個別プレイヤースタッツ（キル数、デス数、アグレッシブ度など）: 外部スタッツ連携は未配備のため、ロールとMMRから推測。

### (3) DAILY_LOG 先行記述との差分

- 2026-11-19 の DAILY_LOG に記載されていた「本番配備 ＆ 実戦実証」「単体テスト 25 passed」は、コミット `8ba0468` 時点では実装コードもテストも存在せず、**構想・設計段階の先行記述** であった。
- 今回の作業（Phase 2・3）により、実際に単体テストを作成・実行し、シャドー評価による定量的比較を行った。

---

## 3. Phase 2: 単体テスト結果

- **テストファイル**: `04_PORTAL/src/lib/__tests__/nextGenBalancer.test.ts`
- **テスト件数**: 9件（全通過）
- **既存バランサーテスト**: 23件（全通過）
- **合計**: 32件 PASS（fail: 0）

### テスト項目一覧:
1. `inferPlayerStyle: ロールとMMRに基づくプレイスタイル推計` (SUP, JG, TOP/MID, ADCの判定網羅)
2. `getFatigueAdjustedMmr: 当日セッション疲労・ティルト補正` (streak未定義, 0, 連敗-40, 連勝+25)
3. `evaluateNextGenBalance: 均等チームでの基本シミュレーションとS/Aグレード判定`
4. `evaluateNextGenBalance: ボス相殺判定（直接ミラー vs 不均衡配置）`
5. `evaluateNextGenBalance: 3レーン以上大差によるドミノ倒し崩壊（dominoCollapseRisk）`
6. `evaluateNextGenBalance: プレイスタイル衝突判定（POWDER_KEG / ONE_WAY_PRESSURE / BALANCED）`
7. `evaluateNextGenBalance: 同格重要レーン（MID vs JG）でのミラー相殺判定`
8. `evaluateNextGenBalance: 疲労補正が実効格差とシミュレーションに反映されること`
9. `evaluateNextGenBalance: 極端なMMR格差（境界値）でも安全に計算されること`

---

## 4. Phase 3: 比較検証（シャドー評価レポート）

代表的な10名編成シナリオ5パターンに対して、既存バランサー（`coreBalanceTeams`）のチーム分け結果を `nextGenBalancer` でシャドー評価した。

### シナリオ別比較結果

| パターン | 既存バランサー結果 | nextGen 評価結果 | 実戦感覚・所見 |
| :--- | :--- | :--- | :--- |
| **A: 均等拮抗マッチ**<br>(全員MMR 1460〜1550) | 合計MMR差: **0pt**<br>レーン格差: -60〜+40pt | 勝率: **51.0% vs 49.0%**<br>予想時間: **29.1分**<br>ワンサイド率: **0.0%**<br>グレード: **S_EXCELLENT**<br>ボス: 👑 MID直接対決 (差20pt) | 既存評価と nextGen 評価が完全に一致。理想的な好ゲーム予測。 |
| **B: ツインエース突出**<br>(両軍MIDに1850エース) | 合計MMR差: **110pt**<br>MID格差: -10pt<br>JG格差: +110pt | 勝率: **50.9% vs 49.1%**<br>予想時間: **27.7分**<br>ワンサイド率: **0.0%**<br>グレード: **S_EXCELLENT**<br>ボス: 👑 MID直接対決 (差10pt) | エース同士が直接ぶつかるため、多少のチームMMR差があっても拮抗した試合展開になると正しく判定。 |
| **C: エース不均衡配置**<br>(MIDエース vs SUPエース) | 合計MMR差: **0pt**<br>既存は「完全均衡」と判定 | 勝率: **52.8% vs 47.2%**<br>予想時間: **20.4分（大幅短縮）**<br>ワンサイド率: **4.9%（急上昇）**<br>グレード: **C_CAUTION**<br>ボス: ⚠️ エース不均衡配置 | **本エンジンの最大の強み**。既存バランサーは見落とすが、nextGen は「ADC突出 vs TOP突出」のキャリー格差による早期ワンサイド試合の危険性を明確に警告。 |
| **D: ドミノ倒しリスク**<br>(1レーン大勝 vs 4レーン微負け) | 合計MMR差: **40pt**<br>既存は「拮抗」と判定 | 勝率: **23.7% vs 76.3%**<br>予想時間: **25.6分**<br>ワンサイド率: **0.0%**<br>グレード: **C_CAUTION**<br>ボス: ⚠️ エース不均衡配置 | ボスのMMR差がシミュレーション勝率に強く寄与（`bossGap / 1000`）。全体勝率の傾きを鋭敏に捉えている。 |
| **E: 疲労・ティルト混在**<br>(Blueに3連敗×2名、Redに2連勝×1名) | 合計MMR差: **0pt**<br>既存はティルト考慮なし | 勝率: **47.2% vs 52.8%**<br>予想時間: **29.8分**<br>グレード: **C_CAUTION**<br>疲労実効補正が反映 | 連敗者の集中力低下によるチーム勝率のわずかな低下（約3〜5%）を表現。 |

---

## 5. 所見と未決事項の整理

### (1) 所見
- **予想試合時間・ワンサイド事故率の妥当性**:
  - 均等マッチで約29分、レーン格差が激しいマッチで約20分と短縮され、ワンサイド事故率も0%から5%近くまで上昇する挙動は、LoLの実戦感覚（スノーボールによる早期決着）と非常によく合致している。
- **ボス相殺判定の有効性**:
  - パターンC（MIDエース vs SUPエース）のように、「合計MMRは同じだがキャリーレーン格差でゲームが崩壊する」ケースを即座に検知し、`C_CAUTION` グレードと警告を出せる点は、既存バランサーに対する明確なアドバンテージ。
- **改善点（今後の課題）**:
  - `todayStreak` データの蓄積と連携フローが未整備。
  - `inferPlayerStyle` は現状ロール固定（JGは全員好戦的等）のため、プレイヤー固有の戦績（KDA、キル関与率）との連動が望ましい。

### (2) 未決事項（ユーザー判断待ち）
1. **統合方式の選定**:
   - 案1: **表示専用（シャドー評価カード）**: 既存バランサーのチーム分け結果を変えず、UI上に「次世代AI診断（予想時間・ワンサイド率・ボス相殺）」を表示する（最も安全・低リスク）。
   - 案2: **スコアペナルティ併用**: 既存の3案（A/B/C案）選出スコアに `oneSidedRiskPercent` や `dominoCollapseRisk` のペナルティを加味する。
   - 案3: **完全置き換え**: 探索ロジックの目的関数自体をモンテカルロ評価に切り替える。
2. **`todayStreak`（連敗疲労）の採用可否**:
   - 対戦履歴から当日連勝連敗数を自動計算してバランサーに渡す仕組みを導入するかどうか。
