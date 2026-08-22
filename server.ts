import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Persistent fleet storage file
const DATA_DIR = path.join(process.cwd(), "data");
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

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Shared Fleet Data Endpoints (All users see the same updated data)
  app.get("/api/fleet-data", (req, res) => {
    res.json({
      success: true,
      records: currentFleetState.records,
      lastUpdated: currentFleetState.lastUpdated,
      version: currentFleetState.version,
      timestamp: currentFleetState.timestamp,
    });
  });

  app.post("/api/fleet-data", (req, res) => {
    try {
      const { records, lastUpdated, actionType } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: "Tham số 'records' phải là một mảng dữ liệu." });
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

  app.delete("/api/fleet-data", (req, res) => {
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

  app.post("/api/recognize-image", async (req, res) => {
    try {
      const { image, mimeType = "image/jpeg", region, apiKey: clientApiKey } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Vui lòng cung cấp dữ liệu hình ảnh (base64)." });
      }

      const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm vào file .env hoặc cấu hình trong ứng dụng.",
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
      if (typeof base64Data === "string" && base64Data.includes("base64,")) {
        base64Data = base64Data.split("base64,")[1];
      }
      base64Data = base64Data.replace(/[\r\n\s]/g, "");

      let normalizedMime = mimeType || "image/jpeg";
      if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";
      if (!normalizedMime.startsWith("image/")) normalizedMime = "image/jpeg";

      const systemPrompt = `Bạn là chuyên gia AI Vision OCR bóc tách dữ liệu vận tải và đội xe chuyên nghiệp tại Việt Nam.
Nhiệm vụ của bạn là nhận diện, bóc tách chính xác toàn bộ bảng danh sách tài xế vận hành từ hình ảnh (hoặc vùng hình ảnh được chọn).`;

      let userText = "Hãy nhận dạng và trích xuất toàn bộ bảng dữ liệu danh sách tài xế trong hình ảnh này.";
      if (region && (region.width < 95 || region.height < 95)) {
        userText += ` Hãy tập trung bóc tách dữ liệu trong vùng được khoanh chọn: x=${Math.round(region.x)}%, y=${Math.round(region.y)}%, width=${Math.round(region.width)}%, height=${Math.round(region.height)}%.`;
      }

      // Danh sách model ưu tiên tự động fallback
      const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
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
