import { parseInteger, parseVietnameseNumber } from './numberParser';

export interface NormalizedOcrTripRow {
  stt: number;
  driverName: string;
  vehicleNumber: string;
  stationVolume: number;
  largeTrips: number;
  smallTrips: number;
  totalKm: number;
  totalTrips: number;
  waterVehicles: number;
  rawRowIndex: number;
  needsReview?: boolean;
  warningNotes?: string[];
}

function textValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = parseInteger(value);
  return parsed > 0 ? parsed : fallback;
}

export function normalizeOcrRows(value: unknown): NormalizedOcrTripRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => {
      const driverName = textValue(item.driverName ?? item.driver ?? item.driver_name);
      const vehicleNumber = textValue(item.vehicleNumber ?? item.vehicle ?? item.licensePlate ?? item.license_plate);
      const largeTrips = parseInteger(item.largeTrips ?? item.large ?? item.large_trip);
      const smallTrips = parseInteger(item.smallTrips ?? item.small ?? item.small_trip);
      const explicitTotalTrips = parseInteger(item.totalTrips ?? item.total ?? item.trips);
      const derivedTotalTrips = largeTrips + smallTrips;
      const warningNotes: string[] = [];

      if (!driverName) warningNotes.push('Thiếu tên tài xế');
      if (!vehicleNumber) warningNotes.push('Thiếu số xe');
      if (derivedTotalTrips > 0 && explicitTotalTrips !== derivedTotalTrips) {
        warningNotes.push(`Tổng chuyến đã sửa từ ${explicitTotalTrips} thành ${derivedTotalTrips}`);
      }

      const rawRowIndex = positiveInteger(item.rawRowIndex ?? item.rowIndex ?? item.stt, index + 1);
      return {
        stt: rawRowIndex,
        driverName,
        vehicleNumber,
        stationVolume: parseVietnameseNumber(item.stationVolume ?? item.station_volume ?? item.volume),
        largeTrips,
        smallTrips,
        totalKm: parseInteger(item.totalKm ?? item.total_km ?? item.km),
        totalTrips: derivedTotalTrips > 0 ? derivedTotalTrips : explicitTotalTrips,
        waterVehicles: parseInteger(item.waterVehicles ?? item.water ?? item.water_trips),
        rawRowIndex,
        needsReview: !driverName || !vehicleNumber,
        warningNotes,
      } satisfies NormalizedOcrTripRow;
    });
}
