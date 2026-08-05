import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { resolveToRosterChampion } from '../../../../lib/dictFactCheck';

// お気に入りは管理者専用の辞典編集とは違い、閲覧できる人なら誰でも安全にトグルできる
// 個人の好み設定なので、あえて管理者セッションを要求しない（要求すると、管理者ログインしていない
// スマホ閲覧時にトグルがSupabaseへ届かず、PCとスマホでお気に入りが同期しない不具合になる）。
export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase環境変数が設定されていません。' }, { status: 500 });
    }
    const { champion: rawChampion, is_favorited } = await req.json();
    if (!rawChampion || typeof is_favorited !== 'boolean') {
      return NextResponse.json({ error: '必須パラメータが不足しています。' }, { status: 400 });
    }

    // 認証は要求しない設計(上記コメント参照)だが、championの実在チェック・正規化は
    // 他の全ての書き込み経路と統一済み(resolveToRosterChampion)なのにここだけ漏れて
    // おり、無検証の自由文字列でmatchup_sentinelにゴミ行(champ_<任意文字列>_global)を
    // 作成できてしまっていた(2026-08-05発覚)。UIは常に正規IDを渡すため通常操作では
    // 発現しないが、API自体は直叩き可能なため検証を追加する。
    const champion = await resolveToRosterChampion(rawChampion);
    if (!champion) {
      return NextResponse.json({ error: `「${rawChampion}」を実在チャンピオン名として認識できませんでした。` }, { status: 400 });
    }

    const matchup_id = `champ_${champion}_global`;

    const { data: existing } = await supabase
      .from('matchup_sentinel')
      .select('raw_data')
      .eq('matchup_id', matchup_id)
      .maybeSingle();

    const mergedRawData = { ...(existing?.raw_data || {}), is_favorited };

    if (existing) {
      // raw_dataだけを更新し、created_atには触れない。
      // (created_atは辞典一覧の「最終更新日」表示に使われる唯一の列で、お気に入りの
      //  トグルのような編集ではない操作でここを動かすと、実際は内容を更新していないのに
      //  「最新に更新された」と誤表示してしまう。)
      const { error } = await supabase
        .from('matchup_sentinel')
        .update({ raw_data: mergedRawData })
        .eq('matchup_id', matchup_id);
      if (error) throw error;
    } else {
      // まだ辞典データが無い(未着手)チャンピオンでも、お気に入りだけ先に登録できるようにする。
      const { error } = await supabase
        .from('matchup_sentinel')
        .insert({
          matchup_id,
          champion,
          enemy: 'GLOBAL',
          strategy: '',
          raw_data: mergedRawData,
          created_at: new Date().toISOString()
        });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('❌ [Favorite API] POST Error:', err);
    return NextResponse.json({ error: 'お気に入りの保存に失敗しました: ' + err.message }, { status: 500 });
  }
}
