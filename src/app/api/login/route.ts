import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyPassword,
} from '@/lib/auth';

const LoginSchema = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  if (!(await verifyPassword(parsed.data.password))) {
    // Small delay to slow down brute-force attempts.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
