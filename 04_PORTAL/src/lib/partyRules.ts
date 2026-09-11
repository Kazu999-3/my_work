import { supabaseAdmin as supabase } from './supabaseAdmin';

export interface PartyChaosRule {
  id: string;
  title: string;
  desc: string;
  tag: string;
  isCustom?: boolean;
  created_at?: string;
}

export const DEFAULT_PARTY_RULES: PartyChaosRule[] = [
  {
    id: "heartsteel",
    title: "💥 心鋼（ハートスチール）スタック王決定戦",
    desc: "全員1stコアに「ハートスチール」購入必須！集団戦でひたすら殴り合ってスタックを稼げ！",
    tag: "アイテム縛り",
  },
  {
    id: "offmeta",
    title: "🎭 オフメタ・魔改造ビルド戦",
    desc: "ADキャラはフルAPビルド、APメイジはフルAD/脅威ビルドで購入！普段見られない超火力を出せ！",
    tag: "ビルド縛り",
  },
  {
    id: "reverse_role",
    title: "🔄 ロール完全反転（Reverse Role）",
    desc: "普段のメインレーンは使用禁止！Top専がSup/ADC、Jg専がMidなど普段やらないロールを担当！",
    tag: "ロール縛り",
  },
  {
    id: "spell_unify",
    title: "⚡ サモスペ統一（ゴースト＋イグナイト）",
    desc: "フラッシュ禁止！全員「ゴースト ＋ イグナイト」で超アグレッシブに突撃せよ！",
    tag: "サモスペ縛り",
  },
  {
    id: "all_tank",
    title: "🛡️ オールタンク・筋肉プロレスマッチ",
    desc: "全員タンクまたはブルーザーのみ使用可能！死なない泥沼の集団戦を楽しめ！",
    tag: "キャラ縛り",
  },
  {
    id: "all_assassin",
    title: "🗡️ オールアサシン・一撃必殺ハイスピード戦",
    desc: "全員アサシンのみ使用可能！視界に入った瞬間にどちらかが消し飛ぶスリリングマッチ！",
    tag: "キャラ縛り",
  },
  {
    id: "nemesis",
    title: "😈 ネメシス・ドラフト（押し付け合い戦）",
    desc: "相手チームに使わせるチャンピオン5体を自分たちが指名！弱キャラの押し付け合い頭脳戦！",
    tag: "ドラフト縛り",
  },
  {
    id: "standard_aram",
    title: "🎲 スタンダード（縛りなし全力勝負）",
    desc: "特別ルールなし。ランダムチャンプと純粋な腕前で全力でぶつかり合おう！",
    tag: "通常ARAM",
  },
];

const SETTINGS_KEY = 'party_custom_rules';

/**
 * DBからお祭りカスタムルール一覧を取得（未設定ならデフォルトを初期登録して返す）
 */
export async function getPartyRules(): Promise<PartyChaosRule[]> {
  try {
    if (!supabase) return DEFAULT_PARTY_RULES;

    const { data, error } = await supabase
      .from('ktm_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.warn('[partyRules] getPartyRules error:', error);
      return DEFAULT_PARTY_RULES;
    }

    if (data && Array.isArray(data.value) && data.value.length > 0) {
      return data.value as PartyChaosRule[];
    }

    // 初回初期化
    await supabase
      .from('ktm_settings')
      .upsert({
        key: SETTINGS_KEY,
        value: DEFAULT_PARTY_RULES,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    return DEFAULT_PARTY_RULES;
  } catch (err) {
    console.error('[partyRules] Fetch failed:', err);
    return DEFAULT_PARTY_RULES;
  }
}

/**
 * DBにお祭りカスタムルール一覧を保存
 */
export async function savePartyRules(rules: PartyChaosRule[]): Promise<boolean> {
  try {
    if (!supabase) return false;

    const { error } = await supabase
      .from('ktm_settings')
      .upsert({
        key: SETTINGS_KEY,
        value: rules,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error('[partyRules] savePartyRules error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[partyRules] Save failed:', err);
    return false;
  }
}
