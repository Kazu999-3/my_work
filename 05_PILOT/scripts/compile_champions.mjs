import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, '../src/data');
const LOCAL_MASTER_DICT_PATH = path.join(OUTPUT_DIR, 'ddragon_master_dict.json');
const INTEL_DIR = path.resolve(__dirname, '../../01_INTEL');
const TACTICS_DIR = path.join(INTEL_DIR, 'tactics');
const MASTER_DICT_PATH = fs.existsSync(LOCAL_MASTER_DICT_PATH)
  ? LOCAL_MASTER_DICT_PATH
  : path.join(INTEL_DIR, '_LOL/ddragon_master_dict.json');
const SUMMARY_FILE = path.join(OUTPUT_DIR, 'champions_summary.json');
const DETAILS_FILE = path.join(OUTPUT_DIR, 'champions_detail_map.json');
const ENV_FILE = path.resolve(__dirname, '../.env.local');
const FACTORY_DIR = path.resolve(__dirname, '../../02_FACTORY');
const NOTE_STOCKS_DIR = path.join(FACTORY_DIR, '_LOL/note_stocks');
const CUSTOM_ROLES_FILE = path.join(OUTPUT_DIR, 'custom_roles.json');
const ITEM_DICT_FILE = path.join(OUTPUT_DIR, 'item_dictionary.json');
const OPGG_META_FILE = path.join(OUTPUT_DIR, 'opgg_lane_meta.json');

const FALLBACK_PATCH = '14.24.1';

// .env.local 簡易ローダー
function loadEnv() {
  if (fs.existsSync(ENV_FILE)) {
    const raw = fs.readFileSync(ENV_FILE, 'utf-8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// ロール推測用テーブル
const DEFAULT_ROLES_MAP = {
  Aatrox: ['TOP'], Ahri: ['MID'], Akali: ['MID', 'TOP'], Akshan: ['MID', 'TOP'], Alistar: ['SUP'],
  Ambessa: ['TOP', 'JG'], Amumu: ['JG', 'SUP'], Anivia: ['MID'], Annie: ['MID', 'SUP'], Aphelios: ['ADC'],
  Ashe: ['ADC', 'SUP'], AurelionSol: ['MID'], Aurora: ['MID', 'TOP'], Azir: ['MID'], Bard: ['SUP'],
  Belveth: ['JG'], Blitzcrank: ['SUP'], Brand: ['SUP', 'MID', 'JG'], Braum: ['SUP'], Briar: ['JG'],
  Caitlyn: ['ADC'], Camille: ['TOP'], Cassiopeia: ['MID', 'TOP'], Chogath: ['TOP', 'MID'], Corki: ['MID', 'ADC'],
  Darius: ['TOP'], Diana: ['JG', 'MID'], DrMundo: ['TOP', 'JG'], Draven: ['ADC'], Ekko: ['JG', 'MID'],
  Elise: ['JG'], Evelynn: ['JG'], Ezreal: ['ADC'], Fiddlesticks: ['JG'], Fiora: ['TOP'],
  Fizz: ['MID'], Galio: ['MID', 'SUP'], Gangplank: ['TOP', 'MID'], Garen: ['TOP'], Gnar: ['TOP'],
  Gragas: ['TOP', 'JG', 'MID'], Graves: ['JG'], Gwen: ['TOP', 'JG'], Hecarim: ['JG'], Heimerdinger: ['MID', 'TOP', 'SUP'],
  Hwei: ['MID', 'SUP'], Illaoi: ['TOP'], Irelia: ['TOP', 'MID'], Ivern: ['JG'], Janna: ['SUP'],
  JarvanIV: ['JG'], Jax: ['TOP', 'JG'], Jayce: ['TOP', 'MID'], Jhin: ['ADC'], Jinx: ['ADC'],
  Kaisa: ['ADC'], Kalista: ['ADC'], Karma: ['SUP', 'MID'], Karthus: ['JG', 'BOT'], Kassadin: ['MID'],
  Katarina: ['MID'], Kayle: ['TOP', 'MID'], Kayn: ['JG'], Kennen: ['TOP'], Khazix: ['JG'],
  Kindred: ['JG'], Kled: ['TOP'], KogMaw: ['ADC', 'MID'], Ksante: ['TOP'], Leblanc: ['MID'],
  LeeSin: ['JG'], Leona: ['SUP'], Lillia: ['JG', 'TOP'], Lissandra: ['MID'], Lucian: ['ADC', 'MID'],
  Lulu: ['SUP'], Lux: ['SUP', 'MID'], Malphite: ['TOP', 'MID', 'SUP'], Malzahar: ['MID'], Maokai: ['SUP', 'TOP', 'JG'],
  MasterYi: ['JG'], Mel: ['MID', 'SUP'], Milio: ['SUP'], MissFortune: ['ADC'], MonkeyKing: ['JG', 'TOP'],
  Mordekaiser: ['TOP'], Morgana: ['SUP', 'MID', 'JG'], Naafiri: ['MID', 'TOP'], Nami: ['SUP'], Nasus: ['TOP'],
  Nautilus: ['SUP'], Neeko: ['MID', 'SUP'], Nidalee: ['JG'], Nilah: ['ADC'], Nocturne: ['JG'],
  Nunu: ['JG'], Olaf: ['TOP', 'JG'], Orianna: ['MID'], Ornn: ['TOP'], Pantheon: ['MID', 'TOP', 'SUP'],
  Poppy: ['TOP', 'JG', 'SUP'], Pyke: ['SUP', 'MID'], Qiyana: ['MID', 'JG'], Quinn: ['TOP'], Rakan: ['SUP'],
  Rammus: ['JG'], RekSai: ['JG'], Rell: ['SUP', 'JG'], Renata: ['SUP'], Renekton: ['TOP'],
  Rengar: ['JG', 'TOP'], Riven: ['TOP'], Rumble: ['TOP', 'MID', 'JG'], Ryze: ['MID', 'TOP'], Samira: ['ADC'],
  Sejuani: ['JG', 'TOP'], Senna: ['SUP', 'ADC'], Seraphine: ['SUP', 'BOT', 'MID'], Sett: ['TOP', 'SUP'], Shaco: ['JG', 'SUP'],
  Shen: ['TOP', 'SUP'], Shyvana: ['JG', 'TOP'], Singed: ['TOP'], Sion: ['TOP'], Sivir: ['ADC'],
  Skarner: ['TOP', 'JG'], Smolder: ['ADC', 'MID'], Sona: ['SUP'], Soraka: ['SUP'], Swain: ['SUP', 'MID', 'BOT'],
  Sylas: ['MID', 'JG', 'TOP'], Syndra: ['MID'], TahmKench: ['TOP', 'SUP'], Taliyah: ['JG', 'MID'], Talon: ['MID', 'JG'],
  Taric: ['SUP'], Teemo: ['TOP'], Thresh: ['SUP'], Tristana: ['ADC', 'MID'], Trundle: ['TOP', 'JG'],
  Tryndamere: ['TOP', 'MID'], TwistedFate: ['MID', 'ADC'], Twitch: ['ADC'], Udyr: ['JG', 'TOP'], Urgot: ['TOP'],
  Varus: ['ADC', 'MID'], Vayne: ['ADC', 'TOP'], Veigar: ['MID', 'BOT'], Velkoz: ['SUP', 'MID'], Vex: ['MID'],
  Vi: ['JG'], Viego: ['JG'], Viktor: ['MID'], Vladimir: ['MID', 'TOP'], Volibear: ['TOP', 'JG'],
  Warwick: ['JG', 'TOP'], Xayah: ['ADC'], Xerath: ['SUP', 'MID'], XinZhao: ['JG'], Yasuo: ['MID', 'TOP', 'BOT'],
  Yone: ['MID', 'TOP'], Yorick: ['TOP'], Yuumi: ['SUP'], Zac: ['JG', 'TOP'], Zed: ['MID', 'JG'],
  Zeri: ['ADC'], Ziggs: ['BOT', 'MID'], Zilean: ['SUP', 'MID'], Zoe: ['MID'], Zyra: ['SUP', 'JG', 'MID']
};

function parseBibleContent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');

  let roles = [];
  const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
  if (tagsMatch) {
    const rawTags = tagsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, ''));
    const validRoles = ['TOP', 'JG', 'MID', 'ADC', 'BOT', 'SUP'];
    roles = rawTags.filter((t) => validRoles.includes(t.toUpperCase())).map((t) => t.toUpperCase());
  }

  const summaryMatch = content.match(/- \*\*戦術概要\*\*:\s*([^\n\r]+)/);
  const killLineMatch = content.match(/- \*\*即死キルライン基準\*\*:\s*([^\n\r]+)/);
  const p1Match = content.match(/### Phase 1[^\n\r]*[\r\n]+- \*\*アクション\*\*:\s*([^\n\r]+)/);
  const p2Match = content.match(/### Phase 2[^\n\r]*[\r\n]+- \*\*アクション\*\*:\s*([^\n\r]+)/);
  const p3Match = content.match(/### Phase 3[^\n\r]*[\r\n]+- \*\*アクション\*\*:\s*([^\n\r]+)/);
  const trapMatch = content.match(/### ❌[^\n\r]*[\r\n]+- \*\*([^*]+)\*\*/);
  const matchupTipsMatch = content.match(/## 🎯 主要対面特化ミクロ[^\n\r]*[\r\n]+([^\n\r]+)/);

  const traps = [];
  const trapRegex = /- \*\*([^*]+)\*\*:\s*([^\n\r]+)/g;
  let m;
  while ((m = trapRegex.exec(content)) !== null) {
    if (m[1].includes('トラップ') || m[1].includes('地雷') || m[1].includes('NG') || m[1].includes('禁忌')) {
      traps.push(`${m[1]}: ${m[2]}`);
    }
  }

  return {
    roles,
    summary: summaryMatch ? summaryMatch[1].trim() : '',
    killLine: killLineMatch ? killLineMatch[1].trim() : '',
    phases: {
      p1: p1Match ? p1Match[1].trim() : '',
      p2: p2Match ? p2Match[1].trim() : '',
      p3: p3Match ? p3Match[1].trim() : '',
    },
    trap: trapMatch ? trapMatch[1].trim() : (traps[0] || ''),
    traps,
    matchupTip: matchupTipsMatch ? matchupTipsMatch[1].trim() : '',
    fullMarkdown: content,
  };
}

function cleanTacticText(str) {
  if (!str) return '';
  const s = str.trim();
  if (s.includes('該当言及なし') || s === '※なし' || s === 'なし' || s === '※') return '';
  return s;
}

function parseNoteStockFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');

  // タイトル
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');

  // 元動画 URL & ID
  const videoMatch = content.match(/📺\s*\*\*元動画\*\*:\s*\[([^\]]+)\]\((https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+))/);
  const videoTitle = videoMatch ? videoMatch[1].trim() : '';
  const videoUrl = videoMatch ? videoMatch[2].trim() : '';
  const videoId = videoMatch ? videoMatch[3].trim() : '';

  // キラーエピソード
  const quoteMatch = content.match(/## 📌 note記事で使えるキラーエピソード[^\n\r]*[\r\n]+([\s\S]*?)(?=---|\n## )/);
  const killerQuote = quoteMatch ? quoteMatch[1].trim() : '';

  // 5大極意
  const cameraMatch = content.match(/モンスター狩り中のカメラワーク[^:]*:\s*([^\n\r]+)/);
  const smiteMatch = content.match(/スマイト管理[^\n\r]*:\s*([^\n\r]+)/);
  const waveMatch = content.match(/ガンク後のウェーブ介入ルール[^:]*:\s*([^\n\r]+)/);
  const shadowMatch = content.match(/14分以降（中盤）のJGの居場所[^:]*:\s*([^\n\r]+)/);
  const comebackMatch = content.match(/崩壊した試合を拾う逆転シナリオ[^:]*:\s*([^\n\r]+)/);
  const pingsMatch = content.match(/レーナーを動かすピン[^:]*:\s*([^\n\r]+)/);
  const muteMatch = content.match(/冷徹なオペレーターメンタル[^:]*:\s*([^\n\r]+)/);
  const triggerMatch = content.match(/\*思考トリガー:\s*([^*]+)\*/);

  // 対象チャンピオン特定
  const targetMatch = content.match(/> 🎯 \*\*対象チャンピオン\*\*:\s*([^\n\r]+)/);
  const rawTarget = targetMatch ? targetMatch[1].trim() : '';

  const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')) : [];

  return {
    id: videoId || path.basename(filePath, '.md'),
    title,
    videoTitle,
    videoUrl,
    videoId,
    rawTarget,
    tags,
    killerQuote: cleanTacticText(killerQuote),
    keyTactics: {
      cameraWork: cleanTacticText(cameraMatch ? cameraMatch[1] : ''),
      smiteRule: cleanTacticText(smiteMatch ? smiteMatch[1] : ''),
      waveRule: cleanTacticText(waveMatch ? waveMatch[1] : ''),
      shadowRule: cleanTacticText(shadowMatch ? shadowMatch[1] : ''),
      comebackRule: cleanTacticText(comebackMatch ? comebackMatch[1] : ''),
      pingsRule: cleanTacticText(pingsMatch ? pingsMatch[1] : ''),
      muteRule: cleanTacticText(muteMatch ? muteMatch[1] : ''),
    },
    thoughtTrigger: triggerMatch ? triggerMatch[1].trim() : '',
  };
}

function loadAllNoteStocks(champKeys) {
  const map = {};
  for (const k of champKeys) {
    map[k] = [];
    map[k.toLowerCase()] = map[k];
  }

  if (!fs.existsSync(NOTE_STOCKS_DIR)) return map;

  const files = fs.readdirSync(NOTE_STOCKS_DIR).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const fullPath = path.join(NOTE_STOCKS_DIR, file);
    const parsed = parseNoteStockFile(fullPath);
    if (!parsed) continue;

    // 紐付くチャンピオンを検出
    const matchedChampKeys = new Set();
    const lowerFile = file.toLowerCase();

    for (const key of champKeys) {
      const lowerKey = key.toLowerCase();
      // 1. ファイル名に含む (例: Viego_-b3o... や LeeSin_... または Lee_Sin)
      const underscoreKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (lowerFile.startsWith(lowerKey + '_') || lowerFile.includes('_' + lowerKey + '_') || lowerFile.includes(underscoreKey)) {
        matchedChampKeys.add(key);
      }
      // 2. rawTarget に含む
      if (parsed.rawTarget.toLowerCase().includes(lowerKey)) {
        matchedChampKeys.add(key);
      }
      // 3. tags に含む
      if (parsed.tags.some(t => t.toLowerCase() === lowerKey)) {
        matchedChampKeys.add(key);
      }
    }

    for (const key of matchedChampKeys) {
      map[key].push(parsed);
    }
  }

  return map;
}

const JG_PICK_GUIDES = {
  LeeSin: {
    blindPick: { rating: 'A', label: '先出し安定', reason: '高い機動力と自己防衛スキルを持ち、カウンターを受けても逃げ切れるためブラインドピック耐性が高い。' },
    counterPick: { targets: ['Karthus', 'Nidalee', 'Evelynn', 'MasterYi'], situation: '敵JGが序盤虚弱なファーム型、またはインベード耐性が低いアサシンの時に侵入して圧倒できる。' },
    whenToPick: { teamSynergy: '味方レーン（特にMID/TOP）が序盤主導権を取れる構成、または味方に確定CC持ちがいる時。', winCondition: '序盤2〜6分のリバー主導権からスノーボールし、20分までに試合を決定づける。' }
  },
  Viego: {
    blindPick: { rating: 'A', label: '先出し安定', reason: 'クリア速度が速く、アイテムビルドの幅が広いためどんな構成相手でも腐りにくい。' },
    counterPick: { targets: ['Sejuani', 'Zac', 'Amumu'], situation: '敵にタンクが多くキル関与から憑依連鎖を狙いやすい時、または敵の瞬間火力が低い時。' },
    whenToPick: { teamSynergy: '味方にエンゲージ役（CC持ちタンクやイニシエーター）がおり、自分が後入りでリセットを狙える構成。', winCondition: '集団戦で最初の1キルを取り、パッシブ憑依でスキルを使い回して殲滅する。' }
  },
  Elise: {
    blindPick: { rating: 'B', label: '条件付き先出し', reason: 'タワーダイブ能力は最強だが、試合が長引くと失速するため後半スケール型の敵構成にはリスクがある。' },
    counterPick: { targets: ['Kayn', 'Shyvana', 'Karthus'], situation: '敵JGが序盤無力でLv6まで引きこもりたい構成に対し、3分タワーダイブと敵陣荒らしで試合を壊す。' },
    whenToPick: { teamSynergy: '味方TOPやBOTが強力な確定スタン・スロウを持ち、Lv3タワーダイブを仕掛けられる構成。味方がAD過多の時のAP枠。', winCondition: '序盤10分以内にダイブで2レーンを完全崩壊させ、ヘラルドでタワーを割り切る。' }
  },
  Lillia: {
    blindPick: { rating: 'B', label: '状況見てピック', reason: '序盤のインベードに弱く、確定CCを持つアサシンJG（Jarvan, Vi）に捕まると脆い。' },
    counterPick: { targets: ['Udyr', 'Skarner', 'Trundle', 'Volibear'], situation: '敵がスキルショット依存や近接メレー過多で、移動速度差によるカイトが刺さる時。' },
    whenToPick: { teamSynergy: '味方TOP/MIDがAD偏重でAPダメージが不足している時、かつ敵にタンク・ブルーザーが多い時。', winCondition: '中盤以降の集団戦でQパッシブの超高機動からR（子守唄）で敵複数体を眠らせて壊滅させる。' }
  },
  Zac: {
    blindPick: { rating: 'A', label: '先出し安定', reason: '画面外からの理不尽なEエンゲージにより、どんなレーン状況からでもガンクを成立させられる。' },
    counterPick: { targets: ['Graves', 'Nidalee', 'Kindred'], situation: '敵にピール（引き剥がし）スキルやノックバックが少なく、飛び込みを止められない時。' },
    whenToPick: { teamSynergy: '味方にCC後のバーストダメージ（アサシン・メイジ）が豊富で、フロントライン（盾）が不在の時。', winCondition: '視界外からのEイニシエートで敵キャリーをキャッチし、集団戦を完勝する。' }
  },
  Vi: {
    blindPick: { rating: 'S', label: '先出し最安定', reason: 'R（不可避エンゲージ）により、どんな対面・どんな敵構成に対してもキャリーを無力化できる。' },
    counterPick: { targets: ['Zeri', 'Kalista', 'Lucian', 'Kassadin'], situation: '敵に超高機動力のワンマンキャリー（ブリンク持ちADCやアサシン）がいる時の絶対的回答。' },
    whenToPick: { teamSynergy: '味方MIDがローム型アサシンやバーストメイジ（Ahri, Syndra等）で、Rの拘束時間中に即死させられる時。', winCondition: '敵の最重要キャリーにRを直撃させてワンコンボで落とし、数的有利を作る。' }
  },
  Graves: {
    blindPick: { rating: 'A', label: '先出し安定', reason: '高いアーマー（Eパッシブ）と高速クリアにより、ADアサシンJG相手に極めて強固。' },
    counterPick: { targets: ['JarvanIV', 'XinZhao', 'Viego', 'Nocturne'], situation: '敵JGがAD主体で、インベードを受けてもEのスタックで返り討ちにできる時。' },
    whenToPick: { teamSynergy: '味方にCCが十分あり、JGに継続火力・オブジェクト破壊速度が求められる時。', winCondition: '圧倒的なファーム速度と敵キャンプの収奪（カウンターJG）でレベル・ゴールド差をつけ圧殺。' }
  },
  JarvanIV: {
    blindPick: { rating: 'S', label: '先出し最安定', reason: 'Lv2〜Lv3から強力なガンクが可能で、タンクビルド・ファイタービルドの融通が利く。' },
    counterPick: { targets: ['Varus', 'Jinx', 'Ashe', 'KogMaw'], situation: '敵キャリーにブリンク（壁抜け）手段がなく、R（天崩地裂）に閉じ込めれば必殺となる時。' },
    whenToPick: { teamSynergy: '味方にAoE（範囲攻撃）やエンゲージ合わせ（Rumble, Orianna, Miss Fortune）がいる時。', winCondition: '序盤の高速ガンクで味方レーンを勝ち越させ、集団戦で敵キャリーを檻に閉じ込める。' }
  },
  Nocturne: {
    blindPick: { rating: 'S', label: '先出し最安定', reason: '高速フルクリアとLv6の確定視界遮断Rにより、SoloQの連携不足を最も咎めやすい。' },
    counterPick: { targets: ['TwistedFate', 'Shen', 'Soraka'], situation: '敵のグローバル支援スキル（TF・シェンのR等）を自身のR（パラノイア）の視界遮断で無力化できる時。' },
    whenToPick: { teamSynergy: 'サイドレーンで孤立しやすい敵が多い時、または味方にダイブ追従役がいる時。', winCondition: 'Lv6以降、Rが上がるたびにCDごとに敵の押し込みレーンや孤立キャリーを暗殺する。' }
  },
  XinZhao: {
    blindPick: { rating: 'A', label: '先出し安定', reason: '序盤の1v1・2v2タイマンがトップクラスに強く、R（三日月守護）で敵遠距離火力を遮断できる。' },
    counterPick: { targets: ['Diana', 'MasterYi', 'Amumu'], situation: '序盤のスカトル勝負で絶対に負けたくない時、または敵の集団戦メイジの砲撃をRで弾きたい時。' },
    whenToPick: { teamSynergy: '味方レーナーが序盤主導権を握り、リバーでのファイトを起こしやすい構成の時。', winCondition: '序盤のスカトル・インベードで敵JGを叩き潰し、主導権を握り続ける。' }
  },
  Kindred: {
    blindPick: { rating: 'B', label: '条件付き先出し', reason: 'マーク回収が必要なため、味方レーンがプッシュ負けしていると敵陣に入れず腐るリスクがある。' },
    counterPick: { targets: ['Zac', 'Sejuani', 'Sion', 'ChoGath'], situation: '敵にタンクが多く割合ダメージが刺さる時、またはR（羊の安息）で敵の即死コンボ（Zed, Syndra）を無効化できる時。' },
    whenToPick: { teamSynergy: '味方レーン（特にMID/TOP）がプッシュ主導権を取れる構成、かつチームにADマークスマン火力が不足している時。', winCondition: 'マークを重ねて射程を伸ばし、後半の第2ADCとして集団戦を制圧する。' }
  },
  Sejuani: {
    blindPick: { rating: 'A', label: '先出し安定', reason: 'パッシブのアーマー・スロウ無効によりインベードに強く、長射程Rでエンゲージ・ディスエンゲージ両対応。' },
    counterPick: { targets: ['KhaZix', 'Rengar', 'Talon'], situation: '敵にアサシンが多く、味方キャリーを守り切れば勝てる構成の時。' },
    whenToPick: { teamSynergy: '味方のTOP・MID・SUPに近接メレー（Yone, Yasuo, Renekton, Nautilus等）が多く、Eの氷結スタックを爆速で溜められる時。', winCondition: '近接味方とのシナジーで敵を瞬時にスタンさせ、集団戦の主導権を握る。' }
  }
};

const AP_MAGICIANS = [
  'zyra', 'lillia', 'karthus', 'evelynn', 'elise', 'nidalee', 'taliyah', 'fiddlesticks',
  'brand', 'morgana', 'cassiopeia', 'orianna', 'syndra', 'veigar', 'viktor', 'xerath',
  'lux', 'vex', 'aurora', 'anivia', 'ahri', 'velkoz', 'zoe', 'hwei', 'swain', 'vladimir',
  'heimerdinger', 'teemo', 'rumble', 'kennen', 'ekko', 'diana', 'kassadin', 'leblanc', 'fizz',
  'malzahar', 'lissandra', 'ryze', 'twistedfate', 'annie'
];
const ENCHANTERS = ['lulu', 'nami', 'janna', 'soraka', 'sona', 'milio', 'yuumi', 'renataglasc', 'taric', 'seraphine', 'karma', 'zilean'];
const TANKS = ['leona', 'nautilus', 'alistar', 'braum', 'rell', 'thresh', 'blitzcrank', 'tahmkench', 'poppy', 'maokai', 'sejuani', 'zac', 'amumu', 'rammus', 'sion', 'chogath', 'ornn', 'malphite', 'shen', 'ksante'];
const ASSASSINS = ['khazix', 'rengar', 'talon', 'zed', 'kayn', 'qiyana', 'naafiri', 'pyke', 'shaco', 'nocturne', 'katarina', 'akali', 'yone'];
const MARKSMEN = ['jinx', 'kaisa', 'caitlyn', 'ezreal', 'vayne', 'lucian', 'sivir', 'tristana', 'ashe', 'varus', 'samira', 'zeri', 'aphelios', 'kalista', 'kogmaw', 'draven', 'missfortune', 'jhin', 'xayah', 'graves', 'kindred'];

function getPickGuide(champId, roles = []) {
  if (JG_PICK_GUIDES[champId]) {
    return JG_PICK_GUIDES[champId];
  }
  const id = champId.toLowerCase();
  const isTank = TANKS.includes(id);
  const isAssassin = ASSASSINS.includes(id);
  const isMage = AP_MAGICIANS.includes(id);
  const isSupportEnchanter = ENCHANTERS.includes(id);
  const isMarksman = MARKSMEN.includes(id);
  const isFighter = !isTank && !isAssassin && !isMage && !isSupportEnchanter && !isMarksman;

  if (isTank) {
    return {
      blindPick: { rating: 'A', label: '先出し安定', reason: '高い耐久力とハードCCによる集団戦貢献が高く、対面を選ばずに役割を果たせる。' },
      counterPick: { targets: ['アサシン全般', '低耐久キャリー'], situation: '敵にアサシンや瞬間火力職が多く、味方キャリーを守るピールが必要な時。' },
      whenToPick: { teamSynergy: '味方にフロントライン（前衛）やイニシエーター（仕掛け役）が不在の時。', winCondition: '集団戦で敵の攻撃を受け止めつつCCを叩き込み、味方キャリーにダメージを出させる。' }
    };
  } else if (isMage) {
    return {
      blindPick: { rating: 'A', label: '先出し安定', reason: '長射程スキルとゾーン制圧力により、安全にウェーブクリアや牽制を行いやすい。' },
      counterPick: { targets: ['近接メレー', '低機動力タンク'], situation: '敵が接近戦を好む構成に対し、射程外からのポークや範囲CC（足止め）が刺さる時。' },
      whenToPick: { teamSynergy: '味方にAP魔法ダメージが不足している時、またはオブジェクト周りの視界・ゾーン制圧力を高めたい時。', winCondition: 'オブジェクト前の牽制で敵の体力を削り、不用意に入ってきた敵をフォーカスして人数差を作る。' }
    };
  } else if (isAssassin) {
    return {
      blindPick: { rating: 'B', label: '状況見てピック', reason: '敵にハードCCや耐久タンクを固められると失速しやすいため、後出しの方が真価を発揮しやすい。' },
      counterPick: { targets: ['逃げ場のないマークスマン', '低機動力メイジ'], situation: '敵のキャリーラインが薄く、一瞬のバーストで人数有利を作りやすい時。' },
      whenToPick: { teamSynergy: '敵に柔らかいキャリーが多く、味方にダメージの追従手段がある時。', winCondition: '視界の隙間から敵キャリーを暗殺し、オブジェクト戦の前に人数差を作る。' }
    };
  } else if (isSupportEnchanter) {
    return {
      blindPick: { rating: 'A', label: '先出し安定', reason: 'シールド・ヒール・バフによる味方キャリーの保護能力が高く、構成を選ばず活躍できる。' },
      counterPick: { targets: ['ポーク構成', '継続戦闘型'], situation: 'サステイン（回復）勝負で優位に立てる時、または味方ハイパーキャリーを全力育成したい時。' },
      whenToPick: { teamSynergy: '味方ADCやファイターに十分な火力があり、生存能力を高めれば勝てる構成の時。', winCondition: '集団戦で味方キャリーを徹底的にピール・強化し、敵のフォーカスを無力化して勝ち切る。' }
    };
  } else if (isMarksman) {
    return {
      blindPick: { rating: 'A', label: '先出し安定', reason: '継続的な遠距離DPSを提供し、後半スケールで試合を決定づける主戦力となる。' },
      counterPick: { targets: ['タンク主体の低射程構成'], situation: '敵の前衛を安全圏から溶かせる時、または射程有利を押し付けられる時。' },
      whenToPick: { teamSynergy: 'チームに安定したフロントライン（盾）やピール役が揃っている時。', winCondition: '中盤〜終盤までファームを継続し、アイテム完成後の集団戦で継続ダメージを叩き出す。' }
    };
  } else {
    return {
      blindPick: { rating: 'A', label: '先出し安定', reason: 'タイマン能力と耐久・火力のバランスが良く、SoloQでのサイドレーン主導権を握りやすい。' },
      counterPick: { targets: ['低機動力ファイター', '特定対面'], situation: '1v1で主導権を握れるマッチアップ、または小規模戦で有利を取れる時。' },
      whenToPick: { teamSynergy: '小規模戦（2v2 / 3v3）を起こしやすく、サイドプッシュで敵を引きつけられる時。', winCondition: 'レーン戦で有利を築き、サイドレーンの圧力または裏回りエンゲージで集団戦を崩壊させる。' }
    };
  }
}

async function main() {
  console.log('⚡ [Compile] 全173体DDragon公式辞書 ＋ Supabase(facts/sentinel/spikes/timing) ＋ バイブル全文を完全統合中...');

  if (!fs.existsSync(MASTER_DICT_PATH)) {
    if (fs.existsSync(SUMMARY_FILE) && fs.existsSync(DETAILS_FILE)) {
      console.log('ℹ️ [Vercel Build] マスター辞書がありませんが、事前生成済みデータが存在するためスキップします:', SUMMARY_FILE);
      return;
    }
    console.error('❌ マスター辞書が見つかりません:', MASTER_DICT_PATH);
    process.exit(1);
  }

  const masterDict = JSON.parse(fs.readFileSync(MASTER_DICT_PATH, 'utf-8'));
  const ddragonChampions = masterDict.champions || {};
  const champKeys = Object.keys(ddragonChampions);
  console.log(`🔍 DDragon公式チャンピオン数: ${champKeys.length} 体`);

  // Supabase からデータ取得
  const factsMap = {};
  const matchupsMap = {};
  const powerSpikesMap = {};
  const jungleTimingMap = {};
  const laneRolesMap = {};
  const libraryKnowledgeMap = {};

  if (supabase) {
    try {
      console.log('☁️ Supabase から facts, matchups, spikes, timings, roles, personal_knowledge を取得中...');
      const [
        { data: factsData, error: factsErr },
        { data: sentinelData, error: sentinelErr },
        { data: powerSpikesData },
        { data: jungleTimingData },
        { data: laneRolesData },
        { data: knowledgeData }
      ] = await Promise.all([
        supabase.from('champion_facts').select('*'),
        supabase.from('matchup_sentinel').select('id, champion, enemy, title, strategy, raw_data').neq('enemy', 'GLOBAL').neq('enemy', 'PROCESS_INTERROGATION'),
        supabase.from('champion_power_spikes').select('champion, early_game_score, mid_game_score, late_game_score, peak_window, summary'),
        supabase.from('champion_jungle_timing_agg').select('champion, sample_count, avg_first_core_sec, avg_second_core_sec, tier, external_fastest_clear_sec'),
        supabase.from('champion_lane_roles').select('champion, role, rank'),
        supabase.from('personal_knowledge').select('id, champion, title, content, tags, source_url, created_at').order('created_at', { ascending: false }).limit(2000),
      ]);

      if (factsErr) {
        console.warn('⚠️ champion_facts 取得エラー:', factsErr.message);
      } else if (factsData) {
        for (const row of factsData) {
          const k = String(row.champion || '').toLowerCase();
          factsMap[k] = row;
        }
        console.log(`✅ champion_facts 取得成功: ${factsData.length} 件`);
      }

      if (sentinelErr) {
        console.warn('⚠️ matchup_sentinel 取得エラー:', sentinelErr.message);
      } else if (sentinelData) {
        for (const row of sentinelData) {
          const k = String(row.champion || '').toLowerCase();
          if (!matchupsMap[k]) matchupsMap[k] = [];
          matchupsMap[k].push({
            id: row.id,
            enemy: row.enemy,
            note: row.strategy || row.title || '',
            result: row.raw_data?.result || '',
            trap: row.raw_data?.trap || '',
          });
        }
        console.log(`✅ matchup_sentinel 取得成功: ${sentinelData.length} 件`);
      }

      if (powerSpikesData) {
        for (const row of powerSpikesData) {
          powerSpikesMap[String(row.champion || '').toLowerCase()] = {
            early: row.early_game_score,
            mid: row.mid_game_score,
            late: row.late_game_score,
            peakWindow: row.peak_window,
            summary: row.summary,
          };
        }
        console.log(`✅ champion_power_spikes 取得成功: ${powerSpikesData.length} 件`);
      }

      if (jungleTimingData) {
        for (const row of jungleTimingData) {
          jungleTimingMap[String(row.champion || '').toLowerCase()] = {
            sampleCount: row.sample_count,
            avgFirstCoreSec: row.avg_first_core_sec,
            avgSecondCoreSec: row.avg_second_core_sec,
            tier: row.tier,
            fastestClearSec: row.external_fastest_clear_sec,
          };
        }
        console.log(`✅ champion_jungle_timing_agg 取得成功: ${jungleTimingData.length} 件`);
      }

      if (laneRolesData) {
        for (const row of laneRolesData) {
          const k = String(row.champion || '').toLowerCase();
          if (!laneRolesMap[k]) laneRolesMap[k] = [];
          const normalized = row.role === 'ADC' ? 'BOT' : row.role;
          if (!laneRolesMap[k].includes(normalized)) {
            laneRolesMap[k].push(normalized);
          }
        }
      }

      if (knowledgeData) {
        for (const row of knowledgeData) {
          if (row.champion && row.champion !== 'Unknown' && row.champion !== 'null') {
            const k = String(row.champion).toLowerCase();
            if (!libraryKnowledgeMap[k]) libraryKnowledgeMap[k] = [];
            // サロゲートペアを分断しない安全なUnicode文字配列スライス
            const rawText = (row.content || '')
              .replace(/<[^>]*>/g, '')
              .replace(/[#*`_]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            const safeChars = Array.from(rawText);
            let snippet = safeChars.slice(0, 200).join('');
            if (typeof snippet.toWellFormed === 'function') {
              snippet = snippet.toWellFormed();
            }

            libraryKnowledgeMap[k].push({
              id: row.id,
              title: typeof row.title?.toWellFormed === 'function' ? row.title.toWellFormed() : (row.title || ''),
              snippet,
              tags: row.tags || [],
              sourceUrl: row.source_url || '',
              createdAt: row.created_at || '',
            });
          }
        }
        console.log(`✅ personal_knowledge マッピング成功: 関連チャンピオン ${Object.keys(libraryKnowledgeMap).length} 体`);
      }
    } catch (e) {
      console.warn('⚠️ Supabase 接続スキップ (オフライン動作継続):', e.message);
    }
  }

  const summaries = [];
  const detailMap = {};

  console.log('📚 note発信ストック・動画バイブルをロード中...');
  const allNoteStocksMap = loadAllNoteStocks(champKeys);
  const totalStocksCount = Object.values(allNoteStocksMap).reduce((acc, list) => acc + list.length, 0);
  console.log(`✅ 動画バイブル読み込み完了: 関連付け延べ ${totalStocksCount} 件`);

  let customRolesMap = {};
  if (fs.existsSync(CUSTOM_ROLES_FILE)) {
    try {
      customRolesMap = JSON.parse(fs.readFileSync(CUSTOM_ROLES_FILE, 'utf-8'));
      console.log(`🛠️ カスタムレーン設定ロード成功: ${Object.keys(customRolesMap).length} 体`);
    } catch (e) {
      console.warn('⚠️ custom_roles.json パース失敗:', e.message);
    }
  }

  let itemDictionaryMap = {};
  if (fs.existsSync(ITEM_DICT_FILE)) {
    try {
      itemDictionaryMap = JSON.parse(fs.readFileSync(ITEM_DICT_FILE, 'utf-8'));
      console.log(`📖 アイテム翻訳辞書ロード成功: ${Object.keys(itemDictionaryMap).length} 語`);
    } catch (e) {
      console.warn('⚠️ item_dictionary.json パース失敗:', e.message);
    }
  }

  let opggLaneMeta = null;
  if (fs.existsSync(OPGG_META_FILE)) {
    try {
      opggLaneMeta = JSON.parse(fs.readFileSync(OPGG_META_FILE, 'utf-8'));
      console.log(`📊 OP.GG 公式メタデータロード成功: 合計 ${opggLaneMeta.totalEntries} 件`);
    } catch (e) {
      console.warn('⚠️ opgg_lane_meta.json パース失敗:', e.message);
    }
  }

  const translateTrendItem = (name) => {
    if (!name) return '';
    const trimmed = String(name).trim();
    if (itemDictionaryMap[trimmed]) return itemDictionaryMap[trimmed];
    const lower = trimmed.toLowerCase();
    for (const [k, v] of Object.entries(itemDictionaryMap)) {
      if (k.toLowerCase() === lower) return v;
    }
    return trimmed;
  };

  for (const champKey of champKeys) {
    const raw = ddragonChampions[champKey];
    const champId = raw.id;
    const lowerId = champId.toLowerCase();

    const possibleFiles = [
      path.join(TACTICS_DIR, `${lowerId}_tactics_bible.md`),
      path.join(TACTICS_DIR, `${champId}_tactics_bible.md`),
    ];
    if (champId === 'MonkeyKing') {
      possibleFiles.push(path.join(TACTICS_DIR, 'monkeyking_tactics_bible.md'));
    }

    let bibleData = null;
    for (const f of possibleFiles) {
      if (fs.existsSync(f)) {
        bibleData = parseBibleContent(f);
        break;
      }
    }

    const dbFact = factsMap[lowerId] || factsMap[champId.toLowerCase()] || null;
    const dbMatchups = matchupsMap[lowerId] || matchupsMap[champId.toLowerCase()] || [];
    const dbSpikes = powerSpikesMap[lowerId] || null;
    const dbTiming = jungleTimingMap[lowerId] || null;
    const dbRoles = laneRolesMap[lowerId] || null;

    // スキル情報の抽出
    const skills = {};
    const spells = [];
    let passiveInfo = { name: 'パッシブ', description: '', imageFull: `${champId}_P.png` };

    for (const slot of ['Passive', 'Q', 'W', 'E', 'R']) {
      const key = `${champId}:${slot}`;
      const skillInfo = masterDict.skills ? masterDict.skills[key] : null;
      if (skillInfo) {
        const slotKey = slot.toLowerCase();
        const spellId = skillInfo.spell_id || `${champId}${slot}`;
        const imageFull = `${spellId}.png`;

        if (slot === 'Passive') {
          passiveInfo = {
            name: skillInfo.name_ja || '固有スキル',
            description: (skillInfo.description_ja || '').replace(/<[^>]*>/g, '').trim(),
            imageFull: `${champId}_P.png`,
          };
          skills.passive = passiveInfo;
        } else {
          const sObj = {
            id: spellId,
            name: skillInfo.name_ja || slot,
            description: (skillInfo.description_ja || '').replace(/<[^>]*>/g, '').trim(),
            cooldown: skillInfo.cooldown || [],
            cooldownBurn: (skillInfo.cooldown && skillInfo.cooldown.length > 0) ? skillInfo.cooldown.join('/') : '',
            costBurn: (skillInfo.cost && skillInfo.cost.length > 0) ? skillInfo.cost.join('/') : '',
            imageFull,
          };
          spells.push(sObj);
          skills[slotKey] = sObj;
        }
      }
    }

    const customRole = customRolesMap[champId] || customRolesMap[lowerId];
    const roles = (customRole && Array.isArray(customRole) && customRole.length > 0)
      ? customRole
      : (dbRoles || (bibleData && bibleData.roles && bibleData.roles.length > 0
        ? bibleData.roles
        : (DEFAULT_ROLES_MAP[champId] || ['TOP'])));

    const nameJa = raw.name_ja || champId;
    const titleJa = raw.title_ja || '';

    // サマリーオブジェクト
    const champVideoBibles = allNoteStocksMap[champId] || allNoteStocksMap[lowerId] || [];

    // OP.GG実データから最有力ロールの勝率・Tierを取得 (AI推測値は完全排除)
    let opggWinRate = undefined;
    let opggTier = undefined;
    if (opggLaneMeta?.lanes) {
      for (const r of roles) {
        const laneKey = r === 'BOT' ? 'ADC' : r;
        const meta = opggLaneMeta.lanes[laneKey]?.[champId];
        if (meta) {
          opggWinRate = meta.winRate;
          opggTier = meta.tier;
          break;
        }
      }
    }

    const summaryItem = {
      id: champId,
      name: champId,
      jpName: nameJa,
      title: titleJa,
      roles,
      skills,
      hasBible: !!bibleData,
      videoBibleCount: champVideoBibles.length,
      libraryKnowledgeCount: (libraryKnowledgeMap[lowerId] || []).length,
      tier: opggTier || undefined,
      winRate: opggWinRate || undefined,
    };

    summaries.push(summaryItem);

    // 強み・弱み・カウンター・BANのパース（読点「、」で文章を切断しない安全な処理）
    const parseList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      const str = String(val).trim();
      if (!str) return [];
      // 改行がある場合は改行で分割
      if (str.includes('\n')) {
        return str.split('\n').map(s => s.trim().replace(/^[-*•\s\d.]+/, '')).filter(Boolean);
      }
      // 句点「。」がある文章の場合は、句点単位で分割
      if (str.includes('。')) {
        return str.split('。').map(s => s.trim()).filter(Boolean).map(s => s + '。');
      }
      // 各要素が短いキーワード（20文字未満）の場合のみカンマ/読点分割
      if (str.includes(',') || str.includes('、')) {
        const parts = str.split(/[,、]/).map(s => s.trim()).filter(Boolean);
        const isShortKeywords = parts.every(p => p.length < 20);
        if (isShortKeywords) {
          return parts;
        }
      }
      return [str];
    };

    // 詳細オブジェクト
    detailMap[champId] = {
      id: champId,
      jpName: nameJa,
      title: titleJa,
      tags: roles,
      info: { attack: 7, defense: 6, magic: 4, difficulty: 5 },
      spells,
      passive: passiveInfo,
      facts: {
        strengths: parseList(dbFact?.strengths),
        weaknesses: parseList(dbFact?.weaknesses),
        counters: parseList(dbFact?.counter_champions),
        mustBan: parseList(dbFact?.must_ban_champions),
        tier: opggTier || undefined,
        winRate: opggWinRate || undefined,
        trendItems: (dbFact?.patch_meta?.trend_items || []).map(translateTrendItem),
        trendRunes: dbFact?.patch_meta?.trend_runes || undefined,
        gameplayGuide: dbFact?.strategy || '',
        powerSpikes: dbFact?.power_spikes || '',
        skillOrder: dbFact?.patch_meta?.skill_order || ['Q', 'E', 'W'],
      },
      bible: bibleData ? {
        playstyleSummary: bibleData.summary,
        killCombo: bibleData.killLine,
        stages: {
          early: bibleData.phases.p1,
          mid: bibleData.phases.p2,
          late: bibleData.phases.p3,
        },
        traps: bibleData.traps.length > 0 ? bibleData.traps : (bibleData.trap ? [bibleData.trap] : []),
        rawMarkdown: bibleData.fullMarkdown,
      } : (dbFact && (dbFact.strategy || Object.keys(dbFact).some(k => k.startsWith('sovereign_draft')))) ? {
        playstyleSummary: dbFact.strategy || `${nameJa}のプロ戦術考察`,
        killCombo: dbFact.power_spikes || '',
        stages: {
          early: '序盤の有利を築き、主導権を確保。',
          mid: 'パワースパイクを活かしてオブジェクトに圧力をかける。',
          late: '集団戦でキャリーを守るか敵後衛を無力化。',
        },
        traps: parseList(dbFact.weaknesses),
        rawMarkdown: Object.entries(dbFact)
          .filter(([k, v]) => (k.startsWith('sovereign_draft') || k === 'strategy') && typeof v === 'string')
          .map(([k, v]) => v)
          .join('\n\n---\n\n'),
      } : undefined,
      videoBibles: champVideoBibles,
      libraryKnowledge: libraryKnowledgeMap[lowerId] || libraryKnowledgeMap[champId.toLowerCase()] || [],
      matchups: dbMatchups,
      powerSpikes: dbSpikes,
      jungleTiming: dbTiming,
      pickGuide: getPickGuide(champId, roles, raw.tags || []),
    };

    // 小文字キーでも引けるように登録
    detailMap[lowerId] = detailMap[champId];
  }

  // 日本語名で50音ソート
  summaries.sort((a, b) => a.jpName.localeCompare(b.jpName, 'ja'));

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 出力（TurbopackのJSON破損防止のためtoWellFormedを適用）
  const summaryJson = JSON.stringify(summaries, null, 2);
  const detailsJson = JSON.stringify(detailMap, null, 2);
  fs.writeFileSync(SUMMARY_FILE, typeof summaryJson.toWellFormed === 'function' ? summaryJson.toWellFormed() : summaryJson, 'utf-8');
  fs.writeFileSync(DETAILS_FILE, typeof detailsJson.toWellFormed === 'function' ? detailsJson.toWellFormed() : detailsJson, 'utf-8');

  console.log(`✅ [Success] 2段階コンパイル完了:`);
  console.log(`   ・一覧用サマリー: ${SUMMARY_FILE} (${summaries.length}体)`);
  console.log(`   ・詳細マップ: ${DETAILS_FILE} (Facts:${Object.keys(factsMap).length}件, Matchups:${Object.keys(matchupsMap).length}チャンプ)`);
}

main().catch(console.error);
