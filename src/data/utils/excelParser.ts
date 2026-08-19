import * as XLSX from 'xlsx';
import { ColumnDefinition, ColumnKey, ColumnMappingItem, DriverRecord, ImportErrorItem, ParsedSheetData } from '../types';

export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  {
    key: 'stt',
    label: 'STT',
    description: 'Số thứ tự dòng',
    required: false,
    aliases: ['stt', 'sothutu', 'no', 'idx', 'index', 'thutu', 'sott'],
    type: 'number',
  },
  {
    key: 'driverName',
    label: 'TÊN TÀI XẾ',
    description: 'Họ và tên người lái xe',
    required: true,
    aliases: [
      'tentaixe',
      'taixe',
      'tenlaixe',
      'laixe',
      'hovaten',
      'hotentaixe',
      'tentaixe.',
      'driver',
      'drivername',
      'tx',
      'hoten',
      'nguoilaixe',
    ],
    type: 'string',
  },
  {
    key: 'vehicleNumber',
    label: 'SỐ XE',
    description: 'Biển số phương tiện',
    required: true,
    aliases: [
      'soxe',
      'bienso',
      'biensoxe',
      'bsx',
      'bienkiemsoat',
      'bks',
      'vehicle',
      'truckno',
      'xe',
      'sohieu',
      'soxevanchuyen',
    ],
    type: 'string',
  },
  {
    key: 'stationVolume',
    label: 'KL TRẠM TN (m³)',
    description: 'Khối lượng trạm tiếp nhận (m³)',
    required: false,
    aliases: [
      'kltramtn',
      'kltramtnm3',
      'kltramtn(m3)',
      'khoiluongtram',
      'kltram',
      'khoiluong(m3)',
      'khoiluong',
      'kl(m3)',
      'kl',
      'tramtn',
      'volume',
      'khoiluongtramtn',
      'kltramtiepnhan',
    ],
    type: 'number',
  },
  {
    key: 'largeTrips',
    label: 'CHUYẾN LỚN',
    description: 'Số chuyến xe tải trọng lớn',
    required: false,
    aliases: [
      'chuyenlon',
      'chuyenlon(chuyen)',
      'lon',
      'xelon',
      'triplarge',
      'chuyen>=',
      'cl',
      'soluongchuyenlon',
    ],
    type: 'number',
  },
  {
    key: 'smallTrips',
    label: 'CHUYẾN NHỎ',
    description: 'Số chuyến xe tải trọng nhỏ',
    required: false,
    aliases: [
      'chuyennho',
      'chuyennho(chuyen)',
      'nho',
      'xenho',
      'tripsmall',
      'chuyen<',
      'cn',
      'soluongchuyennho',
    ],
    type: 'number',
  },
  {
    key: 'totalKm',
    label: 'TỔNG KM',
    description: 'Tổng số km đã di chuyển',
    required: false,
    aliases: [
      'tongkm',
      'tongso km',
      'sokm',
      'km',
      'quangduong(km)',
      'quangduong',
      'totalkm',
      'kilomet',
      'tongquangduong',
    ],
    type: 'number',
  },
  {
    key: 'totalTrips',
    label: 'TỔNG CHUYẾN',
    description: 'Tổng số lượt chuyến chạy',
    required: false,
    aliases: [
      'tongchuyen',
      'tongsochuyen',
      'chuyentong',
      'totaltrips',
      'tongluotchuyen',
      'soluongchuyen',
    ],
    type: 'number',
  },
  {
    key: 'waterVehicles',
    label: 'XE NƯỚC',
    description: 'Số lượng chuyến / xe nước',
    required: false,
    aliases: [
      'xenuoc',
      'soxenuoc',
      'xebonnuoc',
      'watertruck',
      'xn',
      'chuyennuoc',
      'nuoc',
    ],
    type: 'number',
  },
];

/**
 * Remove Vietnamese accents and special characters for flexible comparison
 */
export function normalizeStringForComparison(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[\s\-_().,:;'"[\]{}*#/?\\+=|~`!@$%^&]/g, '') // remove spaces & symbols
    .replace(/m3|m³|m\^3/g, 'm3')
    .trim();
}

/**
 * Safe numeric conversion supporting Vietnamese formatted numbers:
 * 356.5, 356,5, 1,683, 1.683, etc.
 */
export function parseVietnameseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (str === '' || str === '-' || str === '—' || str === 'N/A' || str === 'null') {
    return 0;
  }

  // Handle negative sign
  const isNegative = str.startsWith('-');
  if (isNegative) str = str.substring(1).trim();

  // Pattern cases:
  // Case 1: "1,683" (thousands comma) vs "356,5" (decimal comma)
  // If comma is followed by exactly 1 or 2 digits at the end -> likely decimal comma (e.g. 356,5 or 12,50)
  // If comma is followed by exactly 3 digits and no other dot/comma -> could be 1,683 (thousands separator)
  if (str.includes(',') && str.includes('.')) {
    // Both exist: usually 1,234.56 or 1.234,56
    const firstComma = str.indexOf(',');
    const firstDot = str.indexOf('.');
    if (firstComma < firstDot) {
      // 1,234.56 -> remove commas
      str = str.replace(/,/g, '');
    } else {
      // 1.234,56 -> remove dots, change comma to dot
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && (parts[1].length === 1 || parts[1].length === 2)) {
      // Decimal comma: "356,5" -> "356.5"
      str = parts[0] + '.' + parts[1];
    } else if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) {
      // Thousands comma: "1,683" or "12,000,000"
      str = str.replace(/,/g, '');
    } else {
      // General single comma fallback
      str = str.replace(',', '.');
    }
  } else if (str.includes('.')) {
    // E.g. "1.683" as thousands or "356.5" as decimal
    const parts = str.split('.');
    if (parts.length > 2) {
      // Multiple dots -> thousands separators: "1.000.000"
      str = str.replace(/\./g, '');
    } else if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1 && Number(parts[0]) >= 1) {
      // Ambiguous: Could be 1.683 km (meaning 1683) or a 3-decimal float like 1.683
      // We will parse standard float, but if totalKm typically > 100, we leave standard float unless context specifies
      // Standard JavaScript parseFloat handles "356.5" and "1.683"
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/**
 * Match a raw Excel header string against our standard column definitions
 */
export function matchColumnDefinition(rawHeader: string): { targetKey: ColumnKey; confidence: number } | null {
  if (!rawHeader) return null;
  const normalized = normalizeStringForComparison(rawHeader);
  if (!normalized) return null;

  let bestMatch: { targetKey: ColumnKey; confidence: number } | null = null;
  let highestConfidence = 0;

  for (const colDef of COLUMN_DEFINITIONS) {
    // Exact match on key or label
    if (
      normalized === normalizeStringForComparison(colDef.key) ||
      normalized === normalizeStringForComparison(colDef.label)
    ) {
      return { targetKey: colDef.key, confidence: 1.0 };
    }

    // Exact match in aliases
    for (const alias of colDef.aliases) {
      const normAlias = normalizeStringForComparison(alias);
      if (normalized === normAlias) {
        return { targetKey: colDef.key, confidence: 0.95 };
      }
      // Substring match
      if (normalized.includes(normAlias) && normAlias.length >= 3) {
        const conf = 0.7 + (normAlias.length / normalized.length) * 0.2;
        if (conf > highestConfidence) {
          highestConfidence = conf;
          bestMatch = { targetKey: colDef.key, confidence: conf };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Parse an Excel workbook file from ArrayBuffer
 */
export function parseWorkbookFile(buffer: ArrayBuffer): {
  workbook: XLSX.WorkBook;
  sheetNames: string[];
  parsedSheets: Record<string, ParsedSheetData>;
  bestSheetName: string;
} {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const sheetNames = workbook.SheetNames;
  const parsedSheets: Record<string, ParsedSheetData> = {};
  let bestSheetName = sheetNames[0] || '';
  let maxMatchedCols = -1;

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert sheet to array of rows
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    if (rows.length === 0) {
      parsedSheets[sheetName] = {
        sheetName,
        headers: [],
        headerRowIndex: 0,
        rawRows: [],
        previewRows: [],
        columnMappings: [],
        matchedColumnCount: 0,
      };
      continue;
    }

    // Find header row: Search first 10 rows for the row with highest column matches
    let bestHeaderRowIndex = 0;
    let bestRowMatchedCount = 0;
    let bestRowMappings: ColumnMappingItem[] = [];
    let bestHeaders: string[] = [];

    const searchLimit = Math.min(rows.length, 12);
    for (let r = 0; r < searchLimit; r++) {
      const candidateHeaders = (rows[r] || []).map((c) => String(c ?? '').trim());
      if (candidateHeaders.filter(Boolean).length === 0) continue;

      const mappings: ColumnMappingItem[] = [];
      const usedKeys = new Set<ColumnKey>();
      let matchCount = 0;

      COLUMN_DEFINITIONS.forEach((colDef) => {
        let bestColIdx = -1;
        let bestConf = 0;
        let matchedHeaderStr = '';

        candidateHeaders.forEach((rawH, idx) => {
          if (!rawH) return;
          const match = matchColumnDefinition(rawH);
          if (match && match.targetKey === colDef.key && match.confidence > bestConf) {
            bestConf = match.confidence;
            bestColIdx = idx;
            matchedHeaderStr = rawH;
          }
        });

        if (bestColIdx !== -1 && !usedKeys.has(colDef.key)) {
          usedKeys.add(colDef.key);
          matchCount++;
          mappings.push({
            targetKey: colDef.key,
            targetLabel: colDef.label,
            excelHeader: matchedHeaderStr,
            excelColIndex: bestColIdx,
            isMapped: true,
            confidence: bestConf,
          });
        } else {
          mappings.push({
            targetKey: colDef.key,
            targetLabel: colDef.label,
            excelHeader: '',
            excelColIndex: -1,
            isMapped: false,
            confidence: 0,
          });
        }
      });

      if (matchCount > bestRowMatchedCount) {
        bestRowMatchedCount = matchCount;
        bestHeaderRowIndex = r;
        bestRowMappings = mappings;
        bestHeaders = candidateHeaders;
      }
    }

    // Extract data rows after header
    const dataRows = rows.slice(bestHeaderRowIndex + 1);

    parsedSheets[sheetName] = {
      sheetName,
      headers: bestHeaders,
      headerRowIndex: bestHeaderRowIndex,
      rawRows: dataRows,
      previewRows: dataRows.slice(0, 10),
      columnMappings: bestRowMappings,
      matchedColumnCount: bestRowMatchedCount,
    };

    if (bestRowMatchedCount > maxMatchedCols) {
      maxMatchedCols = bestRowMatchedCount;
      bestSheetName = sheetName;
    }
  }

  return {
    workbook,
    sheetNames,
    parsedSheets,
    bestSheetName,
  };
}

/**
 * Process raw sheet rows using column mappings into normalized DriverRecord[]
 */
export function normalizeExcelRows(
  rawRows: any[][],
  columnMappings: ColumnMappingItem[]
): {
  records: DriverRecord[];
  errors: ImportErrorItem[];
  validCount: number;
  warningCount: number;
  skippedCount: number;
} {
  const records: DriverRecord[] = [];
  const errors: ImportErrorItem[] = [];
  let skippedCount = 0;
  let warningCount = 0;

  // Build key to colIndex lookup map
  const mappingMap = new Map<ColumnKey, number>();
  columnMappings.forEach((m) => {
    if (m.isMapped && m.excelColIndex >= 0) {
      mappingMap.set(m.targetKey, m.excelColIndex);
    }
  });

  const driverColIdx = mappingMap.get('driverName') ?? -1;
  const vehicleColIdx = mappingMap.get('vehicleNumber') ?? -1;

  rawRows.forEach((row, rowIndex) => {
    // Check if entire row is empty
    const isRowEmpty = row.every((c) => c === null || c === undefined || String(c).trim() === '');
    if (isRowEmpty) {
      skippedCount++;
      return;
    }

    const getRaw = (key: ColumnKey) => {
      const idx = mappingMap.get(key);
      if (idx === undefined || idx < 0 || idx >= row.length) return '';
      return row[idx];
    };

    const rawDriverName = String(getRaw('driverName') ?? '').trim();
    const rawVehicle = String(getRaw('vehicleNumber') ?? '').trim();

    // Check if both primary fields are empty (e.g. footer row, notes row, summary row)
    if (!rawDriverName && !rawVehicle) {
      skippedCount++;
      return;
    }

    // If driver name starts with "Tổng", "Cộng", "Ghi chú", etc. and is a summary row
    const lowerDriver = rawDriverName.toLowerCase();
    if (
      lowerDriver.startsWith('tổng') ||
      lowerDriver.startsWith('cộng') ||
      lowerDriver.startsWith('tong cong') ||
      lowerDriver.startsWith('ghi chú')
    ) {
      skippedCount++;
      return;
    }

    const rowWarnings: string[] = [];

    // Parse numeric fields
    const rawStt = getRaw('stt');
    let sttVal: number | string = rowIndex + 1;
    if (rawStt !== '' && rawStt !== null && rawStt !== undefined) {
      const parsedStt = parseInt(String(rawStt).trim(), 10);
      if (!isNaN(parsedStt) && parsedStt > 0) {
        sttVal = parsedStt;
      }
    }

    const stationVolume = parseVietnameseNumber(getRaw('stationVolume'));
    const largeTrips = Math.round(parseVietnameseNumber(getRaw('largeTrips')));
    const smallTrips = Math.round(parseVietnameseNumber(getRaw('smallTrips')));
    const totalKm = Math.round(parseVietnameseNumber(getRaw('totalKm')));
    let totalTrips = Math.round(parseVietnameseNumber(getRaw('totalTrips')));
    const waterVehicles = Math.round(parseVietnameseNumber(getRaw('waterVehicles')));

    // If totalTrips is 0 or empty, but large + small > 0, we can compute or check
    if (totalTrips === 0 && (largeTrips > 0 || smallTrips > 0)) {
      totalTrips = largeTrips + smallTrips;
    }

    // Validation checks
    if (!rawDriverName) {
      rowWarnings.push('Thiếu tên tài xế');
      errors.push({
        rowIndex: rowIndex + 1,
        driverName: 'Chưa có tên',
        field: 'driverName',
        message: 'Tên tài xế để trống',
        rawValue: '',
      });
    }

    if (!rawVehicle) {
      rowWarnings.push('Thiếu số xe');
      errors.push({
        rowIndex: rowIndex + 1,
        driverName: rawDriverName,
        field: 'vehicleNumber',
        message: 'Biển số xe để trống',
        rawValue: '',
      });
    }

    // Check for dot suffix in driver name as duplicate indicator
    if (rawDriverName.endsWith('.')) {
      rowWarnings.push('Tên có ký tự đặc biệt/dấu chấm');
    }

    const hasWarning = rowWarnings.length > 0;
    if (hasWarning) {
      warningCount++;
    }

    const record: DriverRecord = {
      id: `imported-${Date.now()}-${rowIndex}-${Math.random().toString(36).substring(2, 7)}`,
      stt: sttVal,
      driverName: rawDriverName || '—',
      vehicleNumber: rawVehicle || '—',
      stationVolume: Number(stationVolume.toFixed(1)),
      largeTrips,
      smallTrips,
      totalKm,
      totalTrips,
      waterVehicles,
      hasWarning,
      warningNotes: rowWarnings,
      rawRowIndex: rowIndex + 1,
    };

    records.push(record);
  });

  return {
    records,
    errors,
    validCount: records.length,
    warningCount,
    skippedCount,
  };
}
