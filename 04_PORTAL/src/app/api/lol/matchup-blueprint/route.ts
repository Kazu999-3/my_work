import { NextRequest, NextResponse } from 'next/server';

// 主要チャンピオンのLv6時フルコンボ公式基礎ダメージ ＋ スケーリング
const BURST_PROFILES: Record<string, { baseLvl6: number; adScale: number; apScale: number; primaryType: string }> = {
  Darius: { baseLvl6: 480, adScale: 2.4, apScale: 0.0, primaryType: 'physical' },
  Zed: { baseLvl6: 550, adScale: 2.8, apScale: 0.0, primaryType: 'physical' },
  Riven: { baseLvl6: 520, adScale: 3.0, apScale: 0.0, primaryType: 'physical' },
  Ahri: { baseLvl6: 490, adScale: 0.0, apScale: 2.1, primaryType: 'magic' },
  Aatrox: { baseLvl6: 510, adScale: 2.6, apScale: 0.0, primaryType: 'physical' },
  Renekton: { baseLvl6: 540, adScale: 2.7, apScale: 0.0, primaryType: 'physical' },
  Malphite: { baseLvl6: 420, adScale: 0.0, apScale: 1.8, primaryType: 'magic' },
  Garen: { baseLvl6: 460, adScale: 2.2, apScale: 0.0, primaryType: 'true_hybrid' },
  Irelia: { baseLvl6: 530, adScale: 2.5, apScale: 0.0, primaryType: 'physical' },
  Jax: { baseLvl6: 490, adScale: 2.0, apScale: 1.4, primaryType: 'mixed' },
};

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const myChamp = searchParams.get('my') || 'Aatrox';
  const enemyChamp = searchParams.get('enemy') || 'Darius';
  const enemyLevel = parseInt(searchParams.get('level') || '6', 10);
  const myMaxHp = parseFloat(searchParams.get('myHp') || '1150');
  const myArmor = parseFloat(searchParams.get('myArmor') || '45');
  const myMr = parseFloat(searchParams.get('myMr') || '36');

  // 即死キルライン計算
  const prof = BURST_PROFILES[enemyChamp] || { baseLvl6: 450, adScale: 2.0, apScale: 1.5, primaryType: 'physical' };
  const baseDmg = prof.baseLvl6 * (0.6 + (enemyLevel * 0.066));
  const rawBurst = baseDmg + (25 * prof.adScale);
  const igniteDmg = 70 + (20 * enemyLevel);

  let mitigated = rawBurst * (100 / (100 + (prof.primaryType === 'magic' ? myMr : myArmor)));
  if (prof.primaryType === 'true_hybrid') {
    mitigated = (rawBurst * 0.6 * (100 / (100 + myArmor))) + (rawBurst * 0.4);
  }
  const totalLethal = Math.round(mitigated + igniteDmg);
  const killHpPercent = Math.min(95, Math.max(20, Math.round((totalLethal / myMaxHp) * 100)));

  // 3段階手順書
  const phases = BLUEPRINTS[enemyChamp] || [
    {
      phase: "Phase 1 (Lv1〜2)",
      title: "無理なトレードを避けウェーブ管理",
      action: "敵の序盤スキル威力を確認し、ミニオンの多い有利なタイミングでファーム。",
      win_trigger: "HPを維持して安定してLv3到達",
      badge: "安定 🛡️"
    },
    {
      phase: "Phase 2 (Lv3〜5)",
      title: "敵主要スキルのCD中にショートトレード",
      action: "敵がファームにスキルを使った瞬間を狙ってトレードを仕掛ける。",
      win_trigger: "敵のHPを削りリコール優位を奪う",
      badge: "好機 ⚔️"
    },
    {
      phase: "Phase 3 (Lv6〜)",
      title: "パワースパイクを活かしてレーン制覇",
      action: "自分の1stコア完成・Ult習得のタイミングでオールインまたはプレート破壊。",
      win_trigger: "タワー1stプレート獲得またはソロキル",
      badge: "勝利 👑"
    }
  ];

  return NextResponse.json({
    success: true,
    my_champion: myChamp,
    enemy_champion: enemyChamp,
    enemy_level: enemyLevel,
    kill_line: {
      total_lethal_damage: totalLethal,
      raw_burst_damage: Math.round(rawBurst),
      ignite_damage: igniteDmg,
      kill_hp_percent: killHpPercent,
      my_max_hp: myMaxHp,
      safe_hp_threshold: Math.max(0, Math.round(myMaxHp - totalLethal)),
      danger_badge: killHpPercent >= 50 ? "超危険 🔴" : (killHpPercent >= 40 ? "警戒 🟠" : "通常 🟡"),
      danger_color: killHpPercent >= 50 ? "#ef4444" : (killHpPercent >= 40 ? "#f97316" : "#eab308"),
      advice: `HP ${killHpPercent}% (${totalLethal}以下) で敵のLv${enemyLevel}フルコンボ即死圏内。`
    },
    blueprint: {
      phases
    }
  });
}
