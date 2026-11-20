# SPEC 09: 動画解析の優先度を「プレイリスト → 特定チャンネル → チャンプ調査」に統一（YouTube解析パイプライン）

## 目的
- 動画解析の処理順を、末吉の指定どおり「①プレイリスト分析 → ②特定チャンネルの解析 → ③自動チャンプ調査」の順に統一する。

## 現状（2026-11-20 コードで確認済み。指定と逆になっている）
- ワーカー（scripts/youtube_worker.py）は priority の high → medium → low の順に、同priority内では登録が古い順に処理する仕組みが既にある。
- ところが登録側の priority の付け方が指定と逆：
  - 自動チャンプ調査（scripts/champion_researcher.py、scripts/prospector.py、/api/youtube/scout-champion の既定値）が **high** ＝最優先で処理されている。
  - 特定チャンネル監視（scripts/cloud_youtube_monitor.py）は medium。
  - プレイリスト登録（03_SYSTEMS/v2_CORE/_LOL/youtube_monitor.py のプレイリスト解決、channel_name が `[PL]` 始まり）とチャンネル監視（同ファイル）は priority 未指定＝medium 扱い。
- つまり今は「チャンプ調査 → （プレイリスト・チャンネル同列）」の順で、指定の真逆に近い。

## やること
- [ ] **プレイリスト由来を high にする**：youtube_monitor.py のプレイリスト解決経由の登録に priority=high を明示する。キューAPI（/api/youtube/queue）のプレイリスト追加経由も同様に high とする（source／[PL] 表記で判別できる経路はすべて）。
- [ ] **特定チャンネル由来は medium を明示する**：cloud_youtube_monitor.py は現行 medium のまま明示を維持し、youtube_monitor.py のチャンネル監視経由の登録にも priority=medium を明示する（未指定にしない）。
- [ ] **自動チャンプ調査を low に下げる**：champion_researcher.py、prospector.py、/api/youtube/scout-champion の既定 priority を low に変更する。画面から手動で指定された場合は、その指定を尊重する。
- [ ] **既存の仕組みは壊さない**：ワーカーの処理順（high→medium→low、同順位は古い順）は変更しない。タイムアウトした動画を low に落とす既存のペナルティも維持する（プレイリスト由来でもタイムアウトすれば low に落ちるのは従来どおり）。キュー画面の手動の優先度変更（set_priority）も従来どおり使えること。
- [ ] **既存 pending の扱い**：現在キューに残っている pending（2026-11-20 朝時点で431件）については、由来が確実に判別できるものだけ付け替える（channel_name が `[PL]` 始まり → high、champion_researcher 由来と判別できるもの → low）。判別できないものは現状の priority のままにする。付け替え前に、対象件数の内訳を報告すること。
- [ ] 変更後に、登録元の異なる動画で処理順が「プレイリスト → チャンネル → チャンプ調査」になることを確認し、結果を報告する。Python 側の既存テストがある場合は通すこと。

## やらないこと
- ワーカーの処理サイクル、解析処理そのもの、ステータス遷移の変更。
- priority の段階を増やすなどの仕組み変更（high/medium/low の3段階のまま、付け方だけを直す）。
- 由来が判別できない既存 pending の推測での付け替え。

## 完了条件
- 新規登録分について、処理順が「プレイリスト（high）→ 特定チャンネル（medium）→ 自動チャンプ調査（low）」になっていることが、コードと実際の処理順の両方で確認できる。
- 既存 pending の付け替えは、判別可能なものだけに実施され、内訳が報告されている。
- 手動の優先度変更、タイムアウト時の low 落ちが従来どおり動く。

## 未決事項（エージェントが勝手に決めない）
- 既存 pending のうち由来が判別できないものの扱い（既定は現状維持。変える場合は末吉の判断）。
- チャンプ調査（low）は上位が空のときだけ処理されるため、滞留が続く場合はその旨を報告する（勝手に比率配分などを入れない）。
