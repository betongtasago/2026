import html2canvas from 'html2canvas';

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

export async function downloadTableScreenshot(element: HTMLElement, fileName: string): Promise<void> {
  const scrollContainer = element.querySelector<HTMLElement>('[data-table-scroll]');
  const table = element.querySelector<HTMLElement>('table');
  const width = Math.max(element.clientWidth, scrollContainer?.scrollWidth || 0, table?.scrollWidth || 0);
  const height = Math.max(element.scrollHeight, scrollContainer?.scrollHeight || 0, table?.scrollHeight || 0);

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    width,
    height,
    windowWidth: width,
    windowHeight: Math.max(window.innerHeight, height),
    onclone: (clonedDocument) => {
      const clonedElement = clonedDocument.querySelector<HTMLElement>('[data-table-capture]');
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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Không thể tạo ảnh bảng dữ liệu.');
  downloadBlob(blob, fileName);
}
