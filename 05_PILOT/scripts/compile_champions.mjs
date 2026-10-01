import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INTEL_DIR = path.resolve(__dirname, '../../01_INTEL');
const TACTICS_DIR = path.join(INTEL_DIR, 'tactics');
const MASTER_DICT_PATH = path.join(INTEL_DIR, '_LOL/ddragon_master_dict.json');
const OUTPUT_DIR = path.resolve(__dirname, '../src/data');
const SUMMARY_FILE = path.join(OUTPUT_DIR, 'champions_summary.json');
const DETAILS_FILE = path.join(OUTPUT_DIR, 'champions_detail_map.json');
const ENV_FILE = path.resolve(__dirname, '../.env.local');

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

async function main() {
  console.log('⚡ [Compile] 全173体DDragon公式辞書 ＋ Supabase(facts/sentinel/spikes/timing) ＋ バイブル全文を完全統合中...');

  if (!fs.existsSync(MASTER_DICT_PATH)) {
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

  if (supabase) {
    try {
      console.log('☁️ Supabase から champion_facts, matchup_sentinel, power_spikes, jungle_timing を取得中...');
      const [
        { data: factsData, error: factsErr },
        { data: sentinelData, error: sentinelErr },
        { data: powerSpikesData },
        { data: jungleTimingData },
        { data: laneRolesData }
      ] = await Promise.all([
        supabase.from('champion_facts').select('*'),
        supabase.from('matchup_sentinel').select('id, champion, enemy, title, strategy, raw_data').neq('enemy', 'GLOBAL').neq('enemy', 'PROCESS_INTERROGATION'),
        supabase.from('champion_power_spikes').select('champion, early_game_score, mid_game_score, late_game_score, peak_window, summary'),
        supabase.from('champion_jungle_timing_agg').select('champion, sample_count, avg_first_core_sec, avg_second_core_sec, tier, external_fastest_clear_sec'),
        supabase.from('champion_lane_roles').select('champion, role, rank'),
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
    } catch (e) {
      console.warn('⚠️ Supabase 接続スキップ (オフライン動作継続):', e.message);
    }
  }

  const summaries = [];
  const detailMap = {};

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

    const roles = dbRoles || (bibleData && bibleData.roles && bibleData.roles.length > 0
      ? bibleData.roles
      : (DEFAULT_ROLES_MAP[champId] || ['TOP']));

    const nameJa = raw.name_ja || champId;
    const titleJa = raw.title_ja || '';

    // サマリーオブジェクト
    const summaryItem = {
      id: champId,
      name: champId,
      jpName: nameJa,
      title: titleJa,
      roles,
      skills,
      hasBible: !!bibleData,
      tier: dbFact?.patch_meta?.tier || undefined,
      winRate: dbFact?.patch_meta?.win_rate || undefined,
    };

    summaries.push(summaryItem);

    // 強み・弱み・カウンター・BANのパース
    const parseList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return String(val).split(/[\n,、]+/).map(s => s.trim().replace(/^[-*•\s\d.]+/, '')).filter(Boolean);
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
        tier: dbFact?.patch_meta?.tier || undefined,
        winRate: dbFact?.patch_meta?.win_rate || undefined,
        trendItems: dbFact?.patch_meta?.trend_items || [],
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
      } : undefined,
      matchups: dbMatchups,
      powerSpikes: dbSpikes,
      jungleTiming: dbTiming,
    };

    // 小文字キーでも引けるように登録
    detailMap[lowerId] = detailMap[champId];
  }

  // 日本語名で50音ソート
  summaries.sort((a, b) => a.jpName.localeCompare(b.jpName, 'ja'));

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 出力
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summaries, null, 2), 'utf-8');
  fs.writeFileSync(DETAILS_FILE, JSON.stringify(detailMap, null, 2), 'utf-8');

  console.log(`✅ [Success] 2段階コンパイル完了:`);
  console.log(`   ・一覧用サマリー: ${SUMMARY_FILE} (${summaries.length}体)`);
  console.log(`   ・詳細マップ: ${DETAILS_FILE} (Facts:${Object.keys(factsMap).length}件, Matchups:${Object.keys(matchupsMap).length}チャンプ)`);
}

main().catch(console.error);
