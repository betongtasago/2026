export interface DriverRecord {
  id: string;
  stt?: number | string;
  driverName: string;
  vehicleNumber: string;
  stationVolume: number;
  largeTrips: number;
  smallTrips: number;
  totalKm: number;
  totalTrips: number;
  waterVehicles: number;
  hasWarning?: boolean;
  warningNotes?: string[];
  rawRowIndex?: number;

}

export type ColumnKey =
  | 'stt'
  | 'driverName'
  | 'vehicleNumber'
  | 'stationVolume'
  | 'largeTrips'
  | 'smallTrips'
  | 'totalKm'
  | 'totalTrips'
  | 'waterVehicles';

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  description: string;
  required: boolean;
  aliases: string[];
  type: 'string' | 'number';
}

export interface ColumnMappingItem {
  targetKey: ColumnKey;
  targetLabel: string;
  excelHeader: string;
  excelColIndex: number;
  isMapped: boolean;
  confidence: number;
}

export interface ImportErrorItem {
  rowIndex: number;
  driverName?: string;
  field: string;
  message: string;
  rawValue?: any;
}

export interface ParsedSheetData {
  sheetName: string;
  headers: string[];
  headerRowIndex: number;
  rawRows: any[][];
  previewRows: any[][];
  columnMappings: ColumnMappingItem[];
  matchedColumnCount: number;
}

export interface FilterState {
  searchQuery: string;
  driverName: string;
  vehicleNumber: string;
  minStationVolume: number | null;
  maxStationVolume: number | null;
  minTotalKm: number | null;
  maxTotalKm: number | null;
  minLargeTrips: number | null;
  maxLargeTrips: number | null;
  minSmallTrips: number | null;
  maxSmallTrips: number | null;
  waterVehicles: string;
}

export interface SortState {
  key: ColumnKey | null;
  direction: 'asc' | 'desc';
}

export interface SummaryStats {
  totalDrivers: number;
  uniqueDrivers: number;
  uniqueVehicles: number;
  totalStationVolume: number;
  totalLargeTrips: number;
  totalSmallTrips: number;
  totalTrips: number;
  totalKm: number;
  totalWaterVehicles: number;
  avgKmPerDriver: number;
  avgStationVolume: number;
}
