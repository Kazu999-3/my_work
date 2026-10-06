// ============================================================
// KTM Bot: スラッシュコマンドの正解リスト（単一の情報源）
//
// 【なぜこのファイルがあるか】
// 2026-09-29の調査で、**リポジトリ上に説明文が存在するのは /portal の1つだけ**だと判明した。
// 残り8コマンドはアドホックに登録されており、Discord側に何が登録されているか
// リポジトリからは一切分からない状態だった（登録スクリプトは8個に散在し、うち5個は
// 99_ARCHIVE に眠っていた）。
// その結果:
//   - コマンド選択欄で最初に読まれる説明文の「正解」がどこにも無い
//   - 誰かが登録し直すたびに文言が散らばる
//   - 実装を消してもDiscord側の登録が残る（幽霊コマンド）ことに気づけない
//
// 【使い方】
// - 現状確認 : node 03_SYSTEMS/TOOLS/unregister_discord_commands.mjs --list
//              （実際にDiscordへ登録されている名前と説明文が一覧表示される）
// - 不要分の削除: 同スクリプトに --apply
// - このファイルは**定義のみ**。登録は行わない（外向きの操作なので実行はユーザー判断）。
//
// 【変更時の注意】
// - コマンドを増減したら `src/index.js` のディスパッチと
//   `03_SYSTEMS/TOOLS/unregister_discord_commands.mjs` の KEEP リストも揃えること。
// - 説明文はDiscordの仕様で **100文字以内**。日本語もそのまま1文字として数えられる。
// - エイリアス（同じ機能に複数の名前）は2026-09-29に廃止した。1機能1名称を維持する。
// ============================================================

/**
 * 現在有効な9コマンド。description は Discord のコマンド選択欄に表示される文章で、
 * 初見のメンバーが「何ができるのか」を判断する唯一の手がかりになる。
 * そのため「何が起きるか」を具体的に書く（例: 「戦績を見る」ではなく
 * 「自分の勝率・レーン別MMRを表示します」）。
 */
export const COMMAND_DEFINITIONS = [
  {
    name: 'portal',
    description: 'カスタムの募集と各種設定をまとめたパネルを開きます（まずはここから）',
  },
  {
    name: 'ign',
    description: 'Riot ID（名前#JP1）を登録・変更します。ランクが自動で同期されます',
  },
  {
    name: 'lane',
    description: '希望レーン・NGレーンを登録します。チーム分けに反映されます',
  },
  {
    name: 'recruit',
    description: 'カスタム・ノーマル・ARAMのメンバー募集を作成します',
  },
  {
    name: 'stats',
    description: '自分の勝率・レーン別MMR・よく当たる相手を表示します',
  },
  {
    name: 'ranking',
    description: 'カスタムのリーダーボード（最多勝・勝率・参加数）を表示します',
  },
  {
    name: 'coins',
    description: '自分のKTMコイン残高と、コインの貯め方を表示します',
  },
  {
    name: 'casino',
    description: 'コイン所持数の上位10名（長者番付）を表示します',
  },
  {
    name: 'tip',
    description: '他のメンバーにKTMコインを贈ります（送る相手と金額を指定）',
  },
  {
    name: 'roles',
    description: 'プレイスタイル・志向性ロール（ソロキュー中、練習中等）の付与パネルを表示します',
  },
  {
    name: 'welcome',
    description: '新メンバー向け利用案内（はじめの3ステップ・ルール・設定ボタン）を投稿します',
  },
];

/** Discordの制限: コマンド名は1〜32文字の小文字英数字とハイフン・アンダースコア */
const NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;
/** Discordの制限: description は1〜100文字 */
const DESCRIPTION_MAX = 100;

/**
 * 定義がDiscordの制約を満たしているかを検証する。
 * 登録スクリプトやテストから呼んで、登録前に弾けるようにしてある
 * （長すぎる説明文はDiscord側で 400 になり、原因が分かりにくい）。
 * @returns {string[]} 問題点の一覧（空配列なら問題なし）
 */
export function validateCommandDefinitions(defs = COMMAND_DEFINITIONS) {
  const problems = [];
  const seen = new Set();

  for (const d of defs) {
    if (!d || typeof d.name !== 'string') {
      problems.push(`name が文字列でない定義があります: ${JSON.stringify(d)}`);
      continue;
    }
    if (!NAME_PATTERN.test(d.name)) {
      problems.push(`/${d.name}: コマンド名はDiscordの制約（小文字英数字・ハイフン・_ / 1〜32文字）に違反しています`);
    }
    if (seen.has(d.name)) {
      problems.push(`/${d.name}: コマンド名が重複しています`);
    }
    seen.add(d.name);

    if (typeof d.description !== 'string' || d.description.length === 0) {
      problems.push(`/${d.name}: description が空です（コマンド選択欄で何も説明されません）`);
    } else if ([...d.description].length > DESCRIPTION_MAX) {
      problems.push(`/${d.name}: description が ${[...d.description].length} 文字で上限 ${DESCRIPTION_MAX} を超えています`);
    }
  }

  return problems;
}
