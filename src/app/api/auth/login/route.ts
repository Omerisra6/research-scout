import { NextResponse } from 'next/server';
import { verifyCredentials, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.APP_BASE_URL || '').startsWith('https://'),
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
