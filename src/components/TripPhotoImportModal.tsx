import React, { useMemo, useRef, useState } from 'react';
import { DriverRecord } from '../types';
import { apiFetch } from '../api';
import { prepareOcrImage } from '../utils/imageUpload';
import { normalizeStringForComparison } from '../utils/excelParser';
import { CheckCircle2, FileImage, ListChecks, Loader2, ScanLine, Upload, X, Zap } from 'lucide-react';

interface OcrTripRow {
  stt?: number;
  driverName: string;
  vehicleNumber: string;
  stationVolume?: number;
  largeTrips?: number;
  smallTrips?: number;
  totalKm?: number;
  totalTrips?: number;
  waterVehicles?: number;
}

interface TripPhotoImportModalProps {
  isOpen: boolean;
  records: DriverRecord[];
  onClose: () => void;
  onApply: (records: DriverRecord[], syncedCount: number, totalCount: number) => Promise<void> | void;
}

const numericFields: Array<keyof Pick<DriverRecord, 'stationVolume' | 'largeTrips' | 'smallTrips' | 'totalKm' | 'totalTrips' | 'waterVehicles'>> = [
  'stationVolume',
  'largeTrips',
  'smallTrips',
  'totalKm',
  'totalTrips',
  'waterVehicles',
];

function normalizeVehicleNumber(value: string): string {
  return normalizeStringForComparison(value).replace(/[^a-z0-9]/g, '');
}

function findMatchingRecord(row: OcrTripRow, records: DriverRecord[]): DriverRecord | undefined {
  const vehicle = normalizeVehicleNumber(row.vehicleNumber);
  const driver = normalizeStringForComparison(row.driverName);
  return records.find((record) => {
    const sameVehicle = vehicle && normalizeVehicleNumber(record.vehicleNumber) === vehicle;
    const sameDriver = driver && normalizeStringForComparison(record.driverName) === driver;
    return Boolean(sameVehicle || sameDriver);
  });
}

function mergeOcrRow(record: DriverRecord, row: OcrTripRow): DriverRecord {
  const updated: DriverRecord = { ...record };
  numericFields.forEach((field) => {
    const value = row[field];
    if (typeof value === 'number' && Number.isFinite(value)) updated[field] = value as never;
  });
  if (typeof row.totalTrips !== 'number' && typeof row.largeTrips === 'number' && typeof row.smallTrips === 'number') {
    updated.totalTrips = row.largeTrips + row.smallTrips;
  }
  return updated;
}

function createRecordFromOcr(row: OcrTripRow, index: number, currentCount: number): DriverRecord {
  const blank: DriverRecord = {
    id: `ocr-${Date.now()}-${index}`,
    stt: row.stt || currentCount + index + 1,
    driverName: row.driverName.trim(),
    vehicleNumber: row.vehicleNumber.trim().toUpperCase(),
    stationVolume: 0,
    largeTrips: 0,
    smallTrips: 0,
    totalKm: 0,
    totalTrips: 0,
    waterVehicles: 0,
  };
  return mergeOcrRow(blank, row);
}

function formatValue(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—';
}

export const TripPhotoImportModal: React.FC<TripPhotoImportModalProps> = ({
  isOpen,
  records,
  onClose,
  onApply,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const [rows, setRows] = useState<OcrTripRow[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [isReading, setIsReading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => rows.map((row) => findMatchingRecord(row, records)), [rows, records]);
  const matchedCount = matches.filter(Boolean).length;
  const selectedCount = selectedIndexes.size;
  const selectedMatchedCount = Array.from(selectedIndexes).filter((index) => Boolean(matches[index])).length;
  const selectedNewCount = selectedCount - selectedMatchedCount;
  const allRowsSelected = rows.length > 0 && selectedCount === rows.length;

  if (!isOpen) return null;

  const reset = () => {
    setImageDataUrl(null);
    setImageFileName('');
    setRows([]);
    setSelectedIndexes(new Set());
    setError(null);
    setIsReading(false);
    setIsApplying(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleChooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setRows([]);
    setSelectedIndexes(new Set());
    setIsReading(true);
    try {
      const uploaded = await prepareOcrImage(file);
      setImageDataUrl(uploaded.dataUrl);
      setImageFileName(file.name);
      const response = await apiFetch('/api/recognize-image', {
        method: 'POST',
        body: JSON.stringify({ image: uploaded.dataUrl, mimeType: uploaded.mimeType }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Không thể nhận diện danh sách chuyến.');

      const recognized: OcrTripRow[] = Array.isArray(data.drivers)
        ? data.drivers
            .filter((row: Partial<OcrTripRow>) => row && row.driverName && row.vehicleNumber)
            .map((row: Partial<OcrTripRow>) => ({
              stt: typeof row.stt === 'number' ? row.stt : undefined,
              driverName: String(row.driverName).trim(),
              vehicleNumber: String(row.vehicleNumber).trim(),
              stationVolume: typeof row.stationVolume === 'number' ? row.stationVolume : 0,
              largeTrips: typeof row.largeTrips === 'number' ? row.largeTrips : 0,
              smallTrips: typeof row.smallTrips === 'number' ? row.smallTrips : 0,
              totalKm: typeof row.totalKm === 'number' ? row.totalKm : 0,
              totalTrips: typeof row.totalTrips === 'number' ? row.totalTrips : 0,
              waterVehicles: typeof row.waterVehicles === 'number' ? row.waterVehicles : 0,
            }))
        : [];
      setRows(recognized);
      setSelectedIndexes(new Set(recognized.map((_, index) => index)));
      if (!recognized.length) setError('AI chưa nhận diện được dòng dữ liệu hợp lệ. Hãy dùng ảnh rõ hơn, chụp thẳng và đủ sáng.');
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Không thể đọc ảnh danh sách chuyến.');
    } finally {
      setIsReading(false);
    }
  };

  const toggleAllRows = () => {
    setSelectedIndexes(allRowsSelected ? new Set() : new Set(rows.map((_, index) => index)));
  };

  const toggleIndex = (index: number) => {
    setSelectedIndexes((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApply = async () => {
    if (!selectedCount || isApplying) return;
    setIsApplying(true);
    try {
      const nextRecords = [...records];
      rows.forEach((row, index) => {
        if (!selectedIndexes.has(index)) return;
        const matchIndex = nextRecords.findIndex((record) => findMatchingRecord(row, [record])?.id === record.id);
        if (matchIndex >= 0) nextRecords[matchIndex] = mergeOcrRow(nextRecords[matchIndex], row);
        else nextRecords.push(createRecordFromOcr(row, index, nextRecords.length));
      });
      await onApply(nextRecords, selectedCount, rows.length);
      handleClose();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Không thể đồng bộ dữ liệu chuyến.');
    } finally {
      setIsApplying(false);
    }
  };

  const renderMetrics = (row: OcrTripRow, compact = false) => {
    const metrics = [
      ['KL trạm', row.stationVolume, 'rounded-xl bg-violet-50 text-violet-600', 'text-violet-700'],
      ['Lớn', row.largeTrips, 'rounded-xl bg-amber-50 text-amber-600', 'text-amber-600'],
      ['Nhỏ', row.smallTrips, 'rounded-xl bg-amber-50 text-amber-600', 'text-amber-600'],
      ['Tổng', row.totalTrips, 'rounded-xl bg-rose-50 text-rose-600', 'text-rose-600'],
      ['Tổng KM', row.totalKm, 'rounded-xl bg-emerald-50 text-emerald-600', 'text-emerald-700'],
      ['Xe nước', row.waterVehicles, 'rounded-xl bg-cyan-50 text-cyan-600', 'text-cyan-700'],
    ] as const;
    if (compact) {
      return <div className="grid grid-cols-3 gap-2">{metrics.map(([label, value, compactClass]) => <div key={label} className={`${compactClass} px-2.5 py-2`}><span className="block text-[9px] font-bold uppercase">{label}</span><span className="text-slate-800">{formatValue(value)}</span></div>)}</div>;
    }
    return <>{metrics.map(([label, value, , desktopClass]) => <td key={label} className={`px-3 py-3 text-center font-black ${desktopClass}`}>{formatValue(value)}</td>)}</>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/15 text-cyan-200 sm:h-11 sm:w-11"><ScanLine className="h-5 w-5" /></div><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-300">Trợ lý nhập liệu</p><h3 className="truncate text-base font-black tracking-tight sm:text-lg">Đọc danh sách chuyến từ ảnh</h3></div></div>
          <button type="button" onClick={handleClose} className="shrink-0 rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Đóng"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[300px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="mb-4 sm:mb-5"><p className="text-sm font-black text-slate-900">Quy trình 3 bước</p><div className="mt-3 grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-3 lg:grid-cols-1"><div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 font-black text-white">1</span><span>Chọn ảnh bảng kê chuyến.</span></div><div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-700 font-black text-white">2</span><span>AI đọc đủ các cột số liệu.</span></div><div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-black text-white">3</span><span>Chọn dòng và đồng bộ.</span></div></div></div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChooseFile} className="hidden" />
            <button type="button" disabled={isReading} onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60">{isReading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{isReading ? 'Đang đọc ảnh...' : imageDataUrl ? 'Chọn ảnh khác' : 'Tải ảnh danh sách chuyến'}</button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Giữ độ phân giải cao để đọc cột nhỏ. Nên chụp thẳng, đủ sáng và không cắt mất tiêu đề.</p>
            {imageDataUrl && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:mt-5"><img src={imageDataUrl} alt="Ảnh danh sách chuyến" className="max-h-48 w-full object-contain sm:max-h-52" /><p className="truncate border-t border-slate-100 px-3 py-2 text-[11px] font-medium text-slate-500">{imageFileName}</p></div>}
          </aside>

          <section className="flex min-h-[420px] flex-col p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Kết quả nhận diện</p><h4 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">Duyệt trước khi đồng bộ</h4></div>{rows.length > 0 && <div className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4" />{matchedCount}/{rows.length} khớp · {selectedCount} đã chọn</div>}</div>
            {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
            {rows.length > 0 && !isReading && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3"><p className="flex items-center gap-2 text-xs font-semibold text-cyan-900"><ListChecks className="h-4 w-4" />Chọn dòng muốn đưa vào danh sách dữ liệu.</p><button type="button" onClick={toggleAllRows} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-100">{allRowsSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả dữ liệu'}</button></div>}
            {!rows.length && !isReading && !error && <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center"><FileImage className="h-10 w-10 text-cyan-600" /><p className="mt-4 text-sm font-black text-slate-800">Chưa có ảnh để nhận diện</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Nên chụp rõ tiêu đề và các cột tài xế, số xe, khối lượng, lớn, nhỏ, tổng chuyến, tổng km, xe nước.</p></div>}
            {isReading && <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50/50 p-8 text-center"><Loader2 className="h-10 w-10 animate-spin text-cyan-700" /><p className="mt-4 text-sm font-black text-slate-800">AI đang phân tích bảng chuyến...</p><p className="mt-1 text-xs text-slate-500">Quá trình này có thể mất vài giây.</p></div>}

            {rows.length > 0 && !isReading && <>
              <div className="hidden min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 md:block"><table className="w-full min-w-[820px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-[10px] font-black uppercase tracking-wider text-white"><tr><th className="w-12 px-3 py-3 text-center">Chọn</th><th className="px-3 py-3">Tài xế / số xe</th><th className="px-3 py-3 text-center">KL trạm</th><th className="px-3 py-3 text-center">Lớn</th><th className="px-3 py-3 text-center">Nhỏ</th><th className="px-3 py-3 text-center">Tổng chuyến</th><th className="px-3 py-3 text-center">Tổng KM</th><th className="px-3 py-3 text-center">Xe nước</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => { const match = matches[index]; return <tr key={`${row.vehicleNumber}-${index}`} className={selectedIndexes.has(index) ? 'bg-cyan-50/60' : 'bg-white'}><td className="px-3 py-3 text-center"><input type="checkbox" checked={selectedIndexes.has(index)} onChange={() => toggleIndex(index)} className="h-4 w-4 accent-cyan-700" /></td><td className="px-3 py-3"><p className="font-black text-slate-900">{row.driverName}</p><p className="mt-0.5 font-mono text-[11px] font-bold text-slate-500">{row.vehicleNumber}</p><p className={`mt-1 text-[10px] font-bold ${match ? 'text-emerald-600' : 'text-amber-600'}`}>{match ? 'Đã có trong danh sách' : 'Sẽ thêm mới khi đồng bộ'}</p></td>{renderMetrics(row)}</tr>; })}</tbody></table></div>
              <div className="space-y-3 md:hidden">{rows.map((row, index) => { const match = matches[index]; const selected = selectedIndexes.has(index); return <article key={`${row.vehicleNumber}-${index}`} className={`rounded-2xl border p-3 transition ${selected ? 'border-cyan-200 bg-cyan-50/60' : 'border-slate-200 bg-white'}`}><div className="flex items-start gap-3"><input type="checkbox" checked={selected} onChange={() => toggleIndex(index)} className="mt-1 h-5 w-5 shrink-0 accent-cyan-700" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{row.driverName}</p><p className="mt-0.5 font-mono text-xs font-bold text-slate-500">{row.vehicleNumber}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${match ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{match ? 'Đã có' : 'Thêm mới'}</span></div><div className="mt-3 text-center text-xs font-black text-slate-700">{renderMetrics(row, true)}</div></div></div></article>; })}</div>
            </>}

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:mt-5 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-1.5 text-xs leading-5 text-slate-500"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{selectedNewCount > 0 ? `${selectedNewCount} dòng chưa có trong danh sách sẽ được thêm mới.` : 'Các dòng đã chọn sẽ cập nhật số liệu chuyến hiện tại.'}</p><div className="flex w-full gap-2 sm:w-auto"><button type="button" onClick={handleClose} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 sm:flex-none">Hủy</button><button type="button" disabled={!selectedCount || isApplying} onClick={handleApply} className="flex-1 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{isApplying ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 inline h-4 w-4" />}Đồng bộ {selectedCount || ''} dòng</button></div></div>
          </section>
        </div>
      </div>
    </div>
  );
};
