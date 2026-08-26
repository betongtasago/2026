export const MAX_IMAGE_DIMENSION = 1280;
// Vercel Functions accept at most 4.5 MB for the whole JSON request body.
// Base64 expands binary data by roughly 4/3, so leave headroom for JSON metadata.
export const MAX_OCR_IMAGE_BYTES = 2_800_000;
export const MAX_OCR_IMAGE_DIMENSION = 3200;
export const MAX_OCR_CHUNK_HEIGHT = 1700;
export const OCR_CHUNK_OVERLAP = 160;
export const OCR_HEADER_REFERENCE_HEIGHT = 220;
const OCR_UPSCALE_THRESHOLD = 1800;
const OCR_UPSCALE_FACTOR = 1.8;

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadedImage {
  dataUrl: string;
  mimeType: 'image/jpeg';
  fileName: string;
  sizeBytes: number;
}

function validateImageFile(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Ảnh gốc vượt quá giới hạn 20 MB.');
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không thể đọc nội dung ảnh.'));
    };
    image.src = url;
  });
}

function dataUrlSizeBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  return Math.ceil((dataUrl.length - comma - 1) * 0.75);
}

function encodeCanvas(canvas: HTMLCanvasElement, maxBytes: number, initialQuality: number): UploadedImage {
  let quality = initialQuality;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlSizeBytes(dataUrl) > maxBytes && quality > 0.45) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  const sizeBytes = dataUrlSizeBytes(dataUrl);
  if (sizeBytes > maxBytes) {
    throw new Error('Ảnh sau khi xử lý vẫn quá lớn. Hãy chọn ảnh nhỏ hơn hoặc cắt đúng phần bảng chuyến.');
  }
  return { dataUrl, mimeType: 'image/jpeg', fileName: '', sizeBytes };
}

function scaledDimensions(image: HTMLImageElement, maxDimension: number, upscaleSmallImage = false): { width: number; height: number; scale: number } {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const downscale = Math.min(1, maxDimension / longestSide);
  const upscale = upscaleSmallImage && longestSide < OCR_UPSCALE_THRESHOLD
    ? Math.min(OCR_UPSCALE_FACTOR, OCR_UPSCALE_THRESHOLD / longestSide)
    : 1;
  const scale = downscale * upscale;
  return {
    scale,
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
  };
}

async function encodeImage(file: File, maxDimension: number, maxBytes: number): Promise<UploadedImage> {
  validateImageFile(file);
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('Ảnh không có kích thước hợp lệ.');
  }

  const { width, height } = scaledDimensions(image, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const encoded = encodeCanvas(canvas, maxBytes, maxDimension > MAX_IMAGE_DIMENSION ? 0.94 : 0.84);
  return {
    ...encoded,
    fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
  };
}

export function compressImage(file: File): Promise<UploadedImage> {
  return encodeImage(file, MAX_IMAGE_DIMENSION, MAX_OCR_IMAGE_BYTES);
}

/**
 * Prepare OCR input without shrinking a tall table into one unreadable image.
 * Tall images are split into overlapping vertical chunks so every row remains legible.
 */
export async function prepareOcrImages(file: File): Promise<UploadedImage[]> {
  validateImageFile(file);
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('Ảnh không có kích thước hợp lệ.');
  }

  const { width, height, scale } = scaledDimensions(image, MAX_OCR_IMAGE_DIMENSION, true);
  const chunked = height > MAX_OCR_CHUNK_HEIGHT;
  const step = chunked ? MAX_OCR_CHUNK_HEIGHT - OCR_CHUNK_OVERLAP : height;
  const chunks: UploadedImage[] = [];

  for (let y = 0; y < height; y += step) {
    const chunkHeight = Math.min(MAX_OCR_CHUNK_HEIGHT, height - y);
    const headerHeight = y > 0 ? Math.min(OCR_HEADER_REFERENCE_HEIGHT, height) : 0;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = headerHeight + chunkHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, headerHeight + chunkHeight);
    if (headerHeight > 0) {
      // Repeat the column header in every later slice so the model can map
      // numeric cells to the correct columns instead of guessing from context.
      context.drawImage(image, 0, 0, image.naturalWidth, headerHeight / scale, 0, 0, width, headerHeight);
    }
    context.drawImage(
      image,
      0,
      y / scale,
      image.naturalWidth,
      chunkHeight / scale,
      0,
      headerHeight,
      width,
      chunkHeight,
    );

    const encoded = encodeCanvas(canvas, MAX_OCR_IMAGE_BYTES, 0.94);
    chunks.push({
      ...encoded,
      fileName: `${file.name.replace(/\.[^.]+$/, '')}-part-${chunks.length + 1}.jpg`,
    });

    if (y + chunkHeight >= height) break;
  }

  return chunks;
}

/** Backward-compatible helper for callers that expect one image. */
export async function prepareOcrImage(file: File): Promise<UploadedImage> {
  const chunks = await prepareOcrImages(file);
  return chunks[0];
}
