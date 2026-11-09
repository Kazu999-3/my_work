import { supabaseAdmin as supabase } from './supabaseAdmin';

export interface SundayFestivalTheme {
  id: string;
  title: string;
  description: string;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_SUNDAY_THEMES: SundayFestivalTheme[] = [
  {
    id: "undecided",
    title: "🎪 未定（当日集まったメンバーで決定！）",
    description: "集まったメンバーの希望を聞きながら、ランダム縛りや特殊ルールなどをワイワイ決めます！初心者大歓迎✨",
  },
  {
    id: "random_debuff",
    title: "🎲 完全ランダム編成 ＆ 対面レート差デバフ縛りルーレット！",
    description: "闇鍋ランダムチーム分け！格上プレイヤーにのみ面白いハンデ縛りが課されるレート差解消マッチ！",
  },
  {
    id: "tournament_draft",
    title: "⚔️ 大会式 5v5 ドラフトピック戦（お祭りプール限定）",
    description: "公式大会のピック順（B1-R2-B2...）でお祭り縛りプールからチームピック！",
  },
  {
    id: "cross_pick",
    title: "🎭 相手のピック決め合いカスタム（対面ドラフト）",
    description: "対面の相手に使わせるチャンピオンをお互いに指定！苦手チャンプや意外な強ピックの押し付け合い！",
  },
  {
    id: "heartsteel",
    title: "💥 心鋼（ハートスチール）スタック王決定戦",
    description: "全員1stコアに「ハートスチール」購入必須！集団戦でひたすら殴り合ってスタックを稼げ！",
  },
  {
    id: "aram_mayhem",
    title: "❄️ オールランダム ARAM ＆ メイヘム自由戦",
    description: "ハウリングアビスで大乱闘！勝敗気にせずスキルを撃ちまくろう！",
  },
  {
    id: "custom",
    title: "✏️ 自由入力（今週の特別ルール）",
    description: "主催者が考案した特別なルールでお祭りカスタムを開催！",
  },
];

const SETTINGS_KEY = 'sunday_festival_theme';

export async function getSundayFestivalTheme(): Promise<SundayFestivalTheme> {
  try {
    if (!supabase) return DEFAULT_SUNDAY_THEMES[0];

    const { data, error } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.warn('[sundayFestivalTheme] fetch error:', error);
      return DEFAULT_SUNDAY_THEMES[0];
    }

    if (data && data.value && typeof data.value === 'object' && (data.value as any).title) {
      return data.value as SundayFestivalTheme;
    }

    return DEFAULT_SUNDAY_THEMES[0];
  } catch (err) {
    console.error('[sundayFestivalTheme] get failed:', err);
    return DEFAULT_SUNDAY_THEMES[0];
  }
}

export async function saveSundayFestivalTheme(theme: SundayFestivalTheme): Promise<boolean> {
  try {
    if (!supabase) return false;

    const { error } = await supabase
      .from('ktm_settings')
      .upsert({
        key: SETTINGS_KEY,
        value: {
          ...theme,
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error('[sundayFestivalTheme] save error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[sundayFestivalTheme] save failed:', err);
    return false;
  }
}
