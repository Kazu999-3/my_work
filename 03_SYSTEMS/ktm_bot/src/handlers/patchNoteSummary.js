// ============================================================
// KTM Bot: パッチノート超要約 ＆ メタ討論機能 (/patch)
// ============================================================

import { CONFIG } from '../config.js';

// ⚠️ 2026-09-29 是正: ここは「最新パッチのメタ要約」と称して**完全な手入力データ**を
// 事実として配信していた。`patch: '26.17'` は実在しないバージョンで、DataDragonの実測値は
// 16.19.1 だった（2026-09-29確認）。メンバーは存在しないパッチのバフ/ナーフ一覧を見て
// ピックを決めていた可能性がある。
// 2026-09-22に36件一掃した「実データに見せかけた手入力」と同型だが、あの監査は
// ポータルAPI・UI/lib・Python の3領域が対象で**Botは範囲外**だったため残っていた。
//
// 現在の方針（プロジェクトの確立ルール ①実データのみ ②無ければ空 ③正直に表示
// ④静的なものは手入力と明示し由来を偽らない）:
//   - パッチ番号は **DataDragon から実取得**する（唯一の確定情報）
//   - 下記の手入力メモは `MANUAL_META_NOTES` へ改名し、対象パッチと最終更新日を持たせる
//   - 実パッチと手入力メモの対象が食い違う場合は**画面上で古い旨を明示**する

/** 手入力のメタ所感。実データではないので、由来と鮮度を必ず併記して表示する。 */
export const MANUAL_META_NOTES = {
  /** このメモがどのパッチを前提に書かれたか（DataDragonの実値と突き合わせる） */
  writtenForPatch: '16.17',
  updatedAt: '2026-09',
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

/** DataDragon から現行パッチを実取得する。失敗時は null（推測値で埋めない）。 */
export async function fetchLivePatchVersion() {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const versions = await res.json();
    return Array.isArray(versions) && versions.length > 0 ? versions[0] : null;
  } catch (e) {
    console.warn('[patch] DataDragonのバージョン取得に失敗:', e?.message);
    return null;
  }
}

/**
 * パッチ情報Embedを生成。
 * @param {string|null} livePatch DataDragonから実取得した現行バージョン（取得失敗時はnull）
 * @param {object} notes 手入力のメタ所感
 */
export function generatePatchSummaryEmbed(livePatch, notes = MANUAL_META_NOTES) {
  // 実データが取れなかったら、取れなかったと正直に書く（それらしい番号で埋めない）
  const patchLabel = livePatch || '取得できませんでした';
  // 手入力メモが現行パッチ向けに書かれているか
  const isStale = !!livePatch && notes.writtenForPatch !== livePatch;

  const staleWarning = isStale
    ? `\n\n⚠️ **下のメタ所感は パッチ ${notes.writtenForPatch} 時点の手入力メモです（現行は ${livePatch}）。内容が古い可能性があります。**`
    : '';

  const fields = [
    {
      name: '📌 現行パッチ（DataDragon 実取得）',
      value: livePatch
        ? `**${livePatch}**`
        : '取得に失敗しました。時間をおいて再度お試しください。',
      inline: false
    },
    {
      name: `📝 メタ所感（手入力メモ / ${notes.writtenForPatch} 時点・${notes.updatedAt} 更新）`,
      value: notes.highlights.map((h) => `▫ ${h}`).join('\n\n').slice(0, 1024),
      inline: false
    },
    {
      name: '🟢 強化されたと思われるチャンプ（手入力）',
      value: notes.buffs.map((b) => `+ ${b}`).join('\n') || 'なし',
      inline: true
    },
    {
      name: '🔴 弱体化されたと思われるチャンプ（手入力）',
      value: notes.nerfs.map((n) => `- ${n}`).join('\n') || 'なし',
      inline: true
    },
    {
      name: '⚔️ 注目アイテム（手入力）',
      value: notes.opItems.map((item) => `★ ${item}`).join('\n') || 'なし',
      inline: false
    },
    {
      name: '🗣️ メタ討論トピック',
      value: notes.discussionPrompt,
      inline: false
    }
  ];

  return {
    title: `📜 LoL パッチ情報 ＆ メタ討論`,
    description:
      `現行パッチ番号は Riot の DataDragon から取得した実データです。` +
      `\nバフ・ナーフ等の所感は**このコミュニティの手入力メモ**で、公式パッチノートではありません。` +
      `\n\n👉 公式パッチノート: https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes/` +
      staleWarning,
    color: isStale ? 0xc2650f : 0x3498db,
    fields,
    footer: { text: `KTM Sovereign OS | パッチ番号=実データ / メタ所感=手入力` },
    timestamp: new Date().toISOString()
  };
}

/**
 * スラッシュコマンド /patch のハンドラー
 *
 * DataDragonへの実リクエストを伴うため、Discordの3秒制限に引っかからないよう
 * type:5（処理中）で先にACKし、取得後に本文を差し替える（ranking.js と同じ方式）。
 */
export async function handlePatchCommand(interaction, env, ctx) {
  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil((async () => {
    const { patchInteractionResponse } = await import('../utils/api.js');
    try {
      const livePatch = await fetchLivePatchVersion();
      const embed = generatePatchSummaryEmbed(livePatch);
      const components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              label: '🌐 Webポータルで全チャンプ辞典を見る',
              style: 5,
              url: `${CONFIG.PORTAL_URL}/champions`
            },
            {
              type: 2,
              label: '🎲 ルーレットで遊ぶ',
              style: 2,
              custom_id: 'portal_roulette'
            }
          ]
        }
      ];
      await patchInteractionResponse(appId, token, { embeds: [embed], components });
    } catch (err) {
      console.error('handlePatchCommand error:', err);
      const { notifyAdminError } = await import('../utils/alert.js');
      await notifyAdminError(env, err, { command: 'patch' });
      await patchInteractionResponse(appId, token, {
        content: '⚠️ パッチ情報の取得に失敗しました。時間をおいて再度お試しください。'
      });
    }
  })());

  // 処理中応答 (type 5)
  return Response.json({ type: 5 });
}
