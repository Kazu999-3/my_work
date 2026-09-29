// ============================================================
// KTM Bot: ルーレット機能 (/roulette)
// チャンピオン抽選、ロールシャッフル、特殊縛りルールの生成
// ============================================================

// ⚠️ 2026-09-29 是正: ここは以前「代表的なチャンピオン一覧とロール情報 (DDragon準拠)」と
// 書かれていたが、**DDragon準拠ではなく完全な手入力**だった。実測で 65体しか無く、
// DataDragonの実際の総数は 173体（2026-09-29 確認）。つまり **108体（62%）が抽選で
// 一度も出ない**のに「DDragon準拠」を名乗っていた。
// 2026-09-22に一掃した「実データに見せかけた手入力」と同型（あの監査はBotを対象外にしていた）。
//
// ただし **ロール（TOP/JG/MID/ADC/SUP）はDataDragonが提供していない**（あるのは
// Fighter/Mage等の`tags`だけ）。ロール絞り込みにはこの手入力データが必要なので、
// 役割を分けて使う:
//   - ロール指定なし(ALL) … DataDragonの全173体から抽選（`fetchChampionCatalog()`）
//   - ロール指定あり     … 下の厳選プールから抽選（そう表示する）
export const CHAMPION_POOL = [
  // TOP
  { id: 'Aatrox', name: 'エイトロックス', title: 'ダーキンの暴剣', role: 'TOP' },
  { id: 'Darius', name: 'ダリウス', title: 'ノクサスの戦の手', role: 'TOP' },
  { id: 'Fiora', name: 'フィオラ', title: '無双の決闘者', role: 'TOP' },
  { id: 'Garen', name: 'ガレン', title: 'デマーシアの勇士', role: 'TOP' },
  { id: 'Jax', name: 'ジャックス', title: 'マスター・オブ・ウェポン', role: 'TOP' },
  { id: 'Camille', name: 'カミール', title: '鋼の影', role: 'TOP' },
  { id: 'Mordekaiser', name: 'モルデカイザー', title: '鉄の亡霊', role: 'TOP' },
  { id: 'Ornn', name: 'オーン', title: '鍛冶の神', role: 'TOP' },
  { id: 'Renekton', name: 'レネクトン', title: '砂漠の解体者', role: 'TOP' },
  { id: 'Sett', name: 'セト', title: 'ザ・ボス', role: 'TOP' },
  { id: 'KSante', name: 'カ・サンテ', title: 'ナズーマの誇り', role: 'TOP' },
  { id: 'Riven', name: 'リヴェン', title: '追放されし者', role: 'TOP' },
  { id: 'Jayce', name: 'ジェイス', title: '明日の守護者', role: 'TOP' },

  // JG
  { id: 'Graves', name: 'グレイブス', title: '無法者', role: 'JG' },
  { id: 'LeeSin', name: 'リー・シン', title: '盲目の修行僧', role: 'JG' },
  { id: 'Viego', name: 'ヴィエゴ', title: '滅びの王', role: 'JG' },
  { id: 'Lillia', name: 'リリア', title: 'はにかみ屋の花', role: 'JG' },
  { id: 'Nidalee', name: 'ニダリー', title: '野生の女狩人', role: 'JG' },
  { id: 'Nocturne', name: 'ノクターン', title: '永遠の悪夢', role: 'JG' },
  { id: 'JarvanIV', name: 'ジャーヴァンIV', title: 'デマーシアの手本', role: 'JG' },
  { id: 'XinZhao', name: 'シン・ジャオ', title: 'デマーシアの執政長官', role: 'JG' },
  { id: 'Kindred', name: 'キンドレッド', title: '永遠の双子', role: 'JG' },
  { id: 'Kayn', name: 'ケイン', title: '影の一刀', role: 'JG' },
  { id: 'Hecarim', name: 'ヘカリム', title: '戦影', role: 'JG' },
  { id: 'Zac', name: 'ザック', title: '秘密兵器', role: 'JG' },
  { id: 'Shaco', name: 'シャコ', title: '悪魔の道化師', role: 'JG' },
  { id: 'Elise', name: 'エリス', title: '蜘蛛の女王', role: 'JG' },

  // MID
  { id: 'Ahri', name: 'アーリ', title: '九尾の狐', role: 'MID' },
  { id: 'Akali', name: 'アカリ', title: '反逆の暗殺者', role: 'MID' },
  { id: 'Azir', name: 'アジール', title: '砂漠の皇帝', role: 'MID' },
  { id: 'LeBlanc', name: 'ルブラン', title: '幻影のペテン師', role: 'MID' },
  { id: 'Orianna', name: 'オリアナ', title: 'からくり人形', role: 'MID' },
  { id: 'Syndra', name: 'シンドラ', title: '闇の主導者', role: 'MID' },
  { id: 'Viktor', name: 'ビクター', title: '機械化の先駆者', role: 'MID' },
  { id: 'Yasuo', name: 'ヤスオ', title: '許されざる者', role: 'MID' },
  { id: 'Yone', name: 'ヨネ', title: '忘られざる者', role: 'MID' },
  { id: 'Zed', name: 'ゼド', title: '影の頭領', role: 'MID' },
  { id: 'Sylas', name: 'サイラス', title: '解き放たれし暴動者', role: 'MID' },
  { id: 'TwistedFate', name: 'ツイステッド・フェイト', title: 'カードの名手', role: 'MID' },
  { id: 'Kassadin', name: 'カサディン', title: 'ヴォイドの歩行者', role: 'MID' },

  // ADC
  { id: 'Jinx', name: 'ジンクス', title: '暴走ペテン師', role: 'ADC' },
  { id: 'KaiSa', name: 'カイ＝サ', title: 'ヴォイドの娘', role: 'ADC' },
  { id: 'Ezreal', name: 'エズリアル', title: '放浪の冒険家', role: 'ADC' },
  { id: 'Jhin', name: 'ジン', title: '名高き悪漢', role: 'ADC' },
  { id: 'Caitlyn', name: 'ケイトリン', title: 'ピルトーヴァーの平和守護者', role: 'ADC' },
  { id: 'Vayne', name: 'ヴェイン', title: '夜の狩人', role: 'ADC' },
  { id: 'Ashe', name: 'アッシュ', title: 'フロストアーチャー', role: 'ADC' },
  { id: 'Lucian', name: 'ルシアン', title: '浄化の光', role: 'ADC' },
  { id: 'Samira', name: 'サミーラ', title: '砂漠の薔薇', role: 'ADC' },
  { id: 'Xayah', name: 'ザヤ', title: '反逆者', role: 'ADC' },
  { id: 'Zeri', name: 'ゼリ', title: 'ゾウンの火花', role: 'ADC' },
  { id: 'Tristana', name: 'トリスターナ', title: 'ヨードルの砲手', role: 'ADC' },
  { id: 'Draven', name: 'ドレイヴン', title: '華麗なる処刑人', role: 'ADC' },

  // SUP
  { id: 'Thresh', name: 'スレッシュ', title: '魂の監視者', role: 'SUP' },
  { id: 'Nautilus', name: 'ノーチラス', title: '深海の巨人', role: 'SUP' },
  { id: 'Leona', name: 'レオナ', title: '暁の輝き', role: 'SUP' },
  { id: 'Lulu', name: 'ルル', title: '妖精の魔法使い', role: 'SUP' },
  { id: 'Nami', name: 'ナミ', title: '波乗りの巫女', role: 'SUP' },
  { id: 'Pyke', name: 'パイク', title: '溺死魔', role: 'SUP' },
  { id: 'Blitzcrank', name: 'ブリッツクランク', title: '大いなる蒸気の巨人', role: 'SUP' },
  { id: 'Rakan', name: 'ラカン', title: '魅惑の鳥', role: 'SUP' },
  { id: 'Braum', name: 'ブラウム', title: 'フレヨルドの心', role: 'SUP' },
  { id: 'Renata', name: 'レナータ・グラスク', title: 'ケミテック長者', role: 'SUP' },
  { id: 'Milio', name: 'ミリオ', title: '温もりを運ぶ炎', role: 'SUP' },
  { id: 'Rell', name: 'レル', title: '鉄の女戦士', role: 'SUP' },
];

// 面白い特殊縛りルール一覧 (ブレイバリー風)
export const FUN_RULES = [
  {
    title: '⚡ フラッシュ禁止令',
    desc: '全員「フラッシュ（サモナースペル）」の装備が禁止！ゴースト、イグナイト、TPなどで戦え！',
    difficulty: '★☆☆☆☆',
  },
  {
    title: '🧙 全員魔力至上主義 (フルAP)',
    desc: '全プレイヤー、AP（魔力）アイテムのみビルド可能！ADチャンプでも意地でAPを積め！',
    difficulty: '★★☆☆☆',
  },
  {
    title: '🏹 全員クリティカル教 (フルAD/Crit)',
    desc: '全員インフィニティ・エッジやコレクターを目指す！タンクもサポートも殴り合い！',
    difficulty: '★★☆☆☆',
  },
  {
    title: '🛡️ 鉄壁のタンク軍団 (全員タンク)',
    desc: '全員耐久力・防御力アイテムのみ購入可能！終わらない泥沼の集団戦を制覇せよ！',
    difficulty: '★★★☆☆',
  },
  {
    title: '🥾 ブーツ禁止縛り (裸足ウォーキング)',
    desc: '靴（ブーツ系アイテム）の購入が全面禁止！移動速度が遅い状態でスキルを避け合え！',
    difficulty: '★★☆☆☆',
  },
  {
    title: '🐉 ドラゴン・バロン最優先法',
    desc: 'オブジェクト（ヴォイドグラブ・ドラゴン・ヘラルド・バロン）が湧いたら、何があっても最優先で全員集結しなければならない！',
    difficulty: '★★★☆☆',
  },
  {
    title: '🔥 アルティメット即撃ち縛り',
    desc: 'ウルト（Rスキル）が上がったら、敵が見え次第30秒以内に必ず発動しなければならない！',
    difficulty: '★★★★☆',
  },
  {
    title: '💀 10分までキル禁止 (平和条約)',
    desc: '試合開始10:00までは相手チャンピオンを倒してはいけない（削りはOK、キルしたら相手に1ウェーブ譲る）。純粋なファーム勝負！',
    difficulty: '★★★★☆',
  },
  {
    title: '🔄 ロール完全シャッフル戦',
    desc: 'メインロールと一番遠いロールを強制プレイ！（例: メインJGはADCへ、メインADCはTOPへ）',
    difficulty: '★★★☆☆',
  },
  {
    title: '🎲 アルティメット・ブレイバリー',
    desc: 'ルーン・サモスペ・1stアイテム・ミシックをルーレットで決めて完全再現！',
    difficulty: '★★★★★',
  },
];

// 厳選プール(CHAMPION_POOL)しか使えない場合のアイコン用バージョン。
// ⚠️ 以前はここが唯一のバージョン指定で `14.24.1` 固定だった。旧バージョンのCDNは
// 残るため既存65体は今も200で返るが、**14.24.1以降に追加されたチャンピオンは403**
// （2026-09-29実測: Mel / Yunara が403、Ambessa / Aurora は200）。
// プールへ新チャンピオンを足した瞬間に画像が壊れる潜在バグだったので、
// DataDragonから取得した実バージョンを優先し、これは取得失敗時のみのフォールバックにした。
const FALLBACK_DDRAGON_VERSION = '14.24.1';

function getDDragonIconUrl(championId, version = FALLBACK_DDRAGON_VERSION) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`;
}

/**
 * DataDragon から現行バージョンと全チャンピオン（日本語名・タイトル付き）を取得する。
 * Workers のアイソレートが再利用される間はキャッシュして使う（ボタン押下時の
 * 即時応答(type:4)でも3秒制限に余裕を持たせるため）。
 * 取得に失敗したら null を返す（推測データで埋めない）。
 */
let _catalogCache = null;
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000; // 6時間

export async function fetchChampionCatalog() {
  if (_catalogCache && Date.now() - _catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return _catalogCache;
  }
  try {
    const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
      signal: AbortSignal.timeout(4000)
    });
    if (!vRes.ok) throw new Error(`versions.json HTTP ${vRes.status}`);
    const versions = await vRes.json();
    const version = Array.isArray(versions) && versions[0];
    if (!version) throw new Error('versions.json が空');

    const cRes = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/champion.json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!cRes.ok) throw new Error(`champion.json HTTP ${cRes.status}`);
    const json = await cRes.json();

    const champions = Object.values(json.data || {}).map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      role: null // DataDragonはレーン情報を持たない
    }));
    if (champions.length === 0) throw new Error('champion.json が空');

    _catalogCache = { version, champions, fetchedAt: Date.now() };
    return _catalogCache;
  } catch (e) {
    console.warn('[roulette] DataDragonのチャンピオン一覧取得に失敗:', e?.message);
    // 期限切れでも古いキャッシュがあればそれを使う（無ければ null）
    return _catalogCache || null;
  }
}

/**
 * チャンピオン抽選Embedを生成
 */
export function generateChampionRoulette(roleFilter = 'ALL', count = 1, catalog = null) {
  const isAll = !roleFilter || roleFilter === 'ALL';
  const version = catalog?.version || FALLBACK_DDRAGON_VERSION;

  // ロール指定なし → DataDragonの全チャンピオンを使う（取得できていれば）。
  // ロール指定あり → DataDragonはレーン情報を持たないため厳選プールを使う。
  const usingFullCatalog = isAll && Array.isArray(catalog?.champions) && catalog.champions.length > 0;
  let pool = usingFullCatalog ? catalog.champions : CHAMPION_POOL;
  if (!isAll) {
    pool = CHAMPION_POOL.filter((c) => c.role && c.role.toUpperCase() === roleFilter.toUpperCase());
  }
  if (pool.length === 0) pool = CHAMPION_POOL; // 念のための保険

  // 抽選元を偽らずに明示する（「DDragon準拠」と書いて65体しか無かった過去の反省）
  const sourceNote = usingFullCatalog
    ? `全${pool.length}体から抽選 (DataDragon ${version})`
    : isAll
      ? `厳選${pool.length}体から抽選 (DataDragon取得に失敗したため)`
      : `厳選${pool.length}体から抽選 (ロール情報はDataDragonに無いため手入力データを使用)`;

  // シャッフルして指定件数抽出
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  if (count === 1) {
    const c = selected[0];
    // DataDragon由来のチャンピオンにはロール情報が無いので、その場合は行そのものを出さない
    const roleLine = c.role ? `推奨ロール: **${c.role}**\n` : '';
    return {
      embed: {
        title: `🎲 チャンピオン抽選結果: ${c.name}`,
        description: `**${c.title} - ${c.id}**\n${roleLine}\n「運命はお前を選んだ！このチャンピオンで勝利を掴め！」`,
        color: 0xc2650f, // KTMアンバー
        thumbnail: { url: getDDragonIconUrl(c.id, version) },
        footer: { text: `ロール条件: ${roleFilter} | ${sourceNote}` },
        timestamp: new Date().toISOString(),
      },
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: '🔄 もう一度回す',
              style: 1,
              custom_id: `roulette_reroll:champ:${roleFilter}:1`,
            },
            {
              type: 2,
              label: '👥 5人分一括抽選 (チーム)',
              style: 2,
              custom_id: `roulette_reroll:team:ALL:5`,
            },
          ],
        },
      ],
    };
  }

  // チーム5体分抽選
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const teamPicks = roles.map((r) => {
    const rPool = CHAMPION_POOL.filter((c) => c.role === r);
    return rPool[Math.floor(Math.random() * rPool.length)];
  });

  const fields = teamPicks.map((c, i) => ({
    name: `${roles[i]}: ${c.name} (${c.id})`,
    value: `${c.title}`,
    inline: false,
  }));

  return {
    embed: {
      title: '🎲 チーム5構成 ランダム一括ルーレット！',
      description: '全5レーンのチャンピオンを一発抽選しました！\nこの構成でカスタムを戦い抜け！',
      color: 0x5865f2,
      fields,
      thumbnail: { url: getDDragonIconUrl(teamPicks[0].id, version) },
      // チーム抽選はレーン別に選ぶため、ロール情報を持つ厳選プールしか使えない。そう明記する。
      footer: { text: `KTM Sovereign OS | チームドラフト | 厳選${CHAMPION_POOL.length}体から抽選（レーン別のため）` },
      timestamp: new Date().toISOString(),
    },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: '🔄 もう一度チーム抽選',
            style: 1,
            custom_id: `roulette_reroll:team:ALL:5`,
          },
          {
            type: 2,
            label: '🎲 1体単体抽選へ戻る',
            style: 2,
            custom_id: `roulette_reroll:champ:ALL:1`,
          },
        ],
      },
    ],
  };
}

/**
 * ロールシャッフルEmbedを生成 (5人にランダム割り当て)
 */
export function generateRoleShuffle(playerList = []) {
  const roles = ['🛡️ TOP', '⚔️ JG', '🧙 MID', '🏹 ADC', '🩹 SUP'];
  const shuffledRoles = [...roles].sort(() => 0.5 - Math.random());

  // プレイヤーが指定されていない場合のプレースホルダー
  const players = playerList.length >= 5 ? playerList.slice(0, 5) : ['プレイヤー1', 'プレイヤー2', 'プレイヤー3', 'プレイヤー4', 'プレイヤー5'];

  const fields = players.map((p, i) => ({
    name: `${p}`,
    value: `👉 **${shuffledRoles[i]}**`,
    inline: true,
  }));

  return {
    embed: {
      title: '👑 ロール完全シャッフル抽選！',
      description: '運命のレーン割り振り結果です！文句なしで挑め！',
      color: 0x10b981, // エメラルドグリーン
      fields,
      footer: { text: 'KTM Sovereign OS | ロールルーレット' },
      timestamp: new Date().toISOString(),
    },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: '🔄 ロールを再シャッフル',
            style: 1,
            custom_id: `roulette_reroll:roles:ALL:5`,
          },
          {
            type: 2,
            label: '🔥 特殊縛りルールを引く',
            style: 3,
            custom_id: `roulette_reroll:bravery:ALL:1`,
          },
        ],
      },
    ],
  };
}

/**
 * 特殊縛りルールEmbedを生成
 */
export function generateBraveryRoulette() {
  const rule = FUN_RULES[Math.floor(Math.random() * FUN_RULES.length)];

  return {
    embed: {
      title: `🔥 特殊縛りルール発動: ${rule.title}`,
      description: `**【ルール詳細】**\n${rule.desc}\n\n**難易度**: \`${rule.difficulty}\`\n\n*(※全員合意の上で楽しくプレイしてください！)*`,
      color: 0xe11d48, // ローズレッド
      footer: { text: 'KTM Sovereign OS | エキサイティング・ブレイバリー' },
      timestamp: new Date().toISOString(),
    },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: '🎲 別の縛りルールを引く',
            style: 4,
            custom_id: `roulette_reroll:bravery:ALL:1`,
          },
          {
            type: 2,
            label: '🎲 チャンピオンを引く',
            style: 1,
            custom_id: `roulette_reroll:champ:ALL:1`,
          },
        ],
      },
    ],
  };
}

/**
 * スラッシュコマンド /roulette のハンドラー
 */
export async function handleRouletteCommand(interaction, env, ctx) {
  const options = interaction.data.options || [];
  const getOpt = (name) => options.find((o) => o.name === name)?.value;

  const mode = getOpt('mode') || 'champion';
  const role = getOpt('role') || 'ALL';

  // チャンピオン抽選のときだけDataDragonの一覧が必要。
  // アイソレート内でキャッシュされるため通常は即時、初回のみ数百ms。
  const needsCatalog = mode === 'team' || !(mode === 'roles' || mode === 'shuffle' || mode === 'bravery' || mode === 'rule');
  const catalog = needsCatalog ? await fetchChampionCatalog() : null;

  let result;
  if (mode === 'roles' || mode === 'shuffle') {
    // 実行者のメンションを含める
    const caller = `<@${interaction.member?.user?.id || interaction.user?.id}>`;
    result = generateRoleShuffle([caller, 'メンバー2', 'メンバー3', 'メンバー4', 'メンバー5']);
  } else if (mode === 'bravery' || mode === 'rule') {
    result = generateBraveryRoulette();
  } else if (mode === 'team') {
    result = generateChampionRoulette('ALL', 5, catalog);
  } else {
    result = generateChampionRoulette(role, 1, catalog);
  }

  return Response.json({
    type: 4,
    data: {
      embeds: [result.embed],
      components: result.components,
    },
  });
}

/**
 * ボタンによる再抽選ハンドラー
 */
export async function handleRouletteButton(interaction, env, ctx) {
  const customId = interaction.data.custom_id; // e.g. "roulette_reroll:champ:TOP:1"
  const [, type, role, countStr] = customId.split(':');
  const count = parseInt(countStr || '1', 10);

  // チャンピオン抽選のときだけDataDragonの一覧が必要（キャッシュ済みなら即時）
  const needsCatalog = type === 'team' || !(type === 'roles' || type === 'bravery');
  const catalog = needsCatalog ? await fetchChampionCatalog() : null;

  let result;
  if (type === 'roles') {
    const caller = `<@${interaction.member?.user?.id || interaction.user?.id}>`;
    result = generateRoleShuffle([caller, 'メンバー2', 'メンバー3', 'メンバー4', 'メンバー5']);
  } else if (type === 'bravery') {
    result = generateBraveryRoulette();
  } else if (type === 'team') {
    result = generateChampionRoulette('ALL', 5, catalog);
  } else {
    result = generateChampionRoulette(role || 'ALL', count, catalog);
  }

  // メッセージを更新 (type 7)
  return Response.json({
    type: 7,
    data: {
      embeds: [result.embed],
      components: result.components,
    },
  });
}
