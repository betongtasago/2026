type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ResponseLike;
  end(chunk?: unknown): void;
  json?(payload: unknown): void;
};

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

export function applyApiHeaders(req: RequestLike, res: ResponseLike): boolean {
  const allowedOrigin = String(process.env.FRONTEND_ORIGIN || '').trim().replace(/\/$/, '');
  const requestOrigin = firstHeader(req.headers.origin).replace(/\/$/, '');

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  return true;
}

export function sendJson(res: ResponseLike, status: number, payload: unknown): void {
  if (typeof res.json === 'function') {
    res.status(status).json(payload);
    return;
  }
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function requestIp(req: RequestLike): string {
  const forwarded = firstHeader(req.headers['x-forwarded-for']);
  return forwarded.split(',')[0].trim() || 'unknown';
}
