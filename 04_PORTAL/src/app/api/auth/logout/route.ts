import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('ktm_user_session');

  const response = NextResponse.json({ success: true });
  response.cookies.set('ktm_user_session', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
