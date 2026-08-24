import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  canAuthenticate,
  clearLoginFailures,
  clearSessionCookie,
  createSession,
  getAuthenticatedUser,
  isLoginRateLimited,
  recordLoginFailure,
  requireAuth,
  setSessionCookie,
  verifyLogin,
} from "./serverAuth";

dotenv.config();

// Persistent fleet storage file
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const DATA_FILE = path.join(DATA_DIR, "fleet_data.json");

interface FleetStoragePayload {
  records: any[];
  lastUpdated: string | null;
  version: number;
  timestamp: number;
}

function loadStoredFleetData(): FleetStoragePayload {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.records)) {
        return {
          records: parsed.records,
          lastUpdated: parsed.lastUpdated || null,
          version: parsed.version || 1,
          timestamp: parsed.timestamp || Date.now(),
        };
      }
    }
  } catch (err) {
    console.error("Error reading fleet data from file:", err);
  }
  return {
    records: [],
    lastUpdated: null,
    version: 0,
    timestamp: Date.now(),
  };
}

let currentFleetState: FleetStoragePayload = loadStoredFleetData();

function saveFleetDataToFile(payload: FleetStoragePayload) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing fleet data to file:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    const allowedOrigin = String(process.env.FRONTEND_ORIGIN || '').trim().replace(/\/$/, '');
    const requestOrigin = String(req.headers.origin || '').replace(/\/$/, '');
    if (allowedOrigin && requestOrigin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    next();
  });
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/auth/me", (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ success: false, authenticated: false });
    return res.json({ success: true, authenticated: true, user });
  });

  app.post("/api/auth/login", (req, res) => {
    const ip = req.ip || "unknown";
    if (!canAuthenticate()) return res.status(503).json({ success: false, error: "Chưa cấu hình ADMIN_USERNAME, ADMIN_PASSWORD và AUTH_SECRET trên máy chủ." });
    if (isLoginRateLimited(ip)) return res.status(429).json({ success: false, error: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút." });
    const { username, password } = req.body || {};
    if (!verifyLogin(username, password)) {
      recordLoginFailure(ip);
      return res.status(401).json({ success: false, error: "Tên đăng nhập hoặc mật khẩu không đúng." });
    }
    clearLoginFailures(ip);
    setSessionCookie(res, createSession(String(username)));
    return res.json({ success: true, user: { username: String(username) } });
  });

  app.post("/api/auth/logout", (req, res) => {
    clearSessionCookie(res);
    return res.json({ success: true });
  });

  // Shared Fleet Data Endpoints (authenticated users only)
  app.get("/api/fleet-data", requireAuth, (req, res) => {
    res.json({
      success: true,
      records: currentFleetState.records,
      lastUpdated: currentFleetState.lastUpdated,
      version: currentFleetState.version,
      timestamp: currentFleetState.timestamp,
    });
  });

  app.post("/api/fleet-data", requireAuth, (req, res) => {
    try {
      const { records, lastUpdated, actionType } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: "Tham số 'records' phải là một mảng dữ liệu." });
      }
      if (records.length > 100000) {
        return res.status(413).json({ error: "Dữ liệu vượt quá giới hạn 100.000 bản ghi." });
      }
      const now = new Date();

      const defaultTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} - ${now.toLocaleDateString("vi-VN")}`;
      const finalLastUpdated = lastUpdated || defaultTimeStr;

      currentFleetState = {
        records,
        lastUpdated: finalLastUpdated,
        version: (currentFleetState.version || 0) + 1,
        timestamp: Date.now(),
      };

      saveFleetDataToFile(currentFleetState);

      console.log(`[Fleet Sync] Đã lưu ${records.length} bản ghi (Action: ${actionType || 'Update'}, Version: ${currentFleetState.version})`);

      return res.json({
        success: true,
        count: records.length,
        lastUpdated: currentFleetState.lastUpdated,
        version: currentFleetState.version,
        timestamp: currentFleetState.timestamp,
      });
    } catch (err: any) {
      console.error("Error saving fleet data:", err);
      return res.status(500).json({ error: err?.message || "Lỗi khi lưu dữ liệu đội xe." });
    }
  });

  app.delete("/api/fleet-data", requireAuth, (req, res) => {
    try {
      currentFleetState = {
        records: [],
        lastUpdated: null,
        version: (currentFleetState.version || 0) + 1,
        timestamp: Date.now(),
      };
      saveFleetDataToFile(currentFleetState);
      return res.json({ success: true, message: "Đã xóa toàn bộ dữ liệu máy chủ." });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Lỗi khi xóa dữ liệu." });
    }
  });

  app.post("/api/recognize-image", requireAuth, async (req, res) => {
    try {
      const { image, mimeType = "image/jpeg", region } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Vui lòng cung cấp dữ liệu hình ảnh (base64)." });
      }

      const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
      if (!apiKey) {
        return res.status(503).json({
          error: "GEMINI_API_KEY chưa được cấu hình trên máy chủ.",
          needsKey: true,
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let base64Data = image;
      if (typeof base64Data !== 'string' || base64Data.length > 12_000_000) {
        return res.status(413).json({ error: "Ảnh vượt quá giới hạn 12 MB." });
      }
      if (typeof base64Data === "string" && base64Data.includes("base64,")) {
        base64Data = base64Data.split("base64,")[1];
      }
      base64Data = base64Data.replace(/[\r\n\s]/g, "");

      let normalizedMime = mimeType || "image/jpeg";
      if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";
      if (!normalizedMime.startsWith("image/")) normalizedMime = "image/jpeg";

      const systemPrompt = `Bạn là chuyên gia AI Vision OCR bóc tách dữ liệu vận tải và đội xe chuyên nghiệp tại Việt Nam.
Nhiệm vụ của bạn là đọc bảng kê chuyến từ ảnh và trả về dữ liệu có thể đồng bộ vào danh sách tài xế hiện có.
Chỉ trích xuất các dòng tài xế có tên và số xe. Các trường số liệu gồm chuyến lớn, chuyến nhỏ, tổng chuyến, tổng km, xe nước và khối lượng trạm nếu có. Nếu một trường không xuất hiện hoặc không đọc rõ, bỏ qua trường đó thay vì đoán. Không tự cộng dồn với dữ liệu cũ.`;

      let userText = "Hãy nhận dạng bảng danh sách chuyến trong hình ảnh này. Trích xuất tên tài xế, số xe và các số liệu chuyến theo từng dòng. Đặc biệt phân biệt rõ chuyến lớn, chuyến nhỏ và tổng chuyến.";
      if (region && (region.width < 95 || region.height < 95)) {
        userText += ` Hãy tập trung bóc tách dữ liệu trong vùng được khoanh chọn: x=${Math.round(region.x)}%, y=${Math.round(region.y)}%, width=${Math.round(region.width)}%, height=${Math.round(region.height)}%.`;
      }

      // Model ổn định cho OCR ảnh; có thể override bằng GEMINI_MODEL trên server.
      const configuredModel = String(process.env.GEMINI_MODEL || '').trim();
      const candidateModels = Array.from(new Set([
        configuredModel,
        "gemini-3.6-flash",
        "gemini-3-flash-preview",
      ].filter(Boolean)));
      let response = null;
      let lastErr = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: normalizedMime,
                  },
                },
                {
                  text: userText,
                },
              ],
            },
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
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
                      required: ["driverName", "vehicleNumber"],
                    },
                  },
                },
                required: ["drivers"],
              },
            },
          });
          if (response?.text) break;
        } catch (e: any) {
          lastErr = e;
          console.warn(`Thử model ${modelName} thất bại:`, e?.message || e);
        }
      }

      if (!response?.text) {
        throw lastErr || new Error("Không nhận được phản hồi từ AI.");
      }

      let cleanJson = response.text.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```\s*/i, "").replace(/```$/, "").trim();
      }

      const parsedData = JSON.parse(cleanJson);
      return res.json({
        success: true,
        detectedRegionDescription: parsedData.detectedRegionDescription || "Đã nhận diện bảng dữ liệu",
        drivers: parsedData.drivers || [],
        count: (parsedData.drivers || []).length,
      });
    } catch (err: any) {
      console.error("Image recognition error:", err);
      return res.status(500).json({
        error: err.message || "Đã xảy ra lỗi trong quá trình nhận dạng ảnh.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
