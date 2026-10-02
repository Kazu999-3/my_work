import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const raw = fs.readFileSync('./.env.local', 'utf-8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('lane_guides').select('*').eq('lane', 'JG').single();
  if (error || !data) {
    console.error('JG guide not found:', error);
    return;
  }

  const lines = data.body.split('\n');
  const section8Idx = lines.findIndex(l => l.startsWith('## 8.'));
  if (section8Idx === -1) {
    console.log('Already refined or no Section 8 found.');
    return;
  }

  // コアバイブル部分（105行、約6,500文字）を抽出
  const coreBody = lines.slice(0, section8Idx).join('\n').trim();

  // プロの5大極意（カメラワーク・スマイト50/50回避・ウェーブ介入・中盤シャドウ・ミュート基準）を第6章・第7章として美しく肉付け
  const refinedBody = `${coreBody}

## 6. 高レートJGの5大実戦極意（プロ・チャレンジャーの無意識の思考）

実戦動画・チャレンジャー解析から抽出された、JG勝率を直結で引き上げる5大極意です。

- **① モンスター狩り中のカメラワーク（情報収集の視線）**: 自陣キャンプを狩る際、自分のチャンピオンを見る時間は全体の20%以下に抑える。残りの80%は視点を各レーンへ飛ばし、敵味方のスキル使用状況（FlashやCCが落ちたか）、ウェーブの引き具合、マナ残量を常に定点観測する。
- **② ガンク後のウェーブ介入ルール（触る vs 触らない基準）**:
  - 【触る基準】: 味方がリコールしたい時、タワー下まで一気に押し切ってバウンスを作れるなら全力でプッシュ（ゴールドとXPを共有しつつ味方に安全なリコールをプレゼント）。
  - 【触らない基準】: 味方が自陣手前でウェーブをフリーズできる状態なら、ミニオンに1発も触れず即座に森へ帰還する。
- **③ スマイト管理 ＆ 50/50（運ゲー）勝負の絶対回避法**:
  - スマイトの運ゲー（50/50）は「JGの敗北」と心得る。オブジェクト周りではまず敵JGをキル・排除するか、一旦引いてリセットする。
  - やむを得ず競り合う際は、「バーストスキル ＋ スマイト」の同時着弾（例: リーシンのQ2着弾瞬間にスマイト）で一瞬で削り切り、敵の反応猶予をゼロにする。
- **④ 14分以降（中盤）のJGの居場所・迷子防止（シャドウの基準）**:
  - 外塔陥落後、スプリットプッシャー（TOPやMID）の背後1画面分の暗闇に立つ「シャドウ」を徹底する。敵が囲みに来た瞬間にカウンターガンクを仕掛けることで、2v3を制してバロンへと繋げる。
- **⑤ 冷徹なオペレーターメンタル（ミュート基準）**:
  - 無理なガンク要求ピンや理不尽なハテナピンを打つ味方は、最初の1回で即座にピンミュートする。自分の確固たる周回テンポを崩さないことこそが、最終的にその味方を勝たせる唯一の道である。

## 7. 2026年シーズン初動テンポ早見表

- **0:55**: ジャングルモンスター湧き（味方リーシュを受けて最速開始）
- **2:15**: 最速3キャンプ完了 ➔ レベル3ガンクまたはインベードの選択ウィンドウ
- **2:45〜2:50**: 最速フルクリア完了 ➔ リバーへ移動
- **2:55**: 初動リフトスカトル（カニ）出現 ➔ レーン主導権がある側を確保
- **5:00**: 1stドラゴン湧き
- **8:00**: ヴォイドグラブ湧き（3体討伐でタワーシージ圧力を掌握）
- **14:00**: タワープレート陥落 ➔ スプリットプッシュのシャドウとヘラルド戦へ移行
- **20:00**: バロン・ナッシャー湧き ➔ 視界完全支配からのベイトまたは直撃`;

  const { error: updateErr } = await supabase
    .from('lane_guides')
    .update({
      body: refinedBody,
      updated_at: new Date().toISOString(),
    })
    .eq('lane', 'JG');

  if (updateErr) {
    console.error('Update failed:', updateErr);
  } else {
    console.log('✅ JG lane guide refined successfully! New char count:', refinedBody.length);
  }
}
run();
