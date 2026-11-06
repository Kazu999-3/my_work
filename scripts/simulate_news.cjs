const path = require('path');
require(path.resolve(__dirname, '../04_PORTAL/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../04_PORTAL/.env.local')
});
const { createClient } = require(path.resolve(__dirname, '../04_PORTAL/node_modules/@supabase/supabase-js'));

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function simulate() {
  const { data: edgeData } = await sb
    .from('edge_tasks')
    .select('payload')
    .eq('task_type', 'ktm_match_detail_stats')
    .eq('payload->>matchId', 'd0e39dd5-65ec-4063-94af-b267750b4882')
    .limit(1);

  const detail = edgeData[0].payload;
  const winnerParts = detail.participants.filter(p => p.team === 'BLUE');
  const loserParts = detail.participants.filter(p => p.team === 'RED');
  const winnerTotalDmg = winnerParts.reduce((s, p) => s + (p.damage_dealt || 0), 0);
  const loserTotalDmg = loserParts.reduce((s, p) => s + (p.damage_dealt || 0), 0);

  const participantSummary = detail.participants.map(p => {
    return `- [${p.team}] [${p.role}] ${p.name} [MMR:${p.playerMmr}] (${p.champion_name}) KDA: ${p.kills}/${p.deaths}/${p.assists} [与ダメ:${(p.damage_dealt/1000).toFixed(1)}k, 被ダメ:${(p.damage_taken/1000).toFixed(1)}k, 視界:${p.vision}, CS:${p.cs}, 白黒時間:${p.time_dead}秒] (MMR変動: ${p.mmrDelta > 0 ? '+' + p.mmrDelta : p.mmrDelta})`;
  }).join('\n');

  const prompt = `あなたは「月刊KTMスポーツ」の戦術デスク兼eスポーツ実況解説者です。
以下のLoLカスタム（KTM公式マッチ）の【実数値スコアボード】に基づき、プロ解説者（LJL実況）の視点を取り入れた、熱狂的で解像度の高いスポーツ新聞風ダイジェスト号外を作成してください。

【厳格な執筆ルール（捏造厳禁・ファクト至上主義）】
1. 架空のセリフ（捏造インタビュー）は絶対に禁止です。
2. 提供されたスコアデータ（KDA、チャンプ名、ロール、勝敗、与ダメ、被ダメ、視界スコア、CS、白黒時間、試合時間）にない出来事を勝手に創作しないでください。
3. 称賛・分析はすべて【実数値、ダメージ量、視界貢献、MMRレート差の根拠】に基づいて行ってください。
4. 試合時間は約37分です。

【試合情報】
・勝利陣営: BLUE TEAM（総キル: 29 vs 25）
・試合時間: 約37分
・総ダメージ量: BLUE TEAM ${(winnerTotalDmg/1000).toFixed(1)}k vs 相手側 ${(loserTotalDmg/1000).toFixed(1)}k

【対面マッチアップ比較】
・TOP: 【勝】berry [MMR 1505] (Chogath / 10/8/4 ダメ:15.4k) vs 【負】ごり [MMR 1433] (Mordekaiser / 10/5/7 ダメ:23.3k) (レート差: 勝側+72)
・JG: 【勝】sutaro [MMR 1523] (Vi / 2/6/15 ダメ:16.5k) vs 【負】かずき [MMR 1552] (JarvanIV / 7/6/13 ダメ:15.4k) (レート差: 負側+29)
・MID: 【勝】まめ [MMR 1440] (Hwei / 6/6/7 ダメ:40.0k) vs 【負】エマ*fam [MMR 1569] (Anivia / 3/6/12 ダメ:20.3k) (レート差: 負側+129)
・ADC: 【勝】show [MMR 1617] (Draven / 10/3/14 ダメ:65.0k) vs 【負】こんぺ [MMR 1672] (Ashe / 5/5/9 ダメ:22.0k) (レート差: 負側+55)
・SUP: 【勝】yukizo [MMR 1491] (Seraphine / 1/3/19 ダメ:9.8k) vs 【負】けいろん [MMR 1276] (Alistar / 0/7/17 ダメ:6.3k) (レート差: 勝側+215)

【全参加者スタッツ（与ダメ・被ダメ・視界・CS含む）】
${participantSummary}

以下のJSONオブジェクト【のみ】を出力してください：
{
  "headline": "実数値に基づくキャッチーな1面大見出し（35文字以内）",
  "subheadline": "勝負の分かれ目となったレーンや数値を要約した小見出し（30文字以内）",
  "lead": "スコアボードの実数値（KDAやキル数、ダメージ量、ロール対決の差）を交え、試合の流れと勝者を的確に解説するリード文（100〜140文字程度）",
  "mvp": {
    "name": "show",
    "champion": "Draven",
    "kda": "10/3/14",
    "role": "ADC",
    "comment": "与ダメ65.0k（チーム総ダメージの44%超）やCS318などの実数値に基づくMVP寸評（60文字以内）"
  },
  "fighterOfTheMatch": {
    "name": "けいろん",
    "champion": "Alistar",
    "kda": "0/7/17",
    "role": "SUP",
    "comment": "視界スコア驚異の102、被ダメ27.4kで体を張り続けた孤軍奮闘を称える寸評（60文字以内）"
  },
  "entertainer": {
    "name": "berry",
    "champion": "Chogath",
    "kda": "10/8/4",
    "role": "TOP",
    "comment": "10キル奪うも8デス、白黒時間384秒（約6分半）も画面を暗転させて味方の胃を削ったピリ辛寸評（80文字程度）"
  },
  "turningPoint": "37分の総力戦における決定打（80文字以内）",
  "keyMatchup": "対面レーンのスタッツ比較と寸評（70文字以内）",
  "sideStory": "まめの格上相手への40.0kダメージ・MMR+40や視界貢献など（60文字以内）"
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      })
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error('API Error:', res.status, data);
    return;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log(text);
}

simulate().catch(console.error);
