import html2canvas from 'html2canvas';

const REPORT_CAPTURE_MAX_PIXELS = 36_000_000;

function captureScale(element: HTMLElement, width: number, height: number): number {
  const deviceScale = Math.max(1, window.devicePixelRatio || 1);
  const preferred = element.matches('[data-report-capture]') ? Math.max(3, Math.min(4, deviceScale * 2)) : Math.min(2, deviceScale);
  const safeScale = Math.sqrt(REPORT_CAPTURE_MAX_PIXELS / Math.max(1, width * height));
  return Math.max(1, Math.min(preferred, safeScale));
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Không thể tạo ảnh bảng dữ liệu.'));
    }, 'image/png');
  });
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  cell: HTMLElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const style = window.getComputedStyle(cell);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 8;
  const paddingRight = Number.parseFloat(style.paddingRight) || 8;
  const fontSize = Number.parseFloat(style.fontSize) || 12;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.2;
  const availableWidth = Math.max(8, width - paddingLeft - paddingRight);
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  context.font = style.font || `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= availableWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  context.fillStyle = style.color || '#0f172a';
  context.textBaseline = 'middle';
  const align = style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'right' : 'left';
  context.textAlign = align;
  const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width - paddingRight : x + paddingLeft;
  const maxLines = Math.max(1, Math.floor((height - 8) / lineHeight));
  const visibleLines = lines.slice(0, maxLines);
  const firstY = y + height / 2 - ((visibleLines.length - 1) * lineHeight) / 2;
  visibleLines.forEach((line, index) => context.fillText(line, textX, firstY + index * lineHeight));
}

/**
 * CSS-independent fallback for browsers where html2canvas cannot parse a modern
 * color function or a cloned overflow container. It recreates the visible table
 * cells on a real canvas, so PNG download still works.
 */
async function renderTableWithCanvas(element: HTMLElement): Promise<Blob> {
  const table = element.querySelector<HTMLTableElement>('table');
  const scrollContainer = element.querySelector<HTMLElement>('[data-table-scroll]');
  if (!table) throw new Error('Không tìm thấy bảng dữ liệu để chụp.');

  const previousScrollLeft = scrollContainer?.scrollLeft || 0;
  if (scrollContainer) scrollContainer.scrollLeft = 0;

  const tableRect = table.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(table.scrollWidth || tableRect.width));
  const height = Math.max(1, Math.ceil(table.scrollHeight || tableRect.height));
  const scale = captureScale(element, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ tạo ảnh bảng.');
  context.scale(scale, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  const cells = Array.from(table.querySelectorAll<HTMLElement>('th, td'));
  cells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    const x = rect.left - tableRect.left;
    const y = rect.top - tableRect.top;
    const cellWidth = rect.width;
    const cellHeight = rect.height;
    const style = window.getComputedStyle(cell);

    context.fillStyle = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ? style.backgroundColor
      : '#ffffff';
    context.fillRect(x, y, cellWidth, cellHeight);
    context.strokeStyle = '#d6dee8';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, Math.max(0, cellWidth - 1), Math.max(0, cellHeight - 1));
    drawText(context, cell.innerText || cell.textContent || '', cell, x, y, cellWidth, cellHeight);
  });

  if (scrollContainer) scrollContainer.scrollLeft = previousScrollLeft;
  return canvasBlob(canvas);
}

async function renderFullReportWithSvg(element: HTMLElement, width: number, height: number): Promise<Blob> {
  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.style.width = `${width}px`;
  cloned.style.maxWidth = 'none';
  cloned.style.height = `${height}px`;
  cloned.style.overflow = 'visible';
  cloned.querySelectorAll<HTMLElement>('[data-table-scroll]').forEach((node) => {
    node.style.width = `${width}px`;
    node.style.maxWidth = 'none';
    node.style.height = 'auto';
    node.style.maxHeight = 'none';
    node.style.overflow = 'visible';
  });

  const cssText = Array.from(document.styleSheets).map((sheet) => {
    try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\\n'); } catch { return ''; }
  }).join('\\n');
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const style = document.createElement('style');
  style.textContent = cssText;
  wrapper.append(style, cloned);
  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const image = new Image();
  image.decoding = 'async';
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Không thể dựng ảnh báo cáo đầy đủ.')); });
  const scale = captureScale(element, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ tạo ảnh báo cáo.');
  context.scale(scale, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvasBlob(canvas);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể tạo bản xem trước ảnh.'));
    reader.readAsDataURL(blob);
  });
}

export async function captureElementAsBlob(element: HTMLElement): Promise<Blob> {
  const scrollContainer = element.querySelector<HTMLElement>('[data-table-scroll]');
  const table = element.querySelector<HTMLElement>('table');
  const width = Math.max(element.clientWidth, scrollContainer?.scrollWidth || 0, table?.scrollWidth || 0);
  const height = Math.max(element.scrollHeight, scrollContainer?.scrollHeight || 0, table?.scrollHeight || 0);

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: captureScale(element, width, height),
      width,
      height,
      windowWidth: width,
      windowHeight: Math.max(window.innerHeight, height),
      useCORS: true,
      imageTimeout: 0,
      logging: false,
      onclone: (clonedDocument) => {
        const clonedElement = clonedDocument.querySelector<HTMLElement>('[data-table-capture], [data-report-capture]');
        const clonedScrollContainer = clonedElement?.querySelector<HTMLElement>('[data-table-scroll]');
        if (clonedElement) {
          clonedElement.style.width = `${width}px`;
          clonedElement.style.maxWidth = 'none';
          clonedElement.style.overflow = 'visible';
        }
        if (clonedScrollContainer) {
          clonedScrollContainer.style.width = `${width}px`;
          clonedScrollContainer.style.maxWidth = 'none';
          clonedScrollContainer.style.overflow = 'visible';
          clonedScrollContainer.style.height = 'auto';
          clonedScrollContainer.style.maxHeight = 'none';
        }
      },
    });
    return canvasBlob(canvas);
  } catch (html2CanvasError) {
    console.warn('html2canvas không thể chụp vùng báo cáo, chuyển sang fallback đầy đủ:', html2CanvasError);
    if (element.matches('[data-report-capture]')) {
      return renderFullReportWithSvg(element, width, height);
    }
    return renderTableWithCanvas(element);
  }
}

export async function captureElementAsDataUrl(element: HTMLElement): Promise<string> {
  return blobToDataUrl(await captureElementAsBlob(element));
}

export async function downloadTableScreenshot(element: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await captureElementAsDataUrl(element);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
