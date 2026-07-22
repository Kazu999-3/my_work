// ============================================================
// チャンピオンの実データを「サーバーから確実に取得できる」ソースから集める。
//
// なぜLoLalytics/op.gg/u.ggを直接使わないか:
//   これらは JavaScript でページを描画するため、サーバー側の生fetchでは
//   統計の中身が取れず、空の殻が返る。結果、AIは参考データ無しで「浅い」記事を書く。
//
// 代わりに公式 Riot Data Dragon（静的JSON・常に取得可能・最高の信頼性）から、
// スキルのクールダウン・コスト・射程・レベル別ベースステータス・公式Tipsを取得する。
// これらはメタ勝率ではないが、「具体的な数字・タイミング」を伴う深い記述の土台になる。
// ============================================================

export interface ChampionStatsResult {
  ok: boolean;
  source: string;       // 取得できたソース名（'DataDragon' など）
  patch: string | null; // データのパッチ
  text: string;         // AIに渡す整形済みテキスト
}

const DD_BASE = 'https://ddragon.leagueoflegends.com';

// 入力の表記ゆれを Data Dragon のID（例: "LeeSin", "Kai'Sa"→"Kaisa"）へ寄せる。
// 完全一致しない場合は champion.json 一覧から緩く探す。
function normalizeId(raw: string): string {
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '');
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${DD_BASE}/api/versions.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const versions = await res.json();
    return Array.isArray(versions) && versions[0] ? versions[0] : null;
  } catch {
    return null;
  }
}

// champion.json（一覧・軽量）から正しいIDを解決する
async function resolveChampionId(version: string, input: string): Promise<string | null> {
  try {
    const res = await fetch(`${DD_BASE}/cdn/${version}/data/en_US/champion.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json())?.data || {};
    const ids = Object.keys(data);
    const target = normalizeId(input).toLowerCase();
    // 完全一致 → 前方一致 → 名前一致 の順で探す
    return (
      ids.find((id) => id.toLowerCase() === target) ||
      ids.find((id) => id.toLowerCase().startsWith(target)) ||
      ids.find((id) => String(data[id]?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === target) ||
      null
    );
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * チャンピオンの実データ（公式）を取得して、AIに渡すテキストへ整形する。
 * 取得できなければ ok:false を返す（呼び出し側はAIの一般知識にフォールバック）。
 */
export async function fetchChampionStats(championInput: string): Promise<ChampionStatsResult> {
  const fail: ChampionStatsResult = { ok: false, source: '', patch: null, text: '' };
  const version = await getLatestVersion();
  if (!version) return fail;

  const id = await resolveChampionId(version, championInput);
  if (!id) return fail;

  try {
    const res = await fetch(`${DD_BASE}/cdn/${version}/data/en_US/champion/${id}.json`, { cache: 'no-store' });
    if (!res.ok) return fail;
    const champ = (await res.json())?.data?.[id];
    if (!champ) return fail;

    const s = champ.stats || {};
    // レベル1と16の主要ステータスを出す（成長を具体値で示すため）
    const atLv = (base: number, per: number, lv: number) => Math.round((base + per * (lv - 1)) * 10) / 10;
    const statLine = [
      `HP: ${s.hp}（Lv16 ${atLv(s.hp, s.hpperlevel, 16)}）`,
      `AD: ${s.attackdamage}（Lv16 ${atLv(s.attackdamage, s.attackdamageperlevel, 16)}）`,
      `Armor: ${s.armor}（Lv16 ${atLv(s.armor, s.armorperlevel, 16)}）`,
      `MR: ${s.spellblock}`,
      `MS: ${s.movespeed}`,
      `AtkRange: ${s.attackrange}`,
    ].join(' / ');

    const passive = champ.passive
      ? `Passive「${champ.passive.name}」: ${stripTags(champ.passive.description).slice(0, 220)}`
      : '';

    const spells = (champ.spells || []).map((sp: any, i: number) => {
      const key = ['Q', 'W', 'E', 'R'][i] || '?';
      const cd = sp.cooldownBurn ? `CD ${sp.cooldownBurn}s` : '';
      const cost = sp.costBurn && sp.costBurn !== '0' ? `Cost ${sp.costBurn}` : '';
      const range = sp.rangeBurn && sp.rangeBurn !== '25000' ? `Range ${sp.rangeBurn}` : '';
      const meta = [cd, cost, range].filter(Boolean).join(' / ');
      return `${key}「${sp.name}」${meta ? `(${meta})` : ''}: ${stripTags(sp.description).slice(0, 200)}`;
    });

    const allytips = (champ.allytips || []).filter(Boolean).slice(0, 3).map(stripTags);
    const enemytips = (champ.enemytips || []).filter(Boolean).slice(0, 3).map(stripTags);

    const text = [
      `チャンピオン: ${champ.name}（${champ.title}）`,
      `ロールタグ: ${(champ.tags || []).join(', ')}`,
      `難易度(Riot公表): ${champ.info?.difficulty ?? '-'}`,
      '',
      `【ベースステータス】 ${statLine}`,
      '',
      `【スキル（公式データ・クールダウン等は最大ランク基準の並び）】`,
      passive,
      ...spells,
      '',
      allytips.length ? `【味方向け公式Tips】\n- ${allytips.join('\n- ')}` : '',
      enemytips.length ? `【対面向け公式Tips】\n- ${enemytips.join('\n- ')}` : '',
    ].filter(Boolean).join('\n');

    return { ok: true, source: 'DataDragon(公式)', patch: version, text };
  } catch {
    return fail;
  }
}
