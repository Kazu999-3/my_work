import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const WORKSPACE_DIR = path.resolve(process.cwd(), '../');
const FEEDBACK_FILE_PATH = path.join(WORKSPACE_DIR, '02_FACTORY/note_analytics_feedback.json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// サーバーサイド用クライアント
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    // 1. AI分析フィードバックの読み込み
    let aiFeedback = {
      popular_keywords: ["デザイン自動生成", "Notion AI", "生産性向上"],
      recommended_tools: ["Canva", "Notion", "ChatGPT"],
      analysis: "まだ分析データが蓄積されていません。noteアクセス統計バッチが実行されると、Geminiによる自動分析結果がここに表示されます。"
    };

    if (fs.existsSync(FEEDBACK_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(FEEDBACK_FILE_PATH, 'utf-8');
        aiFeedback = JSON.parse(fileContent);
      } catch (e) {
        console.error('⚠️ [Affiliate Analytics API] AI Feedback Parse Error:', e);
      }
    }

    // 2. Supabase からPV履歴の取得
    let pvHistory: any[] = [];
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const { data, error } = await supabase
          .from('note_pv_history')
          .select('*')
          .order('recorded_date', { ascending: false })
          .order('pv', { ascending: false })
          .limit(100);

        if (error) {
          console.warn('⚠️ [Affiliate Analytics API] Supabase Query Warning:', error.message);
        } else if (data) {
          pvHistory = data;
        }
      } catch (e: any) {
        console.error('❌ [Affiliate Analytics API] Supabase Connection Error:', e.message);
      }
    }

    // もしDBからデータが取れなかった場合は、ダミーデータを付与してUI確認を可能にする
    if (pvHistory.length === 0) {
      pvHistory = [
        { id: 1, note_id: "dummy_1", title: "【決定版】Canva AI超活用術：初心者でもデザイナー級のバナーを一瞬で作る魔法のプロンプト", pv: 154, likes: 18, comments: 2, recorded_date: new Date().toISOString().split('T')[0] },
        { id: 2, note_id: "dummy_2", title: "【生産性爆上げ】Notion AIを仕事の相棒にする方法：明日から使えるテンプレート5選", pv: 98, likes: 11, comments: 0, recorded_date: new Date().toISOString().split('T')[0] },
        { id: 3, note_id: "dummy_3", title: "【エンジニア必見】ChatGPTを活用したコード自動生成とレビューの最適解", pv: 72, likes: 5, comments: 1, recorded_date: new Date().toISOString().split('T')[0] }
      ];
    }

    return NextResponse.json({
      aiFeedback,
      pvHistory
    });
  } catch (err: any) {
    console.error('❌ [Affiliate Analytics API] GET Error:', err);
    return NextResponse.json({ error: '分析データの取得に失敗しました。' }, { status: 500 });
  }
}
