/**
 * 師弟マッチング共通定数
 */

// 期間設定
export const MENTORSHIP_DURATIONS: Record<string, { label: string; shortLabel: string; days: number; isLight?: boolean; badgeColor?: string }> = {
  '1_MATCH': {
    label: '🎮 1試合だけカスタム対面練習（1回完結）',
    shortLabel: '🎮 1試合カスタム',
    days: 1,
    isLight: true,
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
  },
  'REPLAY': {
    label: '📺 1試合リプレイ添削（1回完結）',
    shortLabel: '📺 リプレイ添削',
    days: 1,
    isLight: true,
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
  },
  '3_DAYS': {
    label: '☕ 3日間お試しバディ（3日）',
    shortLabel: '☕ 3日間お試し',
    days: 3,
    isLight: true,
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  '7_DAYS': {
    label: '⏱️ 1週間集中コース（7日）',
    shortLabel: '⏱️ 1週間集中',
    days: 7,
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
  },
  '14_DAYS': {
    label: '🔥 2週間育成コース（14日・推奨）',
    shortLabel: '🔥 2週間育成',
    days: 14,
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
  },
  '30_DAYS': {
    label: '🏆 1ヶ月ガチ特訓コース（30日）',
    shortLabel: '🏆 1ヶ月特訓',
    days: 30,
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
  },
  'INDEFINITE': {
    label: '♾️ 目標達成まで（期限なし）',
    shortLabel: '♾️ 期限なし',
    days: 90,
    badgeColor: 'bg-stone-100 text-stone-900 border-stone-300',
  },
};


// 🎙️ 通話・コミュニケーションスタイル
export const COMMUNICATION_STYLES: Record<string, { label: string; icon: string; desc: string }> = {
  'VC_ACTIVE': {
    label: '🎙️ VC通話歓迎',
    icon: '🎙️',
    desc: '通話しながらリアルタイム指導・プレイ可能',
  },
  'VC_LISTEN_ONLY': {
    label: '🎧 聞き専OK',
    icon: '🎧',
    desc: '師匠が通話で喋り、弟子はチャットで返答',
  },
  'TEXT_ONLY': {
    label: '💬 テキスト添削のみ',
    icon: '💬',
    desc: '画面共有・リプレイ動画のテキスト添削中心',
  },
};

// 🍃 円満解散の理由選択肢
export const DISBAND_REASONS = [
  '🗓️ スケジュール・活動時間の都合',
  '🎯 今回のテーマの練習が一通り完了した',
  '🔄 別のテーマやチャンプに挑戦するため',
  '🌱 気軽にリセット（お互いに合意済み）',
  '✍️ その他',
];

// 🚀 キックオフ3ステップ
export const KICKOFF_STEPS = [
  {
    step: 1,
    title: 'Discordで挨拶 ＆ OP.GG共有',
    desc: 'ペアが成立したら、まずはDiscordで挨拶を交わし、普段使っているOP.GGや得意チャンピオンの情報を共有しましょう！',
    actionText: '挨拶テンプレをコピー',
  },
  {
    step: 2,
    title: '今回のゴールを1つだけ決める',
    desc: '「10分CS 70を目指す」「集団戦の立ち位置を覚える」「特定チャンプのコンボ」など、達成したい明確な目標を1つに絞ります。',
    actionText: '目標の例を見る',
  },
  {
    step: 3,
    title: 'まずはノーマル1戦 or カスタムで動作確認',
    desc: 'いきなりランク戦には行かず、ノーマルや定期カスタムで気軽に一緒にプレイしながら雰囲気を掴みましょう！',
    actionText: 'カスタム・ノーマルへGO',
  },
];

// 📜 師弟の心得・ガイドライン
export const MENTORSHIP_GUIDELINES = {
  mentor: [
    '✨ 否定やダメ出しから入らず、「どこが良かったか」をまず褒める',
    '🎯 1試合に課題は1つだけ（一度にたくさんの情報を詰め込みすぎない）',
    '💡 「なぜそう動くのか」の理由を論理的・優しく伝える',
    '⏳ 弟子の成長スピードを尊重し、焦らせない',
  ],
  pupil: [
    '🤝 教えてもらったアドバイスや時間に対して感謝を伝える',
    '❓ 分からないこと・疑問点は遠慮せずその場で質問する',
    '📝 1つずつ意識して実践し、失敗しても落ち込まない',
    '💬 通話や返信が難しい時は無理せず伝える',
  ],
};

