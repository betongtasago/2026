import { webcrypto } from 'node:crypto';

const SESSION_COOKIE = 'tasago_session';

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ResponseLike;
  json(payload: unknown): void;
};

function env(name: string): string {
  return String(process.env[name] || '');
}

function header(req: RequestLike, name: string): string {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
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

function decodePayload(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

async function validToken(token: string): Promise<boolean> {
  const [payload, provided] = token.split('.');
  if (!payload || !provided) return false;
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(env('AUTH_SECRET').trim() || 'unconfigured-auth-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = Buffer.from(await webcrypto.subtle.sign('HMAC', key, Buffer.from(payload, 'utf8'))).toString('base64url');
  if (provided !== expected) return false;
  try {
    const data = JSON.parse(decodePayload(payload)) as { sub?: string; exp?: number };
    return Boolean(data.sub && data.sub === env('ADMIN_USERNAME').trim() && data.exp && data.exp > Math.floor(Date.now() / 1000));
  } catch { return false; }
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (req.method !== 'GET') {
      res.status(405).json({ success: false, error: 'Phương thức không được hỗ trợ.' });
      return;
    }
    const cookies = parseCookies(header(req, 'cookie'));
    const authorization = header(req, 'authorization');
    const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
    const token = cookies[SESSION_COOKIE] || bearer;
    if (!token || !env('AUTH_SECRET').trim() || !env('ADMIN_USERNAME').trim()) {
      res.status(401).json({ success: false, authenticated: false });
      return;
    }
    if (!await validToken(token)) {
      res.status(401).json({ success: false, authenticated: false });
      return;
    }
    res.status(200).json({ success: true, authenticated: true, user: { username: env('ADMIN_USERNAME').trim() } });
  } catch (error) {
    console.error('Vercel session function error:', error);
    res.status(500).json({ success: false, authenticated: false, error: 'Lỗi kiểm tra phiên trên Vercel.', code: 'AUTH_SESSION_FUNCTION_ERROR' });
  }
}
