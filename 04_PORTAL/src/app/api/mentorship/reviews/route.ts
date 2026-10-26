import { NextResponse } from 'next/server';

/**
 * 旧 mentorship reviews API 互換エンドポイント
 * 2026-10-23にリファクタリングで削除されたが、端末に古いJSキャッシュが残っている
 * ユーザーが /mentorship を開いた際に 404 (Client Error) が飛ぶのを防ぐため、
 * 空配列を返して安全に吸収する。
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    reviews: [],
  });
}
