import { NextResponse } from 'next/server';

export async function GET() {
  // モックおよび最新試合の集団戦ディープアナリティクスデータ
  const sampleFights = [
    {
      fight_id: 1,
      time_str: "08:30",
      title: "08:30 ヴォイドグラブ争奪戦",
      result: "VICTORY",
      result_badge: "大勝利 🟢",
      ally_kills: 2,
      enemy_kills: 0,
      objectives: ["Voidgrub x3"],
      my_damage_dealt: 1450,
      gold_swing: 850,
      summary: "⚔️ 【ヴォイドグラブ獲得大勝利】 敵TOP・JGの連携ミスを突いて2キルを獲得し、グラブ全取得。",
      key_factor: "敵ダリウスの主要スキル空振りに合わせた即時オールインが決定打となりました。",
      feedback: "🔥 Aatrox の活躍: 1,450 dmg (前線制圧により敵JGの接近を完全ブロック)"
    },
    {
      fight_id: 2,
      time_str: "15:20",
      title: "15:20 第2回ドラゴン前集団戦",
      result: "VICTORY",
      result_badge: "大勝利 🟢",
      ally_kills: 3,
      enemy_kills: 1,
      objectives: ["Chemtech Dragon"],
      my_damage_dealt: 2380,
      gold_swing: 1200,
      summary: "🐉 【ドラゴン獲得勝利】 敵の隙を突き、ドラゴンと3キルを両取り。チーム全体に強力な永続バフを付与。",
      key_factor: "敵キャリー(KaiSa)へのフォーカスが統率され、反撃を許さずに各個撃破しました。",
      feedback: "🔥 Aatrox の活躍: 2,380 dmg (集団戦での最大ダメージ貢献を記録)"
    },
    {
      fight_id: 3,
      time_str: "22:40",
      title: "22:40 バロンピット前集団戦",
      result: "DEFEAT",
      result_badge: "惜敗 🔴",
      ally_kills: 1,
      enemy_kills: 3,
      objectives: ["Baron (Enemy)"],
      my_damage_dealt: 1890,
      gold_swing: -1800,
      summary: "⚠️ 【バロン戦惜敗】 バロンピット周辺で敵に挟撃され、バロンを奪取されました。",
      key_factor: "視界確保が不十分な状態でのバロン突入が原因。敵Zedのフランク（側面奇襲）を許しました。",
      feedback: "💡 改善ポイント: オブジェクト前はピンクワードで裏ルートの視界を確保してからコールしましょう。"
    },
    {
      fight_id: 4,
      time_str: "28:15",
      title: "28:15 MIDインヒビター攻防戦",
      result: "VICTORY",
      result_badge: "決定的勝利 👑",
      ally_kills: 4,
      enemy_kills: 0,
      objectives: ["Mid Inhibitor", "Nexus Tower x2"],
      my_damage_dealt: 3120,
      gold_swing: 2500,
      summary: "👑 【エンドゲーム大勝利】 敵の無理なエンゲージを返り討ちにし、4キルから一気に試合を決着。",
      key_factor: "重傷と物理貫通（黒斧）の完成により、敵前衛を秒速で溶かすことに成功しました。",
      feedback: "🏆 MVP級の活躍: 3,120 dmg (圧倒的な耐久と範囲火力でゲームセット)"
    }
  ];

  return NextResponse.json({
    success: true,
    champion: "Aatrox",
    match_duration: "29:40",
    total_fights: sampleFights.length,
    victory_fights: 3,
    defeat_fights: 1,
    total_fight_damage: 8840,
    fights: sampleFights
  });
}
