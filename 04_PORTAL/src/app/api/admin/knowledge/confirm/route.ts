import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../../lib/supabaseAdmin';
import { verifyAdminSession } from '../../../../../lib/adminAuth';
import { resolveToRosterChampion, getNoChampionMarker } from '../../../../../lib/dictFactCheck';

// ============================================================
// POST: knowledge/add(AI解析のみ)のプレビューを、管理者の確認・編集後に実際へ保存する。
// 2026-08-15、「記事のどこがチャンピオン辞典に保存されるかプレビュー画面を挟みたい」との
// 要望により、旧knowledge/add/route.tsの保存処理をここへ分離した。
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminSession(req);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await req.json();
    const {
      title, summary, rawContent, url, genre, tags, champion, authorKey, atomicInsights,
    } = body || {};

    if (!title || !summary) {
      return NextResponse.json({ error: 'title/summaryが必要です。' }, { status: 400 });
    }

    // プレビュー画面でチャンピオンを編集した場合も、表記ゆれ・誤字がそのままDBに混入しない
    // よう改めて正規化する(knowledge/add側で一度解決済みの値が渡ってくるのが通常だが、
    // 管理者が手で書き換えた場合を考慮)。
    const resolvedChampion = champion ? await resolveToRosterChampion(champion) : null;

    const { data, error } = await supabase
      .from('personal_knowledge')
      .insert([{
        title,
        content: summary,
        raw_content: String(rawContent || '').slice(0, 15000),
        source_url: url || '',
        genre: genre || 'その他',
        tags: Array.isArray(tags) ? tags : [],
        champion: resolvedChampion || getNoChampionMarker('personal_knowledge'),
        author: authorKey || null,
      }])
      .select()
      .single();

    if (error) throw error;

    // 原子的な知見(Zettelkasten方式)を、元記事(container)の子レコードとして分割保存する。
    // 「1ノート1アイデア」に反する巨大な塊のまま辞典生成プロンプトへ渡ってノイズが増える
    // 問題を避けるため、独立して再利用できる知見だけを短く切り出す(2026-08-12)。
    //
    // 記事全体のchampion欄だけで振り分けると、「ミッドAhri」のようにチャンピオン固有の話と
    // レーン一般論が混在する記事は、champion欄がAhriである以上レーン一般論も丸ごとAhriの
    // 辞典生成プロンプトへ流れ込み、レーン別ガイド側には一切反映されない片方向バイアスが
    // あった(2026-08-15発覚)。atomic insight単位でscopeを判定し、"lane_general"のものは
    // champion欄を空にしてpersonal_knowledgeへ保存する。これによりfetch_personal_knowledge
    // (champion列一致検索)からは自然に外れてチャンピオン辞典生成には混ざらなくなる一方、
    // レーンガイドへの統合はAIが自動実行せず、既存の「レーン別ガイドへ一括統合」admin操作
    // (人間が実行ボタンを押すまで動かない)に委ねる。
    //
    // チャンピオン固有側の分割も含め「分割そのもの」をAIに丸ごと任せず、全atomic insightを
    // review_status='pending'で保存する(2026-08-15、ユーザー要望)。pending中は
    // fetch_personal_knowledge(champion_trend_worker.py)のクエリからもレーンガイド
    // 一括統合の対象クエリからも除外され、/admin/knowledgeの「未承認の分割知見」パネルで
    // 人間が承認するまで一切使われない。
    const insights = Array.isArray(atomicInsights) ? atomicInsights.slice(0, 5) : [];
    const laneGeneralCount = insights.filter((i: any) => i.scope === 'lane_general').length;

    if (insights.length > 0) {
      const { error: atomicError } = await supabase
        .from('personal_knowledge')
        .insert(
          insights.map((insight: any) => ({
            title: insight.title,
            content: insight.summary,
            raw_content: insight.summary,
            source_url: url || '',
            genre: genre || 'その他',
            tags: Array.isArray(insight.tags) ? insight.tags : [],
            champion: insight.scope === 'lane_general'
              ? getNoChampionMarker('personal_knowledge')
              : (resolvedChampion || getNoChampionMarker('personal_knowledge')),
            author: authorKey || null,
            parent_id: data.id,
            is_atomic: true,
            review_status: 'pending',
          }))
        );
      if (atomicError) console.error('❌ [Knowledge Confirm API] 原子的な知見の保存に失敗:', atomicError);
    }

    // 同じ投稿者(X/note)の既存記事があれば、後から気づけるようここで一緒に返す。
    let relatedByAuthor: { id: number; title: string; source_url: string | null; created_at: string }[] = [];
    if (authorKey) {
      const { data: related } = await supabase
        .from('personal_knowledge')
        .select('id, title, source_url, created_at')
        .eq('author', authorKey)
        .neq('id', data.id)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(10);
      relatedByAuthor = related || [];
    }

    return NextResponse.json({
      success: true,
      message: `ナレッジ「${title}」を登録しました。`,
      relatedByAuthor,
      atomicInsightCount: insights.length - laneGeneralCount,
      laneGeneralPendingCount: laneGeneralCount,
      data,
    });

  } catch (err: any) {
    console.error('❌ [Knowledge Confirm API] POST Error:', err);
    return NextResponse.json({ error: err.message || 'ナレッジの保存に失敗しました。' }, { status: 500 });
  }
}
