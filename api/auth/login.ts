import { applyApiHeaders, requestIp, sendJson } from '../_http';

export const config = { runtime: 'nodejs22.x' };
import {
  canAuthenticate,
  clearLoginFailures,
  createSession,
  isLoginRateLimited,
  recordLoginFailure,
  setSessionCookie,
  shouldExposeClientToken,
  verifyLogin,
} from '../../serverAuth';

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ResponseLike;
  end(chunk?: unknown): void;
};

export default function handler(req: RequestLike, res: ResponseLike): void {
  if (!applyApiHeaders(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Phương thức không được hỗ trợ.' });
    return;
  }
  if (!canAuthenticate()) {
    sendJson(res, 503, { success: false, error: 'Chưa cấu hình ADMIN_USERNAME, ADMIN_PASSWORD và AUTH_SECRET trên máy chủ.' });
    return;
  }

  const ip = requestIp(req);
  if (isLoginRateLimited(ip)) {
    sendJson(res, 429, { success: false, error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const { username, password } = body;
  if (!verifyLogin(username, password)) {
    recordLoginFailure(ip);
    sendJson(res, 401, { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    return;
  }

  clearLoginFailures(ip);
  const sessionToken = createSession(String(username));
  setSessionCookie(res, sessionToken, req);
  sendJson(res, 200, {
    success: true,
    user: { username: String(username) },
    ...(shouldExposeClientToken(req) ? { sessionToken } : {}),
  });
}
