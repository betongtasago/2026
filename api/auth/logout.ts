import { applyApiHeaders, sendJson } from '../../vercelHttp';

import { clearSessionCookie } from '../../vercelAuth';

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
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
  clearSessionCookie(res, req);
  sendJson(res, 200, { success: true });
}
