import { NextResponse } from 'next/server';

export async function GET() {
  const cs_timeline = [
    { minute: 1, cs: 0, benchmark: 0 },
    { minute: 3, cs: 18, benchmark: 20 },
    { minute: 5, cs: 36, benchmark: 38 },
    { minute: 7, cs: 54, benchmark: 55 },
    { minute: 9, cs: 68, benchmark: 72 },
    { minute: 11, cs: 85, benchmark: 88 },
    { minute: 13, cs: 102, benchmark: 104 },
    { minute: 15, cs: 118, benchmark: 120 },
  ];

  const recall_events = [
    {
      time_str: "05:20",
      gold_at_recall: 1150,
      bought_items: ["プレート スチールキャップ"],
      wave_state: "敵タワーへ完全プッシュ",
      loss_cs: 0,
      loss_gold: 0,
      evaluation: "理想的リコール 🟢",
      detail: "ウェーブを押し切ってからの帰還により、ミニオン損失0で靴完成。"
    },
    {
      time_str: "11:45",
      gold_at_recall: 880,
      bought_items: ["処刑人の劫罰", "コントロールワード"],
      wave_state: "リバー中央（やや不利）",
      loss_cs: 3,
      loss_gold: 65,
      evaluation: "許容範囲 🟡",
      detail: "敵ダリウスのHPを削ってリコール強要後の帰還。微小なロスで重傷確保。"
    },
    {
      time_str: "18:30",
      gold_at_recall: 1300,
      bought_items: ["ファージ", "ルビークリスタル"],
      wave_state: "自タワー前フリーズ",
      loss_cs: 0,
      loss_gold: 0,
      evaluation: "テンポ獲得 🟢",
      detail: "ドラゴン獲得直後の安全帰還。次ウェーブに完璧に間に合う。"
    }
  ];

  const build_audit = {
    score: 95,
    grade: "S",
    summary: "敵の回復構成（Darius/Soraka）に対し、11分で処刑人の劫罰（重傷）を的確に導入！",
    items_audited: [
      {
        item_name: "プレート スチールキャップ",
        timing: "05:20 (1stリコール)",
        audit: "満点 👑",
        reason: "敵対面DariusのAA/Q物理ダメージを序盤から12%カットし、レーン主導権を確立。"
      },
      {
        item_name: "処刑人の劫罰",
        timing: "11:45 (2ndリコール)",
        audit: "適格 🟢",
        reason: "ダリウスQ外周の回復および敵ソラカの集団戦ヒールを50%阻害（推定3,200HP分の回復をカット）。"
      },
      {
        item_name: "ブラック・クリーバー (黒斧)",
        timing: "22:10 (完成)",
        audit: "最適解 🟢",
        reason: "敵前衛の物理防御（AR）を削り、集団戦のバースト火力を最大化。"
      }
    ]
  };

  const timing_scaling = [
    { phase: "序盤 (〜20分)", win_rate: 62, impact: "高い (レーン有利確立)", status: "好調 🟢" },
    { phase: "中盤 (20〜28分)", win_rate: 74, impact: "最大パワースパイク (黒斧+ステラック完成)", status: "最強 👑" },
    { phase: "終盤 (28分〜)", win_rate: 48, impact: "やや低下 (敵ADCのフルビルド化)", status: "警戒 🟡" },
  ];

  const radar_metrics = [
    { subject: "レーン戦火力", my_score: 92, target_score: 85, diff: "+7", status: "ダイヤ級 🟢" },
    { subject: "CSペース (15分)", my_score: 88, target_score: 90, diff: "-2", status: "ほぼ同等 🟡" },
    { subject: "視界スコア", my_score: 65, target_score: 82, diff: "-17", status: "要改善 🔴" },
    { subject: "被ソロキル回避", my_score: 90, target_score: 85, diff: "+5", status: "ダイヤ級 🟢" },
    { subject: "集団戦貢献度", my_score: 86, target_score: 80, diff: "+6", status: "ダイヤ級 🟢" },
    { subject: "オブジェクト関与", my_score: 80, target_score: 85, diff: "-5", status: "プラチナ級 🟡" },
  ];

  return NextResponse.json({
    success: true,
    my_champion: "Aatrox",
    enemy_champion: "Darius",
    match_duration_str: "29:40",
    kda_str: "7/2/8",
    early_game_metrics: {
      cs_timeline,
      cs_at_15: 118,
      cs_per_min_at_15: 7.87,
      trade_ratio: 1.36,
      gold_diff_at_15: 650,
      lane_result: "レーン大勝利 🟢"
    },
    recall_efficiency: {
      events: recall_events,
      total_loss_gold: 65,
      rating: "テンポ維持率 95% (極めて優秀)"
    },
    build_audit,
    timing_scaling,
    radar_metrics,
    biggest_bottleneck: {
      metric: "視界スコア (コントロールワード設置数)",
      advice: "視界スコアがダイヤ平均（82pt）に対し65pt。2ndリコール以降、常にピンクワードを1本所持して川の視界を確保しましょう！"
    }
  });
}
