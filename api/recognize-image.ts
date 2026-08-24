import { GoogleGenAI, Type } from '@google/genai';
import { applyApiHeaders, sendJson } from './_http';

export const config = { runtime: 'nodejs22.x', maxDuration: 60 };
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

function cleanResponseText(value: string): string {
  const text = value.trim();
  if (text.startsWith('```json')) return text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  if (text.startsWith('```')) return text.replace(/^```\s*/i, '').replace(/```$/, '').trim();
  return text;
}

export default async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (!applyApiHeaders(req, res)) return;
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, error: 'Phương thức không được hỗ trợ.' });
    return;
  }
  if (!getAuthenticatedUser(req)) {
    sendJson(res, 401, { success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return;
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const image = body.image;
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    const region = body.region && typeof body.region === 'object' ? body.region as Record<string, unknown> : null;
    if (typeof image !== 'string' || !image) {
      sendJson(res, 400, { error: 'Vui lòng cung cấp dữ liệu hình ảnh (base64).' });
      return;
    }

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      sendJson(res, 503, { error: 'GEMINI_API_KEY chưa được cấu hình trên máy chủ.', needsKey: true });
      return;
    }
    if (image.length > 12_000_000) {
      sendJson(res, 413, { error: 'Ảnh vượt quá giới hạn 12 MB.' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const base64Data = image.includes('base64,') ? image.split('base64,')[1].replace(/[\r\n\s]/g, '') : image.replace(/[\r\n\s]/g, '');
    const normalizedMime = mimeType === 'image/jpg' || !mimeType.startsWith('image/') ? 'image/jpeg' : mimeType;
    const systemInstruction = `Bạn là chuyên gia AI Vision OCR dữ liệu vận tải tại Việt Nam. Đọc toàn bộ bảng kê chuyến từ ảnh và trả về từng dòng độc lập. Không được gộp hoặc loại bỏ các dòng trùng tên; cùng một tài xế có thể chạy nhiều xe nên phải giữ riêng từng số xe. Đọc theo chiều ngang và đối chiếu đúng tiêu đề cột. Mỗi dòng phải có driverName, vehicleNumber, stationVolume, largeTrips, smallTrips, totalKm, totalTrips và waterVehicles. Ô trống hoặc số 0 trả 0; không tự suy đoán và không tự cộng với dữ liệu cũ.`;
    let userText = 'Hãy nhận dạng toàn bộ bảng danh sách chuyến trong ảnh. Đọc từng dòng từ trái sang phải, trả về đủ các cột khối lượng trạm, chuyến lớn, chuyến nhỏ, tổng km, tổng chuyến và xe nước.';
    if (region && typeof region.width === 'number' && typeof region.height === 'number' && (region.width < 95 || region.height < 95)) {
      userText += ` Tập trung vùng x=${Math.round(Number(region.x) || 0)}%, y=${Math.round(Number(region.y) || 0)}%, width=${Math.round(region.width)}%, height=${Math.round(region.height)}%.`;
    }

    const models = Array.from(new Set([String(process.env.GEMINI_MODEL || '').trim(), 'gemini-3.6-flash', 'gemini-3-flash-preview'].filter(Boolean)));
    let response: { text?: string } | null = null;
    let lastError: unknown = null;
    for (const model of models) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: { parts: [{ inlineData: { data: base64Data, mimeType: normalizedMime } }, { text: userText }] },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedRegionDescription: { type: Type.STRING },
                drivers: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stt: { type: Type.INTEGER },
                      driverName: { type: Type.STRING },
                      vehicleNumber: { type: Type.STRING },
                      stationVolume: { type: Type.NUMBER },
                      largeTrips: { type: Type.INTEGER },
                      smallTrips: { type: Type.INTEGER },
                      totalKm: { type: Type.INTEGER },
                      totalTrips: { type: Type.INTEGER },
                      waterVehicles: { type: Type.INTEGER },
                    },
                    required: ['driverName', 'vehicleNumber', 'stationVolume', 'largeTrips', 'smallTrips', 'totalKm', 'totalTrips', 'waterVehicles'],
                  },
                },
              },
              required: ['drivers'],
            },
          },
        });
        if (response?.text) break;
      } catch (error) {
        lastError = error;
        console.warn(`Thử model ${model} thất bại:`, error instanceof Error ? error.message : error);
      }
    }
    if (!response?.text) throw lastError instanceof Error ? lastError : new Error('Không nhận được phản hồi từ AI.');

    const parsed = JSON.parse(cleanResponseText(response.text));
    const drivers = Array.isArray(parsed.drivers) ? parsed.drivers : [];
    sendJson(res, 200, {
      success: true,
      detectedRegionDescription: parsed.detectedRegionDescription || 'Đã nhận diện bảng dữ liệu',
      drivers,
      count: drivers.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi trong quá trình nhận dạng ảnh.';
    console.error('Image recognition error:', error);
    sendJson(res, 500, { error: message });
  }
}
