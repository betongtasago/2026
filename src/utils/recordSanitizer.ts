import type { DriverRecord } from '../types';
import { parseInteger, parseVietnameseNumber } from './numberParser';

export function sanitizeDriverRecords(value: unknown): DriverRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => {
      const largeTrips = parseInteger(item.largeTrips);
      const smallTrips = parseInteger(item.smallTrips);
      const explicitTotalTrips = parseInteger(item.totalTrips);
      const totalTrips = largeTrips + smallTrips > 0 ? largeTrips + smallTrips : explicitTotalTrips;

      return {
        ...item,
        id: String(item.id || `server-${index + 1}`),
        stt: item.stt === undefined || item.stt === null ? index + 1 : item.stt as string | number,
        driverName: String(item.driverName || 'Chưa có tên').trim(),
        vehicleNumber: String(item.vehicleNumber || 'Chưa có số xe').trim(),
        stationVolume: parseVietnameseNumber(item.stationVolume),
        largeTrips,
        smallTrips,
        totalKm: parseInteger(item.totalKm),
        totalTrips,
        waterVehicles: parseInteger(item.waterVehicles),
        hasWarning: Boolean(item.hasWarning),
        warningNotes: Array.isArray(item.warningNotes) ? item.warningNotes.map(String) : undefined,
      };
    }) as DriverRecord[];
}
