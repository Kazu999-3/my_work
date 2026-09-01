// ============================================================
// KTM Bot: パッチノート超要約 ＆ メタ討論機能 (/patch)
// ============================================================

import { CONFIG } from '../config.js';

// 最新パッチのメタ要約データ (パッチごとに定期更新またはDDragon連携)
export const LATEST_PATCH_INFO = {
  patch: '26.17',
  title: '🔥 パッチ 26.17 超要約 ＆ メタ激変ポイント',
  date: '2026年9月',
  highlights: [
    '🌲 **JGメタの変化**: 序盤スノーボール型JG（リー・シン、エリス）のガンク圧力が上昇。ファーム型JGは6分前のグラブ戦に備える必要あり。',
    '🛡️ **TOPタンク強化**: オーン、サイオンの基礎ステータスが上方修正され、集団戦エンゲージ構成が復権。',
    '🏹 **ADC・ボットレーン**: クリティカルアイテムのコスト見直しにより、2コア完成時のパワースパイクが約1分前倒しに。',
    '🧙 **MIDローム環境**: アカリ、ルブランなどのローム型アサシンがボットへの影響力を出しやすい環境に。'
  ],
  buffs: ['オーン (Top)', 'サイオン (Top)', 'ジンクス (ADC)', 'リー・シン (JG)', 'ルル (SUP)'],
  nerfs: ['カ・サンテ (Top)', 'ヴィエゴ (JG)', 'シンドラ (Mid)', 'ヴァルス (ADC)'],
  opItems: ['インフィニティ・エッジ', '心の鋼', 'ナイト ハーベスター'],
  discussionPrompt: '💬 **今パッチの注目チャンプやおすすめビルド、強いと思うJGルートをこのスレッドで語り合おう！**'
};

/**
 * パッチノート要約Embedを生成
 */
export function generatePatchSummaryEmbed(info = LATEST_PATCH_INFO) {
  return {
    title: `📜 【パッチ ${info.patch}】超要約 ＆ メタ討論`,
    description: `LoL最新パッチ **${info.patch}** の要点まとめです！\nカスタムマッチやソロQのピック・BANにお役立てください。\n\n${info.highlights.map(h => `▫ ${h}`).join('\n\n')}`,
    color: 0x3498db, // ブルー
    fields: [
      {
        name: "🟢 主な強化 (Buffs)",
        value: info.buffs.map(b => `+ ${b}`).join('\n') || "なし",
        inline: true
      },
      {
        name: "🔴 主な弱体化 (Nerfs)",
        value: info.nerfs.map(n => `- ${n}`).join('\n') || "なし",
        inline: true
      },
      {
        name: "⚔️ 注目アイテム・システム変更",
        value: info.opItems.map(item => `★ ${item}`).join('\n') || "なし",
        inline: false
      },
      {
        name: "🗣️ メタ討論トピック",
        value: info.discussionPrompt,
        inline: false
      }
    ],
    footer: { text: `KTM Sovereign OS | パッチメタ速報 (${info.date})` },
    timestamp: new Date().toISOString()
  };
}

/**
 * スラッシュコマンド /patch のハンドラー
 */
export async function handlePatchCommand(interaction, env, ctx) {
  const embed = generatePatchSummaryEmbed();
  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          label: "🌐 Webポータルで全チャンプ辞典を見る",
          style: 5,
          url: `${CONFIG.PORTAL_URL}/champions`
        },
        {
          type: 2,
          label: "🎲 ルーレットで遊ぶ",
          style: 2,
          custom_id: "portal_roulette"
        }
      ]
    }
  ];

  return Response.json({
    type: 4,
    data: {
      embeds: [embed],
      components
    }
  });
}
