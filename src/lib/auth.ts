import { createHmac, createHash, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'rs_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function parseUsers(): Map<string, string> {
  const raw = process.env.AUTH_USERS || '';
  const users = new Map<string, string>();
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(':');
    if (sep <= 0) continue;
    users.set(trimmed.slice(0, sep).toLowerCase(), trimmed.slice(sep + 1));
  }
  return users;
}

export function isAuthEnabled(): boolean {
  return parseUsers().size > 0;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must be set when AUTH_USERS is configured.');
  }
  return secret;
}

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function verifyCredentials(email: string, password: string): boolean {
  const users = parseUsers();
  const expected = users.get(email.trim().toLowerCase());
  if (expected === undefined) return false;
  return safeEqual(password, expected);
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSessionToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email: email.trim().toLowerCase(), exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const sep = token.lastIndexOf('.');
  if (sep <= 0) return null;

  const payload = token.slice(0, sep);
  const signature = token.slice(sep + 1);

  try {
    if (!safeEqual(signature, sign(payload))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { email?: string; exp?: number };
    if (!data.email || !data.exp || data.exp < Date.now()) return null;
    if (!parseUsers().has(data.email)) return null;
    return data.email;
  } catch {
    return null;
  }
}
