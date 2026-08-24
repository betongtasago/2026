import healthHandler from './health';
import loginHandler from './auth/login';
import logoutHandler from './auth/logout';
import meHandler from './auth/me';
import fleetDataHandler from './fleet-data';
import recognizeImageHandler from './recognize-image';

type VercelRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  statusCode?: number;
  setHeader(name: string, value: string | number | string[]): void;
  status(code: number): VercelResponse;
  end(chunk?: unknown): void;
  json(payload: unknown): void;
};

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

function pathname(req: VercelRequest): string {
  try {
    return new URL(req.url || '/', `https://${String(req.headers.host || 'localhost')}`).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return String(req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const route = `${String(req.method || 'GET').toUpperCase()} ${pathname(req)}`;
  const routes: Record<string, Handler> = {
    'GET /api/health': healthHandler,
    'GET /api/auth/me': meHandler,
    'POST /api/auth/login': loginHandler,
    'POST /api/auth/logout': logoutHandler,
    'GET /api/fleet-data': fleetDataHandler,
    'POST /api/fleet-data': fleetDataHandler,
    'DELETE /api/fleet-data': fleetDataHandler,
    'POST /api/recognize-image': recognizeImageHandler,
  };
  const selected = routes[route];
  if (selected) {
    await selected(req, res);
    return;
  }
  res.status(404).json({ success: false, error: 'API route không tồn tại.' });
}
