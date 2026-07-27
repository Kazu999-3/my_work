import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// お気に入りは管理者専用の辞典編集とは違い、閲覧できる人なら誰でも安全にトグルできる
// 個人の好み設定なので、あえて管理者セッションを要求しない（要求すると、管理者ログインしていない
// スマホ閲覧時にトグルがSupabaseへ届かず、PCとスマホでお気に入りが同期しない不具合になる）。
export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase環境変数が設定されていません。' }, { status: 500 });
    }
    const { champion, is_favorited } = await req.json();
    if (!champion || typeof is_favorited !== 'boolean') {
      return NextResponse.json({ error: '必須パラメータが不足しています。' }, { status: 400 });
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
