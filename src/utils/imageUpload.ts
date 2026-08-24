export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_IMAGE_DIMENSION = 1280;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadedImage {
  dataUrl: string;
  mimeType: 'image/jpeg';
  fileName: string;
  sizeBytes: number;
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

export async function compressImage(file: File): Promise<UploadedImage> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Ảnh gốc vượt quá giới hạn 12 MB.');
  }

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('Ảnh không có kích thước hợp lệ.');
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length * 0.75 > MAX_IMAGE_BYTES && quality > 0.45) {
    quality -= 0.07;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  const sizeBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
  if (sizeBytes > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh sau khi nén vẫn quá lớn. Hãy chọn ảnh nhỏ hơn.');
  }

  return {
    dataUrl,
    mimeType: 'image/jpeg',
    fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
    sizeBytes,
  };
}
