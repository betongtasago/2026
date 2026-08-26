/**
 * Parse numbers commonly produced by Vietnamese spreadsheets and OCR.
 * Supports values such as 356.5, 356,5, 1,683 and 1.234,56.
 */
export function parseVietnameseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let text = String(value).trim();
  if (!text || text === '-' || text === '—' || text === 'N/A' || text.toLowerCase() === 'null') return 0;

  const isNegative = text.startsWith('-');
  if (isNegative) text = text.slice(1).trim();

  // OCR may attach currency/unit symbols or spaces to a number.
  text = text.replace(/[^0-9,\.]/g, '');
  if (!text) return 0;

  if (text.includes(',') && text.includes('.')) {
    const commaIndex = text.indexOf(',');
    const dotIndex = text.indexOf('.');
    if (commaIndex < dotIndex) {
      // 1,234.56
      text = text.replace(/,/g, '');
    } else {
      // 1.234,56
      text = text.replace(/\./g, '').replace(',', '.');
    }
  } else if (text.includes(',')) {
    const parts = text.split(',');
    if (parts.length === 2 && (parts[1].length === 1 || parts[1].length === 2)) {
      // 356,5 or 12,50
      text = `${parts[0]}.${parts[1]}`;
    } else if (parts.length > 1 && parts.slice(1).every((part) => part.length === 3)) {
      // 1,683 or 12,000,000
      text = text.replace(/,/g, '');
    } else {
      text = text.replace(/,/g, '.');
    }
  } else if (text.includes('.')) {
    // Keep a single dot as a decimal separator. Remove repeated thousands dots.
    if (text.split('.').length > 2) text = text.replace(/\./g, '');
  }

  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

export function parseInteger(value: unknown): number {
  if (typeof value === 'string') {
    const text = value.trim();
    const isGroupedThousands = /^-?\d{1,3}\.\d{3}$/.test(text);
    if (isGroupedThousands) {
      const negative = text.startsWith('-');
      const digits = text.replace(/[^0-9]/g, '');
      const grouped = Number(digits);
      return Number.isFinite(grouped) ? (negative ? -grouped : grouped) : 0;
    }
  }
  return Math.round(parseVietnameseNumber(value));
}
