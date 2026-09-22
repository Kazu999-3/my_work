# 📌 Sovereign OS 業務ダッシュボード (TODO)

本ファイルは、日々の作業タスクを管理するためのダッシュボードです。
会話開始時に AI が自動的にこのファイルを読み込み、文脈を復元して本日のタスクに直ちに追従します。

> 📦 **過去の完了済みセッションログは [`TODO_ARCHIVE.md`](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md) に退避済み**（2026-09-21実施、AIコンテキスト消費削減のため）。本体には進行中タスクと直近の完了ログのみ残しています。詳細な実装経緯や「なぜそうしたか」を確認したい場合はアーカイブを参照してください。

---

## 🚀 【進行中】 The Sovereign Victory Loop (完全勝利サイクル開発)

> **最上位誓約**: 
> 1. 「プレイ前 ➔ プレイ中 ➔ プレイ後 ➔ ナレッジ蓄積」の完全循環ループを維持。
> 2. 不確定情報（AI推測・でっち上げ）は100%排除。Riot公式 Live Client Data / DataDragon / 確定実戦データのみを使用。

Step 1〜4（対面計算基盤・オーバーレイ連動・ディープアナリティクス・ナレッジ自動更新ループ）は全項目完了済み。詳細は[アーカイブ](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md)を参照せず、`HANDOVER_CLAUDE.md`のシステム構造マップと稼働実態の補足を参照。

## ✅ 2026-09-20 対応済み（直近1週間の実装における潜在不具合修正 全6件）

> **経緯**: 深層ロジック監査で5件の不具合を発見・修正後、ライブ検証中に追加のセキュリティ脆弱性を発見（#6）。詳細は[アーカイブ](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md)。

- [x] バカラ配当計算の元金未差引バグ（無限コイン増殖インフレ）解消
- [x] バランサーサイド公平化の数学的恒等式（100%ランダム決定化）解消
- [x] ポロ・クラッシュのリプレイ多重利確脆弱性 ＆ 通信遅延クラッシュ是正
- [x] チップ送金の手入力誤字による幽霊アカウント自動生成防止 ＆ 完了通知是正
- [x] 師弟フォーラムスレッド作成時の Discord API タグ上限超過(400エラー)防止
- [x] 【最高・セキュリティ】ポロ・クラッシュの`gameToken`平文漏洩を根絶（crashPointをサーバー側`crash_sessions`テーブルのみで保持する方式に変更、本番適用・実測確認済み）

---

## 📋 【次のタスク】 ナレッジ基盤の先行整理 ＆ 再解析パイプライン

### 🧹 Phase 1: ナレッジ ＆ キュー先行整理 ＆ 辞典超強化（全項目完了済み）

YouTubeキュー整合化、帝国総合索引同期・戦術バイブル拡充、チャンピオン辞典・ビジュアルダッシュボード強化まで全て完了。詳細は[アーカイブ](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md)（2026-09-18セッション節）を参照。

### 🚀 Phase 2: 動画解析インフラ進化 ＆ 再解析パイプライン

- [x] 字幕欠落動画のローカルWhisper音声認識フォールバック配備（`scripts/whisper_transcriber.py`）

> **2026-09-21 実測**: `youtube_queue` 合計1228件（completed 1071 / pending 75 / manually_closed 82 / **エラー系0件**）。ローカル常駐`edge_worker_daemon.py`は**64.4時間 起票が止まっていた**（PC起動依存という構造上、気づかれず止まり続けるリスクが現在進行形。`ops_health_check.py`がこれを検知できることは実行確認済み）。

- [x] **第0弾: 基盤修正（2026-09-20完了）**
  - [x] 字幕抽出のハードコード依存を実データ取得方式へ根本修正（実データ取得不能時はスキップ、架空データで埋めない）
  - [x] Geminiモデル候補を生存確認済みモデル（`gemini-3.1-flash-lite`等）へ差し替え
  - [x] チャンピオン名正規化を`normalize_champion_id()`に統一
  - [x] Whisperフォールバックの`ModuleNotFoundError`を修正
  - [x] `ops_health_check.py`の新チェックを実行して動作確認（2026-09-21完了。64.4時間の無起票を正しく検知した。あわせて、WARNが何件あっても最後に「ALL GREEN」と誤報していたサマリーのバグも修正）
- [x] **案5: 🧹 SNS一時下書きドラフト群の自動インデックス化**: [`02_FACTORY/01_DRAFTS/sns/INDEX.md`](file:///d:/my_work/02_FACTORY/01_DRAFTS/sns/INDEX.md) を新設（2026-09-21、パッチ別・生成種別別に全187件を索引化）
- [x] **第1弾 (MVP): kirei_bible の実演クリップを戦術バイブルへマウント（2026-09-21完了）**
  - 計15本をマウント（Kha'Zix / Viego / Shyvana×2 / Wukong / Graves×2 / JarvanIV / Akali / Akshan / Ambessa×2 / Bel'Veth / Talon / Vi）。
  - 実行して判明した不具合を4件修正: ①実際は7本しかマウントできていないのに「12本マウント」と報告していた虚偽カウント、②間隔なし連続取得による429取りこぼし6本（5秒間隔を追加）、③判定より先に取得していた無駄なネットワークアクセス、④INDEX.mdの動画誤検出。
  - マウント先バイブルが無く捨てられていた16本を救済するため、`champion_facts`の蓄積データからバイブルを生成する`generate_tactics_bible.py --from-db`を新設し12体を配備（AI生成なし＝課金ゼロ）。
  - **残り12本は字幕・音声とも取得できず未処理**（下記のcookieタスク待ち）。
- [ ] **🍪 YouTube cookie の設定（ユーザー作業が必要・第1弾の残り12本と第2弾の一部がこれ待ち）**
  - **現状**: 字幕の無い動画はWhisperで音声から文字起こしするが、音声ダウンロードが `HTTP 403 Forbidden` で弾かれる。実測で第1弾の12本がこれで未処理。
  - **自動化は不可能と確認済み（2026-09-21実測）**: Chrome/Edgeからのcookie直読みは `Failed to decrypt with DPAPI` で失敗する。Chrome 127以降の **App-Bound Encryption**（他アプリからの復号を防ぐ保護）によるもので、**Chromeを終了しても解決しない**。Firefox/Brave/Opera/Vivaldiは未インストール。したがって`.env`の `YT_DLP_COOKIES_FROM=chrome` は現在のChromeでは機能しない設定。
  - **必要な作業**: ①Chrome拡張「Get cookies.txt LOCALLY」を追加 → ②YouTubeを開いた状態で実行しcookies.txtをダウンロード → ③`.env`に `YT_DLP_COOKIES_FILE=（保存先の絶対パス）` を追加。保存先は`.gitignore`対象の場所にすること。
  - **配線は完了済み**: `scripts/yt_dlp_cookies.py` に解決ロジックを集約済みで、設定すれば現役3スクリプト全てで自動的に読まれる（ログに `[cookie] cookies.txt を使用します` と出る）。未設定でもフェイルセーフが働き、字幕のある動画は通常どおり処理される。
  - **設定後の確認手順**:
    ```bash
    # 1. cookieが認識されているか（「cookies.txt を使用します」と出れば成功）
    .venv/Scripts/python.exe -c "import sys; sys.path.insert(0,'scripts'); from dotenv import load_dotenv; load_dotenv('.env'); from yt_dlp_cookies import apply_cookie_opts; apply_cookie_opts({})"

    # 2. 403で失敗していた動画で実際に音声を取得できるか試す
    .venv/Scripts/python.exe scripts/extract_video_tactics.py 27t49A38l6I --dry-run

    # 3. 通れば第1弾の残りをまとめて処理
    .venv/Scripts/python.exe scripts/extract_video_tactics.py --batch --limit 20
    ```
- [ ] **第2弾: pendingキューの再解析（実測78件・2026-09-21時点）**
  - 実測(2026-09-21時点): `youtube_queue` は合計1228〜1231件で pending 75〜78件（監視が新着を拾うため日々増える） / manually_closed 82 / **エラー系0件**。TODOに記載されていた「error系53件」は既にpendingへ戻されており、救済（リセット）自体は完了済み。残るのはこれらを実際に処理すること。
  - 10件サンプル調査では8割が英語字幕ありでWhisper不要のため、cookie未設定でも大半は処理できる見込み。
  - **⚠️ Gemini課金が発生する。まず少数で試してから本格実行すること。**
  - **実行手順（そのまま使える）**:
    ```bash
    # 1. 現状確認（何件残っているか）
    .venv/Scripts/python.exe scripts/clean_youtube_queue.py --status

    # 2. まず3件だけ試す（MAX_ITEMS未指定時の既定も3件）
    MAX_ITEMS=3 .venv/Scripts/python.exe scripts/youtube_worker.py

    # 3. 結果を確認してから件数を増やす（429を避けるため20件程度ずつ推奨）
    MAX_ITEMS=20 .venv/Scripts/python.exe scripts/youtube_worker.py
    ```
  - 常駐で回す場合はローカルワーカーを起動する（`start_all.bat` またはポータル管理画面の「🚀 ワーカー起動」ボタン）。起票は`youtube_queue_scheduler_loop`が10分おきに行う。
  - **実行後の確認**: `.venv/Scripts/python.exe scripts/ops_health_check.py` で「YouTubeキュー健全性」「YouTube自動化の稼働鮮度」がPASSになるか見る。
- [x] **第3弾: ローテーション再解析の実装（2026-09-21完了、実行は未着手）**
  - `edge_worker_daemon.py`に`youtube_rotation`タスクを新設。完了済み動画を古い順に少数ずつpendingへ戻す。
  - 暴走防止に2つの歯止め: 未処理キューが20件以上なら差し戻さない／スケジューラは既定で無効のオプトイン（`ENABLE_YOUTUBE_ROTATION=1`）。
  - 現在pendingが70件超あるため安全弁が作動し、有効化しても当面は何も差し戻さない（第2弾の消化が先）。
- [x] **（データ整理）** `wukong_tactics_bible.md`と`monkeyking_tactics_bible.md`の分裂を統合（2026-09-21完了。両者はバイト単位で完全同一だったため、DDragon公式IDである`monkeyking_`側に一本化し`wukong_`を削除）。

### 👑 Phase 3: 自律ナレッジループ ＆ セマンティック検索進化

- [ ] **実戦リザルト（Live Client Data）から戦術バイブルへの「完全自動逆流」**: 試合終了監視デーモン（`auto_match_recorder.py`）が試合結果と対面相手を自動検知し、バイブルの対面メモおよび「没理由（Rejected）」へ自律追記
- [ ] **戦術概念の横断検索（RAG / 逆引きインデックス）**: 「インベード対処」「オブジェクト放棄基準」等の戦術概念キーワードで全バイブル・全動画クリップを即座に逆引きできる検索API/機能の配備

---

## ✅ ハードコード偽装データの一掃（2026-09-22 完了）

> **経緯**: コーチページの「実戦の罠（没理由DB）」がDB由来を名乗りながら全対面共通の
> ハードコード固定文だった件を起点に、ポータルAPI・UI/lib・Python(HUD/CLI)の3領域を全量調査。
> **同一構造の問題が36件**見つかり、全件対応した。共通する型は「**実データ取得に失敗したとき、
> それらしい内容で埋め、失敗をユーザーに伝えない。かつ見出しにDB/実戦データ/客観/公式/確定と
> 由来を示唆する語が付く**」で、`known-regression-patterns` パターン5の実装版と言える。

### 特に実害が大きかったもの

- **試合の教訓がどこにも保存されていなかった**: `sync-match-feedback` はDB書き込みを一切
  行わないスタブなのに「辞典・対面メモへ自動同期しました」と成功を返していた（サイレントな
  データ消失）。`TODO.md` 上ではこの経路を含む「Step4 ナレッジ自動更新ループ」が完了扱いだった。
- **AIコーチのプロンプト汚染**: `playerStyleProfile.ts` の手入力固定値が「your.gg実戦データ連動」を
  名乗ってAIプロンプトへ注入されており、どの試合を解析させても「KP@15が下位3%」という
  固定の前提で講評が生成されていた。
- **「公式・確定」を騙る即死計算**: `kill_line_calculator.py` のdocstringは「168体すべての
  DataDragon公式確定計算」と明言していたが、実体は手書き41体分で残り127体は無言で汎用値。
  それがHUDに「即死確定」と断言表示されていた。
- **架空データが「検証済み・公式」ラベルでファイルに永続化**: `generate_tactics_bible.py` の
  既定モードが手書きデータを `status: verified` / `source_type: official` 付きで書き出していた
  （既存17ファイルも訂正済み）。

### 確立した修正の型（今後も踏襲する）

**①実データのみ返す ②無ければ null/空を返す ③UIは「まだ登録されていません」と正直に表示する
④静的なものは「一般論」「手入力値」「推定」と明示し、由来を偽る見出し（DB・公式・確定・客観・連動）を付けない。**

### 残る前提整備（未着手）

- [ ] **DDragonにダメージデータを取り込む**
  - 即死計算のハードコードを根治するには DDragon 実データへ寄せるのが本筋だが、
    **現状の `ddragon_master_dict.json`（579KB / 865スキル）にはスキル名・CD・コストしか無く、
    ダメージ数値とスケーリング係数が存在しない**（2026-09-22実測確認）。
    `ddragon_master_sync.py` を拡張して DDragon の `effect`/`vars` を取り込む必要がある。
  - これが済めば、Python側 `kill_line_calculator.py` とポータル側 `BURST_PROFILES`
    （現在は二重管理された別々の手書きテーブル）を単一ソースへ統合できる。
    それまでは両者とも「推定値」であることを表示する暫定対応済み。

---

## ✅ ポータルの応答速度・操作性改善（2026-09-22 完了）

> **経緯**: 「利便性・操作性を上げたい、レスポンスを速くしたい」という要望に対し、
> 提案 → 実測 → 実装の順で進めた。制約として **カジノの残高とバランサーの参加者リストは
> 即時性が要るためキャッシュ禁止** をユーザーから指定されている（今後も厳守）。

- [x] **参照系API 6本にCDNキャッシュを導入**（`3450e706`）
  - `src/lib/apiCache.ts` の `cachedJson()` で `Cache-Control: s-maxage / stale-while-revalidate` を付与。
  - 対象: leaderboard / synergy / stats-winrates / champions-stats / leaderboard-meta（60秒）、
    champions/dictionary-overview（300秒）。
  - **`/api/bet`・`/api/players/list`・`/api/riot/live-game` には意図的に付けていない**（上記の即時性制約）。
  - 当初 `export const revalidate` を使ったが、supabase-js が内部で `no-store` を付けるため
    Next.js 側が常に動的判定になり無効だった（ビルド警告8件）。Cache-Controlヘッダ方式に変更して警告0件。
- [x] **主要画面の `alert()` をトースト通知へ置き換え**（`da86eed3`）
  - 既存の `src/components/Toaster.tsx`（CustomEvent方式）を流用。ライトテーマ向けに配色調整、エラーは6秒表示。
  - 自動置換が成功/失敗を6箇所取り違えていた（例:「N件の失敗タスクを一括再実行しました」を error 扱い）ため、grep監査で全件突合して是正済み。
- [x] **プレイヤー詳細ページのチャートを遅延読込化**（`01b112fa`）
  - `charts/PlayerCharts.tsx` へ分離し `next/dynamic` + `ssr:false` 化。**実測 1,325KB → 925KB（約30%減）**。

### 測って「やらない」と判断したもの（再調査を防ぐための記録）

- [x] **`select('*')` の列指定化（全81箇所）→ 費用対効果が無いため見送り**（2026-09-22 実測）
  - 内訳: **単一行取得30件**（`.single()`/`.maybeSingle()`、削減余地ほぼ無し）、
    **limit付き18件**（うち`limit=1`が7件）、**limit無しの複数行33件**。
  - limit無し33件の大半は極小テーブル（`mentorship_profiles` 2.9KB / `youtube_channels` 1.4KB /
    `soloq_reflections` 8.4KB 等）で、列を絞っても差が出ない。
  - 実データのある上位2件を実測した結果、**転送量は半減するが応答は 8〜10% しか縮まなかった**:
    - `ktm_match_participants`（1,220行×21列）: 424ms/463KB → 11列指定で 388ms/244KB
    - `youtube_queue`（1,232行×12列）: 470ms/408KB → 9列指定で 420ms/299KB
  - しかもこの2件は MMR再計算バッチ / 管理画面で、ユーザー導線のホットパスではない。
  - 81箇所を書き換える保守コストに見合わないため**見送る**。将来テーブルが数万行規模に育った場合は再検討する。
  - 参考: 巨大テキスト列を持つ `champion_facts` は全列1,265ms/1,585KB に対し4列指定で527ms/69KB と
    劇的な差が出るが、**実コード上に全列取得している箇所は無い**（`dictionary-overview` は既に列指定済み、
    `refine-facts` は単一行）。
  - **教訓**: 本セッションでは推測ベースの提案が実測で3回否定された（loading.tsx追加・recharts全ページ肥大化・
    本件）。以後、性能改善は必ず「先に測る」。

---

## ✅ カジノの収支監査 ＆ ベット改ざん経路の封鎖（2026-09-22 完了 / コミット `24cede10`）

> **経緯**: 「各ゲームのルール説明が欲しい」「どれもいい感じの収支になっている？」という
> 問いから全ゲームの実装を精査したところ、**ゲームバランス以前に不正操作が可能な経路が4つ**
> 見つかった。RTPはすべて `04_PORTAL/scripts/casino_rtp_report.js` で200万回試行して実測している。

### 塞いだ脆弱性

- **認証ヘルパーが認証として機能していなかった**: `lib/authGuard.ts` の `verifyUserOrAdmin` は
  ①セッションが無ければリクエストボディの識別子で擬似セッションを生成し、
  ②どの照合にも一致しなくても最後に `return { ok: true }` していたため、
  **一度も `ok:false` を返さなかった**。`/api/bet`・`tip`・`shop`・`handicap` が
  他人のdiscordIdを書くだけで他人のコインを操作できる状態だった。
- **オッズをクライアントが自由に決められた**: `/api/bet` POST が `body.odds` を無検証で保存し、
  精算側(`match/record`)がその値で払い戻していた。`odds: 99999` で賭け金の99,999倍。
  1.15〜10.0のクランプは**ブラウザ側にしか存在しなかった**。
- **`/api/bet/settle` が無認証**: 1人あたり最大850コインを任意のプレイヤーへ無制限に発行できた。
- **`/api/bet/baccarat` と `/api/bet` PUT(おみくじ・破産救済)が無認証**。

### 是正したRTP（左が修正前 → 右が修正後・いずれも実測値）

- **バカラ**: PLAYER 3.45% → **1.36%** / BANKER 1.07% → **0.94%** / TIE 24.15% → **14.24%**
  （TIEは本場の「8 to 1」ではなく「8 for 1」で計算されており約10pt不利だった）
- **クラッシュ**: 利確目標ごとにRTPが 99.67%〜10.47% と乖離していた（低倍率で刻むほど得・
  高倍率狙いは一方的に搾取される構造）。逆関数サンプリング `0.96/(1-r)` へ変更し
  **全目標で96%一定**に。上限50倍。
- **宝くじ**: 1等リセット10,000と2等1,000を無徴収で発行しており、321口未満では毎回
  コインを純増させる**インフレ装置**だった。賞金を当週売上の内訳から拠出する方式へ変更し
  **発行超過を0**に。

### 新設したもの

- `04_PORTAL/src/app/casino/rules/page.tsx`（`/casino/rules`）: 全ゲームの確率・配当・RTP・
  ハウスエッジを公開。配当テーブルを変更したら**必ずこのページの数値も更新すること**。
- `04_PORTAL/scripts/casino_rtp_report.js`: RTP実測スクリプト。
  **検証**: `cd 04_PORTAL && node scripts/casino_rtp_report.js`
- `04_PORTAL/src/lib/betOdds.ts` ＋ 回帰テスト10件（テストは計46件パス）。
  **検証**: `cd 04_PORTAL && npm test`

### 🚨 デプロイ前に必須（未着手・ユーザー作業）

- [ ] **`PORTAL_BOT_SECRET` を Vercel と Cloudflare Workers の両方に設定する**（所要: 10分）
  - `/api/bet/settle` と `/api/bet` はKTM Botからも呼ばれるが、Botはセッションcookieを持たず
    `X-Bot-Secret` しか送らない。**この値が未設定だと安全側に倒れて拒否するため、
    Discordからの自動精算とベットが止まる**。
  - 2026-09-20時点では「露出は低リスクな通知エンドポイントのみ」としてユーザー判断で
    未設定のまま運用していたが、**今回コイン発行系が依存するようになり前提が変わった**。
  - **やること**:
    ```bash
    openssl rand -hex 32                       # 1. 値を生成
    # 2. Vercel: Settings > Environment Variables に PORTAL_BOT_SECRET を追加
    cd 03_SYSTEMS/ktm_bot && npx wrangler secret put PORTAL_BOT_SECRET   # 3. Workers側
    ```
  - **検証**: 設定後にDiscordで `/bet` を実行し、コインが引かれることを確認する。
- [ ] **`24cede10` の push ＆ デプロイ**（上記シークレット設定の後に行うこと）

### ジャックポット金庫の是正 ＆ コイン台帳の新設（2026-09-22 実装完了・DB適用待ち）

**判明した事実（実測）**

- **ペンタキル総取りは一度も発火しないデッドコードだった**。カジノ画面は「🔥 ペンタキルで総取り！」と
  告知していたが、①`ktm_match_participants` に `penta_kills` 列が無く、
  ②判定が `/api/match/record`（Botが kills/deaths/assists を0埋めで送る時点）で走り、
  実データを埋める `riot/match-sync` は3分後という二重の理由で永久に0のままだった。
  さらに `lib/riot.ts` の `fetchMatchDetails` が `pentaKills` をマッピングしていなかった（3つ目の欠落）。
- **金庫19,505コインはほぼ全額が新規発行分**で、プレイヤーから集めた金ではなかった。
  内訳は 試合開催ボーナス+100/試合 ×122試合 ≒ 12,200、初期値 `DEFAULT_JACKPOT` 12,800、
  ベット5% ≒ 97。**宝くじ券の購入実績は0枚**（保有0・履歴0）。
- **金庫は主要なインフレ源ではなかった**。月あたりの発行は 試合精算 約23,000 /
  おみくじ 約15,000（直近実績で1日2〜4名が受取）/ 破産救済 約2,100 に対し、金庫は約900。
  一方で9月は19名中**7名**が残高100未満まで落ちて破産救済を使っており、吸収側も大きい。

**実装したこと**

- [x] **金庫に上限 `JACKPOT_CAP = 5000` を設定**（`lib/jackpot.ts`）。上限到達中は積立をスキップする。
  ユーザー判断により**既存の超過分（約14,505）は据え置き**、上限は今後の積立停止にのみ適用。
- [x] **払い出し後のリセット額を 10,000 → 0 に**。旧実装は払い出しのたびに1万コインを無条件生成していた。
  読み取り失敗時のフォールバックも 12,800 → 0（幻のコインを作らない）。
- [x] **ペンタキル判定を `riot/match-sync` へ移設**し、実データ取得後に判定するようにした。
  `lib/riot.ts` に `pentaKills` のマッピングを追加、`match-sync` が `penta_kills` を保存。
  再同期による二重払い出しを防ぐため `ktm_matches.jackpot_claimed` フラグを追加。
- [x] **コイン台帳 `coin_transactions` を新設**（`lib/coinLedger.ts`）。
  `updatePlayerCoinsAndInventory` に `reason` を渡すと自動記録される。
  おみくじ・破産救済・試合精算・ベット投入/払戻・スロット・クラッシュ・バカラ・
  ショップ・ハンデ・チップ送受・宝くじ・ジャックポットの全経路に付与済み。
  **集計**: `summarizeCoinFlow(days)` で reason 別の発行/消費を実測できる。
- [x] `/casino/rules` に金庫の説明（2つの当選方法・積立元・上限の存在）を追記。
- [x] **ジャックポット総取りの条件を「ペンタキル達成 ＋ その試合に勝利」に変更**（2026-09-22）。
  負け試合での帳尻ペンタキルで金庫が飛ぶのを避け、勝ちに繋がった活躍だけを報いる。
  判定は `riot/match-sync` の `penta_kills > 0 && team === match.winning_team`。
  Discord通知と `/casino/rules` の文言も勝利条件を明記済み。

**🚨 デプロイ前に必須（未着手）**

- [ ] **【最優先】migration 74・75・80 を本番へ適用する**
  - 2026-09-22に実DBと照合した結果、`_migrations` の記録（70番まで）と実態が食い違っており、
    **74・75・78 が未適用**だと判明した。実測結果は以下のとおり。

    | 番号 | 対象 | 状態 |
    |---|---|---|
    | 71 | `champion_jungle_timing_agg` | ✅ 適用済み |
    | 72 | `ktm_players.coins` / `.inventory` | ✅ 適用済み |
    | 73 | `mentorship_matches` / `mentorship_profiles` | ✅ 適用済み |
    | **74** | `mentorship_reviews` / `player_reputations` | ❌ **未適用** |
    | **75** | `mentorship_profile_comments` | ❌ **未適用** |
    | 76 | `mentorship_profiles.max_pupils` | ✅ 適用済み |
    | 78 | `crash_used_tokens` | ❌ 未適用（※参照0件・後述） |
    | 79 | `crash_sessions` | ✅ 適用済み |
    | **80** | `coin_transactions` / `penta_kills` / `jackpot_claimed` | ❌ **未適用（今回追加）** |

  - ⚠️ **`node scripts/migrate.mjs` は現状そのままでは動かない。`DATABASE_URL` が未設定のため**
    （`.env` / `04_PORTAL/.env` / `.env.local` のいずれにも無い）。
    このスクリプトはPostgresへ直接接続してDDLを流す作りで、手元の
    `SUPABASE_SERVICE_ROLE_KEY`（PostgREST経由）ではDDLを実行できない。
    71〜79が記録から漏れていたのはこれが原因で、Supabaseダッシュボードから
    手動適用されていたと考えられる。
  - **やること**: Supabaseダッシュボード → Settings → Database → Connection string → URI を取得し、
    ```bash
    cd d:/my_work
    DATABASE_URL='postgresql://postgres.xxxxx:[パスワード]@...pooler.supabase.com:6543/postgres' node scripts/migrate.mjs
    ```
    `.env` に保存する場合はユーザーの許可を得てから追記すること（機密情報のため）。
  - **検証**: 適用後に以下で3件すべてが200を返すこと。
    ```bash
    node 04_PORTAL/scripts/casino_rtp_report.js   # 設定値の再確認（DB非依存）
    curl -s "https://my-work-8jbd.vercel.app/api/player/reputation?playerName=test"
    ```
    加えて `coin_transactions` / `ktm_match_participants.penta_kills` /
    `ktm_matches.jackpot_claimed` の3つがPostgREST経由で引けることを確認する。
  - 80番が未適用でもアプリは壊れないよう防御済み（台帳の書き込み失敗は warn で握りつぶし、
    `penta_kills` を含む更新が失敗したら列なしで再試行する）。ただし台帳は記録されない。

- [ ] **【重要】告知済みの師弟機能3つが本番で静かに壊れている**（上記74・75の適用で直る）
  - 2026-09-14の更新履歴で告知した以下が、テーブル不在のまま動いている。
    - ⭐ 師弟の完全匿名評価 ＆ 満足度集約（+100🪙） … `mentorship_reviews`
    - 🌟 メンバー匿名評判 ＆ KTM栄誉システム（+50🪙） … `player_reputations`
    - 💬 師弟プロフィールへのコメント … `mentorship_profile_comments`
  - 本番で叩くと **HTTP 200 で空データが返る**（エラーにならない）。
    ```
    mentorship/reviews    200  {"ok":true,"summaries":{},"hasReviewed":false}
    player/reputation     200  {"ok":true,"tagCounts":{},"totalKudos":0,"canSendToday":true}
    mentorship/comments   200  {"ok":true,"comments":[]}
    ```
  - 原因は `app/api/player/reputation/route.ts` 42〜45行目のように、selectのerrorを
    `console.warn` に落として `ok: true` を返していること。**読み取りは永久に空、書き込みは失敗**する。
    2026-09-22に一掃した「失敗を隠して成功を装う」パターンそのもので、
    `known-regression-patterns` のパターン5に該当する。
  - **74・75を適用したら、実際にレビュー投稿・評判送信・コメント投稿が通るかを必ず動作確認すること**
    （テーブルを作っただけで満足せず、書き込み経路まで確かめる）。
  - **あわせて検討**: テーブル不在のような構造的エラーまで握りつぶしてよいのか。
    少なくとも「データが無い」と「テーブルが無い」は区別してログ・レスポンスに出すべき。

### 🤔 判断が必要（未着手）

- [ ] **到達不能コード15ファイル（166.8KB）＋未使用依存2件の扱いを決める**（2026-09-22 調査済み）
  - エントリポイント213件から**到達可能性を辿る解析**を実施（`src/` 配下で動的importは0件のため
    取りこぼし無し）。結果は「到達可能348件 / **到達不能15件**」。
  - ⚠️ **削除してもパフォーマンスは1バイトも改善しない**。どこからもimportされていないため
    既にバンドルへ含まれていない。効くのは①AIのコンテキスト消費（171KBが検索対象から外れる）
    ②開発時の混乱解消 ③**無駄な作業の防止**の3点。
    実際 2026-09-22 に `SoloQReflectionModal.tsx`（alert→トースト化）と
    `MatchupWarningCard.tsx`（偽装データ一掃）を編集したが、**どちらも死んだファイルで作業が無駄になった**。
  - **再調査用スクリプト**: 下記を実行すれば同じ解析を再現できる（都度書き直さないこと）。
    `04_PORTAL/scripts/find_dead_code.mjs`

  **(a) 重複・未使用が明白（判断不要。指示があれば即削除する / 計 7.3KB）**

  | ファイル | 理由 |
  |---|---|
  | `src/components/BottomNav.tsx` | `Sidebar.tsx:423` に同等のスマホ用ボトムナビが実装済み。完全な重複 |
  | `src/components/Skeleton.tsx` | `components/Feedback.tsx:14` に同名の生きた `Skeleton` 実装あり |
  | `src/lib/apiClient.ts` | 参照0件 |
  | `src/lib/supabaseBrowserClient.ts` | 参照0件（`lib/supabaseClient.ts` が生きている） |

  - あわせて **`clsx` と `tailwind-merge` が `package.json` に残っているが参照0件**
    （shadcn系の `cn()` ヘルパーも存在しない）。削除候補。

  **(b) 告知済み機能のため判断が必要（計 153KB）**

  下記は更新履歴でメンバーに告知した機能だが、どこからも呼ばれていない。
  削除＝「実装したはずの機能を正式に諦める」判断になるため、勝手に消さないこと。

  | ファイル | 告知された機能 |
  |---|---|
  | `app/coach/TiltDiagnosisPopup.tsx` (17.5KB) | ティルト診断の自動ポップアップ（2026-08-04告知） |
  | `components/coach/JgMatchupPredictor.tsx` (13.0KB) | JG特化HUDカンペ（2026-08-20告知） |
  | `components/coach/JgSkillMasteryChecklist.tsx` (7.8KB) | 同上 |
  | `components/coach/FocusStickyBar.tsx` (4.0KB) | 同上 |
  | `app/coach/AngerDetoxModal.tsx` (6.3KB) | 間接的に死亡（呼び出し元が死んでいる） |
  | `app/coach/SoloQReflectionModal.tsx` (51.7KB) | ソロQ振り返りモーダル |
  | `app/coach/MatchupWarningCard.tsx` (23.8KB) | **存在しない `/api/coach/matchup-warning` を呼んでいる**（復活させるならAPIから作る必要あり） |
  | `app/coach/MatchupSmartCard.tsx` (12.4KB) | |
  | `app/coach/EarlyJunglePathingCard.tsx` (8.0KB) | 間接的に死亡 |
  | `components/coach/MinimapPlotView.tsx` (7.1KB) | 間接的に死亡 |
  | `app/admin/knowledge/PendingInsightsPanel.tsx` (8.0KB) | 管理画面。呼ぶ `/api/admin/knowledge/pending-review`(4.1KB) も生きた呼び出し元0件 |

  - **選択肢**: ①まとめて `99_ARCHIVE/` へ退避（スキル棚卸しと同じ方式・復元可能） ②削除
    ③使いたいものだけ `coach/page.tsx` へ配線して復活
  - `coach/page.tsx` が現在importしているのは ScoutTab / FiveVFiveSimTab / MySoloQDashboard /
    PlayerStyleRadarCard / VisionAnalyticsCard / ChampionQuickSelector / MatchupBlueprintCard /
    MatchFightsAnalyticsCard / PostGameDeepAnalyticsDashboard / OverlayLauncherButton /
    SoloQDeepIntelSyncCard の11件。復活させるならここへ足す。

- [ ] **巨大ファイルの分割は「先に実測」してから判断する**（未着手・低優先）
  - 候補: `app/balancer/page.tsx` 176KB / `app/champions/tabs/DictionaryTab.tsx` 174KB /
    `app/analyzer/page.tsx` 116KB / `app/player/[id]/page.tsx` 105KB /
    `app/ktm-admin/page.tsx` 97KB / `lib/sessionAnalyticsCalculator.ts` 92KB
  - ⚠️ **推測で着手しないこと**。2026-09-22に「rechartsが全ページを肥大化させている」という
    推測が実測で否定された（既にルート分割済みだった）。分割前に必ずバンドル実測を行う。

- [ ] **migration 78 `crash_used_tokens` の置き去りをどうするか**（所要: 5分）
  - このテーブルは未適用のままだが、**コード内の参照が0件**。79番の `crash_sessions` 方式へ
    移行した際の置き去りで、未適用でも実害は無い。
  - **選択肢**: ①ファイルごと削除する ②冒頭に「廃止・適用不要」のコメントを足して残す。
    放置すると次に棚卸しする人が同じ調査を繰り返す。

- [x] ~~**ジャックポット金庫 19,505コインの扱いを決める**~~ → 2026-09-22に決定・実装済み（上記セクション参照）。
  **既存の超過分は据え置き**、上限5,000は今後の積立停止にのみ適用する方針をユーザーが選択。
  あわせてペンタキル経路を実装し、金庫に実際に機能する出口を作った。
  - 2026-09-22時点の実測で、**金庫19,505コインが総流通量15,407コインを上回っている**
    （保有者19名 / 平均810 / 中央値601 / 最高保有者かずきさん4,129）。
  - `lastWonAt: null`＝**一度も当選者が出ておらず**積み上がり続けている。この状態で1等が出ると
    1人が通貨供給を2.3倍に増やし、2位の4.7倍の資産を持つことになる。
  - **選択肢**: ①据え置き（お祭りとして許容）②上限を設けて超過分を全員へ均等還元
    ③初期値まで減額して仕切り直し。
  - 是正後の宝くじは売上の60%しか積み立てないため**今後の増加ペースは大きく下がる**が、
    既に積み上がった19,505コインは別途どうするか決める必要がある。
- [ ] **コイン供給全体の見直し**（低優先・上記の判断次第）
  - おみくじの期待値が1人1日165コイン。19名全員が毎日引くと**5日で総流通量が倍**になるペース。
    試合精算も1試合あたり約2,550コインを発行する（参加100×10 + 勝利150×5 + MVP200 + 各賞200×3）。
  - `findOrCreatePlayer` の `autoCreate: true` は初期所持金1000コインで新規作成するため、
    アカウントを増やせばコインを増やせる経路も残っている（認証修正で悪用はしにくくなった）。

---

## 🔧 積み残し（2026-09-21セッションで発見・判断保留したもの）

いずれも実害は小さいが、調査済みの経緯を失わないよう記録する。

- [ ] **⚖️ バランサーのサイド公平化に回帰テストが無い**（所要: 30分程度・課金なし）
  - 2026-09-21の監査で現行ロジックにバグは無いと実測確認済み（偏った`sideHistory`で40回試行し100%正しい側を選択、中立時は33/27でほぼ50/50）。
  - ただし**このロジックを直接検証するテストが0件**で、2026-09-19〜20に同じバグを2回連続で見逃した経緯がある（1回目の修正は等価変形で実際には直っていなかった）。次に誰かが触った際に再発を検知できない。
  - **やること**: `04_PORTAL/src/lib/__tests__/balancer.test.ts` に以下2点のテストを追加する。
    - 偏った`sideHistory`（片方にBLUE10/RED0、もう片方にBLUE0/RED10）を与え、RED偏重だった側が今回BLUEになることを検証
    - `sideHistory`が中立のとき、多数回試行して概ね50/50に分布する（系統的バイアスが無い）ことを検証
  - **検証**: `cd 04_PORTAL && npm test`（現在36件が約20秒で全パス）
- [ ] **🏆 月間アワードの自動投稿が停止したまま**（所要: 5分・要デプロイ）
  - `scheduled.js`に毎月1日12:00 JSTの投稿ロジック（`mode: monthly_award`）が実装済みだが、2026-09-16の`fb275ce4`でcronを刷新した際に`"0 3 1 * *"`が`wrangler.toml`から落とされ、GitHub Actions側にも代替が無いため**完全なデッドコード**になっている。
  - 2026-09-21にユーザー判断で「今は復活させない」と決定。
  - **復活させる場合**: `03_SYSTEMS/ktm_bot/wrangler.toml`の`crons`配列へ`"0 3 1 * *"`を追加し、`cd 03_SYSTEMS/ktm_bot && npx wrangler deploy`。Discordチャンネルへの自動投稿が復活する点に注意。
- [ ] **📅 `DAILY_LOG.md`に日付エントリが無い**（所要: 判断次第）
  - `ops_health_check.py`が「デイリーログ鮮度: 日付エントリが検出できませんでした」を出し続けている。2026-09-18に新設した運用（作業終了時にAIが追記し翌朝読み直す）が実際には回っていない。
  - **判断が必要**: ①運用を続ける（セッション終了時に追記する習慣をルール化する）か、②チェック自体を`ops_health_check.py`から外すか。形だけ残すとヘルスチェックのノイズになり、本当に見るべきWARNが埋もれる。
- [ ] **🗂️ `scratch/`(96MB)がAIの検索対象に入りうる**（低優先・現状維持で可）
  - `.gitignore`済みだが、Glob/Grepの検索範囲を絞る標準的な仕組みが見当たらず、無理に`settings.json`をいじるより現状維持が安全と判断して2026-09-21は見送った。エージェントが誤って広範囲に読み込む実害が出た場合に再検討する。

---

## 📜 過去の完了済みセッション履歴（詳細は [TODO_ARCHIVE.md](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md) を参照）

- **2026-09-22**: カジノ全ゲームの収支監査（ベット改ざん経路4件を封鎖、バカラ/クラッシュ/宝くじのRTPを実測ベースで是正、確率公開ページ /casino/rules を新設）、ハードコード偽装データ36件の全量調査・一掃、ポータル応答改善（参照系API6本のCDNキャッシュ／alert→トースト／チャート遅延読込で初回JS 1,325→925KB）、select(*)列指定化は実測の結果 効果8〜10%で見送り判断
- **2026-09-21**: コンテキスト消費削減の大掃除（HANDOVER/TODO圧縮）、ポータル無限ロード修正、KTM Bot cron曜日ズレ＆20:00判定の機能停止修正＋募集文言の土日分離（デプロイ済み）、動画深堀りモード新設、実演クリップ15本マウント、戦術バイブル12体配備、ヘルスチェックの虚偽報告修正
- **2026-09-18**: ナレッジマネジメント7大核心原則をSovereign OS全域へ反映（38項目、デイリーログ・地雷回避DB・自動バイブル同期デーモン等を新設）
- **2026-09-17**: 一般ユーザー向けポータル改善第2弾（試合履歴解放・選手カルテ・ボトムナビ・師弟掲示板）、業務効率化5大課題解消（監査コマンド化・LLM健全性ルール・スキルスリム化・UI規約明文化・辞典同期CLI）
- **2026-09-08**: ファクトチェック画面全面強化、DataDragon辞書同期基盤構築、Hextechオーバーレイリニューアル
- **2026-09-07**: リーダーボードにコイン長者番付タブ追加
- **2026-09-05**: コイン機能・ログインボーナス・ショップ購入の不具合解消
- **2026-09-04**: Sovereign HUDオーバーレイのフルスペック化、集団戦セッション自動特定＆勝因敗因アナライザー
- **2026-08-09〜08-10**: 【最重要】Gemini APIクォータ枯渇の根本原因究明・解消、辞典/ソロQコーチ/KTM Bot不具合修正、再発防止スキル4件新設
- **2026-08-04**: ティルト診断自動ポップアップ化、辞典一斉ファクトチェック機能新設、日本語化バッチ拡充、依存パッケージ棚卸し（脆弱性37→18件）
- **2026-07-26〜08-04**: Sovereign OS v7.0移行完走、収益化パイプライン削除、Supabase直接アクセスのAPI経由化、RLSセキュリティ監査、YouTube解析のローカルPC実行方針確定、デザイン刷新（クリーム調→暖色ダークへ再刷新）

---

## 📊 運用目標 ＆ 前提ルール
- **note配信**: 週2回（水・土） / 500円モデル有料記事 of 自動生成
- **SNS（X）宣伝**: パッチメタに応じたチャンピオン紹介スレッドの配信
- **主要アセット**: 
  - [NEXUS_INDEX.md (総合索引)](file:///d:/my_work/01_INTEL/NEXUS_INDEX.md)
  - [アフィリエイト知識](file:///d:/my_work/02_FACTORY/03_ASSETS/affiliate_knowledge.md)
  - [note執筆プロトコル](file:///d:/my_work/02_FACTORY/03_ASSETS/forge_note_protocol.md)

## 🚧 技術的負債バックログ

現時点で未解決の技術的負債はありません。過去に洗い出した項目（タスクキュー統合、Gatewayバイパス解消、Supabase API経由化、RLS監査、cron曜日ズレ修正等）は全件対応済みです。詳細は[アーカイブ](file:///d:/my_work/02_FACTORY/TODO_ARCHIVE.md)を参照。
