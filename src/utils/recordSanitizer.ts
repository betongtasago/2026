import { DriverRecord } from '../types';

function finiteNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeDriverRecords(value: unknown): DriverRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      ...item,
      id: String(item.id || `server-${index + 1}`),
      stt: item.stt === undefined || item.stt === null ? index + 1 : item.stt as string | number,
      driverName: String(item.driverName || 'Chưa có tên').trim(),
      vehicleNumber: String(item.vehicleNumber || 'Chưa có số xe').trim(),
      stationVolume: finiteNumber(item.stationVolume),
      largeTrips: finiteNumber(item.largeTrips),
      smallTrips: finiteNumber(item.smallTrips),
      totalKm: finiteNumber(item.totalKm),
      totalTrips: finiteNumber(item.totalTrips),
      waterVehicles: finiteNumber(item.waterVehicles),
      hasWarning: Boolean(item.hasWarning),
      warningNotes: Array.isArray(item.warningNotes) ? item.warningNotes.map(String) : undefined,
    })) as DriverRecord[];
}
