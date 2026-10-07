import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizeChampionName } from '@/lib/championNames';

// 2026-10-08: 「Lv6 推定致死量バースト」を削除（ユーザー判断）。敵のダメージは約45体分の手書きの係数、
// 自分の体力は誰でも1150・防御も固定で、根拠の無い数字を「409 DMG」と実測のように出していた。

const BLUEPRINTS: Record<string, any[]> = {
  Darius: [
    {
      phase: "Phase 1 (Lv1〜2)",
      title: "耐えてウェーブを手前に引く (Lv2先行厳禁)",
      action: "Lv1での殴り合いは極めて不利なためCSを数体捨ててウェーブを引く。敵のQ外周被弾を徹底回避する。",
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

  if (!supabase) return result;

  try {
    const { data: facts } = await supabase
      .from('champion_facts')
      .select('weaknesses, counter_champions, patch, confidence')
      .eq('champion', myChamp)
      .maybeSingle();

    if (facts) {
      const isUsable = (v: any) =>
        typeof v === 'string' && v.trim() && !v.includes('情報不足') && !v.includes('判断できません');
      const trim = (v: string) => v.split(/\n\s*【[^】]+】/)[0].trim();

      if (isUsable(facts.weaknesses)) result.weaknesses = trim(facts.weaknesses);
      if (isUsable(facts.counter_champions)) {
        result.counter_champions = trim(facts.counter_champions);
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

    const { data: sentinel } = await supabase
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

async function fetchClearTimes(myChamp: string, enemyChamp: string): Promise<{ my: number | null; enemy: number | null }> {
  if (!supabase) return { my: null, enemy: null };
  try {
    const { data } = await supabase
      .from('champion_jungle_timing_agg')
      .select('champion, external_fastest_clear_sec')
      .in('champion', [myChamp, enemyChamp]);
    const find = (c: string) => (data || []).find((r: any) => String(r.champion).toLowerCase() === c.toLowerCase())?.external_fastest_clear_sec ?? null;
    return { my: find(myChamp), enemy: find(enemyChamp) };
  } catch {
    return { my: null, enemy: null };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const myChamp = searchParams.get('my') || 'JarvanIV';
  const enemyChamp = searchParams.get('enemy') || 'LeeSin';

  // 1. 3段階手順書（個別に書いてあるのは BLUEPRINTS の数体だけ。それ以外は全員共通の一般的な流れ）
  const phasesAreGeneric = !BLUEPRINTS[enemyChamp];
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

  // 3. 実戦の罠・NG行動
  const rejectedIntel = await buildRejectedIntel(myChamp, enemyChamp);

  return NextResponse.json({
    success: true,
    my_champion: myChamp,
    enemy_champion: enemyChamp,
    blueprint: {
      phases,
      phases_are_generic: phasesAreGeneric,
    },
    // 初動ルート用の最速フルクリア時間（champion_jungle_timing_agg、junglepedia 由来の実測。無ければ null）
    // 2026-10-08: 以前はどこからも渡しておらず、画面は誰でも「約3分15秒（目安推測）」だった
    jungle_clear: await fetchClearTimes(myChamp, enemyChamp),
    rejected_intel: rejectedIntel
  });
}
