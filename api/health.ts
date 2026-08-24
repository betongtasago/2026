export const config = { runtime: 'nodejs22.x' };

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): ResponseLike;
  json(payload: unknown): void;
  end(chunk?: unknown): void;
};

export default function handler(req: RequestLike, res: ResponseLike): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ status: 'error', error: 'Phương thức không được hỗ trợ.' });
    return;
  }
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
