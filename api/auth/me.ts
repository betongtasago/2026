import { applyApiHeaders, sendJson } from '../../vercelHttp';

import { getAuthenticatedUser } from '../../vercelAuth';

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ResponseLike;
  end(chunk?: unknown): void;
};

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (!applyApiHeaders(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, error: 'Phương thức không được hỗ trợ.' });
    return;
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    sendJson(res, 401, { success: false, authenticated: false });
    return;
  }
  sendJson(res, 200, { success: true, authenticated: true, user });
}
