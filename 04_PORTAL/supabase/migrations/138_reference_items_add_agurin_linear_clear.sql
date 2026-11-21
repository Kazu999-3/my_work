-- Migration: 138_reference_items_add_agurin_linear_clear.sql
-- Description: 欧州王者Agurin直伝「リニアクリア（直線動線）」と赤バフスキップ理論（D115）新規追加

INSERT INTO public.reference_items (
    code, title, author, url, category, summary, content, has_fulltext, source_group, created_at, updated_at
)
VALUES 
(
    'D115',
    '欧州王者Agurin直伝「リニアクリア（直線動線）」と赤バフスキップ理論',
    'bonevoid @bonevoid (Agurin @AgurinLoL)',
    'https://x.com/bonevoid/status/2100745745276276897',
    'LoL上達・戦術',
    '欧州最強ソロランク王者Agurin氏の移動効率極大化マクロ。円形フルクリアの往復ロスを排除し、目的地への経路上にあるキャンプだけを直線（リニア）で狩る。テンポ最優先なら赤バフすらスキップして敵より先に盤面を制圧する最高峰のテンポ論。',
    '【欧州王者Agurin直伝：リニアクリア（直線動線）と赤バフスキップ理論】
一次ソース: bonevoid氏解説 (元動画/配信: Agurin @AgurinLoL)
URL: https://x.com/bonevoid/status/2100745745276276897

■ 1. 思考停止フルクリアの罠（円形クリアの往復ロス）
多くのジャングラーは「すべてのキャンプを狩らなければ損」と思い込み、円形に全キャンプを回ろうとする（例: 青➔グロンプ➔ウルフ➔ラプター➔赤➔クルーグ）。
しかし、この動線はマップ中央やレーンから離れる無駄な往復移動（タイムロス）を生み、レーンの状況変化（味方のピンチ、敵の甘え、オブジェクト発生）に対して常に「後手」になる。

■ 2. リニアクリア（Linear Clear：直線動線）の概念
目的地点（ガンク、インベード、オブジェクト、敵陣サイド）を設定し、そこへ向かう経路上に存在するキャンプだけを「一直線（リニア）」に狩り抜ける動線設計。
・目的地がBotなら、TopサイドのキャンプからBotサイドへ向かって一直線に流す。
・余計な寄り道（角にあるクルーグや孤立したバフ）で動線を歪ませない。

■ 3. 「Why I skip Red Buff」（なぜ赤バフを捨てるのか）
Agurinが実戦で赤バフをあえてスキップして目的地へ走る理由：
① テンポの同期:
レーナーのウェーブクラッシュや敵のタワー下ダイブの猶予時間は数十秒しかない。赤バフを殴っている15秒〜20秒のロスで、その黄金のガンク・ダイブタイミングが完全に消滅する。
② 敵ジャングラーへの先手:
敵JGが定石どおりフルクリアして赤バフを叩いている間に、こちらはリニアクリアで最短到達し、敵陣インベードや敵タワーダイブを仕掛けて盤面を破壊できる。
③ キャンプは逃げないが、盤面のチャンスは逃げる:
赤バフはあとで狩ればいい（または敵が奪いに来たらカウンターで他を奪う）。ゲームを動かすのは「キャンプのゴールド」ではなく「テンポによって得られるレーン主導権とキル・タワープレート」である。

■ 4. 実戦への適用ルール
① 目的地（どこでゲームを動かすか）を先に決める。
② その目的地に向かう最短直線上のキャンプのみをピックアップする。
③ 動線から外れるキャンプ（赤バフやクルーグ等）を狩るとタイミングが遅れる場合は、躊躇なくスキップして直行する。
④ 敵より20秒早くアクションを起こし、テンポの差で試合を掌握する。',
    true,
    'D',
    now(),
    now()
)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    author = EXCLUDED.author,
    url = EXCLUDED.url,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    has_fulltext = EXCLUDED.has_fulltext,
    source_group = EXCLUDED.source_group,
    updated_at = now();
