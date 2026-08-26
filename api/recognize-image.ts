import { webcrypto } from 'node:crypto';

import { normalizeOcrRows } from '../src/utils/ocrNormalization';

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

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

const SESSION_COOKIE = 'tasago_session';

function env(name: string): string {
  return String(process.env[name] || '');
}

function header(req: RequestLike, name: string): string {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function send(res: ResponseLike, status: number, payload: unknown): void {
  res.status(status).json(payload);
}

function applyCors(req: RequestLike, res: ResponseLike): boolean {
  const origin = header(req, 'origin');
  const allowedOrigin = env('FRONTEND_ORIGIN').trim().replace(/\/$/, '');
  if (origin && (!allowedOrigin || origin.replace(/\/$/, '') === allowedOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).json({});
    return false;
  }
  return true;
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

async function isAuthenticated(req: RequestLike): Promise<boolean> {
  const cookies = parseCookies(header(req, 'cookie'));
  const authorization = header(req, 'authorization');
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  const token = cookies[SESSION_COOKIE] || bearer;
  if (!token || !env('AUTH_SECRET').trim() || !env('ADMIN_USERNAME').trim()) return false;
  const [payload, provided] = token.split('.');
  if (!payload || !provided) return false;
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(env('AUTH_SECRET').trim()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = Buffer.from(await webcrypto.subtle.sign('HMAC', key, Buffer.from(payload, 'utf8'))).toString('base64url');
  if (provided !== expected) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    return Boolean(data.sub === env('ADMIN_USERNAME').trim() && data.exp && data.exp > Math.floor(Date.now() / 1000));
  } catch { return false; }
}

function cleanResponseText(value: string): string {
  const text = value.trim();
  if (text.startsWith('```json')) return text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  if (text.startsWith('```')) return text.replace(/^```\s*/i, '').replace(/```$/, '').trim();
  return text;
}

function responseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      detectedRegionDescription: { type: 'STRING' },
      drivers: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            stt: { type: 'INTEGER' },
            driverName: { type: 'STRING' },
            vehicleNumber: { type: 'STRING' },
            stationVolume: { type: 'NUMBER' },
            largeTrips: { type: 'INTEGER' },
            smallTrips: { type: 'INTEGER' },
            totalKm: { type: 'INTEGER' },
            totalTrips: { type: 'INTEGER' },
            waterVehicles: { type: 'INTEGER' },
          },
          required: ['driverName', 'vehicleNumber', 'stationVolume', 'largeTrips', 'smallTrips', 'totalKm', 'totalTrips', 'waterVehicles'],
        },
      },
    },
    required: ['drivers'],
  };
}

async function callGemini(model: string, apiKey: string, base64Data: string, mimeType: string, systemInstruction: string, userText: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ inlineData: { data: base64Data, mimeType } }, { text: userText }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: responseSchema() },
    }),
  });
  const payload = await upstream.json().catch(() => ({})) as GeminiResponse;
  if (!upstream.ok) throw new Error(payload.error?.message || `Gemini trả HTTP ${upstream.status}.`);
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!text) throw new Error('Gemini không trả về nội dung nhận diện.');
  return text;
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  try {
    if (!applyCors(req, res)) return;
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (req.method !== 'POST') {
      send(res, 405, { success: false, error: 'Phương thức không được hỗ trợ.' });
      return;
    }
    if (!await isAuthenticated(req)) {
      send(res, 401, { success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const image = body.image;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    const region = body.region && typeof body.region === 'object' ? body.region as Record<string, unknown> : null;
    const segment = body.segment && typeof body.segment === 'object' ? body.segment as Record<string, unknown> : null;
    if (typeof image !== 'string' || !image) {
      send(res, 400, { success: false, error: 'Vui lòng cung cấp dữ liệu hình ảnh (base64).' });
      return;
    }
    const apiKey = env('GEMINI_API_KEY').trim();
    if (!apiKey) {
      send(res, 503, { success: false, error: 'GEMINI_API_KEY chưa được cấu hình trên máy chủ.', needsKey: true });
      return;
    }
    if (image.length > 12_000_000) {
      send(res, 413, { success: false, error: 'Ảnh vượt quá giới hạn 12 MB.' });
      return;
    }

    const base64Data = image.includes('base64,') ? image.split('base64,')[1].replace(/[\r\n\s]/g, '') : image.replace(/[\r\n\s]/g, '');
    const normalizedMime = mimeType === 'image/jpg' || !mimeType.startsWith('image/') ? 'image/jpeg' : mimeType;
    const systemInstruction = 'Bạn là chuyên gia AI Vision OCR dữ liệu vận tải tại Việt Nam. Đọc toàn bộ bảng kê chuyến từ ảnh và trả về từng dòng độc lập. Không được gộp hoặc loại bỏ các dòng trùng tên; cùng một tài xế có thể chạy nhiều xe nên phải giữ riêng từng số xe. Đọc theo chiều ngang và đối chiếu đúng tiêu đề cột. Mỗi dòng nhìn thấy phải được trả về, kể cả khi một ô tên hoặc số xe bị mờ; khi không đọc được định danh thì trả chuỗi rỗng để giao diện đưa vào danh sách cần kiểm tra. Mỗi dòng phải có driverName, vehicleNumber, stationVolume, largeTrips, smallTrips, totalKm, totalTrips và waterVehicles. Ô trống hoặc số 0 trả 0; không tự suy đoán và không tự cộng với dữ liệu cũ.';
    let userText = 'Hãy nhận dạng toàn bộ bảng danh sách chuyến trong ảnh. Đọc từng dòng từ trái sang phải, trả về đủ các cột khối lượng trạm, chuyến lớn, chuyến nhỏ, tổng km, tổng chuyến và xe nước. Không bỏ qua dòng cuối, dòng có số 0, dòng trùng tên hoặc dòng nằm sát mép ảnh.';
    if (segment && Number(segment.index) > 0 && Number(segment.total) > 1) {
      userText += ` Đây là phần ${Math.round(Number(segment.index))}/${Math.round(Number(segment.total))} của ảnh bảng dài; hãy đọc tất cả dòng nhìn thấy trong phần này, kể cả dòng bị lặp ở mép vùng chồng lấn.`;
    }
    if (region && typeof region.width === 'number' && typeof region.height === 'number' && (region.width < 95 || region.height < 95)) {
      userText += ` Tập trung vùng x=${Math.round(Number(region.x) || 0)}%, y=${Math.round(Number(region.y) || 0)}%, width=${Math.round(region.width)}%, height=${Math.round(region.height)}%.`;
    }

    const models = Array.from(new Set([env('GEMINI_MODEL').trim(), 'gemini-3.6-flash', 'gemini-3-flash-preview'].filter(Boolean)));
    let cleanJson = '';
    let lastError: unknown = null;
    for (const model of models) {
      try {
        cleanJson = cleanResponseText(await callGemini(model, apiKey, base64Data, normalizedMime, systemInstruction, userText));
        if (cleanJson) break;
      } catch (error) {
        lastError = error;
        console.warn(`Thử model ${model} thất bại:`, error instanceof Error ? error.message : error);
      }
    }
    if (!cleanJson) throw lastError instanceof Error ? lastError : new Error('Không nhận được phản hồi từ AI.');

    const parsed = JSON.parse(cleanJson) as { detectedRegionDescription?: string; drivers?: unknown };
    const drivers = normalizeOcrRows(parsed.drivers);
    send(res, 200, { success: true, detectedRegionDescription: parsed.detectedRegionDescription || 'Đã nhận diện bảng dữ liệu', drivers, count: drivers.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi trong quá trình nhận dạng ảnh.';
    console.error('Image recognition error:', error);
    send(res, 502, { success: false, error: `OCR Gemini: ${message}`, code: 'OCR_UPSTREAM_ERROR' });
  }
}
