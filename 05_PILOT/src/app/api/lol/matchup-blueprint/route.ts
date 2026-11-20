import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizeChampionName } from '@/lib/championNames';
import { getCalendarPatch } from '@/lib/ddragonClient';

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
  let calendarPatch = '26.23';
  try {
    calendarPatch = await getCalendarPatch();
  } catch {}

  const result: {
    weaknesses: string | null;
    counter_champions: string | null;
    is_enemy_counter: boolean;
    matchup_memo: string | null;
    source_patch: string | null;
    current_patch: string;
    confidence: string | null;
  } = {
    weaknesses: null,
    counter_champions: null,
    is_enemy_counter: false,
    matchup_memo: null,
    source_patch: null,
    current_patch: calendarPatch,
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
      // SPEC 10: 見出しで後続文を切り落とさず、文頭の「また、」「さらに、」などの断片化接続詞を自然に除去
      const cleanText = (v: string) => {
        let t = v.trim();
        // 文頭の接続詞（また、/さらに、/そして、/なお、/・等）を整形
        t = t.replace(/^(?:また[、,\s]|さらに[、,\s]|そして[、,\s]|なお[、,\s]|・\s*)+/g, '');
        return t.trim();
      };

      if (isUsable(facts.weaknesses)) result.weaknesses = cleanText(facts.weaknesses);
      if (isUsable(facts.counter_champions)) {
        result.counter_champions = cleanText(facts.counter_champions);
        const normalizedEnemy = normalizeChampionName(enemyChamp) || enemyChamp;
        const haystack = result.counter_champions;
        result.is_enemy_counter =
          haystack.includes(enemyChamp) ||
          haystack.includes(normalizedEnemy) ||
          (normalizeChampionName(haystack) || '').includes(normalizedEnemy);
      }
      // 最新パッチへ自動追従（facts.patch が空または古い場合でも現行パッチを補完）
      result.source_patch = facts.patch || calendarPatch;
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
    const normMy = normalizeChampionName(myChamp) || myChamp;
    const normEnemy = normalizeChampionName(enemyChamp) || enemyChamp;
    const { data } = await supabase
      .from('champion_jungle_timing_agg')
      .select('champion, external_fastest_clear_sec')
      .in('champion', [myChamp, enemyChamp, normMy, normEnemy])
      .order('champion', { ascending: true });

    const find = (c: string) => {
      const target = c.toLowerCase();
      const norm = (normalizeChampionName(c) || c).toLowerCase();
      const row = (data || []).find((r: any) => {
        const rc = String(r.champion || '').toLowerCase();
        return rc === target || rc === norm;
      });
      // 厳格な数値検証: 実データのないものや異常値は null を返し推測値は捏造しない
      const sec = row?.external_fastest_clear_sec;
      return typeof sec === 'number' && sec > 60 && sec < 300 ? sec : null;
    };
    return { my: find(myChamp), enemy: find(enemyChamp) };
  } catch {
    return { my: null, enemy: null };
  }
}

function getGenericPhasesByLane(lane: string) {
  const currentLane = (lane || 'JUNGLE').toUpperCase();
  if (currentLane === 'JUNGLE') {
    return [
      {
        phase: "Phase 1 (Lv1〜2)",
        title: "安全なキャンプ巡回と最速Lv3ルート確立",
        action: "味方ボットのリーシュを受けて効率的なフルクリアを開始。逆サイドからのインベードを警戒しながらHPを8割以上維持。",
        win_trigger: "無駄な被弾なく02:30までにLv3到達",
        badge: "周回 🌲"
      },
      {
        phase: "Phase 2 (Lv3〜5)",
        title: "2:55スカトル争奪 ＆ 視界先行・カウンターガンク",
        action: "敵JGのスタート位置から逆算し、衝突を避けるか仕掛けるかを判断。敵主要スキルのCDに合わせてサイドレーンに介入。",
        win_trigger: "スカトル確保または敵JGの位置特定で第2段階クリア",
        badge: "制圧 ⚡"
      },
      {
        phase: "Phase 3 (Lv6〜)",
        title: "パワースパイクを活かしてドラゴン/グラブ完全掌握",
        action: "Ult習得のタイミングで主導権のあるレーンへダイブ/ガンクし、人数有利を作って重要オブジェクトへ直行。",
        win_trigger: "1stドラゴンまたはヴォイドグラブ確保で試合テンポ掌握",
        badge: "掌握 👑"
      }
    ];
  }

  if (currentLane === 'TOP') {
    return [
      {
        phase: "Phase 1 (Lv1〜2)",
        title: "無理なトレードを避けウェーブを手前に引く",
        action: "敵の序盤スキル威力を警戒し、CSを数体捨ててでもウェーブを手前にフリーズ。Lv2先行を冷静に見極める。",
        win_trigger: "自タワー手前にウェーブがフリーズできればクリア",
        badge: "忍耐 🛡️"
      },
      {
        phase: "Phase 2 (Lv3〜5)",
        title: "敵主要スキルのCD中にショートトレード",
        action: "敵が重要スキルを外した瞬間を見逃さず、スキル1セットを叩き込んで即座に離脱。",
        win_trigger: "敵のHPを削りリコールまたはFlashを強要",
        badge: "好機 ⚔️"
      },
      {
        phase: "Phase 3 (Lv6〜)",
        title: "パワースパイクからオールイン ＆ プレート奪取",
        action: "Ult習得に合わせてオールインでソロキルを狙い、ミニオンを押し込んでタワープレートを獲得。",
        win_trigger: "タワー主導権の確立またはキル獲得でレーン完全勝利",
        badge: "破壊 👑"
      }
    ];
  }

  if (currentLane === 'MID') {
    return [
      {
        phase: "Phase 1 (Lv1〜2)",
        title: "スキル射程を活かしてLv2先行プッシュ",
        action: "ミニオンと敵チャンプを巻き込むスキル配置でウェーブ主導権を奪取。横ステップで敵のハラスを回避。",
        win_trigger: "敵にCSを取らせずタワー下に押し込めればクリア",
        badge: "主導権 ⚡"
      },
      {
        phase: "Phase 2 (Lv3〜5)",
        title: "F6・リバー視界確保 ＆ カウンターハラス",
        action: "敵JGの奇襲をケアするワードを置き、敵MIDがスキルを使った直後の無防備な時間を狙ってHPを削る。",
        win_trigger: "敵のポーションを削り切り味方JGのスカトル寄り支援",
        badge: "制圧 🎯"
      },
      {
        phase: "Phase 3 (Lv6〜)",
        title: "バーストコンボでソロキル ＆ オブジェクト合流",
        action: "Ultを絡めたフルコンボでキルラインを形成。レーンを押し込んでドラゴン・ヴォイドグラブの集団戦に一番槍で合流。",
        win_trigger: "サイドローム成功またはオブジェクト集団戦勝利",
        badge: "勝利 👑"
      }
    ];
  }

  // BOT (ADC / SUPPORT)
  return [
    {
      phase: "Phase 1 (Lv1〜2)",
      title: "第2ウェーブ前衛3体でのLv2先行エンゲージ争い",
      action: "第1ウェーブを素早く削り、第2ウェーブの前衛3体を最速で倒してLv2になった瞬間に前進トレードを仕掛ける。",
      win_trigger: "敵デュオの体力を削りサモナースペルを吐かせればクリア",
      badge: "先制 ⚡"
    },
    {
      phase: "Phase 2 (Lv3〜5)",
      title: "リバー視界管理 ＆ 敵JGボットガンクの徹底回避",
      action: "02:45〜03:15の敵JG初期ガンクを警戒し、リバー・トライブッシュの視界を維持。無理なタワー下深追いは厳禁。",
      win_trigger: "被ガンク死ゼロで安定したファームとアイテム素材獲得",
      badge: "警戒 🛡️"
    },
    {
      phase: "Phase 3 (Lv6〜)",
      title: "ボットタワー破壊からMIDスワップで主導権拡大",
      action: "Ult習得のオールインまたは味方JGのガンクに合わせて敵デュオを撃破。1stタワー破壊後にMIDへスワップ。",
      win_trigger: "ドラゴン確保 ＋ 1stタワー破壊でボット完全勝利",
      badge: "制圧 👑"
    }
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const myChamp = searchParams.get('my') || 'JarvanIV';
  const enemyChamp = searchParams.get('enemy') || 'LeeSin';
  const lane = searchParams.get('lane') || 'JUNGLE';

  // 1. 3段階手順書（個別に書いてあるのは BLUEPRINTS の数体だけ。それ以外はレーン適合した共通手順）
  const phasesAreGeneric = !BLUEPRINTS[enemyChamp];
  const phases = BLUEPRINTS[enemyChamp] || getGenericPhasesByLane(lane);

  // 3. 実戦の罠・NG行動
  const rejectedIntel = await buildRejectedIntel(myChamp, enemyChamp);

  return NextResponse.json({
    success: true,
    my_champion: myChamp,
    enemy_champion: enemyChamp,
    lane,
    blueprint: {
      phases,
      phases_are_generic: phasesAreGeneric,
    },
    // 初動ルート用の最速フルクリア時間（champion_jungle_timing_agg 由来の実測。無ければ null）
    jungle_clear: await fetchClearTimes(myChamp, enemyChamp),
    rejected_intel: rejectedIntel
  });
}
