import { webcrypto } from 'node:crypto';

const SESSION_COOKIE = 'tasago_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ResponseLike;
  json(payload: unknown): void;
};

function env(name: string): string {
  return String(process.env[name] || '');
}

function firstHeader(req: RequestLike, name: string): string {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function send(res: ResponseLike, status: number, payload: unknown): void {
  res.status(status).json(payload);
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

async function createSession(username: string): Promise<string> {
  const payload = base64Url(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(env('AUTH_SECRET').trim() || 'unconfigured-auth-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await webcrypto.subtle.sign('HMAC', key, Buffer.from(payload, 'utf8'));
  return `${payload}.${Buffer.from(signature).toString('base64url')}`;
}

function isCrossSite(req: RequestLike): boolean {
  const configuredOrigin = env('FRONTEND_ORIGIN').trim();
  const requestHost = firstHeader(req, 'host').split(':')[0].toLowerCase();
  if (!configuredOrigin || !requestHost) return Boolean(configuredOrigin);
  try { return new URL(configuredOrigin).hostname.toLowerCase() !== requestHost; } catch { return true; }
}

function isRateLimited(ip: string): boolean {
  const current = attempts.get(ip);
  if (!current || current.resetAt <= Date.now()) {
    attempts.set(ip, { count: 0, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return false;
  }
  return current.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const current = attempts.get(ip);
  if (!current || current.resetAt <= Date.now()) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

function requestIp(req: RequestLike): string {
  return firstHeader(req, 'x-forwarded-for').split(',')[0].trim() || 'unknown';
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).json({});
      return;
    }
    if (req.method !== 'POST') {
      send(res, 405, { success: false, error: 'Phương thức không được hỗ trợ.' });
      return;
    }

    const username = String(env('ADMIN_USERNAME')).trim();
    const configuredPassword = env('ADMIN_PASSWORD');
    const secret = env('AUTH_SECRET').trim();
    if (!username || !configuredPassword || !secret) {
      send(res, 503, { success: false, error: 'Chưa cấu hình tài khoản quản trị và AUTH_SECRET trên máy chủ.' });
      return;
    }

    const ip = requestIp(req);
    if (isRateLimited(ip)) {
      send(res, 429, { success: false, error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    if (body.username !== username || body.password !== configuredPassword) {
      recordFailure(ip);
      send(res, 401, { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
      return;
    }

    const sessionToken = await createSession(username);
    const sameSite = isCrossSite(req) ? 'None' : 'Lax';
    const secure = env('NODE_ENV') === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=${sameSite}${secure}`);
    send(res, 200, {
      success: true,
      user: { username },
      ...(isCrossSite(req) ? { sessionToken } : {}),
    });
  } catch (error) {
    console.error('Vercel login function error:', error);
    send(res, 500, { success: false, error: 'Lỗi khởi tạo chức năng đăng nhập trên Vercel.', code: 'AUTH_FUNCTION_ERROR' });
  }
}
