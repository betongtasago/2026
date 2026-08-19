import * as XLSX from 'xlsx';
import { DriverRecord } from '../types';

export function exportDriversToExcel(records: DriverRecord[], filename = 'BaoCaoTaiXe.xlsx') {
  const exportData = records.map((r, index) => ({
    'STT': index + 1,
    'TÊN TÀI XẾ': r.driverName,
    'SỐ XE': r.vehicleNumber,
    'KL TRẠM TN (m³)': r.stationVolume,
    'CHUYẾN LỚN': r.largeTrips,
    'CHUYẾN NHỎ': r.smallTrips,
    'TỔNG KM': r.totalKm,
    'TỔNG CHUYẾN': r.totalTrips,
    'XE NƯỚC': r.waterVehicles,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 24 }, // TÊN TÀI XẾ
    { wch: 14 }, // SỐ XE
    { wch: 18 }, // KL TRẠM TN
    { wch: 14 }, // CHUYẾN LỚN
    { wch: 14 }, // CHUYẾN NHỎ
    { wch: 14 }, // TỔNG KM
    { wch: 14 }, // TỔNG CHUYẾN
    { wch: 12 }, // XE NƯỚC
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo tài xế');

  XLSX.writeFile(workbook, filename);
}

export function exportDriversToCSV(records: DriverRecord[], filename = 'BaoCaoTaiXe.csv') {
  const headers = [
    'STT',
    'TÊN TÀI XẾ',
    'SỐ XE',
    'KL TRẠM TN (m³)',
    'CHUYẾN LỚN',
    'CHUYẾN NHỎ',
    'TỔNG KM',
    'TỔNG CHUYẾN',
    'XE NƯỚC',
  ];

  const rows = records.map((r, index) => [
    index + 1,
    `"${r.driverName.replace(/"/g, '""')}"`,
    `"${r.vehicleNumber.replace(/"/g, '""')}"`,
    r.stationVolume.toFixed(1),
    r.largeTrips,
    r.smallTrips,
    r.totalKm,
    r.totalTrips,
    r.waterVehicles,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
