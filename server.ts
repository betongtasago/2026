// Trong server.ts:
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
        console.warn(`Thử model ${modelName} thất bại:`, e.message);
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
