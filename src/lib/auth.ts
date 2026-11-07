// Single-password auth using Web Crypto, so it works in both middleware
// (edge runtime) and route handlers (node runtime).

export const SESSION_COOKIE = 'internsit_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return secret;
}

async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Constant-time password check against APP_PASSWORD. */
export async function verifyPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // Compare HMACs so both sides have equal length and comparison is constant-time.
  return safeEqual(await hmac(`pw:${input}`), await hmac(`pw:${expected}`));
}

/** Token format: `<expiresAtMs>.<hmacHex>` */
export async function createSessionToken(): Promise<string> {
  const expiresAt = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${expiresAt}.${toHex(await hmac(`session:${expiresAt}`))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) return false;
  if (!(Number(expiresAt) > Date.now())) return false;
  return safeEqual(encoder.encode(signature), encoder.encode(toHex(await hmac(`session:${expiresAt}`))));
}
