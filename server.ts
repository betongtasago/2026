import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.AQ.Ab8RN6KS8v8T9rA2ir_4VyEpLWtlvWS3gOfI9u8NlvxJ5YQAVA;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with high limit for images
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Image Recognition Endpoint
  app.post("/api/recognize-image", async (req, res) => {
    try {
      const { image, mimeType = "image/jpeg", region } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Vui lòng cung cấp dữ liệu hình ảnh (base64)." });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({
          error: "GEMINI_API_KEY chưa được cấu hình trên server. Vui lòng cấu hình API key trong phần Settings > Secrets.",
          needsKey: true,
        });
      }

      // Robust base64 extraction
      let base64Data = image;
      if (typeof base64Data === "string" && base64Data.includes("base64,")) {
        base64Data = base64Data.split("base64,")[1];
      }
      base64Data = base64Data.replace(/[\r\n\s]/g, "");

      // Normalize mimeType
      let normalizedMime = mimeType || "image/jpeg";
      if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";
      if (!normalizedMime.startsWith("image/")) normalizedMime = "image/jpeg";

      const systemPrompt = `Bạn là chuyên gia AI Vision OCR bóc tách dữ liệu vận tải và đội xe chuyên nghiệp tại Việt Nam.
Nhiệm vụ của bạn là nhận diện, bóc tách chính xác toàn bộ bảng danh sách tài xế vận hành từ hình ảnh (hoặc vùng hình ảnh được chọn).

Các cột thông tin cần nhận diện:
- stt: Số thứ tự (số nguyên, ví dụ 1, 2, 3...)
- driverName: Họ và tên tài xế (tiếng Việt có dấu, ví dụ 'Đặng Kim Thương', 'Nguyễn Thanh Phong', 'Lê Văn Nhành'...)
- vehicleNumber: Biển số xe / Số xe (ví dụ '51B 33618', '51N 04419', '50CD 00927', '51L 93030'...)
- stationVolume: Khối lượng trạm TN m³ (số thực, ví dụ 356.5, 242.0, 341.8...)
- largeTrips: Chuyến lớn (số nguyên, ví dụ 50, 26, 47...)
- smallTrips: Chuyến nhỏ (số nguyên, ví dụ 0, 2, 4...)
- totalKm: Tổng số Km (số nguyên, ví dụ 1683, 775, 1622...)
- totalTrips: Tổng số chuyến (số nguyên, nếu không có cột riêng thì bằng largeTrips + smallTrips)
- waterVehicles: Xe nước / số chuyến phụ (số nguyên, ví dụ 0, 1, 2...)

Quy tắc quan trọng:
1. Trích xuất đầy đủ tất cả các dòng tài xế có trong bảng.
2. Bỏ qua các dòng tiêu đề cột, dòng tổng cộng, chú thích hoặc văn bản ngoài lề.
3. Luôn giữ nguyên vẹn dấu tiếng Việt cho tên tài xế.
4. Chuẩn hóa biển số xe không dấu cách thừa.
5. Số thực sử dụng dấu chấm phân cách thập phân.`;

      let userText = "Hãy nhận dạng và trích xuất toàn bộ bảng dữ liệu danh sách tài xế trong hình ảnh này.";
      if (region && (region.width < 95 || region.height < 95)) {
        userText += ` Hãy tập trung bóc tách dữ liệu trong vùng được khoanh chọn: x=${Math.round(region.x)}%, y=${Math.round(region.y)}%, width=${Math.round(region.width)}%, height=${Math.round(region.height)}%.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
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
              detectedRegionDescription: {
                type: Type.STRING,
                description: "Mô tả bảng dữ liệu tài xế nhận diện được từ ảnh",
              },
              drivers: {
                type: Type.ARRAY,
                description: "Danh sách tất cả các dòng tài xế bóc tách từ bảng",
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

      const responseText = response.text;
      if (!responseText) {
        return res.status(500).json({ error: "Không nhận được phản hồi từ mô hình AI." });
      }

      // Clean JSON string if enclosed in markdown
      let cleanJson = responseText.trim();
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

  // Vite middleware for development vs static build in production
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
    console.log(`Fleet Management Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
