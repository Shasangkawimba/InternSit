import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function errorResponse(message: string, status: number) {
  return json({ error: message }, status);
}

/** Defense in depth: middleware already gates /api/*, handlers verify again. */
export async function requireSession(): Promise<NextResponse | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return (await verifySessionToken(token)) ? null : errorResponse('Unauthorized', 401);
}

export function validationError(error: z.ZodError) {
  return json(
    {
      error: 'Invalid request',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    400,
  );
}

type Parsed<T> = { data: T; response?: undefined } | { data?: undefined; response: NextResponse };

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<Parsed<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: errorResponse('Request body must be valid JSON', 400) };
  }
  const result = schema.safeParse(raw);
  return result.success ? { data: result.data } : { response: validationError(result.error) };
}

export function serverError(error: unknown) {
  console.error('[api] unexpected error:', error);
  return errorResponse('Internal server error', 500);
}
