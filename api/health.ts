import { applyApiHeaders, sendJson } from './_http';

export const config = { runtime: 'nodejs22.x' };

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
  if (req.method !== 'GET') {
    sendJson(res, 405, { status: 'error', error: 'Phương thức không được hỗ trợ.' });
    return;
  }
  sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
}
