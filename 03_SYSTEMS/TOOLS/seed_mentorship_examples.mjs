import fs from 'fs';

function parseEnv(path) {
  if (!fs.existsSync(path)) return {};
  const content = fs.readFileSync(path, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) env[m[1]] = (m[2] || '').trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env1 = parseEnv('04_PORTAL/.env.local');
const env2 = parseEnv('.env');
const env3 = parseEnv('03_SYSTEMS/ktm_bot/.dev.vars');
const env = { ...env2, ...env1, ...env3 };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

async function postProfile(profile) {
  const res = await fetch(`${supabaseUrl}/rest/v1/mentorship_profiles`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(profile)
  });
  if (!res.ok) {
    console.error('Insert error:', res.status, await res.text());
    return null;
  }
  return await res.json();
}

async function main() {
  const exampleProfiles = [
    // 1. 【師匠 / マクロ重視】
    {
      discord_id: "example_mentor_macro",
      player_name: "【記入例】マクロ特化・師匠 (JG/MID)",
      role_type: "MENTOR",
      lanes: ["JUNGLE", "MID"],
      champions: ["JarvanIV", "Sejuani", "TwistedFate", "Galio"],
      current_rank: "PLATINUM",
      target_rank: null,
      tags: [
        "オブジェクト周りの陣形・マクロ",
        "ジャングルルート・ガンク判断",
        "視界・ワードコントロール",
        "試合の終わらせ方・クローズ",
        "録画・リプレイ添削",
        "VC指導対応",
        "ゴールド以下歓迎"
      ],
      bio: "【マクロ・試合コントロール特化の記入例】\nオブジェクト（ドラゴン・バロン）前の視界準備、主導権を握るウェーブコントロール、有利を確実に勝利へ繋げるクローズ手順を徹底解説します！\n『レーン戦で勝っても試合に負ける』『中盤以降どこへ行けばいいか迷う』という方、リプレイ添削や画面共有でロジカルに指導します！",
      active_hours: "平日 21:00〜24:00 / 休日",
      status: "OPEN"
    },
    // 2. 【師匠 / ミクロ重視】
    {
      discord_id: "example_mentor_micro",
      player_name: "【記入例】ミクロ特化・師匠 (TOP/BOT)",
      role_type: "MENTOR",
      lanes: ["TOP", "BOT"],
      champions: ["Aatrox", "Fiora", "Lucian", "Draven"],
      current_rank: "DIAMOND",
      target_rank: null,
      tags: [
        "レーン戦トレード",
        "トレード・キルライン見極め",
        "1on1マッチアップ特訓",
        "キャリー立ち位置・カイト",
        "画面共有ライブ指導",
        "VC可能",
        "シルバー以下歓迎"
      ],
      bio: "【ミクロ・対面破壊＆キルライン特化の記入例】\nレーン戦でのCS精度、スキルドッジ、相手のスキルクールダウンを突いたトレード技術、100%仕留めるキルラインの見極めを伝授します！\nカスタムでの1v1対戦特訓や、操作・カイトのリアルタイム添削を中心に行います。レーン戦で圧倒的ソロキルを取りたい方ぜひ！",
      active_hours: "平日夜 / 休日 昼〜深夜",
      status: "OPEN"
    },
    // 3. 【弟子 / マクロ重視】
    {
      discord_id: "example_pupil_macro",
      player_name: "【記入例】マクロ強化・弟子 (SUP/JG)",
      role_type: "PUPIL",
      lanes: ["SUPPORT", "JUNGLE"],
      champions: ["Nautilus", "Leona", "Amumu", "Vi"],
      current_rank: "BRONZE",
      target_rank: "GOLD",
      tags: [
        "オブジェクト周りの陣形・マクロ",
        "視界・ワードコントロール",
        "エンゲージ・仕掛け判断の指導",
        "聞き専OK",
        "VC可能"
      ],
      bio: "【中盤以降の動き方・視界管理を学びたい方の記入例】\nサポート/JGメインでプレイしています。序盤は五分で進んでも、中盤以降ドラゴン前でどこにワードを置くべきか、いつ集団戦を仕掛けるべきかの判断が分からず逆転されてしまいます。マクロ思考を基礎から教えてくださる師匠を探しています！",
      active_hours: "平日 21:30〜24:00 / 日曜",
      status: "OPEN"
    },
    // 4. 【弟子 / ミクロ重視】
    {
      discord_id: "example_pupil_micro",
      player_name: "【記入例】ミクロ強化・弟子 (TOP/MID)",
      role_type: "PUPIL",
      lanes: ["TOP", "MID"],
      champions: ["Garen", "Darius", "Yone", "Ahri"],
      current_rank: "IRON",
      target_rank: "SILVER",
      tags: [
        "レーン戦トレード",
        "トレード・キルライン見極め",
        "1on1マッチアップ特訓",
        "ウェーブ管理・フリーズ",
        "録画・リプレイ添削"
      ],
      bio: "【レーン戦でソロキルされないトレード技術を身につけたい方の記入例】\n対面にハラスされ続けてタワー下に追い詰められたり、無駄にキルされてしまうことが多いです。相手のスキルを避けてダメージ勝ちするトレードの基本や、キルラインの見極めを1v1やリプレイで教えていただきたいです！",
      active_hours: "土日メイン / 平日不定期",
      status: "OPEN"
    }
  ];

  // 古いテスト弟子（ぽろ丸・ルーキー）も削除して綺麗にする
  const toDelete = [
    "example_mentor_macro",
    "example_mentor_micro",
    "example_pupil_macro",
    "example_pupil_micro",
    "test_pupil_poromaru",
    "test_pupil_rookie_top"
  ];

  console.log('Cleaning and Updating Example Profiles...');
  for (const did of toDelete) {
    await fetch(`${supabaseUrl}/rest/v1/mentorship_profiles?discord_id=eq.${did}`, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
  }

  for (const p of exampleProfiles) {
    const result = await postProfile(p);
    if (result) {
      console.log(`✅ Inserted [${p.role_type}]: ${p.player_name}`);
    }
  }

  console.log('\nAll Example Profiles successfully updated with clear example names!');
}

main().catch(console.error);
