const SESSION_COOKIE = 'tasago_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function env(name: string): string {
  const runtimeProcess = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process;
  return String(runtimeProcess?.env?.[name] || '');
}

function encodeBase64Url(binary: string): string {
  return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string | number | string[]): void;
};

function header(req: RequestLike, name: string): string {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function base64UrlEncode(value: string): string {
  const bytes = new globalThis.TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return encodeBase64Url(binary);
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = globalThis.atob(padded);
  return new globalThis.TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function signature(payload: string): Promise<string> {
  const secret = env('AUTH_SECRET').trim() || 'unconfigured-auth-secret';
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) throw new Error('Web Crypto không khả dụng trên runtime Vercel.');
  const key = await webCrypto.subtle.importKey('raw', new globalThis.TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = await webCrypto.subtle.sign('HMAC', key, new globalThis.TextEncoder().encode(payload));
  let binary = '';
  new Uint8Array(result).forEach((byte) => { binary += String.fromCharCode(byte); });
  return encodeBase64Url(binary);
}

function parseCookies(value: string): Record<string, string> {
  return value.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) {
      try { cookies[key] = decodeURIComponent(rest.join('=')); } catch {}
    }
    return cookies;
  }, {});
}

function crossSite(req: RequestLike): boolean {
  const configuredOrigin = String(process.env.FRONTEND_ORIGIN || '').trim();
  const requestHost = header(req, 'host').split(':')[0].toLowerCase();
  if (!configuredOrigin || !requestHost) return Boolean(configuredOrigin);
  try { return new URL(configuredOrigin).hostname.toLowerCase() !== requestHost; } catch { return true; }
}

export function canAuthenticate(): boolean {
  return Boolean(env('ADMIN_USERNAME').trim() && env('ADMIN_PASSWORD') && env('AUTH_SECRET').trim());
}

export function verifyLogin(username: unknown, password: unknown): boolean {
  return typeof username === 'string' && typeof password === 'string' && username === env('ADMIN_USERNAME').trim() && password === env('ADMIN_PASSWORD');
}

export function isLoginRateLimited(ip: string): boolean {
  const current = attempts.get(ip);
  if (!current || current.resetAt <= Date.now()) {
    attempts.set(ip, { count: 0, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return false;
  }
  return current.count >= MAX_LOGIN_ATTEMPTS;
}

export function recordLoginFailure(ip: string): void {
  const current = attempts.get(ip);
  if (!current || current.resetAt <= Date.now()) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

export function clearLoginFailures(ip: string): void {
  attempts.delete(ip);
}

export async function createSession(username: string): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  return `${payload}.${await signature(payload)}`;
}

export async function getAuthenticatedUser(req: RequestLike): Promise<{ username: string } | null> {
  const cookies = parseCookies(header(req, 'cookie'));
  const bearer = header(req, 'authorization');
  const token = cookies[SESSION_COOKIE] || (bearer.toLowerCase().startsWith('bearer ') ? bearer.slice(7).trim() : '');
  if (!token) return null;
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature || providedSignature !== await signature(payload)) return null;
  try {
    const data = JSON.parse(base64UrlDecode(payload)) as { sub?: string; exp?: number };
    const username = env('ADMIN_USERNAME').trim();
    if (!data.sub || data.sub !== username || !data.exp || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return { username: data.sub };
  } catch { return null; }
}

export function setSessionCookie(res: ResponseLike, token: string, req: RequestLike): void {
  const sameSite = crossSite(req) ? 'None' : 'Lax';
  const secure = env('NODE_ENV') === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=${sameSite}${secure}`);
}

export function clearSessionCookie(res: ResponseLike, req: RequestLike): void {
  const sameSite = crossSite(req) ? 'None' : 'Lax';
  const secure = env('NODE_ENV') === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=${sameSite}${secure}`);
}

export function shouldExposeClientToken(req: RequestLike): boolean {
  return crossSite(req);
}
