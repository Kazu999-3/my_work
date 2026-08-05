import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { createSessionToken, ADMIN_SESSION_COOKIE } from '../../../../lib/adminSession';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';

// 単純な password !== adminPassword は文字列比較の早期リターンにより理論上タイミング
// 攻撃(処理時間差からパスワードを1文字ずつ推測)の対象になりうる。署名検証側
// (lib/adminSession.ts)は既にtimingSafeEqualを使っているのと対照的だった(2026-08-05発覚)。
// SHA-256ダイジェスト同士を比較することで長さも揃い、定数時間比較になる。
function safeEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json(
        { success: false, error: 'サーバー設定エラー: ADMIN_PASSWORDが設定されていません。' },
        { status: 500 }
      );
    }

    // ブルートフォース対策: IPごとに直近15分の失敗回数を数え、上限を超えたら
    // パスワードの正誤に関わらず拒否する(2026-08-05発覚: 試行回数の制限が無かった)。
    // x-forwarded-forの先頭要素はクライアントが自由に送信できる値であり、Vercelは
    // 自身が観測した実IPをチェーンの末尾に追記する。先頭を採用すると、攻撃者が
    // 毎回異なる偽IPを先頭に付けるだけでこのロックアウトを回避できてしまっていた
    // (2026-08-05再発覚)。Vercelが上書き設定する(クライアントから偽装不可能な)
    // x-real-ipを優先し、無い場合のみx-forwarded-forの末尾(=Vercelが追記した値)を使う。
    const xffChain = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ip = req.headers.get('x-real-ip') || xffChain[xffChain.length - 1] || 'unknown';
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count: recentFailures } = await supabase
      .from('edge_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('task_type', 'login_failure')
      .contains('payload', { ip })
      .gt('created_at', since);
    if ((recentFailures || 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { success: false, error: '試行回数が多すぎます。15分ほど待ってから再試行してください。' },
        { status: 429 }
      );
    }

    if (!safeEquals(password || '', adminPassword)) {
      await supabase.from('edge_tasks').insert({ task_type: 'login_failure', status: 'completed', payload: { ip } });
      return NextResponse.json(
        { success: false, error: 'パスワードが正しくありません。' },
        { status: 401 }
      );
    }

    const { token, maxAgeSec } = createSessionToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSec,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `認証処理中にエラーが発生しました: ${err.message}` },
      { status: 500 }
    );
  }
}
