import crypto from 'node:crypto';

const SESSION_COOKIE = 'tasago_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map<string, { count: number; resetAt: number }>();

function getAuthSecret(): string {
  const secret = String(process.env.AUTH_SECRET || '').trim();
  return secret || 'unconfigured-auth-secret';
}

function getAdminCredentials() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!username || !password) return null;
  return { username, password };
}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string): string {
  return crypto.createHmac('sha256', getAuthSecret()).update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header = ''): Record<string, string> {
  return header.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [key, ...value] = part.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(value.join('='));
    return cookies;
  }, {});
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function canAuthenticate(): boolean {
  const hasCredentials = Boolean(getAdminCredentials());
  const hasSecret = Boolean(String(process.env.AUTH_SECRET || '').trim()) || process.env.NODE_ENV !== 'production';
  return hasCredentials && hasSecret;
}

export function verifyLogin(username: unknown, password: unknown): boolean {
  const credentials = getAdminCredentials();
  if (!credentials || typeof username !== 'string' || typeof password !== 'string') return false;
  return safeEqual(username, credentials.username) && safeEqual(password, credentials.password);
}

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || record.resetAt <= now) {
    attempts.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  return record.count >= MAX_LOGIN_ATTEMPTS;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || record.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  record.count += 1;
}

export function clearLoginFailures(ip: string): void {
  attempts.delete(ip);
}

export function createSession(username: string): string {
  const payload = base64Url(JSON.stringify({
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
}

export function getAuthenticatedUser(req: any): { username: string } | null {
  const cookies = parseCookies(req.headers?.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!data.sub || !data.exp || data.exp <= Math.floor(Date.now() / 1000)) return null;
    const credentials = getAdminCredentials();
    return credentials && safeEqual(data.sub, credentials.username) ? { username: data.sub } : null;
  } catch {
    return null;
  }
}

function usesCrossSiteCookie(req?: any): boolean {
  const configuredOrigin = String(process.env.FRONTEND_ORIGIN || '').trim();
  const requestHost = String(req?.headers?.host || '').split(':')[0].toLowerCase();
  if (!configuredOrigin || !requestHost) return Boolean(configuredOrigin);
  try {
    return new URL(configuredOrigin).hostname.toLowerCase() !== requestHost;
  } catch {
    return true;
  }
}

function cookieFlags(req?: any, maxAge = SESSION_TTL_SECONDS): string {
  const sameSite = usesCrossSiteCookie(req) ? 'None' : 'Lax';
  return `HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=${sameSite}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function setSessionCookie(res: any, token: string, req?: any): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieFlags(req)}`);
}

export function clearSessionCookie(res: any, req?: any): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieFlags(req, 0)}`);
}

export function requireAuth(req: any, res: any, next: any): void {
  if (!getAuthenticatedUser(req)) {
    res.status(401).json({ success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return;
  }
  next();
}
