import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '../../../../../lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
  // ===== 管理者セッション確認 =====
  const authResult = await verifyAdminSession(req);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  // =================================
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase環境変数が設定されていません。' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    const { matchup_id, champion, enemy, strategy, raw_data } = body;

    if (!matchup_id || !champion || !enemy) {
      return NextResponse.json({ error: '必須パラメータが不足しています。' }, { status: 400 });
    }

    // 容量削減対策①：note_draftをSupabase Storageへ退避させる
    let updatedRawData = { ...(raw_data || {}) };
    if (updatedRawData.note_draft) {
      try {
        const draftContent = updatedRawData.note_draft;
        const fileName = `${champion}_draft.txt`;
        
        // drafts バケットへアップロード（upsert: true で上書き）
        const { error: uploadError } = await supabase
          .storage
          .from('drafts')
          .upload(fileName, draftContent, {
            contentType: 'text/plain; charset=utf-8',
            upsert: true
          });

        if (uploadError) {
          console.error('❌ [Champion Save API] Storage Upload Error:', uploadError);
        } else {
          // アップロード成功時、URLを記録して、元データは削除して容量を節約
          const { data: urlData } = supabase
            .storage
            .from('drafts')
            .getPublicUrl(fileName);
            
          updatedRawData.note_draft_url = urlData?.publicUrl || `/storage/v1/object/public/drafts/${fileName}`;
          delete updatedRawData.note_draft;
        }
      } catch (uploadErr) {
        console.error('❌ [Champion Save API] Storage Process Exception:', uploadErr);
      }
    }

    const data = {
      matchup_id,
      champion,
      enemy,
      strategy: strategy || '',
      raw_data: updatedRawData,
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('matchup_sentinel')
      .upsert(data, { onConflict: 'matchup_id' })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'チャンピオン辞典を安全に更新しました。',
      data: result
    });

  } catch (err: any) {
    console.error('❌ [Champion Save API] POST Error:', err);
    return NextResponse.json({ error: 'チャンピオン辞典の保存に失敗しました: ' + err.message }, { status: 500 });
  }
}
