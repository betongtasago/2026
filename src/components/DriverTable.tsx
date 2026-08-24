import React from 'react';
import { DriverRecord, SortState, ColumnKey } from '../types';
import {
  ListOrdered,
  User,
  Truck,
  Droplet,
  MapPin,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Car,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';

interface DriverTableProps {
  records: DriverRecord[];
  allFilteredRecords: DriverRecord[];
  sortState: SortState;
  onSort: (key: ColumnKey) => void;
  startIndex: number;
  onEditRow?: (record: DriverRecord) => void;
  onDeleteRow?: (recordId: string) => void;
}

export const DriverTable: React.FC<DriverTableProps> = ({
  records,
  allFilteredRecords,
  sortState,
  onSort,
  startIndex,
  onEditRow,
  onDeleteRow,
}) => {
  // Format STT as 2-digit "01", "02" or "100"
  const formatStt = (index: number) => {
    const num = index + 1;
    return num < 10 ? `0${num}` : `${num}`;
  };

  // Format Station Volume with 1 decimal place
  const formatVolume = (vol: number) => {
    if (vol === null || vol === undefined || isNaN(vol)) return '0.0';
    return Number(vol).toFixed(1);
  };

  // Format KM with thousands separator
  const formatKm = (km: number) => {
    if (km === null || km === undefined || isNaN(km)) return '0';
    return Number(km).toLocaleString('vi-VN');
  };

  // Compute footer totals for current filtered dataset
  const footerTotals = React.useMemo(() => {
    let sumVol = 0;
    let sumLarge = 0;
    let sumSmall = 0;
    let sumKm = 0;
    let sumTrips = 0;
    let sumWater = 0;

    allFilteredRecords.forEach((r) => {
      sumVol += Number(r.stationVolume) || 0;
      sumLarge += Number(r.largeTrips) || 0;
      sumSmall += Number(r.smallTrips) || 0;
      sumKm += Number(r.totalKm) || 0;
      sumTrips += Number(r.totalTrips) || 0;
      sumWater += Number(r.waterVehicles) || 0;
    });

    return {
      sumVol: Number(sumVol.toFixed(1)),
      sumLarge,
      sumSmall,
      sumKm,
      sumTrips,
      sumWater,
    };
  }, [allFilteredRecords]);

  const renderSortIndicator = (key: ColumnKey) => {
    if (sortState.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortState.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-300 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-300 font-bold" />
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse min-w-[960px]">
          {/* THEAD with Deep Blue Theme matching screenshot */}
          <thead>
            {/* Main Header Row */}
            <tr className="bg-gradient-to-r from-[#003B73] via-[#004B93] to-[#00529B] text-white text-xs font-bold uppercase tracking-wider select-none">
              {/* STT */}
              <th
                rowSpan={2}
                className="py-3 px-3 w-16 text-center border-r border-blue-600/40 first:rounded-tl-lg"
              >
                <div className="flex items-center justify-center gap-1">
                  <ListOrdered className="w-4 h-4 text-blue-200" />
                  <span>STT</span>
                </div>
              </th>

              {/* TÊN TÀI XẾ */}
              <th
                rowSpan={2}
                onClick={() => onSort('driverName')}
                className="py-3 px-4 min-w-[200px] border-r border-blue-600/40 cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/40 flex items-center justify-center text-blue-100">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span>TÊN TÀI XẾ</span>
                  </div>
                  {renderSortIndicator('driverName')}
                </div>
              </th>

              {/* SỐ XE */}
              <th
                rowSpan={2}
                onClick={() => onSort('vehicleNumber')}
                className="py-3 px-3.5 min-w-[130px] border-r border-blue-600/40 cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500/40 flex items-center justify-center text-blue-100">
                      <Car className="w-3.5 h-3.5" />
                    </div>
                    <span>SỐ XE</span>
                  </div>
                  {renderSortIndicator('vehicleNumber')}
                </div>
              </th>

              {/* KL TRẠM TN (m³) */}

              <th
                rowSpan={2}
                onClick={() => onSort('stationVolume')}
                className="py-3 px-3.5 min-w-[140px] text-center border-r border-blue-600/40 cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-purple-400/40 flex items-center justify-center text-purple-200">
                    <Droplet className="w-3.5 h-3.5" />
                  </div>
                  <span>KL TRẠM TN (m³)</span>
                  {renderSortIndicator('stationVolume')}
                </div>
              </th>

              {/* GROUP HEADER: CHUYẾN */}
              <th
                colSpan={2}
                className="py-2 px-3 text-center border-r border-b border-blue-600/40 bg-blue-900/40"
              >
                <span className="text-[11px] font-black tracking-widest text-blue-100">CHUYẾN</span>
              </th>

              {/* TỔNG KM */}
              <th
                rowSpan={2}
                onClick={() => onSort('totalKm')}
                className="py-3 px-3.5 min-w-[120px] text-center border-r border-blue-600/40 cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-400/40 flex items-center justify-center text-emerald-200">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span>TỔNG KM</span>
                  {renderSortIndicator('totalKm')}
                </div>
              </th>

              {/* TỔNG CHUYẾN */}
              <th
                rowSpan={2}
                onClick={() => onSort('totalTrips')}
                className="py-3 px-3.5 min-w-[125px] text-center border-r border-blue-600/40 cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-rose-400/40 flex items-center justify-center text-rose-200">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </div>
                  <span>TỔNG CHUYẾN</span>
                  {renderSortIndicator('totalTrips')}
                </div>
              </th>

              {/* XE NƯỚC */}
              <th
                rowSpan={2}
                onClick={() => onSort('waterVehicles')}
                className="py-3 px-3.5 min-w-[110px] text-center last:rounded-tr-lg cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-sky-400/40 flex items-center justify-center text-sky-200">
                    <Droplet className="w-3.5 h-3.5" />
                  </div>
                  <span>XE NƯỚC</span>
                  {renderSortIndicator('waterVehicles')}
                </div>
              </th>

              {/* Actions (if edit handler provided) */}
              {(onEditRow || onDeleteRow) && (
                <th rowSpan={2} className="py-3 px-2 w-16 text-center">
                  <span className="text-[10px] opacity-75">TÁC VỤ</span>
                </th>
              )}
            </tr>

            {/* Sub-header row for CHUYẾN LỚN / CHUYẾN NHỎ */}
            <tr className="bg-[#004B93] text-white text-[11px] font-bold uppercase select-none border-b border-blue-600/40">
              {/* CHUYẾN LỚN */}
              <th
                onClick={() => onSort('largeTrips')}
                className="py-1.5 px-3 min-w-[105px] text-center border-r border-blue-600/40 cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-amber-300">🚚</span>
                  <span>CHUYẾN LỚN</span>
                  {renderSortIndicator('largeTrips')}
                </div>
              </th>

              {/* CHUYẾN NHỎ */}
              <th
                onClick={() => onSort('smallTrips')}
                className="py-1.5 px-3 min-w-[105px] text-center border-r border-blue-600/40 cursor-pointer hover:bg-blue-800/40 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-amber-200">🚛</span>
                  <span>CHUYẾN NHỎ</span>
                  {renderSortIndicator('smallTrips')}
                </div>
              </th>
            </tr>
          </thead>

          {/* TBODY */}
          <tbody className="divide-y divide-slate-100 text-sm font-medium">
            {records.map((record, index) => {
              const currentStt = formatStt(startIndex + index);
              const isWarning = record.hasWarning || record.driverName.endsWith('.');

              return (
                <tr
                  key={record.id}
                  id={`driver-row-${record.id}`}
                  className="hover:bg-blue-50/50 transition-colors group"
                >
                  {/* STT: Rounded Royal Blue Pill */}
                  <td className="py-2.5 px-3 text-center border-r border-slate-100">
                    <span className="inline-flex items-center justify-center w-8 h-7 text-xs font-bold text-white bg-[#0066CC] rounded-lg shadow-xs">
                      {currentStt}
                    </span>
                  </td>

                  {/* TÊN TÀI XẾ */}
                  <td className="py-2.5 px-4 border-r border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`font-semibold tracking-tight truncate ${
                            isWarning ? 'text-slate-900 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {record.driverName}
                        </span>
                        {isWarning && (
                          <span
                            title={record.warningNotes?.join(', ') || 'Tên có dấu chấm đuôi / cảnh báo'}
                            className="inline-flex items-center text-amber-500 shrink-0"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* SỐ XE */}
                  <td className="py-2.5 px-3.5 border-r border-slate-100 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Car className="w-3 h-3" />
                      </div>
                      <span className="font-bold text-slate-800 tracking-wide font-mono text-[13px]">
                        {record.vehicleNumber}
                      </span>
                    </div>
                  </td>

                  {/* KL TRẠM TN (m³): Light purple tint */}

                  <td className="py-2.5 px-3.5 text-center border-r border-slate-100 bg-[#FBF7FE]/60">
                    <span className="font-bold text-purple-700 text-sm tracking-tight">
                      {formatVolume(record.stationVolume)}
                    </span>
                  </td>

                  {/* CHUYẾN LỚN: Light orange tint */}
                  <td className="py-2.5 px-3 text-center border-r border-slate-100 bg-[#FFF9F3]/70">
                    <span className="font-bold text-amber-600 text-sm">
                      {record.largeTrips}
                    </span>
                  </td>

                  {/* CHUYẾN NHỎ: Light yellow tint */}
                  <td className="py-2.5 px-3 text-center border-r border-slate-100 bg-[#FFFDF0]/80">
                    <span className="font-bold text-amber-500 text-sm">
                      {record.smallTrips}
                    </span>
                  </td>

                  {/* TỔNG KM: Light emerald tint */}
                  <td className="py-2.5 px-3.5 text-center border-r border-slate-100 bg-[#F3FAF5]/70">
                    <span className="font-bold text-emerald-700 text-sm tracking-tight font-mono">
                      {formatKm(record.totalKm)}
                    </span>
                  </td>

                  {/* TỔNG CHUYẾN: Light rose tint */}
                  <td className="py-2.5 px-3.5 text-center border-r border-slate-100 bg-[#FFF4F4]/70">
                    <span className="font-black text-red-600 text-sm">
                      {record.totalTrips}
                    </span>
                  </td>

                  {/* XE NƯỚC: Light sky blue tint */}
                  <td className="py-2.5 px-3.5 text-center bg-[#F3F9FF]/70">
                    <span
                      className={`font-bold text-sm ${
                        record.waterVehicles > 0 ? 'text-blue-700 font-black' : 'text-blue-500'
                      }`}
                    >
                      {record.waterVehicles}
                    </span>
                  </td>

                  {/* Optional actions */}
                  {(onEditRow || onDeleteRow) && (
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEditRow && (
                          <button
                            type="button"
                            onClick={() => onEditRow(record)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Chỉnh sửa bản ghi"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteRow && (
                          <button
                            type="button"
                            onClick={() => onDeleteRow(record.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Xóa dòng này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* TFOOT TOTALS ROW */}
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 text-xs font-bold text-slate-800">
              <td colSpan={3} className="py-3 px-4 text-left border-r border-slate-200">

                <span className="font-extrabold uppercase text-slate-700 tracking-wider">
                  TỔNG CỘNG ({allFilteredRecords.length} TÀI XẾ)
                </span>
              </td>
              <td className="py-3 px-3.5 text-center border-r border-slate-200 text-purple-800 font-extrabold">
                {footerTotals.sumVol.toLocaleString('vi-VN', { minimumFractionDigits: 1 })}
              </td>
              <td className="py-3 px-3 text-center border-r border-slate-200 text-amber-700 font-extrabold">
                {footerTotals.sumLarge.toLocaleString('vi-VN')}
              </td>
              <td className="py-3 px-3 text-center border-r border-slate-200 text-amber-600 font-extrabold">
                {footerTotals.sumSmall.toLocaleString('vi-VN')}
              </td>
              <td className="py-3 px-3.5 text-center border-r border-slate-200 text-emerald-800 font-extrabold font-mono">
                {footerTotals.sumKm.toLocaleString('vi-VN')}
              </td>
              <td className="py-3 px-3.5 text-center border-r border-slate-200 text-red-700 font-extrabold">
                {footerTotals.sumTrips.toLocaleString('vi-VN')}
              </td>
              <td className="py-3 px-3.5 text-center text-blue-800 font-extrabold">
                {footerTotals.sumWater.toLocaleString('vi-VN')}
              </td>
              {(onEditRow || onDeleteRow) && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
