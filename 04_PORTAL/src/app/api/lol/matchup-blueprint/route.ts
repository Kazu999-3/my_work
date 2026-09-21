import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { normalizeChampionName } from '../../../../lib/championNames';

// 主要チャンピオンのLv6時フルコンボ公式基礎ダメージ ＋ スケーリング
interface BurstProfile {
  baseLvl6: number;
  adScale: number;
  apScale: number;
  type: 'physical' | 'magic' | 'mixed' | 'true_hybrid';
  ignite: boolean;
}

const BURST_PROFILES: Record<string, BurstProfile> = {
  // Bruisers & Juggernauts
  Darius: { baseLvl6: 480, adScale: 2.4, apScale: 0.0, type: 'physical', ignite: true },
  Aatrox: { baseLvl6: 510, adScale: 2.6, apScale: 0.0, type: 'physical', ignite: false },
  Renekton: { baseLvl6: 540, adScale: 2.7, apScale: 0.0, type: 'physical', ignite: true },
  Riven: { baseLvl6: 520, adScale: 3.0, apScale: 0.0, type: 'physical', ignite: true },
  Garen: { baseLvl6: 460, adScale: 2.2, apScale: 0.0, type: 'true_hybrid', ignite: true },
  Jax: { baseLvl6: 490, adScale: 2.0, apScale: 1.4, type: 'mixed', ignite: true },
  Fiora: { baseLvl6: 480, adScale: 2.5, apScale: 0.0, type: 'true_hybrid', ignite: true },
  Camille: { baseLvl6: 470, adScale: 2.6, apScale: 0.0, type: 'true_hybrid', ignite: true },
  Irelia: { baseLvl6: 530, adScale: 2.5, apScale: 0.0, type: 'physical', ignite: true },
  Sett: { baseLvl6: 500, adScale: 2.4, apScale: 0.0, type: 'true_hybrid', ignite: true },
  Mordekaiser: { baseLvl6: 490, adScale: 0.0, apScale: 2.2, type: 'magic', ignite: true },
  Illaoi: { baseLvl6: 560, adScale: 2.8, apScale: 0.0, type: 'physical', ignite: false },
  Yorick: { baseLvl6: 470, adScale: 2.3, apScale: 0.0, type: 'physical', ignite: false },
  KSante: { baseLvl6: 440, adScale: 1.8, apScale: 0.0, type: 'true_hybrid', ignite: false },

  // Assassins
  Zed: { baseLvl6: 550, adScale: 2.8, apScale: 0.0, type: 'physical', ignite: true },
  Talon: { baseLvl6: 560, adScale: 2.9, apScale: 0.0, type: 'physical', ignite: true },
  Katarina: { baseLvl6: 540, adScale: 2.2, apScale: 2.4, type: 'mixed', ignite: true },
  Akali: { baseLvl6: 530, adScale: 1.8, apScale: 2.5, type: 'magic', ignite: true },
  Qiyana: { baseLvl6: 540, adScale: 2.8, apScale: 0.0, type: 'physical', ignite: true },
  Fizz: { baseLvl6: 520, adScale: 0.0, apScale: 2.6, type: 'magic', ignite: true },
  LeBlanc: { baseLvl6: 510, adScale: 0.0, apScale: 2.5, type: 'magic', ignite: true },
  Ekko: { baseLvl6: 500, adScale: 0.0, apScale: 2.4, type: 'magic', ignite: true },

  // Mages
  Ahri: { baseLvl6: 490, adScale: 0.0, apScale: 2.1, type: 'magic', ignite: true },
  Syndra: { baseLvl6: 550, adScale: 0.0, apScale: 2.6, type: 'magic', ignite: true },
  Orianna: { baseLvl6: 460, adScale: 0.0, apScale: 2.0, type: 'magic', ignite: false },
  Viktor: { baseLvl6: 480, adScale: 0.0, apScale: 2.3, type: 'magic', ignite: false },
  Veigar: { baseLvl6: 520, adScale: 0.0, apScale: 2.5, type: 'magic', ignite: false },
  Lux: { baseLvl6: 510, adScale: 0.0, apScale: 2.4, type: 'magic', ignite: true },
  Vex: { baseLvl6: 500, adScale: 0.0, apScale: 2.3, type: 'magic', ignite: true },

  // Tanks
  Malphite: { baseLvl6: 420, adScale: 0.0, apScale: 1.8, type: 'magic', ignite: false },
  Ornn: { baseLvl6: 440, adScale: 1.2, apScale: 0.0, type: 'magic', ignite: false },
  Sion: { baseLvl6: 450, adScale: 1.8, apScale: 0.0, type: 'physical', ignite: false },
  ChoGath: { baseLvl6: 480, adScale: 0.0, apScale: 1.8, type: 'true_hybrid', ignite: true },

  // ADCs & Marksmen
  Jinx: { baseLvl6: 420, adScale: 2.0, apScale: 0.0, type: 'physical', ignite: false },
  Kaisa: { baseLvl6: 510, adScale: 1.8, apScale: 2.0, type: 'mixed', ignite: false },
  Ezreal: { baseLvl6: 460, adScale: 2.2, apScale: 1.6, type: 'mixed', ignite: false },
  Lucian: { baseLvl6: 520, adScale: 2.6, apScale: 0.0, type: 'physical', ignite: true },
  Samira: { baseLvl6: 540, adScale: 2.8, apScale: 0.0, type: 'physical', ignite: true },

  // Junglers
  LeeSin: { baseLvl6: 530, adScale: 2.6, apScale: 0.0, type: 'physical', ignite: false },
  JarvanIV: { baseLvl6: 480, adScale: 2.3, apScale: 0.0, type: 'physical', ignite: false },
  Viego: { baseLvl6: 490, adScale: 2.4, apScale: 0.0, type: 'physical', ignite: false },
  Nocturne: { baseLvl6: 470, adScale: 2.2, apScale: 0.0, type: 'physical', ignite: false },
  XinZhao: { baseLvl6: 490, adScale: 2.3, apScale: 0.0, type: 'physical', ignite: false },
  MasterYi: { baseLvl6: 460, adScale: 2.2, apScale: 0.0, type: 'true_hybrid', ignite: true },
};

function calculateKillLine(
  enemyChamp: string,
  myChamp: string,
  enemyLevel = 6,
  enemyBonusAd = 25.0,
  enemyBonusAp = 0.0,
  myMaxHp = 1150.0,
  myArmor = 45.0,
  myMr = 36.0
) {
  const profile: BurstProfile = BURST_PROFILES[enemyChamp] || {
    baseLvl6: 460.0,
    adScale: 2.0,
    apScale: 1.8,
    type: 'physical',
    ignite: true,
  };

  // 1. レベルスケーリング基礎ダメージ
  const baseDmg = profile.baseLvl6 * (0.6 + enemyLevel * 0.066);

  // 2. AD/APスケーリング加算
  const rawBurst = baseDmg + (enemyBonusAd * profile.adScale) + (enemyBonusAp * profile.apScale);

  // 3. 防御軽減計算
  let reducedBurst = 0;
  if (profile.type === 'physical') {
    reducedBurst = rawBurst * (100 / (100 + myArmor));
  } else if (profile.type === 'magic') {
    reducedBurst = rawBurst * (100 / (100 + myMr));
  } else if (profile.type === 'mixed') {
    const phys = (rawBurst * 0.5) * (100 / (100 + myArmor));
    const mag = (rawBurst * 0.5) * (100 / (100 + myMr));
    reducedBurst = phys + mag;
  } else {
    // true_hybrid: 確定ダメージ30%はそのまま、残り70%を物理で軽減
    const trueDmg = rawBurst * 0.3;
    const phys = (rawBurst * 0.7) * (100 / (100 + myArmor));
    reducedBurst = trueDmg + phys;
  }

  // 4. イグナイト加算
  const hasIgnite = profile.ignite;
  const igniteDmg = hasIgnite ? 70 + enemyLevel * 20 : 0;
  const totalLethal = Math.round(reducedBurst + igniteDmg);

  // 5. 即死境界割合
  const killHpPercent = Math.min(100, Math.round((totalLethal / myMaxHp) * 100));
  // ★ 2026-09-22修正: 以前は `myMaxHp - totalLethal` を「安全域」として出していたが、
  // これは「満タンからフルコンボを受けた後の残HP」であって安全ラインではない。
  // 実際に死ぬのは「現在HP <= 確定ダメージ」のときなので、安全ラインは確定ダメージそのもの。
  // 旧式だと、確定ダメージが最大HPの半分を超える対面で
  // 「即死境界700HPなのに安全域>450HP」という矛盾した表示になり、
  // 500HPで安全だと誤認させる(実際は即死する)危険な案内になっていた。
  const safeHpThreshold = totalLethal;

  // 6. 危険度バッジ＆アドバイス
  let dangerBadge = '安全圏 🟢';
  let dangerColor = '#10b981';
  let advice = `HP余裕あり。敵のスキル空振りに反撃を合わせましょう。`;

  if (killHpPercent >= 65) {
    dangerBadge = '極限警戒 💀';
    dangerColor = '#dc2626';
    advice = `HP ${killHpPercent}% (${totalLethal}以下) で即死確定！ Flashなしでの不用意な接近は厳禁。`;
  } else if (killHpPercent >= 50) {
    dangerBadge = '超危険 🔴';
    dangerColor = '#ef4444';
    advice = `HP ${killHpPercent}% (${totalLethal}以下) で即死圏内。タワー下でも甘えた居残りはリコール推奨！`;
  } else if (killHpPercent >= 35) {
    dangerBadge = '警戒 🟡';
    dangerColor = '#f59e0b';
    advice = `HP ${killHpPercent}% (${totalLethal}以下) でバースト警戒。敵主要スキルのCDを見てトレード。`;
  }

  return {
    enemy_champion: enemyChamp,
    enemy_level: enemyLevel,
    has_ignite: hasIgnite,
    total_lethal_damage: totalLethal,
    raw_burst_damage: Math.round(rawBurst),
    ignite_damage: igniteDmg,
    kill_hp_percent: killHpPercent,
    my_max_hp: myMaxHp,
    safe_hp_threshold: safeHpThreshold,
    danger_badge: dangerBadge,
    danger_color: dangerColor,
    advice,
  };
}

const BLUEPRINTS: Record<string, any[]> = {
  Darius: [
    {
      phase: "Phase 1 (Lv1〜2)",
      title: "耐えてウェーブを手前に引く (Lv2先行厳禁)",
      action: "Lv1での殴り合いは100%負けるためCSを数体捨ててウェーブを引く。敵のQ外周だけ絶対に避ける。",
      win_trigger: "自タワー手前にウェーブがフリーズできれば第1段階クリア",
      badge: "忍耐 🛡️"
    },
    {
      phase: "Phase 2 (Lv3〜5)",
      title: "Eの空振りを待ってショートトレード",
      action: "敵がE（引き寄せ）を外した瞬間が最大のチャンス。スキル1セット叩き込んで即座に離脱。",
      win_trigger: "敵のHPを60%以下に削り、Flashを吐かせたら第2段階クリア",
      badge: "好機 ⚔️"
    },
    {
      phase: "Phase 3 (Lv6〜)",
      title: "Ult展開からオールイン ＆ プレート奪取",
      action: "FlashのないダリウスにQ先端を叩き込み、Ultで追撃してソロキル。即座にミニオンを押し込んでプレート獲得。",
      win_trigger: "ソロキル ＋ プレート2枚でレーン完全勝利",
      badge: "破壊 👑"
    }
  ],
  Zed: [
    {
      phase: "Phase 1 (Lv1〜2)",
      title: "Qの貫通ダメージを受け流しプッシュ",
      action: "ミニオンの裏に立ち、Qの直撃を避ける（貫通ダメージは半減）。Lv2を先に取って主導権。",
      win_trigger: "敵にCSを取らせずタワー下に押し込めればクリア",
      badge: "主導権 ⚡"
    },
    {
      phase: "Phase 2 (Lv3〜5)",
      title: "W（分身）のCD20秒間を完全制圧",
      action: "W-E-Qコンボを横ステップで回避。分身を使った後の20秒間は無防備なので徹底的にハラス。",
      win_trigger: "敵のポーションを全て使わせリコールを強要",
      badge: "制圧 🎯"
    },
    {
      phase: "Phase 3 (Lv6〜)",
      title: "Rの着地位置にCCを合わせて返り討ち",
      action: "ZedがRを使った瞬間、自分の背後に現れるためCCを即座に置き、フルコンボで返り討ち。",
      win_trigger: "タワーダイブを返り討ちにしてMID主導権確立",
      badge: "迎撃 🛡️"
    }
  ]
};

/**
 * 「実戦の罠・やってはいけないNG行動」を champion_facts / matchup_sentinel の
 * 実データから組み立てる。
 *
 * ★ 2026-09-22新設: 以前はこのセクションの文言がコンポーネント側に完全ハードコードされており、
 * チャンピオンを一切参照していなかった。にもかかわらず見出しは「◯◯ vs ◯◯ 実戦の罠（没理由DB）」と
 * DB由来であるかのように表示していたため、例えばZyra(APメイジ)の対面で
 * 「脅威積み(AD用ステータス)」「防具完成前」といった無関係な助言が出ていた。
 * 実データが無い対面では正直に「未登録」を返し、それらしい汎用文で埋めない。
 */
async function buildRejectedIntel(myChamp: string, enemyChamp: string) {
  const result: {
    weaknesses: string | null;
    counter_champions: string | null;
    is_enemy_counter: boolean;
    matchup_memo: string | null;
    source_patch: string | null;
    confidence: string | null;
  } = {
    weaknesses: null,
    counter_champions: null,
    is_enemy_counter: false,
    matchup_memo: null,
    source_patch: null,
    confidence: null,
  };

  try {
    const { data: facts } = await supabaseAdmin
      .from('champion_facts')
      .select('weaknesses, counter_champions, patch, confidence')
      .eq('champion', myChamp)
      .maybeSingle();

    if (facts) {
      const isUsable = (v: any) =>
        typeof v === 'string' && v.trim() && !v.includes('情報不足') && !v.includes('判断できません');
      // AIが付けがちな【追記知見】等のブロックは本文の言い換えが多いので本文だけ使う
      const trim = (v: string) => v.split(/\n\s*【[^】]+】/)[0].trim();

      if (isUsable(facts.weaknesses)) result.weaknesses = trim(facts.weaknesses);
      if (isUsable(facts.counter_champions)) {
        result.counter_champions = trim(facts.counter_champions);
        // 今回の対面相手が「苦手な相手」に挙がっているかを判定する(日本語名でも拾えるよう正規化)
        const normalizedEnemy = normalizeChampionName(enemyChamp) || enemyChamp;
        const haystack = result.counter_champions;
        result.is_enemy_counter =
          haystack.includes(enemyChamp) ||
          haystack.includes(normalizedEnemy) ||
          (normalizeChampionName(haystack) || '').includes(normalizedEnemy);
      }
      result.source_patch = facts.patch || null;
      result.confidence = facts.confidence || null;
    }

    // この対面固有の実戦メモ(あれば最優先で見せる)
    const { data: sentinel } = await supabaseAdmin
      .from('matchup_sentinel')
      .select('strategy')
      .eq('champion', myChamp)
      .eq('enemy', enemyChamp)
      .not('strategy', 'is', null)
      .neq('strategy', '')
      .limit(1)
      .maybeSingle();

    if (sentinel?.strategy) result.matchup_memo = String(sentinel.strategy).trim();
  } catch (e) {
    console.error('[matchup-blueprint] rejected intel の取得に失敗:', e);
  }

  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const myChamp = searchParams.get('my') || 'JarvanIV';
  const enemyChamp = searchParams.get('enemy') || 'LeeSin';

  // 1. 即死キルライン確定計算
  const killLine = calculateKillLine(enemyChamp, myChamp);

  // 2. 3段階手順書
  const phases = BLUEPRINTS[enemyChamp] || [
    {
      phase: "Phase 1 (Lv1〜2)",
      title: "無理なトレードを避けウェーブ・ルート管理",
      action: "敵の序盤スキル威力を警戒し、有利なタイミングでファーム・クリアを先行。",
      win_trigger: "HPを8割以上維持して安定してLv3到達",
      badge: "安定 🛡️"
    },
    {
      phase: "Phase 2 (Lv3〜5)",
      title: "敵主要スキルのCD中にショートトレード / ガンク展開",
      action: "敵がスキルを空振りした瞬間や、視界の取れたサイドでアクションを仕掛ける。",
      win_trigger: "敵のHPまたはFlashを削り主導権を奪う",
      badge: "好機 ⚔️"
    },
    {
      phase: "Phase 3 (Lv6〜)",
      title: "パワースパイクを活かしてオブジェクト制覇",
      action: "Ult習得・1stコア完成のタイミングで集団戦またはオブジェクト（ヴォイドグラブ/ドラゴン）を完全制圧。",
      win_trigger: "オブジェクト確保またはキル獲得で試合テンポを掌握",
      badge: "勝利 👑"
    }
  ];

  // 3. 実戦の罠・NG行動（実データのみ。無ければnullを返し、UI側で「未登録」と明示する）
  const rejectedIntel = await buildRejectedIntel(myChamp, enemyChamp);

  return NextResponse.json({
    success: true,
    my_champion: myChamp,
    enemy_champion: enemyChamp,
    kill_line: killLine,
    blueprint: {
      phases
    },
    rejected_intel: rejectedIntel
  });
}
