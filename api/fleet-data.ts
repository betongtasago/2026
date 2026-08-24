import path from 'node:path';
import fs from 'node:fs';
import { applyApiHeaders, sendJson } from './_http';
import { getAuthenticatedUser } from '../serverAuth';

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

type FleetPayload = {
  records: unknown[];
  lastUpdated: string | null;
  version: number;
  timestamp: number;
};

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const dataFile = path.join(dataDir, 'fleet_data.json');
let fleetState: FleetPayload = loadFleetState();

function loadFleetState(): FleetPayload {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.records)) {
      return {
        records: parsed.records,
        lastUpdated: parsed.lastUpdated || null,
        version: Number(parsed.version) || 1,
        timestamp: Number(parsed.timestamp) || Date.now(),
      };
    }
  } catch {}
  return { records: [], lastUpdated: null, version: 0, timestamp: Date.now() };
}

function persistFleetState(): void {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(fleetState, null, 2), 'utf8');
  } catch (error) {
    console.error('Không thể ghi fleet data trên filesystem hiện tại:', error);
  }
}

function isAuthenticated(req: RequestLike): boolean {
  return Boolean(getAuthenticatedUser(req));
}

export default function handler(req: RequestLike, res: ResponseLike): void {
  if (!applyApiHeaders(req, res)) return;
  if (!isAuthenticated(req)) {
    sendJson(res, 401, { success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, { success: true, ...fleetState });
    return;
  }

  if (req.method === 'DELETE') {
    fleetState = { records: [], lastUpdated: null, version: fleetState.version + 1, timestamp: Date.now() };
    persistFleetState();
    sendJson(res, 200, { success: true, message: 'Đã xóa toàn bộ dữ liệu máy chủ.' });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const records = body.records;
    if (!Array.isArray(records)) {
      sendJson(res, 400, { success: false, error: "Tham số 'records' phải là một mảng dữ liệu." });
      return;
    }
    if (records.length > 100000) {
      sendJson(res, 413, { success: false, error: 'Dữ liệu vượt quá giới hạn 100.000 bản ghi.' });
      return;
    }
    const now = new Date();
    const fallbackTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${now.toLocaleDateString('vi-VN')}`;
    fleetState = {
      records,
      lastUpdated: typeof body.lastUpdated === 'string' ? body.lastUpdated : fallbackTime,
      version: fleetState.version + 1,
      timestamp: Date.now(),
    };
    persistFleetState();
    sendJson(res, 200, { success: true, count: records.length, ...fleetState });
    return;
  }

  sendJson(res, 405, { success: false, error: 'Phương thức không được hỗ trợ.' });
}
